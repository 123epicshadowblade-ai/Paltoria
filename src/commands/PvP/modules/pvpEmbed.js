import { EmbedBuilder } from 'discord.js';
import { getColor } from '../../../config/bot.js';

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

function rankLabel(index) {
    return RANK_EMOJI[index] || `**#${index + 1}**`;
}

export function buildPvpLeaderboardEmbed(guildName, seasonLabel, entries) {
    const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${guildName} • PVP Leaderboard`)
        .setColor(getColor('primary'))
        .setDescription(`🏆 Monthly Season — ${seasonLabel}`);

    if (entries.length === 0) {
        embed.addFields({ name: 'No PvP activity yet', value: 'Kills and bounties logged by staff will show up here.' });
    } else {
        for (const [index, entry] of entries.entries()) {
            embed.addFields({
                name: `${rankLabel(index)} #${index + 1} • <@${entry.userId}>`,
                value:
                    `⭐ ${entry.points} PTS ・ 🔪 ${entry.kills} K ・ 💀 ${entry.deaths} D ・ 📊 ${entry.kd.toFixed(2)} K/D\n` +
                    `🔥 ${entry.bestStreak} Best Streak ・ 💰 ${entry.bounties} Bounties`,
            });
        }
    }

    embed.addFields(
        {
            name: '📊 Point System',
            value: '🔪 Kill +3 ・ 💀 Death -1\n💰 Bounty +15\n🔥 5 Kill Streak +10\n🔥 10 Kill Streak +25\n🔥 15+ Kill Streak +50',
        },
        {
            name: '🏆 Monthly Awards',
            value: '🥇 PvP Champion — #1 Overall\n🔥 Killstreak King — Highest Streak\n💰 Bounty Hunter — Most Bounties',
        },
    );

    return embed;
}
