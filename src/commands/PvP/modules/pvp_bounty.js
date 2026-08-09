import { successEmbed } from '../../../utils/embeds.js';
import { TitanBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { recordBounty } from '../../../services/pvpService.js';

export default {
    async execute(interaction, config, client) {
        const target = interaction.options.getUser('target');

        if (target.bot) {
            throw new TitanBotError(
                'Bot user targeted',
                ErrorTypes.VALIDATION,
                'Bots cannot be awarded a bounty.',
            );
        }

        const player = await recordBounty(client, interaction.guildId, target.id);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(
                '💰 Bounty Awarded',
                `**${target.tag}** collected a bounty: ${player.bounties} total bounties, ${player.points} pts.`,
            )],
        });
    },
};
