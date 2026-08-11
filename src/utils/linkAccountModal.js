import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

/**
 * Shared by /link and the "Edit Account Info" button: builds the
 * SteamID64 + email modal, pre-filled with whatever's already on file so
 * fixing a typo is just editing the field, not retyping everything.
 */
export function buildLinkAccountModal(existing, customId = 'link_account_standalone') {
    const modal = new ModalBuilder()
        .setCustomId(customId)
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

    return modal;
}
