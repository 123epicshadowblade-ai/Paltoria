import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

/**
 * Shared by /link and the "Edit Account Info" button: builds the account +
 * email modal, pre-filled with whatever's already on file so fixing a typo
 * is just editing the field, not retyping everything. Accepts a SteamID64
 * (Steam), a Player UID (Xbox/PS5, from staff), or an in-game character
 * name -- console players have no SteamID and no self-service way to see
 * their own UID, so name-based resolution against the live server is the
 * only option that works for them without staff help.
 */
export function buildLinkAccountModal(existing, customId = 'link_account_standalone') {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(existing ? 'Update Your Linked Account' : 'Link Your Account');

    const steamIdInput = new TextInputBuilder()
        .setCustomId('steam_id')
        .setLabel('SteamID64, Player UID, or Character Name')
        .setPlaceholder('7656119... (Steam) or your in-game name')
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(40);
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
