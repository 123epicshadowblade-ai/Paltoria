import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { startSupporterPurchase, getLinkedSteamId } from '../../../services/vipService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const supporterBuyHandler = {
    name: 'supporter_buy',
    async execute(interaction, client, args) {
        try {
            const itemId = args[0];
            const guildId = interaction.guildId;
            const userId = interaction.user.id;

            const linkedSteamId = await getLinkedSteamId(client, guildId, userId);
            if (!linkedSteamId) {
                const modal = new ModalBuilder()
                    .setCustomId(`supporter_link_steam:${itemId}`)
                    .setTitle('Link Your SteamID64');

                const steamIdInput = new TextInputBuilder()
                    .setCustomId('steam_id')
                    .setLabel('SteamID64 (find yours at steamid.io)')
                    .setPlaceholder('7656119xxxxxxxxxx')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(17)
                    .setMaxLength(17);

                modal.addComponents(new ActionRowBuilder().addComponents(steamIdInput));
                await interaction.showModal(modal);
                return;
            }

            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) return;

            const embed = await startSupporterPurchase(client, { itemId, guildId, userId, steamId: linkedSteamId });
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'button', customId: interaction.customId });
        }
    },
};

export default [supporterBuyHandler];
