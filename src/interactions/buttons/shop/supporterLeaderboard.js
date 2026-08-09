import { EmbedBuilder } from 'discord.js';
import { getSupporterLeaderboard } from '../../../services/vipService.js';
import { getColor } from '../../../config/bot.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

const supporterLeaderboardHandler = {
    name: 'supporter_leaderboard',
    async execute(interaction, client) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const top = await getSupporterLeaderboard(client, interaction.guildId, 10);

            const description = top.length > 0
                ? top.map((entry, i) => {
                    const rank = RANK_EMOJI[i] || `**#${i + 1}**`;
                    const purchases = entry.count === 1 ? '1 purchase' : `${entry.count} purchases`;
                    return `${rank} <@${entry.userId}> — **$${entry.total.toLocaleString()}** (${purchases})`;
                }).join('\n')
                : 'No Server Supporter purchases yet — be the first!';

            const embed = new EmbedBuilder()
                .setTitle('🏆 Top Server Supporters')
                .setColor(getColor('primary'))
                .setDescription(description);

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'button', customId: interaction.customId });
        }
    },
};

export default [supporterLeaderboardHandler];
