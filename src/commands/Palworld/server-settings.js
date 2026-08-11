import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { fetchRawServerSettings, buildSettingsSummary } from '../../services/palworldSettingsService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('server-settings')
        .setDescription("Shows the Palworld server's current gameplay settings, read live from the server.")
        .setDMPermission(false),
    category: 'Palworld',

    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const rawSettings = await fetchRawServerSettings(client);
        const groups = buildSettingsSummary(rawSettings);

        if (groups.length === 0) {
            await InteractionHelper.safeEditReply(interaction, {
                content: "Couldn't read the server's settings right now. Try again in a moment.",
            });
            logger.warn('server-settings: no groups produced (SFTP unreachable or settings file unparsable)');
            return;
        }

        const DIVIDER = { name: '​', value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' };
        const fields = groups.flatMap((group, index) => (index === 0 ? [group] : [DIVIDER, group]));

        // Built via the EmbedBuilder(data) constructor rather than
        // .setTitle()/.setDescription()/.addFields(): those setters are
        // patched app-wide (src/utils/embeds.js) to strip emoji from every
        // embed in the bot. Passing the raw data object skips that patch.
        const embed = new EmbedBuilder({
            title: '🐾 Paltoria — Server Settings',
            description: '📡 Read live from the server — always up to date.',
            color: getColor('primary'),
            fields,
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    },
};
