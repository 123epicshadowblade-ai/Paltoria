import { EmbedBuilder } from 'discord.js';
import { getColor } from '../../../config/bot.js';
import { displayNameFor } from '../../../services/pvpService.js';

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

function rankLabel(index) {
    return RANK_EMOJI[index] || `**#${index + 1}**`;
}

// Built via the EmbedBuilder(data) constructor rather than the
// .setTitle()/.setDescription()/.addFields() chain: those setters are
// patched app-wide (src/utils/embeds.js) to strip emoji from every embed
// in the bot. Passing the raw data object skips that patch, so this is the
// one embed in Paltoria that keeps its icons.
export function buildPvpLeaderboardEmbed(guildName, seasonLabel, entries) {
    const fields = entries.length === 0
        ? [{ name: 'No PvP activity yet', value: 'Kills and bounties logged by staff will show up here.' }]
        : entries.map((entry, index) => ({
            name: `${rankLabel(index)} #${index + 1} • ${displayNameFor(entry)}`,
            value:
                `⭐ ${entry.points} PTS ・ 🔪 ${entry.kills} K ・ 💀 ${entry.deaths} D ・ 📊 ${entry.kd.toFixed(2)} K/D\n` +
                `🔥 ${entry.bestStreak} Best Streak ・ 💰 ${entry.bounties} Bounties`,
        }));

    fields.push(
        {
            name: '📊 Point System',
            value: '🔪 Kill +3 ・ 💀 Death -1\n💰 Bounty +15\n🔥 5 Kill Streak +10\n🔥 10 Kill Streak +25\n🔥 15+ Kill Streak +50',
        },
        {
            name: '🏆 Monthly Awards',
            value: '🥇 PvP Champion — #1 Overall\n🔥 Killstreak King — Highest Streak\n💰 Bounty Hunter — Most Bounties',
        },
    );

    return new EmbedBuilder({
        title: `⚔️ ${guildName} • PVP Leaderboard`,
        description: `🏆 Monthly Season — ${seasonLabel}`,
        color: getColor('primary'),
        fields,
    });
}
