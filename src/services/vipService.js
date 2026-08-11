import crypto from 'crypto';
import { getGuildConfig } from './config/guildConfig.js';
import { logger } from '../utils/logger.js';
import { infoEmbed } from '../utils/embeds.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';
import { getItemById } from '../config/shop/items.js';
import { getPlayerUidCache } from './palworldStatusService.js';

const CLAIM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CLAIM_CODE_LENGTH = 8;
const STEAMID64_PATTERN = /^7656119\d{10}$/;
// Palworld's own RCON ShowPlayers format -- the only identifier Xbox/PS5
// players have, since they have no SteamID at all.
const PLAYER_UID_PATTERN = /^[0-9A-Fa-f]{32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function isValidPlayerUid(id) {
    return typeof id === 'string' && PLAYER_UID_PATTERN.test(id);
}

export function isValidEmail(email) {
    return typeof email === 'string' && EMAIL_PATTERN.test(email);
}

export async function getLinkedAccount(client, guildId, userId) {
    return client.db.get(`account:link:${guildId}:${userId}`, null);
}

/**
 * Resolves whatever the player typed into a stable identifier:
 *  - a real SteamID64 (Steam players), used as-is
 *  - a raw 32-char Player UID (Xbox/PS5 players who got it from staff),
 *    used as-is
 *  - anything else is treated as their in-game character name and
 *    resolved against the UID cache the bot builds from RCON every ~2
 *    minutes -- the only self-service option for console players, who
 *    have no way to see their own UID otherwise.
 */
async function resolvePlayerIdentifier(client, rawInput) {
    if (isValidSteamId64(rawInput)) {
        return { steamId: rawInput, playerUid: null };
    }
    if (isValidPlayerUid(rawInput)) {
        return { steamId: null, playerUid: rawInput.toUpperCase() };
    }

    const uidCache = await getPlayerUidCache(client);
    const nameQuery = rawInput.trim().toLowerCase();
    const match = Object.entries(uidCache).find(([, entry]) => entry.name?.toLowerCase() === nameQuery);

    if (!match) {
        throw createError(
            'Could not resolve player identifier',
            ErrorTypes.VALIDATION,
            "That doesn't look like a valid SteamID64, and I couldn't match it to a character name that's been online recently. " +
            'If you play on Steam, use your SteamID64 (find it at https://steamid.io). ' +
            "If you play on Xbox/PS5, type your exact in-game character name after joining the server at least once, or ask staff for your Player UID.",
            { rawInput },
        );
    }

    const [playerUid, entry] = match;
    return { steamId: entry.steamid && isValidSteamId64(entry.steamid) ? entry.steamid : null, playerUid };
}

export async function linkAccount(client, guildId, userId, { steamId: rawInput, email }) {
    if (!isValidEmail(email)) {
        throw createError(
            'Invalid email',
            ErrorTypes.VALIDATION,
            "That doesn't look like a valid email address. Use the same email you'll pay with on Ko-fi so your purchase is matched automatically.",
            { email },
        );
    }

    const { steamId, playerUid } = await resolvePlayerIdentifier(client, rawInput);
    const normalizedEmail = email.trim().toLowerCase();
    // steamId stays the primary identifier field for backward compatibility
    // with everywhere else that reads account.steamId; console players who
    // resolved to a UID (no real SteamID) get that UID stored here instead.
    const account = { steamId: steamId || playerUid, playerUid, email: normalizedEmail };
    await client.db.set(`account:link:${guildId}:${userId}`, account, null);
    return account;
}

export async function createVipClaim(client, { guildId, userId, itemId, amount, currency, steamId, email }) {
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
        {
            guildId,
            userId,
            itemId,
            amount,
            currency,
            steamId: steamId || null,
            email: email ? email.trim().toLowerCase() : null,
            createdAt: Date.now(),
        },
        claimExpiryMinutes * 60,
    );

    return { code, expiresInMinutes: claimExpiryMinutes };
}

/**
 * Shared by /buy and the shop buttons: validates config, creates a claim,
 * and returns the embed instructing the buyer how to complete payment.
 * Requires a linked account (SteamID64 + email) so payment can be matched
 * automatically by email, and so the reward can queue a Palworld delivery.
 */
export async function startSupporterPurchase(client, { itemId, guildId, userId, account }) {
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

    const linkedAccount = account || await getLinkedAccount(client, guildId, userId);
    if (!linkedAccount) {
        throw createError(
            'Account not linked',
            ErrorTypes.VALIDATION,
            'Link your Palworld account and email first so your purchase can be matched automatically.',
            { itemId },
        );
    }

    const { code, expiresInMinutes } = await createVipClaim(client, {
        guildId,
        userId,
        itemId: item.id,
        amount: item.price,
        currency: item.currency || 'USD',
        steamId: linkedAccount.steamId,
        email: linkedAccount.email,
    });

    const identifierLabel = linkedAccount.playerUid && !isValidSteamId64(linkedAccount.steamId) ? 'Player UID' : 'SteamID';

    return infoEmbed(
        '⭐ Complete Your Server Supporter Purchase',
        `You're purchasing **${item.name}** (**$${item.price} ${item.currency || 'USD'}**) via Ko-fi.\n\n` +
        `1. Go to ${kofiConfig.pageUrl}\n` +
        `2. Pay with **${linkedAccount.email}** — **at least $${item.price}**\n\n` +
        `That's it. Your Server Supporter role and Palworld reward (${identifierLabel} \`${linkedAccount.steamId}\`) are granted automatically once the payment lands, matched by that email — no code needed.\n\n` +
        `If you have to pay with a *different* email than the one you linked, paste this backup code in the Ko-fi message field instead:\n\`\`\`${code}\`\`\`\n` +
        `(Backup code expires in **${expiresInMinutes} minutes**; the email match doesn't expire.)`,
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

async function recordSupporterSpend(client, guildId, userId, amount) {
    const key = `cache:supporter:totals:${guildId}`;
    const totals = (await client.db.get(key, {})) || {};
    const existing = totals[userId] || { total: 0, count: 0 };
    totals[userId] = { total: existing.total + amount, count: existing.count + 1 };
    await client.db.set(key, totals, null);
}

export async function getSupporterLeaderboard(client, guildId, limit = 10) {
    const totals = (await client.db.get(`cache:supporter:totals:${guildId}`, {})) || {};
    return Object.entries(totals)
        .map(([userId, data]) => ({ userId, total: data.total, count: data.count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);
}

async function findClaimByEmail(client, email) {
    if (!email) return null;
    const normalizedEmail = email.trim().toLowerCase();
    const keys = await client.db.list('temp:vip:claim:');
    for (const key of keys) {
        const claim = await client.db.get(key, null);
        if (claim && claim.email === normalizedEmail) {
            return { key, claim };
        }
    }
    return null;
}

/**
 * Processes a verified Ko-fi webhook payload: matches it to a pending claim
 * (by payer email first, falling back to a claim code in the message),
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

    let claimKey = null;
    let claim = null;
    let matchedBy = null;

    const emailMatch = await findClaimByEmail(client, payload.email);
    if (emailMatch) {
        claimKey = emailMatch.key;
        claim = emailMatch.claim;
        matchedBy = 'email';
    } else {
        const code = extractClaimCode(payload.message);
        if (code) {
            claimKey = `temp:vip:claim:${code}`;
            claim = await client.db.get(claimKey, null);
            matchedBy = 'code';
        }
    }

    if (!claim) {
        logger.warn(`Ko-fi payment ${transactionId} matched no pending claim by email (${payload.email || 'none'}) or code.`);
        return { status: 'unmatched', reason: 'No matching linked email or claim code' };
    }

    const paidAmount = Number.parseFloat(payload.amount);
    if (!Number.isFinite(paidAmount) || paidAmount < claim.amount) {
        logger.warn(`Ko-fi payment ${transactionId} matched by ${matchedBy} paid ${payload.amount}, expected at least ${claim.amount}.`);
        return { status: 'underpaid', claim, paidAmount };
    }

    const guild = client.guilds.cache.get(claim.guildId);
    if (!guild) {
        logger.error(`Ko-fi payment ${transactionId}: bot is not in guild ${claim.guildId} for claim matched by ${matchedBy}.`);
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
        await member.roles.add(supporterRoleId, `Ko-fi Server Supporter purchase (transaction ${transactionId}, matched by ${matchedBy})`);

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
            logger.warn(`Ko-fi payment ${transactionId}: claim had no linked SteamID, no Palworld reward queued.`);
        }

        await recordSupporterSpend(client, claim.guildId, claim.userId, paidAmount);

        await client.db.set(txnKey, { matchedBy, guildId: claim.guildId, userId: claim.userId, itemId: claim.itemId }, null);
        await client.db.delete(claimKey);

        try {
            await member.send(`Thanks for your support! Your Server Supporter role in **${guild.name}** has been granted, and your Palworld reward is queued.`);
        } catch {
            // DMs closed; not a failure of the purchase itself.
        }

        return { status: 'fulfilled', guildId: claim.guildId, userId: claim.userId, roleId: supporterRoleId, matchedBy };
    } catch (error) {
        logger.error(`Ko-fi payment ${transactionId}: failed to grant Server Supporter role:`, error);
        return { status: 'error', reason: error.message, claim };
    }
}
