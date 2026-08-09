import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getSeasonLeaderboard } from '../../../services/pvpService.js';
import { buildPvpLeaderboardEmbed } from './pvpEmbed.js';

export default {
    async execute(interaction, config, client) {
        const { seasonLabel, entries } = await getSeasonLeaderboard(client, interaction.guildId, 20);
        const embed = buildPvpLeaderboardEmbed(interaction.guild.name, seasonLabel, entries);

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    },
};
