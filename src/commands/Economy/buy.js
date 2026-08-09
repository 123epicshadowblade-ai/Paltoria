import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { startSupporterPurchase } from '../../services/vipService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy a Server Supporter tier from the shop')
        .addStringOption(option =>
            option
                .setName('item_id')
                .setDescription('ID of the Server Supporter tier to buy')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const itemId = interaction.options.getString("item_id").toLowerCase();

        const embed = await startSupporterPurchase(client, { itemId, guildId, userId });
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }, { command: 'buy' })
};
