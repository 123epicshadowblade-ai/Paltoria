import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { InteractionHelper } from '../utils/interactionHelper.js';

const CATEGORY_NAME = 'Server Supporter';

async function findOrCreateCategory(guild) {
    let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME,
    );
    if (!category) {
        category = await guild.channels.create({
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            ],
        });
    }
    return category;
}

/**
 * Creates (or reuses) a private channel visible only to the buyer, posts the
 * purchase embed there, and schedules the channel for deletion after
 * autoDeleteMinutes so these don't accumulate.
 */
export async function postToSupporterChannel(guild, member, embed, { autoDeleteMinutes } = {}) {
    const category = await findOrCreateCategory(guild);
    const channelName = `supporter-${member.user.username}`.toLowerCase().slice(0, 90);

    let channel = guild.channels.cache.find(
        c => c.parentId === category.id && c.name === channelName,
    );

    if (!channel) {
        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                {
                    id: member.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                    ],
                },
            ],
        });
    }

    await channel.send({ content: member.toString(), embeds: [embed] });

    if (autoDeleteMinutes) {
        setTimeout(() => {
            channel.delete('Server Supporter purchase channel expired').catch(() => {});
        }, autoDeleteMinutes * 60 * 1000);
    }

    return channel;
}

/**
 * Posts the purchase embed to a private per-buyer channel instead of an
 * ephemeral reply, so the claim code/email instructions aren't visible to
 * anyone else in the channel the command/button was used in.
 */
export async function deliverToSupporterChannel(client, interaction, embed) {
    const claimExpiryMinutes = client.config?.kofi?.claimExpiryMinutes || 60;
    const channel = await postToSupporterChannel(interaction.guild, interaction.member, embed, {
        autoDeleteMinutes: claimExpiryMinutes + 30,
    });

    await InteractionHelper.safeEditReply(interaction, {
        content: `Check ${channel} for your purchase details.`,
    });
}
