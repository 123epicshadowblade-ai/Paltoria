import { EmbedBuilder } from 'discord.js';
import { getColor } from '../config/bot.js';
import { logger } from '../utils/logger.js';

const PENDING_POLLS_KEY = 'cache:polls:pending';

async function readPendingPolls(client) {
    return (await client.db.get(PENDING_POLLS_KEY, [])) || [];
}

async function writePendingPolls(client, entries) {
    await client.db.set(PENDING_POLLS_KEY, entries, null);
}

/**
 * Tracked persistently (not just in-memory) so a bot restart between poll
 * creation and expiry doesn't leave the poll silently un-announced -- the
 * cron sweep in announceExpiredPolls picks it back up on the next tick.
 */
export async function trackPendingPoll(client, entry) {
    const entries = await readPendingPolls(client);
    entries.push(entry);
    await writePendingPolls(client, entries);
}

function buildPollResultEmbed(poll, questionText) {
    const answers = [...poll.answers.values()].sort((a, b) => b.voteCount - a.voteCount);
    const totalVotes = answers.reduce((sum, a) => sum + a.voteCount, 0);
    const topCount = answers[0]?.voteCount ?? 0;

    const lines = answers.map(a => {
        const isWinner = topCount > 0 && a.voteCount === topCount;
        const emojiPrefix = a.emoji ? `${a.emoji} ` : '';
        return `${isWinner ? '🏆' : '▫️'} ${emojiPrefix}${a.text} — **${a.voteCount}** vote${a.voteCount === 1 ? '' : 's'}`;
    }).join('\n');

    // Built via the EmbedBuilder(data) constructor rather than chained
    // setters -- those are patched app-wide (src/utils/embeds.js) to strip
    // emoji from every embed in the bot. The raw data object skips that patch.
    return new EmbedBuilder({
        title: '📊 Poll Results',
        description: `**${questionText}**\n\n${lines || '_No votes were cast._'}`,
        color: getColor('primary'),
        footer: { text: `${totalVotes} total vote${totalVotes === 1 ? '' : 's'}` },
    });
}

/**
 * Cron-driven safety net: for every poll we created that's past its expiry
 * (plus a small buffer for Discord's own closing), finalize it and post a
 * results embed in the same channel, then stop tracking it.
 */
export async function announceExpiredPolls(client) {
    const entries = await readPendingPolls(client);
    if (entries.length === 0) return;

    const now = Date.now();
    const stillPending = [];

    for (const entry of entries) {
        if (entry.expiresAt > now) {
            stillPending.push(entry);
            continue;
        }

        try {
            const guild = client.guilds.cache.get(entry.guildId);
            const channel = guild ? await guild.channels.fetch(entry.channelId).catch(() => null) : null;
            if (!channel) {
                logger.warn(`Poll announcement skipped: channel ${entry.channelId} no longer exists.`);
                continue;
            }

            let message = await channel.messages.fetch(entry.messageId).catch(() => null);
            if (!message?.poll) {
                logger.warn(`Poll announcement skipped: message ${entry.messageId} no longer has poll data.`);
                continue;
            }

            if (!message.poll.resultsFinalized) {
                message = await message.poll.end().catch(() => message);
            }

            const embed = buildPollResultEmbed(message.poll, entry.question);
            await channel.send({ embeds: [embed], reply: { messageReference: entry.messageId } })
                .catch(() => channel.send({ embeds: [embed] }));
        } catch (error) {
            logger.warn(`Failed to announce results for poll ${entry.messageId}: ${error.message}`);
        }
    }

    if (stillPending.length !== entries.length) {
        await writePendingPolls(client, stillPending);
    }
}
