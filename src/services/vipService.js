import crypto from 'crypto';
import { getGuildConfig } from './config/guildConfig.js';
import { logger } from '../utils/logger.js';
import { infoEmbed } from '../utils/embeds.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';
import { getItemById } from '../config/shop/items.js';

const CLAIM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CLAIM_CODE_LENGTH = 8;
const STEAMID64_PATTERN = /^7656119\d{10}$/;

function generateClaimCode() {
    const bytes = crypto.randomBytes(CLAIM_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CLAIM_CODE_LENGTH; i++) {
        code += CLAIM_CODE_ALPHABET[bytes[i] % CLAIM_CODE_ALPHABET.length];
    }
    return code;
}

export function isValidSteamId64(steamId) {
    return typeof steamId === 'string' && STEAMID64_PATTERN.test(steamId);
}

export async function getLinkedSteamId(client, guildId, userId) {
    return client.db.get(`steam:link:${guildId}:${userId}`, null);
}

export async function linkSteamId(client, guildId, userId, steamId) {
    if (!isValidSteamId64(steamId)) {
        throw createError(
            'Invalid SteamID64',
            ErrorTypes.VALIDATION,
            "That doesn't look like a valid SteamID64 (17 digits, starting with 7656119). You can find yours at https://steamid.io.",
            { steamId },
        );
    }
    await client.db.set(`steam:link:${guildId}:${userId}`, steamId, null);
    return steamId;
}

export async function createVipClaim(client, { guildId, userId, itemId, amount, currency, steamId }) {
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
        { guildId, userId, itemId, amount, currency, steamId: steamId || null, createdAt: Date.now() },
        claimExpiryMinutes * 60,
    );

    return { code, expiresInMinutes: claimExpiryMinutes };
}

/**
 * Shared by /buy and the shop buttons: validates config, creates a claim,
 * and returns the embed instructing the buyer how to complete payment.
 * Requires a linked SteamID64 so the payment can also queue a Palworld reward.
 */
export async function startSupporterPurchase(client, { itemId, guildId, userId, steamId }) {
    const item = getItemById(itemId);
    if (!item || item.type !== 'real_money') {
        throw createError(
            `Item ${itemId} not found`,
            ErrorTypes.VALIDATION,
            `The item \`${itemId}\` does not exist in the shop.`,
            { itemId },
        );
    }

    const kofiConfig = client.config?.kofi || {};
    if (!kofiConfig.pageUrl) {
        throw createError(
            'Ko-fi not configured',
            ErrorTypes.CONFIGURATION,
            "Server Supporter purchases are not available yet; the server owner hasn't configured Ko-fi.",
            { itemId },
        );
    }

    const guildConfig = await getGuildConfig(client, guildId);
    if (!guildConfig.supporterRoleId) {
        throw createError(
            'Server Supporter role not configured',
            ErrorTypes.CONFIGURATION,
            'The **Server Supporter role** has not been configured by a server administrator yet.',
            { itemId },
        );
    }

    const linkedSteamId = steamId || await getLinkedSteamId(client, guildId, userId);
    if (!linkedSteamId) {
        throw createError(
            'SteamID not linked',
            ErrorTypes.VALIDATION,
            'Link your SteamID64 first so we know where to send your in-game reward.',
            { itemId },
        );
    }

    const { code, expiresInMinutes } = await createVipClaim(client, {
        guildId,
        userId,
        itemId: item.id,
        amount: item.price,
        currency: item.currency || 'USD',
        steamId: linkedSteamId,
    });

    return infoEmbed(
        '⭐ Complete Your Server Supporter Purchase',
        `You're purchasing **${item.name}** (**$${item.price} ${item.currency || 'USD'}**) via Ko-fi.\n\n` +
        `1. Go to ${kofiConfig.pageUrl}\n` +
        `2. Donate **at least $${item.price}**\n` +
        `3. In the message field, paste this claim code exactly:\n\n` +
        `\`\`\`${code}\`\`\`\n` +
        `Your Server Supporter role and Palworld reward (SteamID \`${linkedSteamId}\`) will be granted automatically once the payment is confirmed. This code expires in **${expiresInMinutes} minutes**.`,
    );
}

function extractClaimCode(message) {
    if (typeof message !== 'string') return null;
    const match = message.toUpperCase().match(/[A-Z2-9]{8}/);
    return match ? match[0] : null;
}

const PALWORLD_REWARDS_KEY = 'cache:palworld:reward_queue';

async function readRewardQueue(client) {
    return (await client.db.get(PALWORLD_REWARDS_KEY, [])) || [];
}

async function writeRewardQueue(client, queue) {
    await client.db.set(PALWORLD_REWARDS_KEY, queue, null);
}

async function queuePalworldReward(client, { guildId, userId, steamId, itemId, amount, kofiTransactionId }) {
    const queue = await readRewardQueue(client);
    queue.push({
        id: crypto.randomUUID(),
        guildId,
        userId,
        steamId,
        itemId,
        amount,
        kofiTransactionId,
        createdAt: new Date().toISOString(),
    });
    await writeRewardQueue(client, queue);
}

export async function getPendingPalworldRewards(client) {
    return readRewardQueue(client);
}

export async function ackPalworldRewards(client, ids) {
    const idSet = new Set(ids);
    const queue = await readRewardQueue(client);
    const remaining = queue.filter(reward => !idSet.has(reward.id));
    await writeRewardQueue(client, remaining);
    return queue.length - remaining.length;
}

/**
 * Processes a verified Ko-fi webhook payload: matches it to a pending claim,
 * grants the configured Server Supporter role, queues the Palworld in-game
 * reward, and records the transaction so retries (Ko-fi resends on non-200
 * responses) cannot grant the role or reward twice.
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
        logger.warn(`Ko-fi payment ${transactionId} had no recognizable Server Supporter claim code in its message.`);
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
    const supporterRoleId = guildConfig.supporterRoleId;
    if (!supporterRoleId) {
        logger.error(`Ko-fi payment ${transactionId}: no supporterRoleId configured for guild ${claim.guildId}.`);
        return { status: 'error', reason: 'Server Supporter role not configured', claim };
    }

    try {
        const member = await guild.members.fetch(claim.userId);
        await member.roles.add(supporterRoleId, `Ko-fi Server Supporter purchase (transaction ${transactionId})`);

        if (claim.steamId) {
            await queuePalworldReward(client, {
                guildId: claim.guildId,
                userId: claim.userId,
                steamId: claim.steamId,
                itemId: claim.itemId,
                amount: claim.amount,
                kofiTransactionId: transactionId,
            });
        } else {
            logger.warn(`Ko-fi payment ${transactionId}: claim ${code} had no linked SteamID, no Palworld reward queued.`);
        }

        await client.db.set(txnKey, { code, guildId: claim.guildId, userId: claim.userId, itemId: claim.itemId }, null);
        await client.db.delete(claimKey);

        try {
            await member.send(`Thanks for your support! Your Server Supporter role in **${guild.name}** has been granted, and your Palworld reward is queued.`);
        } catch {
            // DMs closed; not a failure of the purchase itself.
        }

        return { status: 'fulfilled', guildId: claim.guildId, userId: claim.userId, roleId: supporterRoleId };
    } catch (error) {
        logger.error(`Ko-fi payment ${transactionId}: failed to grant Server Supporter role for claim ${code}:`, error);
        return { status: 'error', reason: error.message, claim };
    }
}
