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

        const top = players
            .filter(p => p && typeof p.name === 'string' && typeof p.level === 'number')
            .sort((a, b) => (b.level - a.level) || ((b.exp || 0) - (a.exp || 0)))
            .slice(0, 10);

        await client.db.set(STATS_CACHE_KEY, { players: top, updatedAt: data.updatedAt || null }, null);
    } catch (error) {
        logger.warn(`Failed to refresh Palworld stats cache: ${error.message}`);
    } finally {
        sftp.end().catch(() => {});
    }
}

export async function getCachedPalworldLeaderboard(client) {
    return client.db.get(STATS_CACHE_KEY, { players: [], updatedAt: null });
}
