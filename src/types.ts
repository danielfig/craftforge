export type PlayerId = string;
export type ItemAuthorId = PlayerId | 'neon';

export interface PlayerProfile {
  id: PlayerId;
  name: string;
  avatarId: string;
  color: string;
  pinHash?: string;
}

export type ItemCategory =
  | 'weapon'
  | 'tool'
  | 'armor'
  | 'potion'
  | 'food'
  | 'block'
  | 'magic'
  | 'mob';

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface CraftItem {
  id: string;
  realmCode: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  enchanted: boolean;
  pixels: string[]; // 256 entries (16x16), '' for transparent or '#rrggbb'
  creatorId: ItemAuthorId;
  recipientId: ItemAuthorId;
  createdAt: number;
  grade: number | null; // 0..10 integer, null if unrated
  gradeComment?: string;
  gradedAt?: number;
  hidden?: boolean;
  hiddenUpdatedAt?: number;
  isDemo?: boolean;
}

export interface RealmState {
  realmCode: string; // Realm Name (continuous 3-20 char string, e.g. DRAGONKEEP)
  realmPassword?: string; // Realm Code (password) stored locally only, never written raw to Firestore
  realmCodeHash?: string; // Deterministic hash of Realm Name + Realm Code stored in Firestore
  players: Record<PlayerId, PlayerProfile>;
  items: CraftItem[];
}
