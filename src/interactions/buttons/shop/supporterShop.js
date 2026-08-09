import { MessageFlags } from 'discord.js';
import { startSupporterPurchase } from '../../../services/vipService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const supporterBuyHandler = {
    name: 'supporter_buy',
    async execute(interaction, client, args) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) return;

            const itemId = args[0];
            const embed = await startSupporterPurchase(client, {
                itemId,
                guildId: interaction.guildId,
                userId: interaction.user.id,
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'button', customId: interaction.customId });
        }
    },
};

export default [supporterBuyHandler];
