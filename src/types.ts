export type PlayerId = string;
export type ItemAuthorId = PlayerId | 'neon' | 'all';

export interface ItemVoteSnapshot {
  score: number; // 0..10 integer
  comment?: string;
  votedAt: number;
}

export interface ItemVote {
  playerId: PlayerId;
  score: number; // 0..10 integer (current active vote)
  comment?: string;
  votedAt: number;
  changesUsed: number; // 0 on initial vote, 1 after changing vote once (max 1)
  history?: ItemVoteSnapshot[]; // Previous votes/comments preserved when changed
}

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
  grade: number | null; // Legacy/summary average score (0..10), null if unrated
  gradeComment?: string;
  gradedAt?: number;
  votes?: Record<PlayerId, ItemVote>; // Per-player votes (0..10)
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
