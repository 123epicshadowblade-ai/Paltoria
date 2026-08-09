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

export async function updatePalworldPresence(client) {
    const rconConfig = client.config?.palworld?.rcon;
    if (!rconConfig?.host || !rconConfig?.port || !rconConfig?.password) {
        return;
    }

    try {
        const players = await getOnlinePlayers(rconConfig);
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
