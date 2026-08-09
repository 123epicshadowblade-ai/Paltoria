import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { startSupporterPurchase, getLinkedAccount } from '../../../services/vipService.js';
import { deliverToSupporterChannel } from '../../../services/supporterChannelService.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const supporterBuyHandler = {
    name: 'supporter_buy',
    async execute(interaction, client, args) {
        try {
            const itemId = args[0];
            const guildId = interaction.guildId;
            const userId = interaction.user.id;

            const linkedAccount = await getLinkedAccount(client, guildId, userId);
            if (!linkedAccount) {
                const modal = new ModalBuilder()
                    .setCustomId(`supporter_link_account:${itemId}`)
                    .setTitle('Link Your Account');

                const steamIdInput = new TextInputBuilder()
                    .setCustomId('steam_id')
                    .setLabel('SteamID64 (find yours at steamid.io)')
                    .setPlaceholder('7656119xxxxxxxxxx')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(17)
                    .setMaxLength(17);

                const emailInput = new TextInputBuilder()
                    .setCustomId('email')
                    .setLabel('Email you\'ll pay with on Ko-fi')
                    .setPlaceholder('you@example.com')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(steamIdInput),
                    new ActionRowBuilder().addComponents(emailInput),
                );
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
