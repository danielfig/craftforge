import { sanitizeRealmCode } from '../store/itemStore';

export interface RealmInvitePayload {
  realmCode: string;
  projectId?: string;
  apiKey?: string;
  inviterName?: string;
}

interface CompactInvitePayload {
  r: string;
  p?: string;
  k?: string;
  f?: string;
}

const REALM_ADJECTIVES = [
  'DIAMOND',
  'EMERALD',
  'NETHER',
  'OBSIDIAN',
  'REDSTONE',
  'AMETHYST',
  'GOLDEN',
  'ENDER',
  'COPPER',
  'CREEPER',
  'BEACON',
  'FROST',
];

const REALM_NOUNS = [
  'FORGE',
  'KEEP',
  'CRAFT',
  'PEAK',
  'VALLEY',
  'CITADEL',
  'VAULT',
  'GUILD',
  'COVE',
  'BASTION',
  'TOWER',
  'CHEST',
];

export function generateRandomRealmCode(): string {
  const adj = REALM_ADJECTIVES[Math.floor(Math.random() * REALM_ADJECTIVES.length)];
  const noun = REALM_NOUNS[Math.floor(Math.random() * REALM_NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}-${noun}-${num}`;
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeInvitePayload(payload: RealmInvitePayload): string {
  const compact: CompactInvitePayload = {
    r: sanitizeRealmCode(payload.realmCode),
  };
  if (payload.projectId?.trim()) {
    compact.p = payload.projectId.trim();
  }
  if (payload.apiKey?.trim()) {
    compact.k = payload.apiKey.trim();
  }
  if (payload.inviterName?.trim()) {
    compact.f = payload.inviterName.trim().slice(0, 24);
  }
  return toBase64Url(JSON.stringify(compact));
}

export function decodeInvitePayload(encoded: string): RealmInvitePayload | null {
  try {
    const trimmed = encoded.trim();
    if (!trimmed) return null;
    const json = fromBase64Url(trimmed);
    const parsed = JSON.parse(json) as Partial<CompactInvitePayload>;
    if (!parsed || typeof parsed.r !== 'string' || !parsed.r.trim()) {
      return null;
    }
    return {
      realmCode: sanitizeRealmCode(parsed.r),
      projectId: typeof parsed.p === 'string' && parsed.p.trim() ? parsed.p.trim() : undefined,
      apiKey: typeof parsed.k === 'string' && parsed.k.trim() ? parsed.k.trim() : undefined,
      inviterName:
        typeof parsed.f === 'string' && parsed.f.trim() ? parsed.f.trim().slice(0, 24) : undefined,
    };
  } catch {
    return null;
  }
}

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://craftforge.app/';
  return `${window.location.origin}${window.location.pathname}`;
}

export function buildJoinUrl(payload: RealmInvitePayload, baseUrl?: string): string {
  const base = (baseUrl || getAppBaseUrl()).split('#')[0].split('?')[0];
  const encoded = encodeInvitePayload(payload);
  return `${base}#join=${encoded}`;
}

export function parseInviteFromLocation(loc?: Location): RealmInvitePayload | null {
  const target = loc || (typeof window !== 'undefined' ? window.location : undefined);
  if (!target) return null;

  // Prefer hash (#join=...) so keys/codes never hit server logs or Referer headers
  const hash = target.hash || '';
  const hashMatch = hash.match(/(?:^#|&)join=([^&]+)/);
  if (hashMatch && hashMatch[1]) {
    const decoded = decodeInvitePayload(decodeURIComponent(hashMatch[1]));
    if (decoded) return decoded;
  }

  // Fallback to query params (?join=... or ?realm=...)
  const params = new URLSearchParams(target.search || '');
  const queryJoin = params.get('join');
  if (queryJoin) {
    const decoded = decodeInvitePayload(queryJoin);
    if (decoded) return decoded;
  }

  const queryRealm = params.get('realm');
  if (queryRealm && queryRealm.trim()) {
    return {
      realmCode: sanitizeRealmCode(queryRealm),
      projectId: params.get('projectId')?.trim() || undefined,
      apiKey: params.get('apiKey')?.trim() || undefined,
      inviterName: params.get('from')?.trim() || undefined,
    };
  }

  return null;
}

export function clearInviteFromUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState(null, '', cleanUrl);
}

export interface InviteEmailOptions {
  realmCode: string;
  inviterName?: string;
  inviteeName?: string;
  personalNote?: string;
  joinUrl: string;
  appUrl?: string;
  cloudProjectId?: string;
  cloudApiKey?: string;
  playerNames?: string[];
}

export function buildInviteEmailContent(options: InviteEmailOptions): {
  subject: string;
  body: string;
} {
  const realmCode = sanitizeRealmCode(options.realmCode);
  const inviter = options.inviterName?.trim() || 'A friend';
  const greeting = options.inviteeName?.trim() ? `Hi ${options.inviteeName.trim()},` : 'Hi there,';
  const appUrl = options.appUrl || getAppBaseUrl();
  const hasCloud = Boolean(options.cloudProjectId?.trim());

  const subject = `Join my CraftForge Realm: ${realmCode}!`;

  const lines: string[] = [
    greeting,
    '',
    `${inviter} invited you to join their CraftForge Minecraft Item Studio realm (${realmCode})!`,
    'Design 16x16 pixel-art Minecraft items, send them over, and rate creations from 0 to 10.',
  ];

  if (options.personalNote?.trim()) {
    lines.push('', `Message from ${inviter}:`, `"${options.personalNote.trim()}"`);
  }

  lines.push(
    '',
    '========================================',
    'OPTION 1: 1-CLICK JOIN (EASIEST!)',
    '========================================',
    'Click or tap this link to open CraftForge and join automatically:',
    options.joinUrl,
    '',
    '========================================',
    'OPTION 2: JOIN MANUALLY',
    '========================================',
    `1. Open CraftForge: ${appUrl}`,
    `2. Enter this Realm Code: ${realmCode}`
  );

  if (hasCloud) {
    lines.push(
      '3. Tap "☁ Sync" in the top bar and enter:',
      `   - Firebase Project ID: ${options.cloudProjectId!.trim()}`
    );
    if (options.cloudApiKey?.trim()) {
      lines.push(`   - Web API Key: ${options.cloudApiKey.trim()}`);
    }
    lines.push(
      '   Then tap "Save & Enable Cloud Sync".',
      '4. Enter your Crafter Name & a 3-digit PIN, pick your avatar, and start crafting!'
    );
  } else {
    lines.push(
      '3. Enter your Crafter Name & a 3-digit PIN, pick your avatar, and start crafting!',
      '   (Note: To sync live across separate devices, enable free Firebase Cloud Sync under "☁ Cloud Sync".)'
    );
  }

  if (options.playerNames && options.playerNames.length > 0) {
    lines.push('', `Current Crafters in this Realm: ${options.playerNames.join(', ')}`);
  }

  lines.push('', 'Happy crafting!', '— CraftForge');

  return {
    subject,
    body: lines.join('\n'),
  };
}

export function buildMailtoUrl(to: string, subject: string, body: string): string {
  const cleanTo = to
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');
  return `mailto:${encodeURIComponent(cleanTo).replace(/%2C/g, ',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildGmailComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  params.set('view', 'cm');
  params.set('fs', '1');
  if (to.trim()) {
    params.set('to', to.trim());
  }
  params.set('su', subject);
  params.set('body', body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}
