import { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { logger } from '../utils/logger.js';

const CATEGORY_NAME = 'Server Supporter';
const PENDING_DELETIONS_KEY = 'cache:supporter:pending_channel_deletions';

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

async function readPendingDeletions(client) {
    return (await client.db.get(PENDING_DELETIONS_KEY, [])) || [];
}

async function writePendingDeletions(client, entries) {
    await client.db.set(PENDING_DELETIONS_KEY, entries, null);
}

async function schedulePendingDeletion(client, guildId, channelId, expiresAt) {
    const entries = await readPendingDeletions(client);
    entries.push({ guildId, channelId, expiresAt });
    await writePendingDeletions(client, entries);
}

export async function cancelPendingDeletion(client, channelId) {
    const entries = await readPendingDeletions(client);
    const remaining = entries.filter(e => e.channelId !== channelId);
    if (remaining.length !== entries.length) {
        await writePendingDeletions(client, remaining);
    }
}

/**
 * Safety-net cron sweep: catches supporter channels whose in-memory
 * setTimeout deletion was lost to a bot restart/redeploy in the meantime.
 * The setTimeout scheduled at creation time is still the normal path when
 * the process stays up for the full window; this only picks up stragglers.
 */
export async function sweepExpiredSupporterChannels(client) {
    const entries = await readPendingDeletions(client);
    if (entries.length === 0) return;

    const now = Date.now();
    const stillPending = [];

    for (const entry of entries) {
        if (entry.expiresAt > now) {
            stillPending.push(entry);
            continue;
        }

        try {
            const guild = client.guilds.cache.get(entry.guildId);
            const channel = guild?.channels.cache.get(entry.channelId);
            if (channel) {
                await channel.delete('Server Supporter purchase channel expired');
            }
        } catch (error) {
            logger.warn(`Failed to sweep-delete expired supporter channel ${entry.channelId}: ${error.message}`);
        }
    }

    if (stillPending.length !== entries.length) {
        await writePendingDeletions(client, stillPending);
    }
}

function buildCloseRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('link_account_button')
            .setLabel('Edit Account Info')
            .setEmoji('🔗')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('supporter_channel_close')
            .setLabel('Close Channel')
            .setStyle(ButtonStyle.Danger),
    );
}

/**
 * Creates (or reuses) a private channel visible only to the buyer, posts the
 * purchase embed there, and schedules the channel for deletion after
 * autoDeleteMinutes so these don't accumulate. Deletion is tracked both by
 * an immediate setTimeout and a persisted record swept by a cron job, so a
 * bot restart mid-window doesn't leave the channel orphaned forever.
 */
export async function postToSupporterChannel(client, guild, member, embed, { autoDeleteMinutes } = {}) {
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

    await channel.send({
        content: `${member} 🔒 This channel is private — only you and staff can see it.`,
    });
    await channel.send({ embeds: [embed], components: [buildCloseRow()] });

    if (autoDeleteMinutes) {
        const expiresAt = Date.now() + autoDeleteMinutes * 60 * 1000;
        await schedulePendingDeletion(client, guild.id, channel.id, expiresAt);

        setTimeout(async () => {
            await cancelPendingDeletion(client, channel.id);
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
    const channel = await postToSupporterChannel(client, interaction.guild, interaction.member, embed, {
        autoDeleteMinutes: claimExpiryMinutes,
    });

    await InteractionHelper.safeEditReply(interaction, {
        content: `Check ${channel} for your purchase details.`,
    });
}
