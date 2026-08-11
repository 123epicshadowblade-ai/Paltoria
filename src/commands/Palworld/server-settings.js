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

        const embed = new EmbedBuilder()
            .setTitle('Palworld Server Settings')
            .setColor(getColor('primary'))
            .setDescription('Read live from the server — always up to date.')
            .addFields(groups);

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    },
};
