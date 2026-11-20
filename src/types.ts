export type PlayerId = 'player1' | 'player2';

export interface PlayerProfile {
  id: PlayerId;
  name: string;
  avatarId: string;
  color: string;
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
  creatorId: PlayerId;
  recipientId: PlayerId;
  createdAt: number;
  grade: number | null; // 0..10 integer, null if unrated
  gradeComment?: string;
  gradedAt?: number;
}

export interface RealmState {
  realmCode: string;
  players: Record<PlayerId, PlayerProfile>;
  items: CraftItem[];
}
