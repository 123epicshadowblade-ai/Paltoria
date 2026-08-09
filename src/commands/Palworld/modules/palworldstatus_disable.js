import { successEmbed } from '../../../utils/embeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getLiveChannelConfig, clearLiveChannelConfig } from '../../../services/palworldLiveChannelService.js';
import { TitanBotError, ErrorTypes } from '../../../utils/errorHandler.js';

export default {
    async execute(interaction, config, client) {
        const existing = await getLiveChannelConfig(client, interaction.guildId);
        if (!existing?.channelId) {
            throw new TitanBotError(
                'No Palworld status channel configured',
                ErrorTypes.VALIDATION,
                'There is no Palworld status channel set up for this server.',
            );
        }

        await clearLiveChannelConfig(client, interaction.guildId);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(
                'Palworld Status Updates Stopped',
                `<#${existing.channelId}> will no longer be updated. The channel itself was not deleted.`,
            )],
        });
    },
};
