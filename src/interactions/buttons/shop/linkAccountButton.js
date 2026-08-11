import { getLinkedAccount } from '../../../services/vipService.js';
import { buildLinkAccountModal } from '../../../utils/linkAccountModal.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

const linkAccountButtonHandler = {
    name: 'link_account_button',
    async execute(interaction, client) {
        try {
            const existing = await getLinkedAccount(client, interaction.guildId, interaction.user.id);
            await interaction.showModal(buildLinkAccountModal(existing));
        } catch (error) {
            await handleInteractionError(interaction, error, { type: 'button', customId: interaction.customId });
        }
    },
};

export default [linkAccountButtonHandler];
