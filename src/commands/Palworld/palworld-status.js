import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import palworldStatusSetup from './modules/palworldstatus_setup.js';
import palworldStatusDisable from './modules/palworldstatus_disable.js';
import palworldStatusSetStatus from './modules/palworldstatus_setstatus.js';

export default {
    data: new SlashCommandBuilder()
        .setName('palworld-status')
        .setDescription('Set up a live-updating Palworld server status channel. (Manage Server required)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Create or reuse a channel that always shows live server status.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Use an existing channel instead of creating a new one.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Stop updating the Palworld status channel (does not delete it).'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-status')
                .setDescription("Lock the bot's Discord status to fixed text, overriding the automatic player count.")
                .addStringOption(option =>
                    option
                        .setName('text')
                        .setDescription('Status text to show (e.g. "Balancing"). Omit or use "clear" to resume automatic player count.')
                        .setRequired(false),
                ),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    category: 'Palworld',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn('Palworld status interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'palworld-status',
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') return palworldStatusSetup.execute(interaction, config, client);
        if (subcommand === 'disable') return palworldStatusDisable.execute(interaction, config, client);
        if (subcommand === 'set-status') return palworldStatusSetStatus.execute(interaction, config, client);
    },
};
