import { successEmbed } from '../../../utils/embeds.js';
import { TitanBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { recordKill } from '../../../services/pvpService.js';

export default {
    async execute(interaction, config, client) {
        const killer = interaction.options.getUser('killer');
        const victim = interaction.options.getUser('victim');

        if (killer.bot || victim.bot) {
            throw new TitanBotError(
                'Bot user targeted',
                ErrorTypes.VALIDATION,
                'Bots cannot be logged as a killer or victim.',
            );
        }

        const { killer: killerStats, streakBonus } = await recordKill(client, interaction.guildId, {
            killerId: killer.id,
            victimId: victim.id,
        });

        let body = `**${killer.tag}** killed **${victim.tag}**\n` +
            `${killer.tag}: ${killerStats.kills} kills, ${killerStats.streak} streak, ${killerStats.points} pts`;
        if (streakBonus) {
            body += `\n🔥 Streak bonus! +${streakBonus.points} pts for hitting a ${streakBonus.at}-kill streak.`;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed('⚔️ Kill Logged', body)],
        });
    },
};
