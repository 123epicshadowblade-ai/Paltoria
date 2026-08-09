import { EmbedBuilder } from 'discord.js';
import { getCachedPalworldLeaderboard } from '../../../services/palworldStatsService.js';
import { getColor } from '../../../config/bot.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

const palworldLeaderboardHandler = {
    name: 'palworld_leaderboard',
    async execute(interaction, client) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const { players, updatedAt } = await getCachedPalworldLeaderboard(client);

            const description = players.length > 0
                ? players.map((p, i) => {
                    const rank = RANK_EMOJI[i] || `**#${i + 1}**`;
                    return `${rank} **${p.name}** — Level ${p.level} (${(p.exp || 0).toLocaleString()} EXP)`;
                }).join('\n')
                : 'No Palworld stats available yet.';

            const embed = new EmbedBuilder()
                .setTitle('🎮 Palworld Level Leaderboard')
                .setColor(getColor('primary'))
                .setDescription(description)
                .setFooter({ text: updatedAt ? `Last updated: ${updatedAt}` : 'Not yet updated' });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'button', customId: interaction.customId });
        }
    },
};

export default [palworldLeaderboardHandler];
