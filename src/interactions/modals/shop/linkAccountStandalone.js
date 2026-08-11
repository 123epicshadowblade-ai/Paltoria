import { MessageFlags } from 'discord.js';
import { linkAccount } from '../../../services/vipService.js';
import { successEmbed } from '../../../utils/embeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const linkAccountStandaloneHandler = {
    name: 'link_account_standalone',
    async execute(interaction, client) {
        try {
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) return;

            const steamId = interaction.fields.getTextInputValue('steam_id').trim();
            const email = interaction.fields.getTextInputValue('email').trim();

            const account = await linkAccount(client, interaction.guildId, interaction.user.id, { steamId, email });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed(
                    'Account Linked',
                    `SteamID: \`${account.steamId}\`\nEmail: \`${account.email}\`\n\nRun \`/link\` again anytime to correct a typo.`,
                )],
            });
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'modal', customId: interaction.customId });
        }
    },
};

export default [linkAccountStandaloneHandler];
