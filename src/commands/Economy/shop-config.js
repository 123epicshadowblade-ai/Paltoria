import { SlashCommandBuilder } from 'discord.js';
import shopConfigSetrole from './modules/shop_config_setrole.js';
import shopConfigSetsupporterrole from './modules/shop_config_setsupporterrole.js';
import { logger } from '../../utils/logger.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('shop-config')
        .setDescription('Configure shop settings. (Manage Server required)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setrole')
                .setDescription('Set the Discord role granted when the Premium Role shop item is purchased.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to grant for Premium Role purchases.')
                        .setRequired(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setsupporterrole')
                .setDescription('Set the Discord role granted after a Ko-fi Server Supporter purchase is confirmed.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to grant for Server Supporter purchases.')
                        .setRequired(true),
                ),
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();
        logger.warn(`[DEBUG supporter] shop-config dispatch subcommand="${subcommand}"`);

        if (subcommand === 'setrole') {
            return shopConfigSetrole.execute(interaction, config, client);
        }
        if (subcommand === 'setsupporterrole') {
            return shopConfigSetsupporterrole.execute(interaction, config, client);
        }
    },
};
