import { EmbedBuilder } from 'discord.js';
import { getColor } from '../config/bot.js';
import { logger } from '../utils/logger.js';
import { getOnlinePlayers } from './palworldStatusService.js';
import { getCachedPalworldLeaderboard } from './palworldStatsService.js';
import { getSeasonLeaderboard, displayNameFor } from './pvpService.js';

function configKey(guildId) {
    return `guild:${guildId}:palworldLiveChannel`;
}

export async function getLiveChannelConfig(client, guildId) {
    return client.db.get(configKey(guildId), null);
}

export async function setLiveChannelConfig(client, guildId, config) {
    await client.db.set(configKey(guildId), config, null);
}

export async function clearLiveChannelConfig(client, guildId) {
    await client.db.delete(configKey(guildId));
}

function buildDashboardEmbed({ players, max, leaderboard, pvpEntries }) {
    const onlineList = players.length > 0
        ? players.map(p => `• ${p.name}`).join('\n')
        : '_No players online_';

    const topLevels = leaderboard.length > 0
        ? leaderboard.slice(0, 5).map((p, i) => `${i + 1}. **${p.name}** — Lv ${p.level} (${(p.exp || 0).toLocaleString()} EXP)`).join('\n')
        : '_No level data yet_';

    const topPvp = pvpEntries.length > 0
        ? pvpEntries.slice(0, 5).map((p, i) =>
            `${i + 1}. ${displayNameFor(p)} — ${p.kills} Kills, ${p.deaths} Deaths (${p.kd.toFixed(2)} KDA)`,
        ).join('\n')
        : '_No PvP activity yet_';

    return new EmbedBuilder()
        .setTitle('Palworld Server Status')
        .setColor(getColor('primary'))
        .addFields(
            { name: `Online Players (${players.length}${max ? `/${max}` : ''})`, value: onlineList },
            { name: 'Top Levels', value: topLevels },
            { name: 'Top PvP (Kills/Deaths)', value: topPvp },
        )
        .setDescription(`Updates automatically every ~2 minutes • Last updated <t:${Math.floor(Date.now() / 1000)}:R>`);
}

export async function refreshLiveChannels(client) {
    const rconConfig = client.config?.palworld?.rcon;
    if (!rconConfig?.host || !rconConfig?.port || !rconConfig?.password) {
        return;
    }

    for (const guild of client.guilds.cache.values()) {
        const config = await getLiveChannelConfig(client, guild.id);
        if (!config?.channelId) continue;

        try {
            const channel = await guild.channels.fetch(config.channelId).catch(() => null);
            if (!channel) {
                logger.warn(`Palworld live channel ${config.channelId} no longer exists in guild ${guild.id}; clearing config.`);
                await clearLiveChannelConfig(client, guild.id);
                continue;
            }

            const [players, { players: leaderboard }, { entries: pvpEntries }] = await Promise.all([
                getOnlinePlayers(rconConfig),
                getCachedPalworldLeaderboard(client),
                getSeasonLeaderboard(client, guild.id, 5),
            ]);

            const embed = buildDashboardEmbed({ players, max: rconConfig.maxPlayers, leaderboard, pvpEntries });

            let dashboardMessage = null;
            if (config.dashboardMessageId) {
                dashboardMessage = await channel.messages.fetch(config.dashboardMessageId).catch(() => null);
            }

            if (dashboardMessage) {
                await dashboardMessage.edit({ embeds: [embed] });
            } else {
                dashboardMessage = await channel.send({ embeds: [embed] });
                await dashboardMessage.pin().catch(() => {});
                config.dashboardMessageId = dashboardMessage.id;
            }

            const previousUids = new Set(config.knownPlayerUids || []);
            const currentUids = new Set(players.map(p => p.playeruid));

            if (config.knownPlayerUids) {
                const joined = players.filter(p => !previousUids.has(p.playeruid));
                const leftCount = [...previousUids].filter(uid => !currentUids.has(uid)).length;

                for (const player of joined) {
                    await channel.send(`🟢 **${player.name}** joined the server`).catch(() => {});
                }
                if (leftCount > 0) {
                    await channel.send(`🔴 ${leftCount} player${leftCount === 1 ? '' : 's'} left the server`).catch(() => {});
                }
            }

            config.knownPlayerUids = [...currentUids];
            await setLiveChannelConfig(client, guild.id, config);
        } catch (error) {
            logger.warn(`Failed to refresh Palworld live channel for guild ${guild.id}: ${error.message}`);
        }
    }
}
