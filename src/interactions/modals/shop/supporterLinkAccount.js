import { MessageFlags } from 'discord.js';
import { linkAccount, startSupporterPurchase } from '../../../services/vipService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const supporterLinkAccountHandler = {
    name: 'supporter_link_account',
    async execute(interaction, client, args) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) return;

            const itemId = args[0];
            const guildId = interaction.guildId;
            const userId = interaction.user.id;
            const steamId = interaction.fields.getTextInputValue('steam_id').trim();
            const email = interaction.fields.getTextInputValue('email').trim();

            const account = await linkAccount(client, guildId, userId, { steamId, email });
            const embed = await startSupporterPurchase(client, { itemId, guildId, userId, account });
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'modal', customId: interaction.customId });
        }
    },
};

export default [supporterLinkAccountHandler];
