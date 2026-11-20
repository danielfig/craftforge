import { CraftItem, PlayerId, PlayerProfile, RealmState } from '../types';

const STORAGE_REALM_KEY = 'craftforge_realm_v1';
const STORAGE_PLAYER_KEY = 'craftforge_active_player_v1';
const STORAGE_CLOUD_KEY = 'craftforge_cloud_config_v1';

export const DEFAULT_FIREBASE_PROJECT_ID = 'craftforge-188ce';

export const REALM_NAME_MIN = 3;
export const REALM_NAME_MAX = 20;
export const REALM_PASSWORD_MIN = 4;
export const REALM_PASSWORD_MAX = 24;

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

export const PLAYER_ACCENT_COLORS = [
  '#4aedf9',
  '#55ff55',
  '#ffaa00',
  '#ff66cc',
  '#aa88ff',
  '#55ffff',
  '#ff7755',
  '#ffee55',
];

/**
 * Deterministic synchronous hash for first-come 3-digit PIN lock.
 * Uses normalized lowercase name + PIN so the same PIN produces different hashes per player.
 */
export function hashPin(name: string, pin: string): string {
  const input = `${name.trim().toLowerCase()}:${pin.trim()}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i * 31;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `pinv1:${part1}${part2}`;
}

export function findPlayerByName(
  players: Record<PlayerId, PlayerProfile>,
  name: string
): PlayerProfile | undefined {
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  return Object.values(players).find((p) => p.name.trim().toLowerCase() === target);
}

export function createStarterRealm(
  realmName = 'FAMILY-CRAFT',
  realmPassword?: string
): RealmState {
  const cleanName = sanitizeRealmName(realmName) || 'FAMILY-CRAFT';
  const cleanPassword = realmPassword?.trim() || undefined;
  const realmCodeHash = cleanPassword ? hashRealmSecret(cleanName, cleanPassword) : undefined;
  return {
    realmCode: cleanName,
    ...(cleanPassword ? { realmPassword: cleanPassword } : {}),
    ...(realmCodeHash ? { realmCodeHash } : {}),
    players: {},
    items: createStarterDemoItems(cleanName),
  };
}

export function sanitizeRealmName(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, REALM_NAME_MAX);
}

export function sanitizeRealmCode(raw: string): string {
  const cleaned = sanitizeRealmName(raw);
  return cleaned || 'FAMILY-CRAFT';
}

export function validateRealmName(raw: string): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, cleaned: '', error: 'Please enter a Realm Name.' };
  }
  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      cleaned: sanitizeRealmName(trimmed),
      error: 'Realm Name must be a single continuous word (no spaces).',
    };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      cleaned: sanitizeRealmName(trimmed),
      error: 'Realm Name can only use letters, numbers, hyphens (-), and underscores (_).',
    };
  }
  const upper = trimmed.toUpperCase();
  if (upper.length < REALM_NAME_MIN || upper.length > REALM_NAME_MAX) {
    return {
      valid: false,
      cleaned: upper.slice(0, REALM_NAME_MAX),
      error: `Realm Name must be ${REALM_NAME_MIN}–${REALM_NAME_MAX} characters long.`,
    };
  }
  return { valid: true, cleaned: upper };
}

export function validateRealmPassword(raw: string): {
  valid: boolean;
  cleaned: string;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, cleaned: '', error: 'Please enter a Realm Code (password).' };
  }
  if (/\s/.test(trimmed)) {
    return {
      valid: false,
      cleaned: trimmed.replace(/\s+/g, ''),
      error: 'Realm Code cannot contain spaces.',
    };
  }
  if (trimmed.length < REALM_PASSWORD_MIN || trimmed.length > REALM_PASSWORD_MAX) {
    return {
      valid: false,
      cleaned: trimmed.slice(0, REALM_PASSWORD_MAX),
      error: `Realm Code must be ${REALM_PASSWORD_MIN}–${REALM_PASSWORD_MAX} characters long.`,
    };
  }
  return { valid: true, cleaned: trimmed };
}

/**
 * Deterministic 64-bit hex hash combining Realm Name + Realm Code (password).
 * Used to derive the unguessable Firestore document ID without storing the raw password.
 */
export function hashRealmSecret(realmName: string, realmPassword: string): string {
  const normalized = `craftforge_realm_v2:${sanitizeRealmName(realmName)}:${realmPassword.trim()}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i << 1);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  h1 ^= h1 >>> 16;
  h2 ^= h2 >>> 13;
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function getRealmDocId(
  realmName: string,
  realmPassword?: string,
  realmCodeHash?: string
): string {
  const cleanName = sanitizeRealmCode(realmName);
  const hash =
    realmCodeHash?.trim() ||
    (realmPassword?.trim() ? hashRealmSecret(cleanName, realmPassword.trim()) : '');
  return hash ? `${cleanName}__${hash}` : cleanName;
}

function normalizePlayersMap(
  rawPlayers: Record<string, Partial<PlayerProfile>> | undefined
): Record<PlayerId, PlayerProfile> {
  const result: Record<PlayerId, PlayerProfile> = {};

  if (rawPlayers && typeof rawPlayers === 'object') {
    let idx = 0;
    for (const [key, profile] of Object.entries(rawPlayers)) {
      const id = (profile?.id || key || '').trim();
      if (!id || id === 'neon') continue;
      const name = (profile?.name || '').trim();
      if (!name) continue;
      const pinHash =
        typeof profile?.pinHash === 'string' && profile.pinHash.trim()
          ? profile.pinHash.trim()
          : undefined;
      result[id] = {
        id,
        name,
        avatarId: profile?.avatarId || 'knight',
        color:
          profile?.color ||
          PLAYER_ACCENT_COLORS[idx % PLAYER_ACCENT_COLORS.length],
        ...(pinHash ? { pinHash } : {}),
      };
      idx++;
    }
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
    const realmPassword =
      typeof parsed.realmPassword === 'string' && parsed.realmPassword.trim()
        ? parsed.realmPassword.trim()
        : undefined;
    const realmCodeHash =
      typeof parsed.realmCodeHash === 'string' && parsed.realmCodeHash.trim()
        ? parsed.realmCodeHash.trim()
        : realmPassword
          ? hashRealmSecret(realmCode, realmPassword)
          : undefined;
    const players = normalizePlayersMap(
      parsed.players as Record<string, Partial<PlayerProfile>> | undefined
    );
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items = normalizeStarterDemoItems(rawItems, realmCode);
    const nextState: RealmState = {
      realmCode,
      ...(realmPassword ? { realmPassword } : {}),
      ...(realmCodeHash ? { realmCodeHash } : {}),
      players,
      items,
    };
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
    if (!raw) {
      return { enabled: true, projectId: DEFAULT_FIREBASE_PROJECT_ID, apiKey: '' };
    }
    const parsed = JSON.parse(raw) as Partial<CloudSyncConfig>;
    const projectId = (parsed.projectId || '').trim() || DEFAULT_FIREBASE_PROJECT_ID;
    return {
      enabled: parsed.enabled !== false,
      projectId,
      apiKey: (parsed.apiKey || '').trim(),
    };
  } catch {
    return { enabled: true, projectId: DEFAULT_FIREBASE_PROJECT_ID, apiKey: '' };
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
      const localProfile = mergedPlayers[id];
      const preservedPinHash =
        (rProfile.pinHash && rProfile.pinHash.trim()) ||
        (localProfile?.pinHash && localProfile.pinHash.trim()) ||
        undefined;
      mergedPlayers[id] = {
        ...(localProfile || {}),
        ...rProfile,
        id,
        ...(preservedPinHash ? { pinHash: preservedPinHash } : {}),
      };
    }
  }

  const realmCodeHash = local.realmCodeHash || remote.realmCodeHash;

  return {
    realmCode: local.realmCode,
    ...(local.realmPassword ? { realmPassword: local.realmPassword } : {}),
    ...(realmCodeHash ? { realmCodeHash } : {}),
    players: normalizePlayersMap(mergedPlayers),
    items: mergedItems,
  };
}

function getFirestoreDocUrl(
  config: CloudSyncConfig,
  realmName: string,
  realmPassword?: string,
  realmCodeHash?: string
): string {
  const safeProject = encodeURIComponent(config.projectId.trim());
  const docId = encodeURIComponent(getRealmDocId(realmName, realmPassword, realmCodeHash));
  const base = `https://firestore.googleapis.com/v1/projects/${safeProject}/databases/(default)/documents/craftforge_realms/${docId}`;
  return config.apiKey ? `${base}?key=${encodeURIComponent(config.apiKey.trim())}` : base;
}

export async function pullRealmFromCloud(
  config: CloudSyncConfig,
  realmName: string,
  realmPassword?: string,
  realmCodeHash?: string
): Promise<RealmState | null> {
  if (!config.enabled || !config.projectId) return null;

  const url = getFirestoreDocUrl(config, realmName, realmPassword, realmCodeHash);
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

  const hash =
    state.realmCodeHash ||
    (state.realmPassword ? hashRealmSecret(state.realmCode, state.realmPassword) : undefined);

  // Never store plaintext realmPassword in Firestore
  const { realmPassword: _omitPassword, ...cloudSafeState } = state;
  const payloadState: RealmState = {
    ...cloudSafeState,
    ...(hash ? { realmCodeHash: hash } : {}),
  };

  const url = getFirestoreDocUrl(config, state.realmCode, state.realmPassword, hash);
  const body = {
    fields: {
      realmName: { stringValue: state.realmCode },
      realmCodeHash: { stringValue: hash || '' },
      updatedAt: { integerValue: String(Date.now()) },
      payload: { stringValue: JSON.stringify(payloadState) },
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
