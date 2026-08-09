import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { setLiveChannelConfig, refreshLiveChannels } from '../../../services/palworldLiveChannelService.js';

export default {
    async execute(interaction, config, client) {
        const existingChannel = interaction.options.getChannel('channel');

        let channel = existingChannel;
        if (!channel) {
            channel = await interaction.guild.channels.create({
                name: 'palworld-status',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.SendMessages],
                        allow: [PermissionFlagsBits.ViewChannel],
                    },
                ],
                reason: `Palworld live status channel set up by ${interaction.user.tag}`,
            });
        }

        await setLiveChannelConfig(client, interaction.guildId, {
            channelId: channel.id,
            dashboardMessageId: null,
            knownPlayerUids: null,
        });

        await refreshLiveChannels(client);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(
                'Palworld Status Channel Set Up',
                `${channel} will now show a live dashboard (online players, top levels) that updates automatically every ~2 minutes, plus join/leave notices.`,
            )],
        });
    },
};
