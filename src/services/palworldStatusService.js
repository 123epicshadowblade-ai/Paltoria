import { Rcon } from 'rcon-client';
import { ActivityType } from 'discord.js';
import { logger } from '../utils/logger.js';

export async function getOnlinePlayers(rconConfig) {
    const rcon = await Rcon.connect({
        host: rconConfig.host,
        port: rconConfig.port,
        password: rconConfig.password,
        timeout: 5000,
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

export async function updatePalworldPresence(client) {
    const rconConfig = client.config?.palworld?.rcon;
    if (!rconConfig?.host || !rconConfig?.port || !rconConfig?.password) {
        return;
    }

    try {
        const players = await getOnlinePlayers(rconConfig);
        await updatePlayerUidCache(client, players);
        const count = players.length;
        const max = rconConfig.maxPlayers;
        const state = max ? `${count}/${max} players online` : `${count} players online`;

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
