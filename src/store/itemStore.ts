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

export const STARTER_DEMO_IDS = new Set<string>([
  'starter-emerald-thunderblade',
  'starter-magma-apple',
]);

export function isDemoItem(
  item: Pick<CraftItem, 'id' | 'isDemo' | 'creatorId'>
): boolean {
  return Boolean(item.isDemo || item.creatorId === 'neon' || STARTER_DEMO_IDS.has(item.id));
}

export function createStarterDemoItems(realmCode = 'FAMILY-CRAFT'): CraftItem[] {
  // Fixed older timestamps so player-crafted items always sort above starter demos
  const baseTime = Date.UTC(2026, 0, 1, 12, 0, 0);
  return [
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
      creatorId: 'neon',
      recipientId: 'neon',
      createdAt: baseTime + 1000 * 60 * 60,
      grade: null,
      hidden: false,
      isDemo: true,
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
      creatorId: 'neon',
      recipientId: 'neon',
      createdAt: baseTime,
      grade: null,
      hidden: false,
      isDemo: true,
    },
  ];
}

export function normalizeStarterDemoItems(items: CraftItem[], realmCode: string): CraftItem[] {
  const userItems = items.filter((item) => !STARTER_DEMO_IDS.has(item.id) && !item.isDemo);
  const demoItems = createStarterDemoItems(realmCode);
  return [...userItems, ...demoItems].sort((a, b) => b.createdAt - a.createdAt);
}

export function createStarterRealm(realmCode = 'FAMILY-CRAFT'): RealmState {
  return {
    realmCode,
    players: {
      player1: { ...DEFAULT_PLAYERS.player1 },
      player2: { ...DEFAULT_PLAYERS.player2 },
    },
    items: createStarterDemoItems(realmCode),
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

const EXTRA_PLAYER_COLORS = ['#ffaa00', '#ff66cc', '#aa88ff', '#55ffff', '#ff7755', '#ffee55'];

function normalizePlayersMap(
  rawPlayers: Record<string, Partial<PlayerProfile>> | undefined
): Record<PlayerId, PlayerProfile> {
  const result: Record<PlayerId, PlayerProfile> = {};

  if (rawPlayers && typeof rawPlayers === 'object') {
    let idx = 0;
    for (const [key, profile] of Object.entries(rawPlayers)) {
      const id = (profile?.id || key || '').trim();
      if (!id || id === 'neon') continue;
      const fallback = DEFAULT_PLAYERS[id];
      result[id] = {
        id,
        name: (profile?.name || fallback?.name || `Player ${idx + 1}`).trim() || `Player ${idx + 1}`,
        avatarId: profile?.avatarId || fallback?.avatarId || 'knight',
        color:
          profile?.color ||
          fallback?.color ||
          EXTRA_PLAYER_COLORS[idx % EXTRA_PLAYER_COLORS.length],
      };
      idx++;
    }
  }

  // Always guarantee at least the 2 default players exist for backward compatibility
  if (Object.keys(result).length === 0) {
    return {
      player1: { ...DEFAULT_PLAYERS.player1 },
      player2: { ...DEFAULT_PLAYERS.player2 },
    };
  }
  if (!result.player1 && Object.keys(result).length < 2) {
    result.player1 = { ...DEFAULT_PLAYERS.player1 };
  }
  if (!result.player2 && Object.keys(result).length < 2) {
    result.player2 = { ...DEFAULT_PLAYERS.player2 };
  }

  return result;
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
    const players = normalizePlayersMap(
      parsed.players as Record<string, Partial<PlayerProfile>> | undefined
    );
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items = normalizeStarterDemoItems(rawItems, realmCode);
    const nextState: RealmState = { realmCode, players, items };
    saveRealmState(nextState);
    return nextState;
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
    if (saved && saved.trim() && saved !== 'neon') return saved.trim();
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

  const mergedItems = normalizeStarterDemoItems(Array.from(byId.values()), local.realmCode);

  const mergedPlayers: Record<PlayerId, PlayerProfile> = {
    ...normalizePlayersMap(local.players),
  };
  if (remote.players && typeof remote.players === 'object') {
    for (const [id, rProfile] of Object.entries(remote.players)) {
      if (!id || id === 'neon' || !rProfile?.name) continue;
      mergedPlayers[id] = {
        ...(mergedPlayers[id] || {}),
        ...rProfile,
        id,
      };
    }
  }

  return {
    realmCode: local.realmCode,
    players: normalizePlayersMap(mergedPlayers),
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
