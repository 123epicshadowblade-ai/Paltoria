import { SlashCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { startSupporterPurchase, getLinkedSteamId } from '../../services/vipService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy a Server Supporter tier from the shop')
        .addStringOption(option =>
            option
                .setName('item_id')
                .setDescription('ID of the Server Supporter tier to buy')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const itemId = interaction.options.getString("item_id").toLowerCase();

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
    }, { command: 'buy' })
};
