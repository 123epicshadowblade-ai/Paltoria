import { successEmbed } from '../../../utils/embeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { setPresenceOverride, clearPresenceOverride, updatePalworldPresence } from '../../../services/palworldStatusService.js';

export default {
    async execute(interaction, config, client) {
        const rawText = interaction.options.getString('text');
        const text = rawText && rawText.trim().toLowerCase() !== 'clear' ? rawText.trim() : null;

        if (text) {
            await setPresenceOverride(client, text);
        } else {
            await clearPresenceOverride(client);
        }

        await updatePalworldPresence(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(
                text ? 'Bot Status Locked' : 'Bot Status Unlocked',
                text
                    ? `The bot's Discord status is now fixed to **"${text}"** and won't be overwritten by the automatic player count until you run this again with no text (or \`clear\`).`
                    : "The bot's Discord status will go back to showing the live player count automatically.",
            )],
        });
    },
};
