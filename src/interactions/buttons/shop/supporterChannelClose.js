import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { cancelPendingDeletion } from '../../../services/supporterChannelService.js';

const supporterChannelCloseHandler = {
    name: 'supporter_channel_close',
    async execute(interaction, client) {
        try {
            const channel = interaction.channel;
            const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
            const isBuyer = channel.permissionOverwrites.cache.has(interaction.user.id);

            if (!isStaff && !isBuyer) {
                await InteractionHelper.safeReply(interaction, {
                    content: "You don't have permission to close this channel.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await InteractionHelper.safeReply(interaction, { content: '🔒 Closing this channel in 5 seconds...' });
            await cancelPendingDeletion(client, channel.id);

            setTimeout(() => {
                channel.delete(`Closed by ${interaction.user.tag}`).catch(() => {});
            }, 5000);
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'button', customId: interaction.customId });
        }
    },
};

export default [supporterChannelCloseHandler];
