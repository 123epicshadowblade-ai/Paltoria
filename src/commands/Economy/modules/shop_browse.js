import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { shopItems } from '../../../config/shop/items.js';
import { getColor } from '../../../config/bot.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

export default {
    async execute(interaction, config, client) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('⭐ Server Supporter')
                .setColor(getColor('primary'))
                .setDescription('Support the server with a one-time Ko-fi donation and get the Server Supporter role plus an in-game Palworld reward. Click a tier below — first-time buyers link their SteamID64 and email once, then future purchases are fully automatic.');

            shopItems.forEach(item => {
                embed.addFields({
                    name: item.name,
                    value: item.description,
                    inline: false,
                });
            });

            const buttons = shopItems.map(item =>
                new ButtonBuilder()
                    .setCustomId(`supporter_buy:${item.id}`)
                    .setLabel(`$${item.price}`)
                    .setStyle(ButtonStyle.Success)
            );

            buttons.push(
                new ButtonBuilder()
                    .setCustomId('supporter_leaderboard')
                    .setLabel('Top Supporters')
                    .setEmoji('🏆')
                    .setStyle(ButtonStyle.Secondary)
            );

            const components = [new ActionRowBuilder().addComponents(buttons)];

            await interaction.reply({ embeds: [embed], components, flags: 0 });
        } catch (error) {
            await handleInteractionError(interaction, error, { command: 'shop_browse' });
        }
    },
};
