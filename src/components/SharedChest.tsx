import React, { useState, useMemo, useEffect } from 'react';
import { CraftItem, ItemAuthorId, ItemRarity, PlayerId, PlayerProfile } from '../types';
import { AVATARS, renderPixelsToDataUrl } from '../assets/textures';
import {
  MAX_VOTE_CHANGES,
  canPlayerChangeVote,
  formatAverageScore,
  getItemAverageGrade,
  getItemVotes,
  isDemoItem,
} from '../store/itemStore';
import { playSound } from '../utils/sounds';

export interface SharedChestProps {
  items: CraftItem[];
  players: Record<PlayerId, PlayerProfile>;
  currentPlayerId: PlayerId;
  onToggleHideItem?: (itemId: string) => void;
  onVoteItem?: (itemId: string, score: number, comment: string) => void;
}

type FilterMode = 'all' | 'graded' | 'pending' | 'needs_vote' | 'hidden' | `player:${PlayerId}`;
type SortMode = 'newest' | 'highest';

const SCORE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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
  return id && id !== 'neon' && id !== 'all' ? players[id] : undefined;
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
  onVoteItem,
}) => {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);
  const [modalScore, setModalScore] = useState<number | null>(null);
  const [modalComment, setModalComment] = useState<string>('');
  const [showVoteEditor, setShowVoteEditor] = useState<boolean>(false);

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
    const gradedItems = nonDemoItems.filter((i) => getItemAverageGrade(i).average !== null);
    const gradedCount = gradedItems.length;

    const avgByPlayer: Record<PlayerId, string> = {};
    for (const p of playerList) {
      const pGraded = gradedItems.filter((i) => i.creatorId === p.id);
      if (pGraded.length === 0) {
        avgByPlayer[p.id] = '—';
      } else {
        const sum = pGraded.reduce((acc, i) => acc + (getItemAverageGrade(i).average ?? 0), 0);
        avgByPlayer[p.id] = (sum / pGraded.length).toFixed(1);
      }
    }

    return {
      totalCrafted,
      gradedCount,
      avgByPlayer,
    };
  }, [nonDemoItems, playerList]);

  // Filter & sort items (including Neon items in vote filters)
  const visibleItems = useMemo(() => {
    let list = nonHiddenItems;
    if (filter === 'hidden') {
      list = myHiddenItems;
    } else if (filter === 'graded') {
      list = nonHiddenItems.filter((i) => getItemAverageGrade(i).average !== null);
    } else if (filter === 'pending') {
      list = nonHiddenItems.filter((i) => getItemAverageGrade(i).average === null);
    } else if (filter === 'needs_vote') {
      list = nonHiddenItems.filter(
        (i) => i.creatorId !== currentPlayerId && !getItemVotes(i)[currentPlayerId]
      );
    } else if (filter.startsWith('player:')) {
      const targetId = filter.slice('player:'.length);
      list = nonDemoItems.filter((i) => i.creatorId === targetId);
    }

    return [...list].sort((a, b) => {
      if (sort === 'highest') {
        const ga = getItemAverageGrade(a).average ?? -1;
        const gb = getItemAverageGrade(b).average ?? -1;
        if (gb !== ga) return gb - ga;
      }
      return b.createdAt - a.createdAt;
    });
  }, [nonHiddenItems, nonDemoItems, myHiddenItems, filter, sort, currentPlayerId]);

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
    const target = items.find((i) => i.id === itemId);
    const existingVote = target ? getItemVotes(target)[currentPlayerId] : undefined;
    if (existingVote) {
      setModalScore(existingVote.score);
      setModalComment(existingVote.comment || '');
      setShowVoteEditor(false);
    } else {
      setModalScore(null);
      setModalComment('');
      setShowVoteEditor(true);
    }
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
              { id: 'graded', label: 'Voted' },
              { id: 'pending', label: 'No Votes Yet' },
              { id: 'needs_vote', label: 'Needs My Vote' },
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
              const avgInfo = getItemAverageGrade(item);
              const isGraded = avgInfo.average !== null;
              const badgeStyle = isGraded ? getScoreBadgeStyle(avgInfo.average as number) : null;
              const myVote = getItemVotes(item)[currentPlayerId];

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

                    {isGraded && badgeStyle && avgInfo.average !== null ? (
                      <span
                        className="mc-badge"
                        title={`Average ${formatAverageScore(avgInfo.average)}/10 from ${avgInfo.count} ${avgInfo.count === 1 ? 'vote' : 'votes'}`}
                        style={{
                          backgroundColor: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: `2px solid ${badgeStyle.border}`,
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: '0.62rem',
                          padding: '4px 7px',
                        }}
                      >
                        ★ {formatAverageScore(avgInfo.average)} ({avgInfo.count})
                      </span>
                    ) : (
                      <span
                        className="mc-badge"
                        style={{
                          backgroundColor: '#5c4a12',
                          color: '#ffdd55',
                          border: '2px solid #d4a017',
                          fontFamily: "'Silkscreen', monospace",
                          fontSize: '0.62rem',
                          padding: '3px 6px',
                        }}
                      >
                        NO VOTES
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
                        {myVote && (
                          <span
                            style={{
                              fontFamily: "'VT323', monospace",
                              fontSize: '1rem',
                              color: '#55ff55',
                              marginLeft: 'auto',
                            }}
                          >
                            You:{myVote.score}
                          </span>
                        )}
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
                        {myVote && (
                          <span
                            style={{
                              fontFamily: "'VT323', monospace",
                              fontSize: '1rem',
                              color: '#55ff55',
                              marginLeft: 'auto',
                            }}
                          >
                            You:{myVote.score}
                          </span>
                        )}
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

            {/* Creator & Voting Metadata */}
            {(() => {
              const inspectIsDemo = isDemoItem(inspectItem);
              const inspectCreator = inspectIsDemo
                ? undefined
                : getPlayerProfile(players, inspectItem.creatorId);
              const inspectVotes = getItemVotes(inspectItem);
              const inspectAvg = getItemAverageGrade(inspectItem);
              const myVote = inspectVotes[currentPlayerId];
              const canChange = canPlayerChangeVote(myVote);
              const changesLeft = myVote
                ? Math.max(0, MAX_VOTE_CHANGES - (myVote.changesUsed ?? 0))
                : MAX_VOTE_CHANGES;
              const hasModalDiff = !myVote
                ? modalScore !== null
                : modalScore !== null &&
                  (modalScore !== myVote.score ||
                    modalComment.trim() !== (myVote.comment || '').trim());

              const inspectIsCreator = !inspectIsDemo && inspectItem.creatorId === currentPlayerId;
              const eligibleVoters = playerList.filter(
                (p) => p.id !== inspectItem.creatorId || Boolean(inspectVotes[p.id])
              );
              const knownIds = new Set(eligibleVoters.map((p) => p.id));
              const extraVoterIds = Object.keys(inspectVotes).filter((id) => !knownIds.has(id));
              const voterRows = [
                ...eligibleVoters.map((p) => ({
                  id: p.id,
                  name: p.name,
                  avatarId: p.avatarId,
                  color: p.color,
                })),
                ...extraVoterIds.map((id) => ({
                  id,
                  name: 'Crafter',
                  avatarId: 'knight',
                  color: '#cccccc',
                })),
              ];
              const modalScores = Object.values(inspectVotes).map((v) => v.score);
              const modalHigh = modalScores.length > 0 ? Math.max(...modalScores) : null;
              const modalLow = modalScores.length > 0 ? Math.min(...modalScores) : null;

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
                            {inspectItem.creatorId === currentPlayerId ? ' (You)' : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <span style={{ color: '#999999' }}>
                      {inspectIsDemo ? 'Starter Demo' : formatDate(inspectItem.createdAt)}
                    </span>
                  </div>

                  {/* Votes, Average & Per-Player Breakdown Section */}
                  <div
                    style={{
                      borderTop: '2px solid rgba(255,255,255,0.15)',
                      paddingTop: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Average Score Summary */}
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
                              color: '#ffdd55',
                            }}
                          >
                            📊 AVERAGE ({inspectAvg.count}{' '}
                            {inspectAvg.count === 1 ? 'VOTE' : 'VOTES'})
                          </span>
                          {inspectAvg.average !== null ? (
                            <span
                              className="mc-badge"
                              style={{
                                backgroundColor: getScoreBadgeStyle(inspectAvg.average).bg,
                                color: getScoreBadgeStyle(inspectAvg.average).color,
                                border: `2px solid ${getScoreBadgeStyle(inspectAvg.average).border}`,
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: '0.82rem',
                                padding: '6px 12px',
                              }}
                            >
                              {formatAverageScore(inspectAvg.average)}/10 •{' '}
                              {GRADE_TITLES[Math.round(inspectAvg.average)] || 'Rated'}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontFamily: "'VT323', monospace",
                                fontSize: '1.2rem',
                                color: '#ffdd55',
                              }}
                            >
                              No votes yet!
                            </span>
                          )}
                        </div>

                        {/* Creator Quick Stats Row (High/Low & Participation) */}
                        {inspectIsCreator && (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '2px solid rgba(85,180,255,0.35)',
                                padding: '8px 10px',
                                textAlign: 'center',
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: "'Silkscreen', monospace",
                                  fontSize: '0.64rem',
                                  color: '#9ad8ff',
                                }}
                              >
                                VOTES RECEIVED
                              </div>
                              <div
                                style={{
                                  fontFamily: "'Press Start 2P', monospace",
                                  fontSize: '0.88rem',
                                  color: '#55ff55',
                                  marginTop: '4px',
                                }}
                              >
                                {inspectAvg.count}/
                                {Math.max(
                                  inspectAvg.count,
                                  playerList.filter((p) => p.id !== inspectItem.creatorId).length
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '2px solid rgba(85,180,255,0.35)',
                                padding: '8px 10px',
                                textAlign: 'center',
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: "'Silkscreen', monospace",
                                  fontSize: '0.64rem',
                                  color: '#9ad8ff',
                                }}
                              >
                                HIGH / LOW
                              </div>
                              <div
                                style={{
                                  fontFamily: "'Press Start 2P', monospace",
                                  fontSize: '0.88rem',
                                  color: '#ffdd55',
                                  marginTop: '4px',
                                }}
                              >
                                {modalHigh !== null ? `${modalHigh} / ${modalLow}` : '—'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Every Player's Vote List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {voterRows.length === 0 ? (
                            <div
                              style={{
                                textAlign: 'center',
                                fontFamily: "'VT323', monospace",
                                fontSize: '1.2rem',
                                color: '#bbbbbb',
                                padding: '8px',
                              }}
                            >
                              No other players in this Realm yet — invite friends so they can vote
                              and comment!
                            </div>
                          ) : (
                            voterRows.map((p) => {
                            const v = inspectVotes[p.id];
                            const vStyle = v ? getScoreBadgeStyle(v.score) : null;
                            const prevHistory = v?.history && v.history.length > 0 ? v.history : null;
                            const lastPrev = prevHistory ? prevHistory[prevHistory.length - 1] : null;
                            return (
                              <div
                                key={p.id}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  border: `2px solid ${
                                    p.id === currentPlayerId
                                      ? 'rgba(85,255,85,0.55)'
                                      : 'rgba(255,255,255,0.12)'
                                  }`,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      minWidth: 0,
                                    }}
                                  >
                                    <img
                                      src={getAvatarUrl(p.avatarId)}
                                      alt={p.name}
                                      className="mc-pixelated"
                                      style={{
                                        width: '24px',
                                        height: '24px',
                                        imageRendering: 'pixelated',
                                      }}
                                    />
                                    <div style={{ minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontFamily: "'Silkscreen', monospace",
                                          fontSize: '0.74rem',
                                          color: p.color || '#ffffff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          flexWrap: 'wrap',
                                        }}
                                      >
                                        <span>
                                          {p.name}
                                          {p.id === currentPlayerId ? ' (You)' : ''}
                                        </span>
                                        {v && v.changesUsed > 0 && (
                                          <span
                                            className="mc-badge"
                                            style={{
                                              fontSize: '0.56rem',
                                              padding: '2px 5px',
                                              backgroundColor: '#3a2248',
                                              color: '#e2b8ff',
                                              border: '1px solid #b866d6',
                                            }}
                                          >
                                            CHANGED
                                          </span>
                                        )}
                                      </div>
                                      {v?.comment && (
                                        <div
                                          style={{
                                            fontFamily: "'VT323', monospace",
                                            fontSize: '1.2rem',
                                            color: '#d8ffd8',
                                            lineHeight: 1.15,
                                          }}
                                        >
                                          “{v.comment}”
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {v && vStyle ? (
                                      <>
                                        {lastPrev && (
                                          <span
                                            style={{
                                              fontFamily: "'VT323', monospace",
                                              fontSize: '1.15rem',
                                              color: '#b5a2cc',
                                            }}
                                            title={`Changed from ${lastPrev.score}/10 to ${v.score}/10`}
                                          >
                                            <span style={{ textDecoration: 'line-through' }}>
                                              {lastPrev.score}/10
                                            </span>{' '}
                                            →
                                          </span>
                                        )}
                                        <span
                                          className="mc-badge"
                                          style={{
                                            backgroundColor: vStyle.bg,
                                            color: vStyle.color,
                                            border: `2px solid ${vStyle.border}`,
                                            fontFamily: "'Press Start 2P', monospace",
                                            fontSize: '0.72rem',
                                            padding: '4px 8px',
                                          }}
                                        >
                                          {v.score}/10
                                        </span>
                                      </>
                                    ) : (
                                      <span
                                        style={{
                                          fontFamily: "'VT323', monospace",
                                          fontSize: '1.12rem',
                                          color: '#999999',
                                        }}
                                      >
                                        Not voted yet
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Preserved Previous Vote & Comment History */}
                                {prevHistory && (
                                  <div
                                    style={{
                                      marginLeft: '32px',
                                      padding: '6px 10px',
                                      backgroundColor: 'rgba(184, 102, 214, 0.12)',
                                      borderLeft: '3px solid #b866d6',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px',
                                    }}
                                  >
                                    {prevHistory.map((h, idx) => (
                                      <div
                                        key={`${p.id}-modal-hist-${idx}`}
                                        style={{
                                          fontFamily: "'VT323', monospace",
                                          fontSize: '1.08rem',
                                          color: '#c9bdd6',
                                          lineHeight: 1.2,
                                        }}
                                      >
                                        <span style={{ color: '#e2b8ff', fontWeight: 700 }}>
                                          Previous vote:
                                        </span>{' '}
                                        <span style={{ textDecoration: 'line-through' }}>
                                          {h.score}/10
                                        </span>
                                        {h.comment ? (
                                          <span style={{ color: '#d8d0e4' }}> — “{h.comment}”</span>
                                        ) : (
                                          <span style={{ color: '#998fa8' }}> (no comment)</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                          )}
                        </div>

                        {/* Inline Vote / Change Vote Once Controls (hidden for item creator) */}
                        {inspectIsCreator ? (
                          <div
                            style={{
                              borderTop: '2px solid rgba(255,255,255,0.12)',
                              paddingTop: '10px',
                              textAlign: 'center',
                              fontFamily: "'Silkscreen', monospace",
                              fontSize: '0.72rem',
                              color: '#9ad8ff',
                            }}
                          >
                            ✨ You crafted this item — viewing live stats, votes &amp; comments.
                          </div>
                        ) : (
                          onVoteItem && (
                          <div
                            style={{
                              borderTop: '2px solid rgba(255,255,255,0.12)',
                              paddingTop: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            {!canChange ? (
                              <div
                                style={{
                                  textAlign: 'center',
                                  fontFamily: "'Silkscreen', monospace",
                                  fontSize: '0.74rem',
                                  color: '#d580ff',
                                  padding: '6px',
                                }}
                              >
                                🔒 Your vote ({myVote?.score}/10) is locked — you already used your 1
                                vote change.
                              </div>
                            ) : !showVoteEditor && myVote ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '8px',
                                }}
                              >
                                <span
                                  style={{
                                    fontFamily: "'VT323', monospace",
                                    fontSize: '1.2rem',
                                    color: '#b8ffb8',
                                  }}
                                >
                                  You voted {myVote.score}/10 ({changesLeft} change left)
                                </span>
                                <button
                                  type="button"
                                  className="mc-btn mc-btn-gold"
                                  onClick={() => {
                                    playSound('click');
                                    setModalScore(myVote.score);
                                    setModalComment(myVote.comment || '');
                                    setShowVoteEditor(true);
                                  }}
                                  style={{
                                    fontSize: '0.74rem',
                                    padding: '8px 12px',
                                    minHeight: '40px',
                                  }}
                                >
                                  ✏️ CHANGE MY VOTE (1 LEFT)
                                </button>
                              </div>
                            ) : (
                              <>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '6px',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontFamily: "'Silkscreen', monospace",
                                      fontSize: '0.74rem',
                                      color: '#ffdd55',
                                    }}
                                  >
                                    {myVote
                                      ? '✏️ CHANGE YOUR VOTE (USES 1 CHANGE):'
                                      : '🗳️ CAST YOUR VOTE (0–10):'}
                                  </span>
                                  {myVote && (
                                    <button
                                      type="button"
                                      className="mc-btn"
                                      onClick={() => {
                                        playSound('click');
                                        setShowVoteEditor(false);
                                      }}
                                      style={{
                                        fontSize: '0.68rem',
                                        padding: '4px 8px',
                                        minHeight: '32px',
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(11, minmax(0, 1fr))',
                                    gap: '4px',
                                  }}
                                >
                                  {SCORE_OPTIONS.map((score) => {
                                    const selected = modalScore === score;
                                    const st = getScoreBadgeStyle(score);
                                    return (
                                      <button
                                        key={score}
                                        type="button"
                                        onClick={() => {
                                          playSound('grade');
                                          setModalScore(score);
                                        }}
                                        style={{
                                          minHeight: '38px',
                                          padding: '2px',
                                          cursor: 'pointer',
                                          fontFamily: "'Press Start 2P', monospace",
                                          fontSize: score === 10 ? '0.62rem' : '0.72rem',
                                          color: selected ? '#fff' : '#ddd',
                                          backgroundColor: selected ? st.bg : '#4a4a4a',
                                          border: selected
                                            ? `2px solid ${st.border}`
                                            : '2px solid #222',
                                        }}
                                      >
                                        {score}
                                      </button>
                                    );
                                  })}
                                </div>

                                <input
                                  type="text"
                                  className="mc-input"
                                  value={modalComment}
                                  maxLength={120}
                                  placeholder="Optional note (e.g. Super cool!)"
                                  onChange={(e) => setModalComment(e.target.value)}
                                  style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '8px 10px',
                                    fontSize: '1.1rem',
                                  }}
                                />

                                <button
                                  type="button"
                                  className={`mc-btn ${myVote ? 'mc-btn-gold' : 'mc-btn-green'}`}
                                  disabled={!hasModalDiff}
                                  onClick={() => {
                                    if (modalScore === null || !hasModalDiff) return;
                                    playSound('xp');
                                    onVoteItem(inspectItem.id, modalScore, modalComment.trim());
                                    setShowVoteEditor(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    minHeight: '46px',
                                    fontFamily: "'Press Start 2P', monospace",
                                    fontSize: '0.74rem',
                                    opacity: hasModalDiff ? 1 : 0.5,
                                    cursor: hasModalDiff ? 'pointer' : 'not-allowed',
                                  }}
                                >
                                  {modalScore === null
                                    ? 'PICK A SCORE (0–10)'
                                    : myVote
                                      ? hasModalDiff
                                        ? `CONFIRM VOTE CHANGE (${modalScore}/10)`
                                        : 'PICK A NEW SCORE OR NOTE'
                                      : `SUBMIT VOTE (${modalScore}/10)`}
                                </button>
                              </>
                            )}
                          </div>
                        )
                        )}
                      </div>
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
