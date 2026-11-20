import React, { useState, useMemo, useEffect } from 'react';
import { CraftItem, ItemAuthorId, ItemRarity, PlayerId, PlayerProfile } from '../types';
import { AVATARS, renderPixelsToDataUrl } from '../assets/textures';
import { isDemoItem } from '../store/itemStore';
import { playSound } from '../utils/sounds';

export interface SharedChestProps {
  items: CraftItem[];
  players: Record<PlayerId, PlayerProfile>;
  currentPlayerId: PlayerId;
  onToggleHideItem?: (itemId: string) => void;
}

type FilterMode = 'all' | 'graded' | 'pending' | 'hidden' | `player:${PlayerId}`;
type SortMode = 'newest' | 'highest';

const PLAYER_STAT_COLORS = ['#ffd700', '#55ffff', '#ff77ff', '#55ff55', '#ffaa00', '#ff6666'];

const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#ffffff',
  uncommon: '#55ff55',
  rare: '#55ffff',
  epic: '#ff55ff',
  legendary: '#ffaa00',
};

const GRADE_TITLES: Record<number, string> = {
  0: 'Bedrock Dud',
  1: 'Dirt Block',
  2: 'Cobble Rookie',
  3: 'Wooden Pick',
  4: 'Coal Miner',
  5: 'Iron Crafter',
  6: 'Redstone Tinker',
  7: 'Gold Enchanter',
  8: 'Diamond Tier!',
  9: 'Emerald Master!',
  10: 'NETHERITE LEGEND!',
};

function getScoreBadgeStyle(grade: number): { bg: string; color: string; border: string } {
  if (grade >= 10) return { bg: '#4b145b', color: '#ff55ff', border: '#ff55ff' };
  if (grade >= 8) return { bg: '#0c5966', color: '#55ffff', border: '#55ffff' };
  if (grade >= 6) return { bg: '#145920', color: '#55ff55', border: '#55ff55' };
  if (grade >= 4) return { bg: '#665200', color: '#ffd700', border: '#ffd700' };
  return { bg: '#444444', color: '#dddddd', border: '#999999' };
}

function getPlayerProfile(
  players: Record<PlayerId, PlayerProfile>,
  id: ItemAuthorId
): PlayerProfile | undefined {
  return id && id !== 'neon' ? players[id] : undefined;
}

function getAvatarUrl(avatarId: string): string {
  const found = AVATARS.find((a) => a.id === avatarId) || AVATARS[0];
  return found ? found.dataUrl : '';
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const SharedChest: React.FC<SharedChestProps> = ({
  items,
  players,
  currentPlayerId,
  onToggleHideItem,
}) => {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);

  const playerList = useMemo(() => Object.values(players), [players]);

  const nonHiddenItems = useMemo(() => items.filter((i) => !i.hidden), [items]);
  const nonDemoItems = useMemo(
    () => nonHiddenItems.filter((i) => !isDemoItem(i)),
    [nonHiddenItems]
  );
  const myHiddenItems = useMemo(
    () => items.filter((i) => !isDemoItem(i) && i.hidden && i.creatorId === currentPlayerId),
    [items, currentPlayerId]
  );

  // Reset filter to 'all' if hidden empties or a filtered player was removed
  useEffect(() => {
    if (filter === 'hidden' && myHiddenItems.length === 0) {
      setFilter('all');
    } else if (filter.startsWith('player:')) {
      const targetId = filter.slice('player:'.length);
      if (!players[targetId]) {
        setFilter('all');
      }
    }
  }, [filter, myHiddenItems.length, players]);

  // Compute top stats (excluding hidden and starter demo items) dynamically for all players
  const stats = useMemo(() => {
    const totalCrafted = nonDemoItems.length;
    const gradedItems = nonDemoItems.filter((i) => i.grade !== null);
    const gradedCount = gradedItems.length;

    const avgByPlayer: Record<PlayerId, string> = {};
    for (const p of playerList) {
      const pGraded = gradedItems.filter((i) => i.creatorId === p.id);
      if (pGraded.length === 0) {
        avgByPlayer[p.id] = '—';
      } else {
        const sum = pGraded.reduce((acc, i) => acc + (i.grade ?? 0), 0);
        avgByPlayer[p.id] = (sum / pGraded.length).toFixed(1);
      }
    }

    return {
      totalCrafted,
      gradedCount,
      avgByPlayer,
    };
  }, [nonDemoItems, playerList]);

  // Filter & sort items (starter demo items appear only in 'all')
  const visibleItems = useMemo(() => {
    let list = nonHiddenItems;
    if (filter === 'hidden') {
      list = myHiddenItems;
    } else if (filter === 'graded') {
      list = nonDemoItems.filter((i) => i.grade !== null);
    } else if (filter === 'pending') {
      list = nonDemoItems.filter((i) => i.grade === null);
    } else if (filter.startsWith('player:')) {
      const targetId = filter.slice('player:'.length);
      list = nonDemoItems.filter((i) => i.creatorId === targetId);
    }

    return [...list].sort((a, b) => {
      if (sort === 'highest') {
        const ga = a.grade ?? -1;
        const gb = b.grade ?? -1;
        if (gb !== ga) return gb - ga;
      }
      return b.createdAt - a.createdAt;
    });
  }, [nonHiddenItems, nonDemoItems, myHiddenItems, filter, sort]);

  // Render crisp pixel art URLs once per items change
  const pixelUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      map[item.id] = renderPixelsToDataUrl(item.pixels, 8);
    }
    return map;
  }, [items]);

  const inspectItem = useMemo(
    () => items.find((i) => i.id === inspectItemId) || null,
    [items, inspectItemId]
  );

  // Close inspection modal on Escape
  useEffect(() => {
    if (!inspectItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectItemId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectItem]);

  const handleFilterChange = (next: FilterMode) => {
    playSound('click');
    setFilter(next);
  };

  const handleSortChange = (next: SortMode) => {
    playSound('click');
    setSort(next);
  };

  const handleOpenInspect = (itemId: string) => {
    playSound('chest');
    setInspectItemId(itemId);
  };

  return (
    <div style={{ width: '100%', maxWidth: '1360px', margin: '0 auto' }}>
      {/* Pixel Tablet Double-Chest Responsive Grid (4-5 cols landscape, 3-4 cols portrait) */}
      <style>{`
        .cf-chest-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        @media (min-width: 600px) {
          .cf-chest-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (min-width: 860px) {
          .cf-chest-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
        }
        @media (min-width: 1120px) {
          .cf-chest-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 14px;
          }
        }
      `}</style>

      {/* Top Stats Banner */}
      <div
        className="mc-panel-dark"
        style={{
          padding: '14px 18px',
          marginBottom: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: '12px',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.35)',
            border: '2px solid #444',
            padding: '10px 12px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: "'Silkscreen', monospace",
              fontSize: '0.72rem',
              color: '#bbbbbb',
              marginBottom: '4px',
            }}
          >
            TOTAL CRAFTED
          </div>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '1.35rem',
              color: '#ffffff',
            }}
          >
            {stats.totalCrafted}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(0,0,0,0.35)',
            border: '2px solid #444',
            padding: '10px 12px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: "'Silkscreen', monospace",
              fontSize: '0.72rem',
              color: '#bbbbbb',
              marginBottom: '4px',
            }}
          >
            GRADED ITEMS
          </div>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '1.35rem',
              color: '#55ff55',
            }}
          >
            {stats.gradedCount}
          </div>
        </div>

        {/* Dynamic Player Averages */}
        {playerList.map((player, idx) => {
          const avg = stats.avgByPlayer[player.id] ?? '—';
          const scoreColor = PLAYER_STAT_COLORS[idx % PLAYER_STAT_COLORS.length];
          return (
            <div
              key={player.id}
              style={{
                backgroundColor: 'rgba(0,0,0,0.35)',
                border: `2px solid ${currentPlayerId === player.id ? '#55ff55' : '#444'}`,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <img
                src={getAvatarUrl(player.avatarId)}
                alt={player.name}
                className="mc-pixelated"
                style={{ width: '38px', height: '38px', imageRendering: 'pixelated' }}
              />
              <div>
                <div
                  style={{
                    fontFamily: "'Silkscreen', monospace",
                    fontSize: '0.7rem',
                    color: '#d0d0d0',
                  }}
                >
                  {player.name} AVG
                </div>
                <div
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '1.08rem',
                    color: scoreColor,
                    marginTop: '3px',
                  }}
                >
                  {avg}
                  {avg !== '—' && <span style={{ fontSize: '0.7rem', color: '#aaa' }}>/10</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter & Sort Bar */}
      <div
        className="mc-panel"
        style={{
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'graded', label: 'Graded' },
              { id: 'pending', label: 'Waiting for Grade' },
              ...playerList.map((p) => ({
                id: `player:${p.id}` as FilterMode,
                label: `By ${p.name}`,
              })),
              ...(myHiddenItems.length > 0
                ? [{ id: 'hidden' as FilterMode, label: `🙈 Hidden (${myHiddenItems.length})` }]
                : []),
            ] as { id: FilterMode; label: string }[]
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              className={`mc-btn ${filter === btn.id ? 'mc-btn-green' : ''}`}
              onClick={() => handleFilterChange(btn.id)}
              style={{
                fontSize: '0.78rem',
                padding: '8px 14px',
                minHeight: '44px',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: "'Silkscreen', monospace",
              fontSize: '0.74rem',
              color: '#3a3a3a',
            }}
          >
            SORT:
          </span>
          <button
            type="button"
            className={`mc-btn ${sort === 'newest' ? 'mc-btn-gold' : ''}`}
            onClick={() => handleSortChange('newest')}
            style={{ fontSize: '0.76rem', padding: '8px 12px', minHeight: '44px' }}
          >
            Newest
          </button>
          <button
            type="button"
            className={`mc-btn ${sort === 'highest' ? 'mc-btn-gold' : ''}`}
            onClick={() => handleSortChange('highest')}
            style={{ fontSize: '0.76rem', padding: '8px 12px', minHeight: '44px' }}
          >
            Highest Score
          </button>
        </div>
      </div>

      {/* Double-Chest Inventory Panel */}
      <div
        className="mc-panel"
        style={{
          padding: '18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            paddingBottom: '10px',
            borderBottom: '3px solid #8b8b8b',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 'clamp(0.85rem, 2vw, 1.05rem)',
              color: '#373737',
            }}
          >
            SHARED DOUBLE CHEST
          </h2>
          <span
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: '1.3rem',
              color: '#4a4a4a',
            }}
          >
            {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {visibleItems.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              fontFamily: "'VT323', monospace",
              fontSize: '1.45rem',
              color: '#444444',
            }}
          >
            No items in this chest filter yet. Head to the Item Studio to craft something awesome!
          </div>
        ) : (
          <div className="cf-chest-grid">
            {visibleItems.map((item) => {
              const demo = isDemoItem(item);
              const creator = demo ? undefined : getPlayerProfile(players, item.creatorId);
              const rarityColor = RARITY_COLORS[item.rarity] || '#ffffff';
              const isGraded = !demo && item.grade !== null;
              const badgeStyle = isGraded ? getScoreBadgeStyle(item.grade as number) : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenInspect(item.id)}
                  className="mc-panel-dark"
                  style={{
                    padding: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    border: `3px solid ${rarityColor}`,
                    position: 'relative',
                    transition: 'transform 0.1s ease',
                  }}
                >
                  {/* Rarity + Score or Pending Badge */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'VT323', monospace",
                        fontSize: '1rem',
                        color: rarityColor,
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.rarity}
                    </span>

                    {demo ? (
                      <span
                        className="mc-badge"
                        style={{
                          backgroundColor: '#0e3a46',
                          color: '#4aedf9',
                          border: '2px solid #4aedf9',
                          fontFamily: "'Silkscreen', monospace",
                          fontSize: '0.64rem',
                          padding: '3px 6px',
                        }}
                      >
                        DEMO
                      </span>
                    ) : isGraded && badgeStyle ? (
                      <span
                        className="mc-badge"
                        style={{
                          backgroundColor: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: `2px solid ${badgeStyle.border}`,
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: '0.68rem',
                          padding: '4px 7px',
                        }}
                      >
                        {item.grade}/10
                      </span>
                    ) : (
                      <span
                        className="mc-badge"
                        style={{
                          backgroundColor: '#5c4a12',
                          color: '#ffdd55',
                          border: '2px solid #d4a017',
                          fontFamily: "'Silkscreen', monospace",
                          fontSize: '0.64rem',
                          padding: '3px 6px',
                        }}
                      >
                        PENDING
                      </span>
                    )}
                  </div>

                  {/* Inventory Slot with Pixel Art */}
                  <div
                    className={`mc-slot ${item.enchanted ? 'mc-enchanted' : ''}`}
                    style={{
                      width: '92px',
                      height: '92px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={pixelUrls[item.id]}
                      alt={item.name}
                      className="mc-pixelated"
                      style={{
                        width: '78px',
                        height: '78px',
                        imageRendering: 'pixelated',
                      }}
                    />
                  </div>

                  {/* Item Name */}
                  <div
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      fontFamily: "'Silkscreen', monospace",
                      fontSize: '0.82rem',
                      color: rarityColor,
                      textShadow: '2px 2px 0 #000',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={item.name}
                  >
                    {item.name}
                  </div>

                  {/* Creator Footer */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      paddingTop: '4px',
                      borderTop: '2px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {demo ? (
                      <>
                        <span style={{ color: '#4aedf9', fontSize: '0.95rem', lineHeight: 1 }}>
                          ✦
                        </span>
                        <span
                          style={{
                            fontFamily: "'VT323', monospace",
                            fontSize: '1.1rem',
                            color: '#4aedf9',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          Neon
                        </span>
                      </>
                    ) : (
                      <>
                        {creator && (
                          <img
                            src={getAvatarUrl(creator.avatarId)}
                            alt={creator.name}
                            className="mc-pixelated"
                            style={{ width: '20px', height: '20px', imageRendering: 'pixelated' }}
                          />
                        )}
                        <span
                          style={{
                            fontFamily: "'VT323', monospace",
                            fontSize: '1.1rem',
                            color: '#cccccc',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {creator?.name || 'Crafter'}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Minecraft Inspection Tooltip Modal */}
      {inspectItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Inspect ${inspectItem.name}`}
          onClick={() => {
            playSound('click');
            setInspectItemId(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div
            className="mc-tooltip"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 'clamp(0.9rem, 2.5vw, 1.15rem)',
                    color: RARITY_COLORS[inspectItem.rarity] || '#ffffff',
                    lineHeight: 1.4,
                  }}
                >
                  {inspectItem.name}
                </h3>
                <div
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '1.25rem',
                    color: '#aaaaaa',
                    textTransform: 'capitalize',
                    marginTop: '4px',
                  }}
                >
                  {inspectItem.rarity} {inspectItem.category}
                  {inspectItem.enchanted ? ' • ✨ Enchanted' : ''}
                </div>
              </div>

              <button
                type="button"
                className="mc-btn"
                aria-label="Close inspection modal"
                onClick={() => {
                  playSound('click');
                  setInspectItemId(null);
                }}
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: '4px 10px',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '0.85rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Enlarged Pixel Art */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                className={`mc-slot ${inspectItem.enchanted ? 'mc-enchanted' : ''}`}
                style={{
                  width: '164px',
                  height: '164px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={pixelUrls[inspectItem.id]}
                  alt={inspectItem.name}
                  className="mc-pixelated"
                  style={{
                    width: '144px',
                    height: '144px',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
            </div>

            {/* Full Description */}
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '2px solid rgba(128, 80, 255, 0.35)',
                padding: '12px 14px',
                fontFamily: "'VT323', monospace",
                fontSize: '1.4rem',
                color: '#f2f2f2',
                lineHeight: 1.35,
              }}
            >
              {inspectItem.description || 'No description written.'}
            </div>

            {/* Creator & Recipient Metadata */}
            {(() => {
              const inspectIsDemo = isDemoItem(inspectItem);
              const inspectCreator = inspectIsDemo
                ? undefined
                : getPlayerProfile(players, inspectItem.creatorId);
              const inspectRecipient = inspectIsDemo
                ? undefined
                : getPlayerProfile(players, inspectItem.recipientId);

              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: '10px',
                      fontFamily: "'VT323', monospace",
                      fontSize: '1.2rem',
                      color: '#cccccc',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {inspectIsDemo ? (
                        <>
                          <span style={{ color: '#4aedf9', fontSize: '1.1rem', lineHeight: 1 }}>
                            ✦
                          </span>
                          <span>
                            Crafted by{' '}
                            <strong style={{ color: '#4aedf9' }}>Neon</strong>
                          </span>
                        </>
                      ) : (
                        <>
                          <img
                            src={getAvatarUrl(inspectCreator?.avatarId || '')}
                            alt={inspectCreator?.name || 'Creator'}
                            className="mc-pixelated"
                            style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                          />
                          <span>
                            Crafted by{' '}
                            <strong style={{ color: '#55ff55' }}>
                              {inspectCreator?.name || 'Crafter'}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>
                    <span style={{ color: '#999999' }}>
                      {inspectIsDemo ? 'Starter Demo' : formatDate(inspectItem.createdAt)}
                    </span>
                  </div>

                  {/* Grade & Comment Section */}
                  <div
                    style={{
                      borderTop: '2px solid rgba(255,255,255,0.15)',
                      paddingTop: '14px',
                    }}
                  >
                    {inspectIsDemo ? (
                      <div
                        style={{
                          textAlign: 'center',
                          fontFamily: "'Silkscreen', monospace",
                          fontSize: '0.78rem',
                          color: '#4aedf9',
                          padding: '8px',
                        }}
                      >
                        ✦ Starter Demo Item by Neon • View-only
                      </div>
                    ) : inspectItem.grade !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'Silkscreen', monospace",
                              fontSize: '0.8rem',
                              color: '#dddddd',
                            }}
                          >
                            RATED BY {(inspectRecipient?.name || 'PARTNER').toUpperCase()}
                          </span>
                          <span
                            className="mc-badge"
                            style={{
                              backgroundColor: getScoreBadgeStyle(inspectItem.grade).bg,
                              color: getScoreBadgeStyle(inspectItem.grade).color,
                              border: `2px solid ${getScoreBadgeStyle(inspectItem.grade).border}`,
                              fontFamily: "'Press Start 2P', monospace",
                              fontSize: '0.88rem',
                              padding: '6px 12px',
                            }}
                          >
                            {inspectItem.grade}/10 • {GRADE_TITLES[inspectItem.grade] || 'Rated'}
                          </span>
                        </div>

                        {inspectItem.gradeComment && (
                          <div
                            style={{
                              backgroundColor: 'rgba(85, 255, 85, 0.08)',
                              borderLeft: '4px solid #55ff55',
                              padding: '10px 12px',
                              fontFamily: "'VT323', monospace",
                              fontSize: '1.35rem',
                              color: '#eaffea',
                            }}
                          >
                            “{inspectItem.gradeComment}”
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: 'center',
                          fontFamily: "'Silkscreen', monospace",
                          fontSize: '0.8rem',
                          color: '#ffdd55',
                          padding: '8px',
                        }}
                      >
                        ⏳ Waiting for {inspectRecipient?.name || 'partner'} to rate (0–10)...
                      </div>
                    )}
                  </div>

                  {/* Creator-Only Hide / Unhide Action (disabled for demo items) */}
                  {onToggleHideItem && !inspectIsDemo && inspectItem.creatorId === currentPlayerId && (
                    <div
                      style={{
                        borderTop: '2px solid rgba(255,255,255,0.15)',
                        paddingTop: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'VT323', monospace",
                          fontSize: '1.15rem',
                          color: '#aaaaaa',
                        }}
                      >
                        {inspectItem.hidden
                          ? 'Hidden from Shared Chest & Inbox (still saved safely).'
                          : 'Only you (the creator) can hide or unhide this item.'}
                      </span>
                      <button
                        type="button"
                        className={`mc-btn ${inspectItem.hidden ? 'mc-btn-green' : 'mc-btn-red'}`}
                        onClick={() => {
                          playSound('click');
                          onToggleHideItem(inspectItem.id);
                          setInspectItemId(null);
                        }}
                        style={{
                          fontSize: '0.78rem',
                          padding: '10px 16px',
                          minHeight: '44px',
                        }}
                      >
                        {inspectItem.hidden ? '👁 UNHIDE ITEM' : '🙈 HIDE ITEM'}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedChest;
