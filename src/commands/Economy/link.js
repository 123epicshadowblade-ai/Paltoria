import { SlashCommandBuilder } from 'discord.js';
import { getLinkedAccount } from '../../services/vipService.js';
import { buildLinkAccountModal } from '../../utils/linkAccountModal.js';

export default {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link (or update) the SteamID64 and email used for Server Supporter purchases and PvP tracking.')
        .setDMPermission(false),
    category: 'Economy',

    async execute(interaction, config, client) {
        const existing = await getLinkedAccount(client, interaction.guildId, interaction.user.id);
        await interaction.showModal(buildLinkAccountModal(existing));
    },
};
