import { Rcon } from 'rcon-client';
import { ActivityType } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getCachedPalworldLeaderboard } from './palworldStatsService.js';

const STATUS_MAX_LENGTH = 128;

// Discord's custom-status "state" field caps at 128 chars. Rather than a
// player count, this shows each online player's level (no names, per
// request) -- trimmed with a "+N more" tail if the full list won't fit.
function buildLevelsOnlyState(onlinePlayers, cachedPlayers) {
    if (onlinePlayers.length === 0) return 'No players online';

    const levelByName = new Map();
    for (const p of cachedPlayers) {
        if (typeof p.name === 'string' && typeof p.level === 'number') {
            levelByName.set(p.name.toLowerCase(), p.level);
        }
    }

    const levels = onlinePlayers
        .map(p => levelByName.get((p.name || '').toLowerCase()))
        .filter(level => typeof level === 'number')
        .sort((a, b) => b - a);

    if (levels.length === 0) return 'No players online';

    const total = levels.length;
    let shown = levels;
    let state = `Levels: ${shown.join(', ')}`;
    while (state.length > STATUS_MAX_LENGTH && shown.length > 0) {
        shown = shown.slice(0, -1);
        const hidden = total - shown.length;
        state = `Levels: ${shown.join(', ')}${hidden > 0 ? ` +${hidden} more` : ''}`;
    }
    return state;
}

export async function getOnlinePlayers(rconConfig) {
    const rcon = await Rcon.connect({
        host: rconConfig.host,
        port: rconConfig.port,
        password: rconConfig.password,
        timeout: 5000,
    });

    // rcon-client re-emits socket errors (e.g. ECONNRESET after the RCON
    // connection times out) as an 'error' event on the Rcon instance. With
    // no listener attached, Node treats that as an uncaught exception and
    // kills the whole process -- this is what actually took the bot down,
    // not the caller's try/catch below (event-emitter errors aren't caught
    // by a surrounding try/catch of an unrelated async call).
    rcon.on('error', (error) => {
        logger.warn(`RCON socket error (non-fatal): ${error.message}`);
    });

    try {
        const response = await rcon.send('ShowPlayers');
        const lines = response.split('\n').map(l => l.trim()).filter(Boolean);
        // First line is the "name,playeruid,steamid" header.
        return lines.slice(1).map(line => {
            const [name, playeruid, steamid] = line.split(',').map(part => part.trim());
            return { name, playeruid, steamid };
        }).filter(p => p.name);
    } finally {
        rcon.end();
    }
}

const UID_CACHE_KEY = 'cache:palworld:uid_map';

// Keyed by the same hex playeruid format Palworld's own RCON reports, so
// the kill tracker (which reads that identical GUID format straight from
// UE4SS) can resolve a killer/victim UID to a SteamID64 + display name
// even after the player has since disconnected.
async function updatePlayerUidCache(client, players) {
    if (!client.db || players.length === 0) return;
    const map = (await client.db.get(UID_CACHE_KEY, {})) || {};
    for (const p of players) {
        if (!p.playeruid) continue;
        map[p.playeruid] = { steamid: p.steamid, name: p.name, lastSeen: Date.now() };
    }
    await client.db.set(UID_CACHE_KEY, map, null);
}

export async function getPlayerUidCache(client) {
    return (await client.db.get(UID_CACHE_KEY, {})) || {};
}

const PRESENCE_OVERRIDE_KEY = 'guild:presenceOverride';

// A manually-set status (e.g. "Balancing") takes priority over the
// automatic "X/Y players online" text and stays in place indefinitely --
// it's never auto-cleared by player count changes, only by an explicit
// /palworld-status set-status clear.
export async function getPresenceOverride(client) {
    return client.db.get(PRESENCE_OVERRIDE_KEY, null);
}

export async function setPresenceOverride(client, text) {
    await client.db.set(PRESENCE_OVERRIDE_KEY, text, null);
}

export async function clearPresenceOverride(client) {
    await client.db.delete(PRESENCE_OVERRIDE_KEY);
}

export async function updatePalworldPresence(client) {
    const override = await getPresenceOverride(client);
    if (override) {
        client.user.setPresence({
            status: 'online',
            activities: [{ name: 'Custom Status', state: override, type: ActivityType.Custom }],
        });
        return;
    }

    const rconConfig = client.config?.palworld?.rcon;
    if (!rconConfig?.host || !rconConfig?.port || !rconConfig?.password) {
        return;
    }

    try {
        const players = await getOnlinePlayers(rconConfig);
        await updatePlayerUidCache(client, players);
        const { players: cachedPlayers } = await getCachedPalworldLeaderboard(client, Infinity);
        const state = buildLevelsOnlyState(players, cachedPlayers);

        client.user.setPresence({
            status: 'online',
            activities: [
                {
                    name: 'Custom Status',
                    state,
                    type: ActivityType.Custom,
                },
            ],
        });
    } catch (error) {
        logger.warn(`Failed to update Palworld player count presence: ${error.message}`);
    }
}
