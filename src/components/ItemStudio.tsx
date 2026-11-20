import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CraftItem, ItemCategory, ItemRarity, PlayerProfile } from '../types';
import { ItemTemplate } from '../assets/templates';
import { renderPixelsToDataUrl } from '../assets/textures';
import { playSound } from '../utils/sounds';
import PixelCanvas from './PixelCanvas';

export type NewCraftItemPayload = Omit<
  CraftItem,
  | 'id'
  | 'realmCode'
  | 'creatorId'
  | 'recipientId'
  | 'createdAt'
  | 'grade'
  | 'gradeComment'
  | 'gradedAt'
  | 'votes'
>;

export interface ItemStudioProps {
  currentPlayer: PlayerProfile;
  otherPlayers: PlayerProfile[];
  onSendItem: (item: NewCraftItemPayload) => void;
}

const CATEGORIES: { id: ItemCategory; icon: string; label: string }[] = [
  { id: 'weapon', icon: '⚔️', label: 'Weapon' },
  { id: 'tool', icon: '⛏️', label: 'Tool' },
  { id: 'armor', icon: '🛡️', label: 'Armor' },
  { id: 'potion', icon: '🧪', label: 'Potion' },
  { id: 'food', icon: '🍎', label: 'Food' },
  { id: 'block', icon: '🧱', label: 'Block' },
  { id: 'magic', icon: '✨', label: 'Magic' },
  { id: 'mob', icon: '👾', label: 'Mob' },
];

const RARITIES: {
  id: ItemRarity;
  label: string;
  color: string;
  bg: string;
}[] = [
  { id: 'common', label: 'Common', color: '#ffffff', bg: '#5a5a5a' },
  { id: 'uncommon', label: 'Uncommon', color: '#55ff55', bg: '#266b26' },
  { id: 'rare', label: 'Rare', color: '#55ffff', bg: '#1e5e73' },
  { id: 'epic', label: 'Epic', color: '#d580ff', bg: '#5b227a' },
  { id: 'legendary', label: 'Legendary', color: '#ffaa00', bg: '#8a5500' },
];

const RANDOM_NAMES: Record<ItemCategory, string[]> = {
  weapon: [
    'Creeper Crusher',
    'Nether Star Blade',
    'Lightning Katana',
    'Dragonfang Sword',
    'Slime Smasher',
    'Obsidian Saber',
  ],
  tool: [
    'Turbo Diamond Pick',
    'Mega Quarry Drill',
    'Bedrock Breaker',
    'Redstone Wrench',
    'Emerald Excavator',
    'Sky Grapple Hook',
  ],
  armor: [
    'Turtle Power Shield',
    'Phantom Wing Cloak',
    'Netherite Titan Helm',
    'Frostbite Boots',
    'Ender Knight Plate',
    'Bouncy Slime Vest',
  ],
  potion: [
    'Super Jump Juice',
    'Invisi-Fizz Brew',
    'Lava Swim Elixir',
    'Hyper Speed Splash',
    'Rainbow Heal Potion',
    'Night Owl Tonic',
  ],
  food: [
    'Enchanted Mega Apple',
    'Rocket Berry Pie',
    'Creeper Crunch Cookie',
    'Golden Honeycomb',
    'Dragon Chili Taco',
    'Glowberry Smoothie',
  ],
  block: [
    'Mega TNT Cube',
    'Bouncy Slime Block',
    'Lucky Mystery Box',
    'Rainbow Beacon',
    'Teleport Pad',
    'Laser Redstone Core',
  ],
  magic: [
    'Ender Storm Wand',
    'Amethyst Frost Staff',
    'Warden Echo Orb',
    'Meteor Summoner',
    'Gravity Crystal',
    'Portal Pocket Watch',
  ],
  mob: [
    'Mini Ender Dragon',
    'Pocket Iron Golem',
    'Disco Creeper',
    'Turbo Axolotl',
    'Jetpack Chicken',
    'Crystal Slime Buddy',
  ],
};

function createBlankPixels(): string[] {
  return Array(256).fill('');
}

export const ItemStudio: React.FC<ItemStudioProps> = ({
  currentPlayer,
  onSendItem,
}) => {
  const [pixels, setPixels] = useState<string[]>(() => createBlankPixels());
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<ItemCategory>('weapon');
  const [rarity, setRarity] = useState<ItemRarity>('rare');
  const [enchanted, setEnchanted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentToast, setSentToast] = useState<{
    itemName: string;
    previewUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!sentToast) return;
    const timer = window.setTimeout(() => setSentToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [sentToast]);

  const previewDataUrl = useMemo(() => renderPixelsToDataUrl(pixels, 6), [pixels]);
  const hasPixels = useMemo(() => pixels.some((p) => p !== ''), [pixels]);

  const activeRarity = RARITIES.find((r) => r.id === rarity) || RARITIES[0];
  const activeCategory = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];

  const handleTemplateSelect = useCallback(
    (template: ItemTemplate) => {
      setCategory(template.category);
      if (!name.trim() && template.id !== 'blank') {
        setName(template.name);
      }
      setErrorMsg(null);
    },
    [name]
  );

  const handleRandomName = useCallback(() => {
    const pool = RANDOM_NAMES[category] || RANDOM_NAMES.weapon;
    const candidates = pool.filter((n) => n !== name);
    const pick =
      candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
    setName(pick);
    setErrorMsg(null);
    playSound('click');
  }, [category, name]);

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      const trimmedDesc = description.trim();

      if (!hasPixels) {
        setErrorMsg('Draw something on the 16×16 canvas (or pick a template) first!');
        playSound('click');
        return;
      }
      if (!trimmedName) {
        setErrorMsg('Give your item a cool name (or tap the 🎲 dice button)!');
        playSound('click');
        return;
      }

      const finalDescription =
        trimmedDesc ||
        `A custom ${activeRarity.label.toLowerCase()} ${activeCategory.label.toLowerCase()} crafted by ${currentPlayer.name}!`;

      const snapshotUrl = renderPixelsToDataUrl(pixels, 4);

      onSendItem({
        name: trimmedName,
        description: finalDescription,
        category,
        rarity,
        enchanted,
        pixels: pixels.slice(),
      });

      playSound('craft');
      setSentToast({
        itemName: trimmedName,
        previewUrl: snapshotUrl,
      });

      // Reset studio immediately so they can craft another item right away
      setPixels(createBlankPixels());
      setName('');
      setDescription('');
      setEnchanted(false);
      setErrorMsg(null);
    },
    [
      activeCategory.label,
      activeRarity.label,
      category,
      currentPlayer.name,
      description,
      enchanted,
      hasPixels,
      name,
      onSendItem,
      pixels,
      rarity,
    ]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* Scoped Pixel Tablet 16:10 layout & live preview animation */}
      <style>{`
        .cf-studio-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: start;
          width: 100%;
        }
        @media (min-width: 900px) {
          .cf-studio-grid {
            grid-template-columns: minmax(0, 1.38fr) minmax(0, 1fr);
            gap: 14px;
            align-items: start;
          }
        }
        @keyframes cfItemFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .cf-float-sprite {
          animation: cfItemFloat 2.4s ease-in-out infinite;
        }
      `}</style>

      {/* Celebratory Sent Toast */}
      {sentToast && (
        <div
          className="mc-panel"
          role="status"
          style={{
            padding: '10px 14px',
            background: 'linear-gradient(90deg, #2d6a27, #3e8e35)',
            border: '3px solid #1b3f17',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
          }}
        >
          <div
            className="mc-slot"
            style={{
              width: '50px',
              height: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img
              src={sentToast.previewUrl}
              alt={sentToast.itemName}
              className="mc-pixelated"
              style={{ width: '40px', height: '40px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '14px', textShadow: '2px 2px 0 #143310' }}>
              🎉 ITEM CRAFTED &amp; SAVED!
            </div>
            <div style={{ fontSize: '13px', color: '#e8ffe4', marginTop: '2px' }}>
              <strong>{sentToast.itemName}</strong> is saved in the Realm! Other players can vote on
              it and you can track its stats. Ready to craft another!
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSentToast(null)}
            className="mc-btn"
            style={{ minHeight: '40px', minWidth: '40px', padding: '4px 10px', fontSize: '12px' }}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pixel Tablet Side-by-Side Layout (~58% Left Canvas+Rail, ~42% Right Tooltip+Form) */}
      <div className="cf-studio-grid">
        {/* LEFT COLUMN: Pixel Art Studio */}
        <div
          className="mc-panel"
          style={{
            padding: '12px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
              gap: '8px',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '15px',
                color: '#222',
                letterSpacing: '0.5px',
              }}
            >
              ⛏️ PIXEL CRAFTING BENCH
            </h2>
            <span
              style={{
                fontSize: '11px',
                color: '#444',
                fontWeight: 700,
              }}
            >
              16×16 Sprite
            </span>
          </div>

          <PixelCanvas
            pixels={pixels}
            onChange={(next) => {
              setPixels(next);
              if (errorMsg) setErrorMsg(null);
            }}
            onTemplateSelect={handleTemplateSelect}
          />
        </div>

        {/* RIGHT COLUMN: Live Tooltip Preview + Item Details Form */}
        <form
          onSubmit={handleSend}
          className="mc-panel"
          style={{
            padding: '12px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Live Floating Minecraft Item Tooltip Preview */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#333',
                marginBottom: '6px',
                letterSpacing: '0.5px',
              }}
            >
              ✨ LIVE MINECRAFT PREVIEW
            </div>

            <div
              className="mc-tooltip"
              style={{
                padding: '10px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              {/* Rendered 16x16 Item Slot */}
              <div
                className={`mc-slot ${enchanted ? 'mc-enchanted' : ''}`}
                style={{
                  width: '80px',
                  height: '80px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {hasPixels ? (
                  <img
                    src={previewDataUrl}
                    alt={name || 'Item preview'}
                    className="mc-pixelated cf-float-sprite"
                    style={{ width: '66px', height: '66px', objectFit: 'contain' }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#ddd',
                      textAlign: 'center',
                      padding: '4px',
                    }}
                  >
                    Draw on canvas!
                  </span>
                )}
              </div>

              {/* Tooltip Text */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: activeRarity.color,
                    textShadow: '2px 2px 0 #000',
                    wordBreak: 'break-word',
                  }}
                >
                  {name.trim() || 'Unnamed Creation'}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                  <span
                    className="mc-badge"
                    style={{
                      backgroundColor: activeRarity.bg,
                      color: activeRarity.color,
                      fontSize: '10px',
                      padding: '2px 6px',
                      border: `1px solid ${activeRarity.color}`,
                    }}
                  >
                    {activeRarity.label}
                  </span>
                  <span
                    className="mc-badge"
                    style={{
                      backgroundColor: '#2c2c3c',
                      color: '#e0e0ff',
                      fontSize: '10px',
                      padding: '2px 6px',
                      border: '1px solid #5a5a7a',
                    }}
                  >
                    {activeCategory.icon} {activeCategory.label}
                  </span>
                  {enchanted && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#d580ff',
                        fontWeight: 700,
                      }}
                    >
                      ✦ Enchanted
                    </span>
                  )}
                </div>

                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: '12px',
                    lineHeight: 1.35,
                    color: description.trim() ? '#b8a8d8' : '#776d8a',
                    fontStyle: description.trim() ? 'normal' : 'italic',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {description.trim() || 'Describe what awesome power this item has...'}
                </p>

                <div
                  style={{
                    marginTop: '2px',
                    fontSize: '10px',
                    color: '#7f8c9a',
                  }}
                >
                  By <strong style={{ color: '#c4e0ff' }}>{currentPlayer.name}</strong> •{' '}
                  <strong style={{ color: '#ffdf85' }}>Open for Realm Voting</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Item Name + Random Dice Button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="craft-item-name"
              style={{ fontSize: '11px', fontWeight: 800, color: '#222' }}
            >
              🏷️ ITEM NAME
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="craft-item-name"
                type="text"
                className="mc-input"
                value={name}
                maxLength={40}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="e.g. Super Creeper Crusher"
                style={{ flex: 1, minHeight: '44px', fontSize: '14px' }}
              />
              <button
                type="button"
                onClick={handleRandomName}
                className="mc-btn mc-btn-gold"
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
                title="Generate a fun random Minecraft item name"
              >
                <span style={{ fontSize: '16px' }}>🎲</span>
                <span>Idea</span>
              </button>
            </div>
          </div>

          {/* Category Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#222' }}>
              📦 CATEGORY
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '5px',
              }}
            >
              {CATEGORIES.map((cat) => {
                const selected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      playSound('click');
                    }}
                    className={`mc-btn ${selected ? 'mc-btn-gold' : ''}`}
                    style={{
                      minHeight: '44px',
                      padding: '4px 3px',
                      fontSize: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                    }}
                    aria-pressed={selected}
                  >
                    <span style={{ fontSize: '15px', lineHeight: 1 }}>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rarity Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#222' }}>
              💎 RARITY
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: '4px',
              }}
            >
              {RARITIES.map((r) => {
                const selected = rarity === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setRarity(r.id);
                      playSound('click');
                    }}
                    className="mc-btn"
                    style={{
                      minHeight: '44px',
                      padding: '4px 2px',
                      fontSize: '10px',
                      backgroundColor: selected ? r.bg : undefined,
                      color: selected ? r.color : '#f5f5f5',
                      outline: selected ? `2px solid ${r.color}` : 'none',
                      textShadow: '1px 1px 0 #000',
                    }}
                    aria-pressed={selected}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enchanted Glint Toggle */}
          <div
            className="mc-panel-dark"
            style={{
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#e6c2ff' }}>
                ✨ Enchanted Glint
              </div>
              <div style={{ fontSize: '10px', color: '#b5b5c8' }}>
                Magical purple Minecraft shimmer!
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enchanted}
              onClick={() => {
                setEnchanted((prev) => {
                  const next = !prev;
                  playSound(next ? 'xp' : 'click');
                  return next;
                });
              }}
              className={`mc-btn ${enchanted ? 'mc-btn-purple' : ''}`}
              style={{
                minWidth: '84px',
                minHeight: '44px',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              {enchanted ? '✦ ON' : 'OFF'}
            </button>
          </div>

          {/* Description Textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                htmlFor="craft-item-desc"
                style={{ fontSize: '11px', fontWeight: 800, color: '#222' }}
              >
                📜 WHAT DOES IT DO? / HOW DOES IT WORK?
              </label>
              <span style={{ fontSize: '10px', color: '#555' }}>
                {description.length}/220
              </span>
            </div>
            <textarea
              id="craft-item-desc"
              className="mc-input"
              rows={2}
              maxLength={220}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Shoots bouncing lava snowballs and gives you super speed!"
              style={{
                resize: 'vertical',
                minHeight: '64px',
                fontSize: '13px',
                lineHeight: 1.35,
              }}
            />
          </div>

          {/* Validation Error */}
          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '8px 10px',
                backgroundColor: '#5c1818',
                border: '2px solid #ff6b6b',
                color: '#ffe5e5',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Big Chunky Green Save Button */}
          <button
            type="submit"
            className="mc-btn mc-btn-green"
            style={{
              width: '100%',
              minHeight: '54px',
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '0.6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '19px' }}>💾</span>
            <span>SAVE ITEM TO REALM!</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ItemStudio;
