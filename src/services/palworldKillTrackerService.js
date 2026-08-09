import Client from 'ssh2-sftp-client';
import { logger } from '../utils/logger.js';
import { getPlayerUidCache } from './palworldStatusService.js';
import { recordKill } from './pvpService.js';

const OFFSET_KEY = 'cache:palworld:kills_offset';

async function resolveIdentity(uidCache, uid, fallbackName) {
    const cached = uidCache[uid];
    if (cached?.steamid) {
        return { id: `steam:${cached.steamid}`, name: cached.name || fallbackName || null };
    }
    // Never seen this UID in an RCON snapshot (e.g. bot restarted after they
    // logged off) — fall back to a UID-keyed identity so the kill still
    // counts, just without a resolved SteamID.
    return { id: `steam:uid:${uid}`, name: fallbackName || null };
}

export async function pollPalworldKills(client) {
    const sftpConfig = client.config?.palworld?.sftp;
    if (!sftpConfig?.host || !sftpConfig?.port || !sftpConfig?.username || !sftpConfig?.password) {
        return;
    }

    const filePath = sftpConfig.killsFilePath;
    const sftp = new Client();

    try {
        await sftp.connect({
            host: sftpConfig.host,
            port: sftpConfig.port,
            username: sftpConfig.username,
            password: sftpConfig.password,
            readyTimeout: 8000,
        });

        const stat = await sftp.stat(filePath).catch(() => null);
        if (!stat) return;

        let offset = (await client.db.get(OFFSET_KEY, 0)) || 0;
        if (stat.size <= offset) {
            if (stat.size < offset) await client.db.set(OFFSET_KEY, 0, null);
            return;
        }

        const buf = await sftp.get(filePath, undefined, { readStreamOptions: { start: offset, end: stat.size } });
        const lines = buf.toString('utf8').split('\n').map(l => l.trim()).filter(Boolean);

        const events = [];
        for (const line of lines) {
            try {
                events.push(JSON.parse(line));
            } catch {
                logger.warn(`Skipping malformed Palworld kill event line: ${line.slice(0, 200)}`);
            }
        }

        if (events.length > 0) {
            const uidCache = await getPlayerUidCache(client);

            for (const guild of client.guilds.cache.values()) {
                for (const event of events) {
                    if (!event.killerUid || !event.victimUid) continue;

                    try {
                        const killer = await resolveIdentity(uidCache, event.killerUid, event.killerName);
                        const victim = await resolveIdentity(uidCache, event.victimUid, event.victimName);

                        if (killer.id === victim.id) continue;

                        await recordKill(client, guild.id, {
                            killerId: killer.id,
                            victimId: victim.id,
                            killerName: killer.name,
                            victimName: victim.name,
                        });
                    } catch (error) {
                        logger.warn(`Failed to record automatic Palworld kill for guild ${guild.id}: ${error.message}`);
                    }
                }
            }
        }

        await client.db.set(OFFSET_KEY, stat.size, null);
    } catch (error) {
        logger.warn(`Failed to poll Palworld kill events: ${error.message}`);
    } finally {
        sftp.end().catch(() => {});
    }
}
