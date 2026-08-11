import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { getLinkedAccount } from '../../services/vipService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link (or update) the SteamID64 and email used for Server Supporter purchases and PvP tracking.')
        .setDMPermission(false),
    category: 'Economy',

    async execute(interaction, config, client) {
        const existing = await getLinkedAccount(client, interaction.guildId, interaction.user.id);

        const modal = new ModalBuilder()
            .setCustomId('link_account_standalone')
            .setTitle(existing ? 'Update Your Linked Account' : 'Link Your Account');

        const steamIdInput = new TextInputBuilder()
            .setCustomId('steam_id')
            .setLabel('SteamID64 (find yours at steamid.io)')
            .setPlaceholder('7656119xxxxxxxxxx')
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setMinLength(17)
            .setMaxLength(17);
        if (existing?.steamId) steamIdInput.setValue(existing.steamId);

        const emailInput = new TextInputBuilder()
            .setCustomId('email')
            .setLabel('Email you\'ll pay with on Ko-fi')
            .setPlaceholder('you@example.com')
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100);
        if (existing?.email) emailInput.setValue(existing.email);

        modal.addComponents(
            new ActionRowBuilder().addComponents(steamIdInput),
            new ActionRowBuilder().addComponents(emailInput),
        );

        await interaction.showModal(modal);
    },
};
