import { CraftItem, PlayerId, PlayerProfile, RealmState } from '../types';

const STORAGE_REALM_KEY = 'craftforge_realm_v1';
const STORAGE_PLAYER_KEY = 'craftforge_active_player_v1';
const STORAGE_CLOUD_KEY = 'craftforge_cloud_config_v1';

export interface CloudSyncConfig {
  enabled: boolean;
  projectId: string;
  apiKey: string;
}

export interface SyncStatus {
  state: 'local' | 'syncing' | 'synced' | 'error';
  message: string;
  lastSyncedAt: number | null;
}

export const DEFAULT_PLAYERS: Record<PlayerId, PlayerProfile> = {
  player1: {
    id: 'player1',
    name: 'Dad',
    avatarId: 'knight',
    color: '#4aedf9',
  },
  player2: {
    id: 'player2',
    name: 'Kiddo',
    avatarId: 'explorer',
    color: '#55ff55',
  },
};

function parsePixelGrid(rows: string[], palette: Record<string, string>): string[] {
  const out: string[] = new Array(256).fill('');
  for (let y = 0; y < 16; y++) {
    const row = rows[y] || '';
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (ch && ch !== '.' && palette[ch]) {
        out[y * 16 + x] = palette[ch];
      }
    }
  }
  return out;
}

// 16x16 Emerald Thunderblade starter pixel art
const STARTER_SWORD_PIXELS = parsePixelGrid(
  [
    '..............EE',
    '.............EGE',
    '............EGLE',
    '...........EGLE.',
    '..........EGLE..',
    '.........EGLE...',
    '........EGLE....',
    '...GG..EGLE.....',
    '....GGEGLE......',
    '.....GYGE.......',
    '....BWGG........',
    '...BWB.GG.......',
    '..BWB...........',
    '.GYB............',
    '.GG.............',
    '................',
  ],
  {
    E: '#1b8a3e',
    G: '#41e066',
    L: '#baffc9',
    Y: '#ffd93d',
    B: '#5c3618',
    W: '#8c5628',
  }
);

// 16x16 Magma Apple starter pixel art
const STARTER_APPLE_PIXELS = parsePixelGrid(
  [
    '........BB......',
    '.......B.GG.....',
    '.......BGGG.....',
    '.....RRRRRR.....',
    '....RROOOORR....',
    '...RROYYYYORR...',
    '...ROYYWWYYOR...',
    '...ROYYWWYYOR...',
    '...RROYYYYORR...',
    '...RRROOOORRR...',
    '....RRRRRRRR....',
    '....RRDDDDRR....',
    '.....RRDDRR.....',
    '......RRRR......',
    '................',
    '................',
  ],
  {
    B: '#5c3618',
    G: '#55d94c',
    R: '#c92a2a',
    D: '#8a1515',
    O: '#ff7b00',
    Y: '#ffd93d',
    W: '#fff8c9',
  }
);

export function createStarterRealm(realmCode = 'FAMILY-CRAFT'): RealmState {
  const now = Date.now();
  const starterItems: CraftItem[] = [
    {
      id: 'starter-emerald-thunderblade',
      realmCode,
      name: 'Emerald Thunderblade',
      description:
        'Summons a green lightning bolt when you swing it! Also makes villagers cheer and gives you Speed II for 10 seconds.',
      category: 'weapon',
      rarity: 'legendary',
      enchanted: true,
      pixels: STARTER_SWORD_PIXELS,
      creatorId: 'player1',
      recipientId: 'player2',
      createdAt: now - 1000 * 60 * 30,
      grade: null,
    },
    {
      id: 'starter-magma-apple',
      realmCode,
      name: 'Magma Jump Apple',
      description:
        'A super spicy glowing apple! Eat it to bounce 10 blocks high and walk safely on lava for 1 full minute.',
      category: 'food',
      rarity: 'epic',
      enchanted: false,
      pixels: STARTER_APPLE_PIXELS,
      creatorId: 'player2',
      recipientId: 'player1',
      createdAt: now - 1000 * 60 * 90,
      grade: 9,
      gradeComment: 'Super bouncy and spicy! Almost melted my boots!',
      gradedAt: now - 1000 * 60 * 45,
    },
  ];

  return {
    realmCode,
    players: {
      player1: { ...DEFAULT_PLAYERS.player1 },
      player2: { ...DEFAULT_PLAYERS.player2 },
    },
    items: starterItems,
  };
}

export function sanitizeRealmCode(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'FAMILY-CRAFT';
}

export function loadRealmState(): RealmState {
  try {
    const raw = localStorage.getItem(STORAGE_REALM_KEY);
    if (!raw) {
      const initial = createStarterRealm();
      saveRealmState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<RealmState>;
    const realmCode = sanitizeRealmCode(parsed.realmCode || 'FAMILY-CRAFT');
    const players: Record<PlayerId, PlayerProfile> = {
      player1: { ...DEFAULT_PLAYERS.player1, ...(parsed.players?.player1 || {}), id: 'player1' },
      player2: { ...DEFAULT_PLAYERS.player2, ...(parsed.players?.player2 || {}), id: 'player2' },
    };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return { realmCode, players, items };
  } catch {
    return createStarterRealm();
  }
}

export function saveRealmState(state: RealmState): void {
  try {
    localStorage.setItem(STORAGE_REALM_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save realm state to localStorage:', err);
  }
}

export function loadActivePlayer(): PlayerId | null {
  try {
    const saved = localStorage.getItem(STORAGE_PLAYER_KEY);
    if (saved === 'player1' || saved === 'player2') return saved;
    return null;
  } catch {
    return null;
  }
}

export function saveActivePlayer(playerId: PlayerId | null): void {
  try {
    if (playerId) {
      localStorage.setItem(STORAGE_PLAYER_KEY, playerId);
    } else {
      localStorage.removeItem(STORAGE_PLAYER_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function loadCloudConfig(): CloudSyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_CLOUD_KEY);
    if (!raw) return { enabled: false, projectId: '', apiKey: '' };
    const parsed = JSON.parse(raw) as Partial<CloudSyncConfig>;
    return {
      enabled: Boolean(parsed.enabled && parsed.projectId),
      projectId: (parsed.projectId || '').trim(),
      apiKey: (parsed.apiKey || '').trim(),
    };
  } catch {
    return { enabled: false, projectId: '', apiKey: '' };
  }
}

export function saveCloudConfig(config: CloudSyncConfig): void {
  try {
    localStorage.setItem(STORAGE_CLOUD_KEY, JSON.stringify(config));
  } catch {
    // ignore storage errors
  }
}

/**
 * Parses either a full Firebase config JS/JSON snippet or a plain projectId string.
 */
export function parseFirebaseSnippet(input: string): { projectId: string; apiKey: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const projectIdMatch = trimmed.match(/["']?projectId["']?\s*:\s*["']([^"']+)["']/);
  const apiKeyMatch = trimmed.match(/["']?apiKey["']?\s*:\s*["']([^"']+)["']/);

  if (projectIdMatch) {
    return {
      projectId: projectIdMatch[1].trim(),
      apiKey: apiKeyMatch ? apiKeyMatch[1].trim() : '',
    };
  }

  // Fallback: user pasted a plain project ID like "my-craftforge-123"
  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return { projectId: trimmed, apiKey: '' };
  }

  return null;
}

export function generateItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Merges local and remote realms without losing concurrent creations or grades.
 */
export function mergeRealmStates(local: RealmState, remote: RealmState): RealmState {
  const byId = new Map<string, CraftItem>();

  for (const item of local.items) {
    byId.set(item.id, item);
  }

  for (const rItem of remote.items) {
    const existing = byId.get(rItem.id);
    if (!existing) {
      byId.set(rItem.id, rItem);
    } else {
      // Prefer whichever copy has a grade, or the more recently graded/created copy
      let winner = existing;
      const existingGraded = existing.grade !== null;
      const remoteGraded = rItem.grade !== null;
      if (remoteGraded && !existingGraded) {
        winner = rItem;
      } else if (remoteGraded && existingGraded) {
        const rTime = rItem.gradedAt || rItem.createdAt;
        const eTime = existing.gradedAt || existing.createdAt;
        if (rTime >= eTime) winner = rItem;
      } else if (rItem.createdAt > existing.createdAt) {
        winner = rItem;
      }

      // Independently merge hidden state using the latest hiddenUpdatedAt timestamp
      const eHideTs = existing.hiddenUpdatedAt || 0;
      const rHideTs = rItem.hiddenUpdatedAt || 0;
      const hiddenSource = rHideTs > eHideTs ? rItem : eHideTs > rHideTs ? existing : winner;

      byId.set(rItem.id, {
        ...winner,
        hidden: Boolean(hiddenSource.hidden),
        hiddenUpdatedAt: Math.max(eHideTs, rHideTs) || undefined,
      });
    }
  }

  const mergedItems = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);

  return {
    realmCode: local.realmCode,
    players: {
      player1: remote.players?.player1?.name ? remote.players.player1 : local.players.player1,
      player2: remote.players?.player2?.name ? remote.players.player2 : local.players.player2,
    },
    items: mergedItems,
  };
}

function getFirestoreDocUrl(config: CloudSyncConfig, realmCode: string): string {
  const safeProject = encodeURIComponent(config.projectId.trim());
  const safeRealm = encodeURIComponent(sanitizeRealmCode(realmCode));
  const base = `https://firestore.googleapis.com/v1/projects/${safeProject}/databases/(default)/documents/craftforge_realms/${safeRealm}`;
  return config.apiKey ? `${base}?key=${encodeURIComponent(config.apiKey.trim())}` : base;
}

export async function pullRealmFromCloud(
  config: CloudSyncConfig,
  realmCode: string
): Promise<RealmState | null> {
  if (!config.enabled || !config.projectId) return null;

  const url = getFirestoreDocUrl(config, realmCode);
  const res = await fetch(url, { method: 'GET' });

  if (res.status === 404) {
    return null; // Realm does not exist in cloud yet
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Firestore read failed (${res.status}): ${errText.slice(0, 120)}`);
  }

  const doc = (await res.json()) as {
    fields?: {
      payload?: { stringValue?: string };
    };
  };

  const payload = doc.fields?.payload?.stringValue;
  if (!payload) return null;

  const parsed = JSON.parse(payload) as RealmState;
  return parsed;
}

export async function pushRealmToCloud(
  config: CloudSyncConfig,
  state: RealmState
): Promise<void> {
  if (!config.enabled || !config.projectId) return;

  const url = getFirestoreDocUrl(config, state.realmCode);
  const body = {
    fields: {
      realmCode: { stringValue: state.realmCode },
      updatedAt: { integerValue: String(Date.now()) },
      payload: { stringValue: JSON.stringify(state) },
    },
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Firestore write failed (${res.status}): ${errText.slice(0, 120)}`);
  }
}
