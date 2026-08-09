import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import pvpLogKill from './modules/pvp_logkill.js';
import pvpBounty from './modules/pvp_bounty.js';
import pvpResetSeason from './modules/pvp_resetseason.js';
import pvpLeaderboard from './modules/pvp_leaderboard.js';

const MOD_ONLY_SUBCOMMANDS = new Set(['log-kill', 'bounty', 'reset-season']);

export default {
    data: new SlashCommandBuilder()
        .setName('pvp')
        .setDescription('View the PvP leaderboard or manage it (staff).')
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription("Shows the server's PvP leaderboard for the current season."),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('log-kill')
                .setDescription('(Staff) Log a PvP kill.')
                .addUserOption(o => o.setName('killer').setDescription('The player who got the kill').setRequired(true))
                .addUserOption(o => o.setName('victim').setDescription('The player who died').setRequired(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('bounty')
                .setDescription('(Staff) Award a bounty to a player.')
                .addUserOption(o => o.setName('target').setDescription('The player who collected the bounty').setRequired(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-season')
                .setDescription('(Staff) Archive the current PvP season, announce awards, and start a new one.'),
        )
        .setDMPermission(false),
    category: 'PvP',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn('PvP interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'pvp',
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (MOD_ONLY_SUBCOMMANDS.has(subcommand) && !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            throw new TitanBotError(
                'Missing ModerateMembers permission',
                ErrorTypes.PERMISSION,
                'You need the **Moderate Members** permission to manage the PvP leaderboard.',
            );
        }

        if (subcommand === 'leaderboard') return pvpLeaderboard.execute(interaction, config, client);
        if (subcommand === 'log-kill') return pvpLogKill.execute(interaction, config, client);
        if (subcommand === 'bounty') return pvpBounty.execute(interaction, config, client);
        if (subcommand === 'reset-season') return pvpResetSeason.execute(interaction, config, client);
    },
};
