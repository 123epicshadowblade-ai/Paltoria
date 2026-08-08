import crypto from 'crypto';
import { getGuildConfig } from './config/guildConfig.js';
import { logger } from '../utils/logger.js';

const CLAIM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CLAIM_CODE_LENGTH = 8;

function generateClaimCode() {
    const bytes = crypto.randomBytes(CLAIM_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CLAIM_CODE_LENGTH; i++) {
        code += CLAIM_CODE_ALPHABET[bytes[i] % CLAIM_CODE_ALPHABET.length];
    }
    return code;
}

export async function createVipClaim(client, { guildId, userId, itemId, amount, currency }) {
    if (!client.db || typeof client.db.set !== 'function') {
        throw new Error('Database unavailable');
    }

    const claimExpiryMinutes = client.config?.kofi?.claimExpiryMinutes || 60;
    let code;
    // Guard against the astronomically unlikely case of a live collision.
    for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateClaimCode();
        const existing = await client.db.get(`temp:vip:claim:${candidate}`, null);
        if (!existing) {
            code = candidate;
            break;
        }
    }
    if (!code) {
        throw new Error('Could not generate a unique claim code');
    }

    await client.db.set(
        `temp:vip:claim:${code}`,
        { guildId, userId, itemId, amount, currency, createdAt: Date.now() },
        claimExpiryMinutes * 60,
    );

    return { code, expiresInMinutes: claimExpiryMinutes };
}

function extractClaimCode(message) {
    if (typeof message !== 'string') return null;
    const match = message.toUpperCase().match(/[A-Z2-9]{8}/);
    return match ? match[0] : null;
}

/**
 * Processes a verified Ko-fi webhook payload: matches it to a pending claim,
 * grants the configured VIP role, and records the transaction so retries
 * (Ko-fi resends on non-200 responses) cannot grant the role twice.
 */
export async function fulfillKofiPayment(client, payload) {
    const transactionId = payload.kofi_transaction_id;
    if (!transactionId) {
        return { status: 'invalid', reason: 'Missing kofi_transaction_id' };
    }

    const txnKey = `cache:vip:txn:${transactionId}`;
    const alreadyProcessed = await client.db.get(txnKey, null);
    if (alreadyProcessed) {
        return { status: 'duplicate', ...alreadyProcessed };
    }

    const code = extractClaimCode(payload.message);
    if (!code) {
        logger.warn(`Ko-fi payment ${transactionId} had no recognizable VIP claim code in its message.`);
        return { status: 'unmatched', reason: 'No claim code found in message' };
    }

    const claimKey = `temp:vip:claim:${code}`;
    const claim = await client.db.get(claimKey, null);
    if (!claim) {
        logger.warn(`Ko-fi payment ${transactionId} referenced claim code ${code}, which was not found or expired.`);
        return { status: 'unmatched', reason: 'Claim code not found or expired', code };
    }

    const paidAmount = Number.parseFloat(payload.amount);
    if (!Number.isFinite(paidAmount) || paidAmount < claim.amount) {
        logger.warn(`Ko-fi payment ${transactionId} for code ${code} paid ${payload.amount}, expected at least ${claim.amount}.`);
        return { status: 'underpaid', claim, paidAmount };
    }

    const guild = client.guilds.cache.get(claim.guildId);
    if (!guild) {
        logger.error(`Ko-fi payment ${transactionId}: bot is not in guild ${claim.guildId} for claim ${code}.`);
        return { status: 'error', reason: 'Guild not found', claim };
    }

    const guildConfig = await getGuildConfig(client, claim.guildId);
    const vipRoleId = guildConfig.vipRoleId;
    if (!vipRoleId) {
        logger.error(`Ko-fi payment ${transactionId}: no vipRoleId configured for guild ${claim.guildId}.`);
        return { status: 'error', reason: 'VIP role not configured', claim };
    }

    try {
        const member = await guild.members.fetch(claim.userId);
        await member.roles.add(vipRoleId, `Ko-fi VIP purchase (transaction ${transactionId})`);

        await client.db.set(txnKey, { code, guildId: claim.guildId, userId: claim.userId, itemId: claim.itemId }, null);
        await client.db.delete(claimKey);

        try {
            await member.send(`Thanks for your support! Your VIP role in **${guild.name}** has been granted.`);
        } catch {
            // DMs closed; not a failure of the purchase itself.
        }

        return { status: 'fulfilled', guildId: claim.guildId, userId: claim.userId, roleId: vipRoleId };
    } catch (error) {
        logger.error(`Ko-fi payment ${transactionId}: failed to grant VIP role for claim ${code}:`, error);
        return { status: 'error', reason: error.message, claim };
    }
}
