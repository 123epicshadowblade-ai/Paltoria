import { EmbedBuilder } from 'discord.js';
import { getColor } from '../../../config/bot.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { resetSeason, computeAwards } from '../../../services/pvpService.js';

export default {
    async execute(interaction, config, client) {
        const archived = await resetSeason(client, interaction.guildId);
        const entries = Object.entries(archived.players)
            .map(([userId, p]) => ({ userId, ...p }))
            .sort((a, b) => b.points - a.points);

        const awards = computeAwards(entries);

        const embed = new EmbedBuilder()
            .setTitle(`🏆 ${archived.seasonLabel} — Season Results`)
            .setColor(getColor('primary'));

        if (!awards) {
            embed.setDescription('No PvP activity was logged this season.');
        } else {
            embed.addFields(
                { name: '🥇 PvP Champion', value: `<@${awards.champion.userId}> — ${awards.champion.points} pts` },
                { name: '🔥 Killstreak King', value: `<@${awards.killstreakKing.userId}> — ${awards.killstreakKing.bestStreak} streak` },
                { name: '💰 Bounty Hunter', value: `<@${awards.bountyHunter.userId}> — ${awards.bountyHunter.bounties} bounties` },
            );
        }

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    },
};
