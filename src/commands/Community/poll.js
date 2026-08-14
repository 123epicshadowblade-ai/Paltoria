import { SlashCommandBuilder } from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { trackPendingPoll } from '../../services/pollService.js';

const OPTION_COUNT = 5;

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll')
        .setDMPermission(false)
        .addSubcommand(sub => {
            sub.setName('create')
                .setDescription('Create a poll -- results are announced automatically here when it ends')
                .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true).setMaxLength(300))
                .addStringOption(o => o.setName('option1').setDescription('Answer option 1').setRequired(true).setMaxLength(55))
                .addStringOption(o => o.setName('option2').setDescription('Answer option 2').setRequired(true).setMaxLength(55));
            for (let n = 3; n <= OPTION_COUNT; n++) {
                sub.addStringOption(o => o.setName(`option${n}`).setDescription(`Answer option ${n}`).setRequired(false).setMaxLength(55));
            }
            sub.addIntegerOption(o => o.setName('duration_hours').setDescription('How long the poll runs, in hours (1-168, default 24)').setRequired(false).setMinValue(1).setMaxValue(168));
            sub.addBooleanOption(o => o.setName('multiselect').setDescription('Allow voters to pick more than one option').setRequired(false));
            return sub;
        }),
    category: 'Community',

    execute: withErrorHandling(async (interaction, config, client) => {
        const options = [];
        for (let n = 1; n <= OPTION_COUNT; n++) {
            const value = interaction.options.getString(`option${n}`);
            if (value) options.push(value);
        }

        const question = interaction.options.getString('question', true);
        const durationHours = interaction.options.getInteger('duration_hours') ?? 24;
        const multiselect = interaction.options.getBoolean('multiselect') ?? false;

        await interaction.reply({
            poll: {
                question: { text: question },
                answers: options.map(text => ({ text })),
                duration: durationHours,
                allowMultiselect: multiselect,
            },
        });

        const message = await interaction.fetchReply();
        await trackPendingPoll(client, {
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            messageId: message.id,
            question,
            // Small buffer past Discord's own expiry so the poll has
            // actually closed voting by the time we read final results.
            expiresAt: Date.now() + durationHours * 60 * 60 * 1000 + 60_000,
        });
    }, { command: 'poll' }),
};
