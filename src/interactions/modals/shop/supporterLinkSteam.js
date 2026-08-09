import { MessageFlags } from 'discord.js';
import { linkSteamId, startSupporterPurchase } from '../../../services/vipService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const supporterLinkSteamHandler = {
    name: 'supporter_link_steam',
    async execute(interaction, client, args) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) return;

            const itemId = args[0];
            const guildId = interaction.guildId;
            const userId = interaction.user.id;
            const steamIdInput = interaction.fields.getTextInputValue('steam_id').trim();

            const steamId = await linkSteamId(client, guildId, userId, steamIdInput);
            const embed = await startSupporterPurchase(client, { itemId, guildId, userId, steamId });
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'modal', customId: interaction.customId });
        }
    },
};

export default [supporterLinkSteamHandler];
