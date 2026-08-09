import { createError, ErrorTypes } from '../utils/errorHandler.js';

const POINTS = {
    kill: 3,
    death: -1,
    bounty: 15,
};

// Streak thresholds checked in descending order; each is awarded once per
// time the streak crosses upward into it (reset when the player dies).
const STREAK_BONUSES = [
    { at: 15, points: 50 },
    { at: 10, points: 25 },
    { at: 5, points: 10 },
];

const DEFAULT_PLAYER = () => ({
    kills: 0,
    deaths: 0,
    bounties: 0,
    streak: 0,
    bestStreak: 0,
    points: 0,
    lastStreakBonusAt: 0,
    name: null,
});

// Player identity is either a Discord snowflake (manual /pvp log-kill,
// rendered as a mention) or "steam:<steamid64>" (automatic in-game kill
// tracking, rendered with the stored in-game name since there's no
// guaranteed Discord account behind it).
export function isSteamIdentity(id) {
    return typeof id === 'string' && id.startsWith('steam:');
}

export function displayNameFor(entry) {
    if (isSteamIdentity(entry.userId)) {
        return entry.name || 'Unknown Player';
    }
    return `<@${entry.userId}>`;
}

function seasonKey(guildId) {
    return `cache:pvp:season:${guildId}`;
}

function archiveKey(guildId, seasonLabel) {
    return `cache:pvp:archive:${guildId}:${seasonLabel}`;
}

function currentSeasonLabel(date = new Date()) {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

async function readSeason(client, guildId) {
    const data = await client.db.get(seasonKey(guildId), null);
    if (data) return data;
    return { seasonLabel: currentSeasonLabel(), startedAt: Date.now(), players: {} };
}

async function writeSeason(client, guildId, season) {
    await client.db.set(seasonKey(guildId), season, null);
}

function applyStreakBonus(player) {
    for (const tier of STREAK_BONUSES) {
        if (player.streak >= tier.at && player.lastStreakBonusAt < tier.at) {
            player.points += tier.points;
            player.lastStreakBonusAt = tier.at;
            return tier;
        }
    }
    return null;
}

export async function recordKill(client, guildId, { killerId, victimId, killerName = null, victimName = null }) {
    if (killerId === victimId) {
        throw createError(
            'Killer and victim are the same user',
            ErrorTypes.VALIDATION,
            "A player can't kill themselves for PvP points.",
            { killerId, victimId },
        );
    }

    const season = await readSeason(client, guildId);
    const killer = season.players[killerId] || DEFAULT_PLAYER();
    const victim = season.players[victimId] || DEFAULT_PLAYER();

    if (killerName) killer.name = killerName;
    if (victimName) victim.name = victimName;

    killer.kills += 1;
    killer.points += POINTS.kill;
    killer.streak += 1;
    killer.bestStreak = Math.max(killer.bestStreak, killer.streak);
    const bonus = applyStreakBonus(killer);

    victim.deaths += 1;
    victim.points += POINTS.death;
    victim.streak = 0;
    victim.lastStreakBonusAt = 0;

    season.players[killerId] = killer;
    season.players[victimId] = victim;
    await writeSeason(client, guildId, season);

    return { killer, victim, streakBonus: bonus };
}

export async function recordBounty(client, guildId, userId) {
    const season = await readSeason(client, guildId);
    const player = season.players[userId] || DEFAULT_PLAYER();
    player.bounties += 1;
    player.points += POINTS.bounty;
    season.players[userId] = player;
    await writeSeason(client, guildId, season);
    return player;
}

export async function getSeasonLeaderboard(client, guildId, limit = 20) {
    const season = await readSeason(client, guildId);
    const entries = Object.entries(season.players)
        .map(([userId, p]) => ({
            userId,
            ...p,
            kd: p.deaths > 0 ? p.kills / p.deaths : p.kills,
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, limit);

    return { seasonLabel: season.seasonLabel, entries };
}

export async function resetSeason(client, guildId) {
    const season = await readSeason(client, guildId);
    await client.db.set(archiveKey(guildId, season.seasonLabel), season, null);

    const fresh = { seasonLabel: currentSeasonLabel(), startedAt: Date.now(), players: {} };
    await writeSeason(client, guildId, fresh);

    return season;
}

export function computeAwards(entries) {
    if (entries.length === 0) return null;

    const champion = entries[0];
    const killstreakKing = [...entries].sort((a, b) => b.bestStreak - a.bestStreak)[0];
    const bountyHunter = [...entries].sort((a, b) => b.bounties - a.bounties)[0];

    return { champion, killstreakKing, bountyHunter };
}
