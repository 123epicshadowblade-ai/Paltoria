import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getSeasonLeaderboard } from '../../../services/pvpService.js';
import { buildPvpLeaderboardEmbed, buildPvpPlayerResultEmbed } from './pvpEmbed.js';

export default {
    async execute(interaction, config, client) {
        const playerId = interaction.options.getString('player');

        if (playerId) {
            const { seasonLabel, entries } = await getSeasonLeaderboard(client, interaction.guildId, 1000);
            const rank = entries.findIndex(e => e.userId === playerId);

            if (rank === -1) {
                await InteractionHelper.safeEditReply(interaction, {
                    content: "That player hasn't logged any PvP activity this season.",
                });
                return;
            }

            const embed = buildPvpPlayerResultEmbed(interaction.guild.name, seasonLabel, entries[rank], rank + 1, entries.length);
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            return;
        }

        const { seasonLabel, entries } = await getSeasonLeaderboard(client, interaction.guildId, 20);
        const embed = buildPvpLeaderboardEmbed(interaction.guild.name, seasonLabel, entries);

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    },
};
