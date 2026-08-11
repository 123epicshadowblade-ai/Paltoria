import Client from 'ssh2-sftp-client';
import { logger } from '../utils/logger.js';

// Splits a comma-separated string on top-level commas only, respecting
// quoted strings and nested (...) tuples so values like
// CrossplayPlatforms=(Steam,Xbox,PS5,Mac) don't get shredded.
function splitTopLevel(s) {
    const parts = [];
    let depth = 0;
    let inQuotes = false;
    let current = '';

    for (const ch of s) {
        if (ch === '"') {
            inQuotes = !inQuotes;
            current += ch;
            continue;
        }
        if (!inQuotes) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (ch === ',' && depth === 0) {
                parts.push(current);
                current = '';
                continue;
            }
        }
        current += ch;
    }
    if (current) parts.push(current);
    return parts;
}

function parseValue(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
    if (trimmed === 'True') return true;
    if (trimmed === 'False') return false;
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        const inner = trimmed.slice(1, -1);
        return inner ? splitTopLevel(inner).map(v => v.trim()) : [];
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed; // Enum-like bare values: None, ItemAndEquipment, etc.
}

export function parseOptionSettings(iniText) {
    const match = iniText.match(/OptionSettings=\((.*)\)\s*$/m);
    if (!match) return {};

    const map = {};
    for (const segment of splitTopLevel(match[1])) {
        const eqIndex = segment.indexOf('=');
        if (eqIndex === -1) continue;
        const key = segment.slice(0, eqIndex).trim();
        map[key] = parseValue(segment.slice(eqIndex + 1));
    }
    return map;
}

export async function fetchRawServerSettings(client) {
    const sftpConfig = client.config?.palworld?.sftp;
    if (!sftpConfig?.host || !sftpConfig?.port || !sftpConfig?.username || !sftpConfig?.password) {
        return null;
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
        const buf = await sftp.get(sftpConfig.settingsFilePath);
        return parseOptionSettings(buf.toString('utf8'));
    } catch (error) {
        logger.warn(`Failed to fetch Palworld server settings: ${error.message}`);
        return null;
    } finally {
        sftp.end().catch(() => {});
    }
}

const percent = (n) => `${Math.round(n * 100)}%`;
const yesNo = (b) => (b ? 'Yes' : 'No');

// Explicit allowlist -- never a raw dump. AdminPassword, ServerPassword,
// RCON/network/API fields are deliberately never listed here.
const SETTING_GROUPS = [
    {
        name: '⚡ Rates',
        fields: [
            { key: 'ExpRate', label: '⭐ EXP Rate', format: (v) => `${v}x` },
            { key: 'PalCaptureRate', label: '🎯 Pal Capture Rate', format: (v) => `${v}x` },
            { key: 'PalSpawnNumRate', label: '🐾 Pal Spawn Rate', format: percent },
            { key: 'WorkSpeedRate', label: '⚒️ Work Speed', format: (v) => `${v}x` },
            { key: 'CollectionDropRate', label: '🌿 Gathering Drop Rate', format: (v) => `${v}x` },
            { key: 'EnemyDropItemRate', label: '💎 Enemy Drop Rate', format: (v) => `${v}x` },
            { key: 'DayTimeSpeedRate', label: '☀️ Day Speed', format: (v) => `${v}x` },
            { key: 'NightTimeSpeedRate', label: '🌙 Night Speed', format: (v) => `${v}x` },
        ],
    },
    {
        name: '⚔️ PvP & Combat',
        fields: [
            { key: 'bIsPvP', label: '⚔️ PvP Enabled', format: yesNo },
            { key: 'bEnablePlayerToPlayerDamage', label: '🗡️ Player-to-Player Damage', format: yesNo },
            { key: 'bEnableFriendlyFire', label: '🔥 Friendly Fire', format: yesNo },
            { key: 'PlayerDamageRateAttack', label: '💥 Player Damage Dealt', format: (v) => `${v}x` },
            { key: 'PlayerDamageRateDefense', label: '🛡️ Player Damage Taken', format: (v) => `${v}x` },
            { key: 'DeathPenalty', label: '💀 Death Penalty', format: (v) => v },
            { key: 'bHardcore', label: '☠️ Hardcore Mode', format: yesNo },
        ],
    },
    {
        name: '🏕️ Server',
        fields: [
            { key: 'ServerName', label: '🏷️ Server Name', format: (v) => v },
            { key: 'ServerPlayerMaxNum', label: '👥 Max Players', format: (v) => String(v) },
            { key: 'GuildPlayerMaxNum', label: '🛖 Max Guild Size', format: (v) => String(v) },
            { key: 'CoopPlayerMaxNum', label: '🤝 Max Co-op Party Size', format: (v) => String(v) },
            { key: 'Region', label: '🌍 Region', format: (v) => v },
            { key: 'CrossplayPlatforms', label: '🎮 Crossplay', format: (v) => (Array.isArray(v) ? v.join(', ') : String(v)) },
            { key: 'SupplyDropSpan', label: '📦 Supply Drop Interval', format: (v) => `${v}s` },
        ],
    },
];

export function buildSettingsSummary(rawMap) {
    if (!rawMap) return [];
    return SETTING_GROUPS
        .map(group => ({
            name: group.name,
            fields: group.fields.filter(f => rawMap[f.key] !== undefined),
        }))
        .filter(group => group.fields.length > 0)
        .map(group => ({
            name: group.name,
            value: group.fields.map(f => `**${f.label}:** ${f.format(rawMap[f.key])}`).join('\n'),
        }));
}
