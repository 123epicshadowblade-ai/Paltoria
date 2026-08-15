import Client from 'ssh2-sftp-client';
import { logger } from '../utils/logger.js';

const STATS_CACHE_KEY = 'cache:palworld:level_leaderboard';

export async function refreshPalworldStatsCache(client) {
    const sftpConfig = client.config?.palworld?.sftp;
    if (!sftpConfig?.host || !sftpConfig?.port || !sftpConfig?.username || !sftpConfig?.password) {
        return;
    }

    const sftp = new Client();
    try {
        await sftp.connect({
            host: sftpConfig.host,
            port: sftpConfig.port,
            username: sftpConfig.username,
            password: sftpConfig.password,
            readyTimeout: 8000,
        });

        const buf = await sftp.get(sftpConfig.statsFilePath);
        const data = JSON.parse(buf.toString('utf8'));
        const players = Array.isArray(data.players) ? data.players : [];

        const sorted = players
            .filter(p => p && typeof p.name === 'string' && typeof p.level === 'number')
            .sort((a, b) => (b.level - a.level) || ((b.exp || 0) - (a.exp || 0)));

        await client.db.set(STATS_CACHE_KEY, { players: sorted, updatedAt: data.updatedAt || null }, null);
    } catch (error) {
        logger.warn(`Failed to refresh Palworld stats cache: ${error.message}`);
    } finally {
        sftp.end().catch(() => {});
    }
}

// limit defaults to the old top-10 behavior so the two existing display
// consumers (leaderboard button, live dashboard) are unaffected; pass a
// larger/Infinity limit to read the full cached population (e.g. to match
// currently-online players against their level for the bot's status text).
export async function getCachedPalworldLeaderboard(client, limit = 10) {
    const { players, updatedAt } = await client.db.get(STATS_CACHE_KEY, { players: [], updatedAt: null });
    return { players: players.slice(0, limit), updatedAt };
}
