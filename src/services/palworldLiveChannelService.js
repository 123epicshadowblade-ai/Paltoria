import { EmbedBuilder } from 'discord.js';
import { getColor } from '../config/bot.js';
import { logger } from '../utils/logger.js';
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

function buildDashboardEmbed({ leaderboard, pvpEntries }) {
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
            { name: 'Top Levels', value: topLevels },
            { name: 'Top PvP (Kills/Deaths)', value: topPvp },
        )
        .setDescription(`Updates automatically every ~2 minutes • Last updated <t:${Math.floor(Date.now() / 1000)}:R>`);
}

export async function refreshLiveChannels(client) {
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

            const [{ players: leaderboard }, { entries: pvpEntries }] = await Promise.all([
                getCachedPalworldLeaderboard(client),
                getSeasonLeaderboard(client, guild.id, 5),
            ]);

            const embed = buildDashboardEmbed({ leaderboard, pvpEntries });

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

            await setLiveChannelConfig(client, guild.id, config);
        } catch (error) {
            logger.warn(`Failed to refresh Palworld live channel for guild ${guild.id}: ${error.message}`);
        }
    }
}
