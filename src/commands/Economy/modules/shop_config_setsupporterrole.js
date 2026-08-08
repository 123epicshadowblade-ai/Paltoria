import { PermissionsBitField } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
export default {
    async execute(interaction, config, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permissions to set the Server Supporter role.' });
        }

        const role = interaction.options.getRole('role');
        const guildId = interaction.guildId;

        try {
            const currentConfig = await getGuildConfig(client, guildId);
            currentConfig.supporterRoleId = role.id;
            await setGuildConfig(client, guildId, currentConfig);

            return InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed('Server Supporter Role Set', `The **Server Supporter Role** has been set to ${role.toString()}. Members who complete a Ko-fi Server Supporter purchase will be granted this role. Make sure the bot's role is above it and it has **Manage Roles** permission.`)],
                ephemeral: true,
            });
        } catch (error) {
            logger.error('shop_config_setsupporterrole error:', error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Could not save the guild configuration.' });
        }
    },
};
