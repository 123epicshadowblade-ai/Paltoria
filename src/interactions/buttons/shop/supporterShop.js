import { MessageFlags } from 'discord.js';
import { startSupporterPurchase, getLinkedAccount } from '../../../services/vipService.js';
import { deliverToSupporterChannel } from '../../../services/supporterChannelService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';
import { buildLinkAccountModal } from '../../../utils/linkAccountModal.js';

const supporterBuyHandler = {
    name: 'supporter_buy',
    async execute(interaction, client, args) {
        try {
            const itemId = args[0];
            const guildId = interaction.guildId;
            const userId = interaction.user.id;

            const linkedAccount = await getLinkedAccount(client, guildId, userId);
            if (!linkedAccount) {
                const modal = buildLinkAccountModal(null, `supporter_link_account:${itemId}`);
                await interaction.showModal(modal);
                return;
            }

            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) return;

            const embed = await startSupporterPurchase(client, { itemId, guildId, userId, account: linkedAccount });
            await deliverToSupporterChannel(client, interaction, embed);
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'button', customId: interaction.customId });
        }
    },
};

export default [supporterBuyHandler];
