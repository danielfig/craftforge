import { sanitizeRealmName } from '../store/itemStore';

export interface RealmInvitePayload {
  realmName: string;
  realmCode: string; // Realm password
  inviterName?: string;
}

interface CompactInvitePayload {
  n: string;
  c: string;
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
  'VAULT',
  'GUILD',
  'COVE',
  'TOWER',
  'CHEST',
  'CAMP',
];

const PASSWORD_WORDS = [
  'creeper',
  'diamond',
  'emerald',
  'pickaxe',
  'redstone',
  'obsidian',
  'villager',
  'enderman',
  'beacon',
  'nether',
  'torch',
  'anvil',
];

export function generateRandomRealmName(): string {
  const adj = REALM_ADJECTIVES[Math.floor(Math.random() * REALM_ADJECTIVES.length)];
  const noun = REALM_NOUNS[Math.floor(Math.random() * REALM_NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return sanitizeRealmName(`${adj}-${noun}${num}`);
}

export function generateRandomRealmPassword(): string {
  const word = PASSWORD_WORDS[Math.floor(Math.random() * PASSWORD_WORDS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}${num}`;
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
    n: sanitizeRealmName(payload.realmName),
    c: payload.realmCode.trim(),
  };
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
    if (
      !parsed ||
      typeof parsed.n !== 'string' ||
      !parsed.n.trim() ||
      typeof parsed.c !== 'string' ||
      !parsed.c.trim()
    ) {
      return null;
    }
    return {
      realmName: sanitizeRealmName(parsed.n),
      realmCode: parsed.c.trim(),
      inviterName:
        typeof parsed.f === 'string' && parsed.f.trim() ? parsed.f.trim().slice(0, 24) : undefined,
    };
  } catch {
    return null;
  }
}

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://danielfig.github.io/craftforge/';
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

  const hash = target.hash || '';
  const hashMatch = hash.match(/(?:^#|&)join=([^&]+)/);
  if (hashMatch && hashMatch[1]) {
    const decoded = decodeInvitePayload(decodeURIComponent(hashMatch[1]));
    if (decoded) return decoded;
  }

  const params = new URLSearchParams(target.search || '');
  const queryJoin = params.get('join');
  if (queryJoin) {
    const decoded = decodeInvitePayload(queryJoin);
    if (decoded) return decoded;
  }

  const queryName = params.get('realmName') || params.get('realm');
  const queryCode = params.get('realmCode') || params.get('code');
  if (queryName?.trim() && queryCode?.trim()) {
    return {
      realmName: sanitizeRealmName(queryName),
      realmCode: queryCode.trim(),
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
  realmName: string;
  realmCode: string;
  inviterName?: string;
  personalNote?: string;
  joinUrl: string;
  appUrl?: string;
}

export function buildInviteEmailContent(options: InviteEmailOptions): {
  subject: string;
  body: string;
} {
  const realmName = sanitizeRealmName(options.realmName);
  const realmCode = options.realmCode.trim();
  const inviter = options.inviterName?.trim() || 'A friend';
  const appUrl = options.appUrl || getAppBaseUrl();

  const subject = `Join my CraftForge Realm: ${realmName}!`;

  const lines: string[] = [
    'Hi!',
    '',
    `${inviter} invited you to join their CraftForge realm "${realmName}" to design Minecraft items and share them in our chest!`,
  ];

  if (options.personalNote?.trim()) {
    lines.push('', `"${options.personalNote.trim()}"`);
  }

  lines.push(
    '',
    '1-Tap Join Link:',
    options.joinUrl,
    '',
    'Or join manually:',
    `1. Open CraftForge: ${appUrl}`,
    `2. Realm Name: ${realmName}`,
    `3. Realm Code: ${realmCode}`,
    '4. Pick a Crafter Name & 3-digit PIN and start crafting!',
    '',
    'See you in the realm!',
    '— CraftForge'
  );

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
