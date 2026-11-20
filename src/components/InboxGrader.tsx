import React, { useState, useMemo, useEffect, useRef } from 'react';
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

export interface InboxGraderProps {
  items: CraftItem[];
  players: Record<PlayerId, PlayerProfile>;
  currentPlayerId: PlayerId;
  onGradeItem: (itemId: string, grade: number, comment: string) => void;
}

type QueueFilter = 'unvoted' | 'voted' | 'mine' | 'all';

interface GradeRank {
  label: string;
  color: string;
  bg: string;
  emoji: string;
}

const GRADE_RANKS: Record<number, GradeRank> = {
  0: { label: 'Bedrock Dud', color: '#aaaaaa', bg: '#3a3a3a', emoji: '🪨' },
  1: { label: 'Dirt Block', color: '#c89b6e', bg: '#4e3524', emoji: '🟫' },
  2: { label: 'Cobble Rookie', color: '#cccccc', bg: '#4f4f4f', emoji: '🧱' },
  3: { label: 'Wooden Pick', color: '#deb887', bg: '#5c4023', emoji: '🪵' },
  4: { label: 'Coal Miner', color: '#b5b5b5', bg: '#2e2e2e', emoji: '⛏️' },
  5: { label: 'Iron Crafter', color: '#f0f0f0', bg: '#5a6368', emoji: '🛡️' },
  6: { label: 'Redstone Tinker', color: '#ff6666', bg: '#661818', emoji: '⚡' },
  7: { label: 'Gold Enchanter', color: '#ffd700', bg: '#665200', emoji: '✨' },
  8: { label: 'Diamond Tier!', color: '#55ffff', bg: '#0c5966', emoji: '💎' },
  9: { label: 'Emerald Master!', color: '#55ff55', bg: '#145920', emoji: '💚' },
  10: { label: 'NETHERITE LEGEND!', color: '#ff55ff', bg: '#4b145b', emoji: '👑' },
};

const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#ffffff',
  uncommon: '#55ff55',
  rare: '#55ffff',
  epic: '#ff55ff',
  legendary: '#ffaa00',
};

const QUICK_NOTES = [
  'Super cool power!',
  'Awesome pixel art!',
  'Totally OP!',
  'So creative!',
  'Haha love it!',
];

const SCORE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function getRankForScore(score: number): GradeRank {
  const clamped = Math.max(0, Math.min(10, Math.round(score)));
  return GRADE_RANKS[clamped] || GRADE_RANKS[5];
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

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export const InboxGrader: React.FC<InboxGraderProps> = ({
  items,
  players,
  currentPlayerId,
  onGradeItem,
}) => {
  const votableItems = useMemo(
    () =>
      items
        .filter((item) => !item.hidden)
        .sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  const unvotedItems = useMemo(
    () =>
      votableItems.filter(
        (item) => item.creatorId !== currentPlayerId && !getItemVotes(item)[currentPlayerId]
      ),
    [votableItems, currentPlayerId]
  );

  const votedItems = useMemo(
    () =>
      votableItems.filter(
        (item) => item.creatorId !== currentPlayerId && Boolean(getItemVotes(item)[currentPlayerId])
      ),
    [votableItems, currentPlayerId]
  );

  const myCreatedItems = useMemo(
    () => votableItems.filter((item) => item.creatorId === currentPlayerId),
    [votableItems, currentPlayerId]
  );

  const [queueFilter, setQueueFilter] = useState<QueueFilter>(() =>
    unvotedItems.length > 0 ? 'unvoted' : 'all'
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const benchRef = useRef<HTMLDivElement | null>(null);

  // If user is on 'unvoted' and finishes voting on all items, switch smoothly to 'all'
  useEffect(() => {
    if (queueFilter === 'unvoted' && unvotedItems.length === 0 && votableItems.length > 0) {
      setQueueFilter('all');
    }
  }, [queueFilter, unvotedItems.length, votableItems.length]);

  const filteredItems = useMemo(() => {
    if (queueFilter === 'unvoted') return unvotedItems;
    if (queueFilter === 'voted') return votedItems;
    if (queueFilter === 'mine') return myCreatedItems;
    return votableItems;
  }, [queueFilter, unvotedItems, votedItems, myCreatedItems, votableItems]);

  // Auto-select first item in current filtered list
  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItemId(null);
      return;
    }
    const stillExists = filteredItems.some((item) => item.id === selectedItemId);
    if (!stillExists) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [filteredItems, selectedItemId]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedItemId) || filteredItems[0] || null,
    [filteredItems, selectedItemId]
  );

  const selectedVotes = useMemo(
    () => (selectedItem ? getItemVotes(selectedItem) : {}),
    [selectedItem]
  );
  const isSelectedCreator = Boolean(selectedItem && selectedItem.creatorId === currentPlayerId);
  const myExistingVote = selectedVotes[currentPlayerId];
  const canVoteOrChange = !isSelectedCreator && canPlayerChangeVote(myExistingVote);
  const changesRemaining = myExistingVote
    ? Math.max(0, MAX_VOTE_CHANGES - (myExistingVote.changesUsed ?? 0))
    : MAX_VOTE_CHANGES;

  // Sync draft score/comment when switching selected item or when current player's saved vote changes
  useEffect(() => {
    if (!selectedItem) {
      setSelectedGrade(null);
      setComment('');
      return;
    }
    const vote = getItemVotes(selectedItem)[currentPlayerId];
    if (vote) {
      setSelectedGrade(vote.score);
      setComment(vote.comment || '');
    } else {
      setSelectedGrade(null);
      setComment('');
    }
  }, [
    selectedItem?.id,
    currentPlayerId,
    myExistingVote?.score,
    myExistingVote?.comment,
    myExistingVote?.changesUsed,
  ]);

  // Render pixel art data URLs for all votable items
  const previewUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of votableItems) {
      map[item.id] = renderPixelsToDataUrl(item.pixels, 8);
    }
    return map;
  }, [votableItems]);

  const allPlayerList = useMemo(() => Object.values(players), [players]);

  const handleSelectItem = (itemId: string) => {
    playSound('chest');
    setSelectedItemId(itemId);
    if (window.innerWidth < 900 && benchRef.current) {
      benchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePickScore = (score: number) => {
    if (!canVoteOrChange) return;
    playSound('grade');
    setSelectedGrade(score);
  };

  const hasChangedFromExisting = useMemo(() => {
    if (!myExistingVote) return true;
    const trimmedComment = comment.trim();
    const existingComment = (myExistingVote.comment || '').trim();
    return selectedGrade !== myExistingVote.score || trimmedComment !== existingComment;
  }, [myExistingVote, selectedGrade, comment]);

  const canSubmit =
    Boolean(selectedItem) &&
    selectedGrade !== null &&
    canVoteOrChange &&
    hasChangedFromExisting;

  const handleSubmit = () => {
    if (!selectedItem || selectedGrade === null || !canSubmit) return;
    playSound('xp');
    onGradeItem(selectedItem.id, selectedGrade, comment.trim());
  };

  const selectedAvgInfo = selectedItem
    ? getItemAverageGrade(selectedItem)
    : { average: null, count: 0 };

  const selectedScoreExtremes = useMemo(() => {
    const scores = Object.values(selectedVotes).map((v) => v.score);
    if (scores.length === 0) return { high: null as number | null, low: null as number | null };
    return {
      high: Math.max(...scores),
      low: Math.min(...scores),
    };
  }, [selectedVotes]);

  return (
    <div style={{ width: '100%', maxWidth: '1340px', margin: '0 auto' }}>
      {/* Pixel Tablet Landscape Split View & Portrait Responsive Rules */}
      <style>{`
        .cf-inbox-split {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          align-items: start;
        }
        .cf-inbox-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .cf-score-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(48px, 1fr));
          gap: 6px;
        }
        @media (min-width: 900px) {
          .cf-inbox-split {
            grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
            gap: 20px;
          }
          .cf-inbox-list {
            grid-template-columns: 1fr;
            max-height: calc(100vh - 260px);
            overflow-y: auto;
            padding-right: 4px;
          }
          .cf-score-grid {
            grid-template-columns: repeat(11, minmax(0, 1fr));
            gap: 6px;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div
        className="mc-panel-dark"
        style={{
          padding: '14px 20px',
          marginBottom: '14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 'clamp(0.95rem, 2.2vw, 1.2rem)',
              color: '#ffdd55',
              textShadow: '2px 2px 0 #000',
            }}
          >
            VOTE &amp; RATE ITEMS
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              fontFamily: "'VT323', monospace",
              fontSize: '1.3rem',
              color: '#d8d8d8',
            }}
          >
            Vote 0–10 on other players&apos; items (1 vote change allowed), or view live stats on
            your own creations!
          </p>
        </div>

        <div
          className="mc-badge"
          style={{
            backgroundColor: unvotedItems.length > 0 ? '#b8860b' : '#3b8526',
            color: '#ffffff',
            fontFamily: "'Silkscreen', monospace",
            fontSize: '0.85rem',
            padding: '8px 14px',
          }}
        >
          {unvotedItems.length === 0
            ? 'ALL VOTED!'
            : `${unvotedItems.length} NEED YOUR VOTE`}
        </div>
      </div>

      {/* Empty State when no crafted items exist yet */}
      {votableItems.length === 0 ? (
        <div
          className="mc-panel"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            className="mc-slot"
            style={{
              width: '92px',
              height: '92px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.8rem',
            }}
          >
            ⚒️
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 'clamp(0.95rem, 2.5vw, 1.2rem)',
              color: '#2a2a2a',
              lineHeight: 1.5,
            }}
          >
            No crafted items yet!
          </h3>
          <p
            style={{
              margin: 0,
              fontFamily: "'VT323', monospace",
              fontSize: '1.4rem',
              color: '#4a4a4a',
              maxWidth: '500px',
            }}
          >
            Head to the Item Studio and craft your first item — you can save and vote on it even
            solo!
          </p>
        </div>
      ) : (
        <div className="cf-inbox-split">
          {/* LEFT: Filter Tabs + Item Queue */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(
                [
                  { id: 'unvoted', label: `Needs Vote (${unvotedItems.length})` },
                  { id: 'voted', label: `My Votes (${votedItems.length})` },
                  { id: 'mine', label: `My Items (${myCreatedItems.length})` },
                  { id: 'all', label: `All (${votableItems.length})` },
                ] as { id: QueueFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`mc-btn ${queueFilter === tab.id ? 'mc-btn-gold' : ''}`}
                  onClick={() => {
                    playSound('click');
                    setQueueFilter(tab.id);
                  }}
                  style={{
                    flex: '1 1 auto',
                    minHeight: '42px',
                    padding: '6px 10px',
                    fontSize: '0.72rem',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <div
                className="mc-panel"
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  fontFamily: "'VT323', monospace",
                  fontSize: '1.3rem',
                  color: '#444',
                }}
              >
                {queueFilter === 'unvoted'
                  ? 'You voted on every item! Switch to "My Votes" or "All" to view results or change a vote once.'
                  : 'No items in this view yet.'}
              </div>
            ) : (
              <div className="cf-inbox-list">
                {filteredItems.map((item) => {
                  const creator = getPlayerProfile(players, item.creatorId);
                  const creatorAvatar = creator ? getAvatarUrl(creator.avatarId) : '';
                  const rarityColor = RARITY_COLORS[item.rarity] || '#ffffff';
                  const isActive = selectedItem?.id === item.id;
                  const itemVotes = getItemVotes(item);
                  const myVote = itemVotes[currentPlayerId];
                  const avgInfo = getItemAverageGrade(item);
                  const isLocked = myVote && !canPlayerChangeVote(myVote);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item.id)}
                      className="mc-panel-dark"
                      style={{
                        padding: '14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        border: isActive
                          ? '3px solid #ffd700'
                          : myVote
                            ? '3px solid #3c6e3c'
                            : '3px solid #7d6218',
                        boxShadow: isActive
                          ? '0 0 20px rgba(255, 215, 0, 0.4), inset 0 0 12px rgba(255, 215, 0, 0.16)'
                          : '0 0 10px rgba(0, 0, 0, 0.25)',
                        backgroundColor: isActive ? '#2d2619' : undefined,
                        transition: 'transform 0.1s ease, border-color 0.12s ease',
                      }}
                    >
                      {/* Top row: Creator & Status */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          width: '100%',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isDemoItem(item) ? (
                            <>
                              <span style={{ color: '#4aedf9', fontSize: '1rem', lineHeight: 1 }}>
                                ✦
                              </span>
                              <span
                                style={{
                                  fontFamily: "'Silkscreen', monospace",
                                  fontSize: '0.72rem',
                                  color: '#4aedf9',
                                }}
                              >
                                By Neon
                              </span>
                            </>
                          ) : (
                            <>
                              {creatorAvatar && (
                                <img
                                  src={creatorAvatar}
                                  alt={creator?.name || 'Creator'}
                                  className="mc-pixelated"
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    imageRendering: 'pixelated',
                                    border: '2px solid #555',
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  fontFamily: "'Silkscreen', monospace",
                                  fontSize: '0.72rem',
                                  color: '#e6e6e6',
                                }}
                              >
                                {item.creatorId === currentPlayerId
                                  ? `By ${creator?.name || 'You'} (You)`
                                  : `By ${creator?.name || 'Crafter'}`}
                              </span>
                            </>
                          )}
                        </div>
                        <span
                          style={{
                            fontFamily: "'VT323', monospace",
                            fontSize: '1.05rem',
                            color: isActive ? '#ffdd55' : '#aaaaaa',
                          }}
                        >
                          {isActive ? '▶ OPEN' : formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      {/* Middle: Pixel Art Slot + Title & Vote Summary */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          width: '100%',
                        }}
                      >
                        <div
                          className={`mc-slot ${item.enchanted ? 'mc-enchanted' : ''}`}
                          style={{
                            width: '72px',
                            height: '72px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <img
                            src={previewUrls[item.id]}
                            alt={item.name}
                            className="mc-pixelated"
                            style={{
                              width: '60px',
                              height: '60px',
                              imageRendering: 'pixelated',
                            }}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: "'Silkscreen', monospace",
                              fontSize: '0.9rem',
                              color: rarityColor,
                              textShadow: '2px 2px 0 #000',
                              marginBottom: '4px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.name}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px',
                              marginBottom: '4px',
                            }}
                          >
                            {avgInfo.average !== null ? (
                              <span
                                className="mc-badge"
                                style={{
                                  fontSize: '0.62rem',
                                  backgroundColor: '#1f3b4d',
                                  color: '#55ffff',
                                  border: '1px solid #55ffff',
                                  padding: '2px 6px',
                                }}
                              >
                                AVG {formatAverageScore(avgInfo.average)}/10 ({avgInfo.count})
                              </span>
                            ) : (
                              <span
                                className="mc-badge"
                                style={{
                                  fontSize: '0.62rem',
                                  backgroundColor: '#3a3a4a',
                                  color: '#ccc',
                                  padding: '2px 6px',
                                }}
                              >
                                NO VOTES YET
                              </span>
                            )}

                            {item.creatorId === currentPlayerId ? (
                              <span
                                className="mc-badge"
                                style={{
                                  fontSize: '0.62rem',
                                  backgroundColor: '#22384f',
                                  color: '#7cd4ff',
                                  border: '1px solid #55b4ff',
                                  padding: '2px 6px',
                                }}
                              >
                                📊 YOUR ITEM
                              </span>
                            ) : myVote ? (
                              <span
                                className="mc-badge"
                                style={{
                                  fontSize: '0.62rem',
                                  backgroundColor: isLocked ? '#3d2240' : '#18471e',
                                  color: isLocked ? '#e6a8ff' : '#80ff80',
                                  border: `1px solid ${isLocked ? '#b866d6' : '#55ff55'}`,
                                  padding: '2px 6px',
                                }}
                              >
                                {isLocked ? '🔒 ' : '✓ '}YOU: {myVote.score}/10
                              </span>
                            ) : (
                              <span
                                className="mc-badge"
                                style={{
                                  fontSize: '0.62rem',
                                  backgroundColor: '#5c4a12',
                                  color: '#ffdd55',
                                  border: '1px solid #d4a017',
                                  padding: '2px 6px',
                                }}
                              >
                                VOTE NOW
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: "'VT323', monospace",
                              fontSize: '1.1rem',
                              color: '#cccccc',
                              lineHeight: 1.2,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {item.description || 'A mysterious crafted item!'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Spacious Active 0-10 Voting Bench + All Votes Breakdown */}
          {selectedItem && (
            <div
              ref={benchRef}
              className="mc-panel"
              style={{
                padding: '20px 22px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Bench Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  paddingBottom: '10px',
                  borderBottom: '3px solid #8b8b8b',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 'clamp(0.85rem, 2vw, 1.05rem)',
                    color: '#2b2b2b',
                  }}
                >
                  {isSelectedCreator ? '📊 YOUR ITEM STATS' : '0–10 VOTING BENCH'}
                </h3>
                <span
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '1.25rem',
                    color: '#4a4a4a',
                  }}
                >
                  {formatTimeAgo(selectedItem.createdAt)}
                </span>
              </div>

              {/* Large Crisp Preview + Authentic Minecraft Tooltip */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '18px',
                  alignItems: 'center',
                }}
              >
                <div
                  className={`mc-slot ${selectedItem.enchanted ? 'mc-enchanted' : ''}`}
                  style={{
                    width: '148px',
                    height: '148px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    margin: '0 auto',
                  }}
                >
                  <img
                    src={previewUrls[selectedItem.id]}
                    alt={selectedItem.name}
                    className="mc-pixelated"
                    style={{
                      width: '128px',
                      height: '128px',
                      imageRendering: 'pixelated',
                    }}
                  />
                </div>

                <div
                  className="mc-tooltip"
                  style={{
                    flex: '1 1 280px',
                    padding: '16px 18px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 'clamp(0.85rem, 2vw, 1.05rem)',
                      color: RARITY_COLORS[selectedItem.rarity] || '#ffffff',
                      marginBottom: '6px',
                      lineHeight: 1.35,
                    }}
                  >
                    {selectedItem.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'VT323', monospace",
                      fontSize: '1.2rem',
                      color: '#a8a8a8',
                      textTransform: 'capitalize',
                      marginBottom: '8px',
                    }}
                  >
                    {selectedItem.rarity} {selectedItem.category}
                    {selectedItem.enchanted ? ' • ✨ Enchanted' : ''}
                  </div>
                  <div
                    style={{
                      fontFamily: "'VT323', monospace",
                      fontSize: '1.4rem',
                      color: '#f2f2f2',
                      lineHeight: 1.3,
                      marginBottom: '10px',
                    }}
                  >
                    {selectedItem.description || 'No description provided.'}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontFamily: "'VT323', monospace",
                      fontSize: '1.2rem',
                      color: '#55ff55',
                    }}
                  >
                    {(() => {
                      if (isDemoItem(selectedItem)) {
                        return (
                          <>
                            <span style={{ color: '#4aedf9', fontSize: '1.1rem', lineHeight: 1 }}>
                              ✦
                            </span>
                            <span style={{ color: '#4aedf9' }}>Crafted by Neon</span>
                          </>
                        );
                      }
                      const selectedCreator = getPlayerProfile(players, selectedItem.creatorId);
                      return (
                        <>
                          {selectedCreator && (
                            <img
                              src={getAvatarUrl(selectedCreator.avatarId)}
                              alt={selectedCreator.name}
                              className="mc-pixelated"
                              style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                            />
                          )}
                          <span>
                            Crafted by {selectedCreator?.name || 'Crafter'}
                            {selectedItem.creatorId === currentPlayerId ? ' (You)' : ''}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {isSelectedCreator ? (
                /* Creator Stats Dashboard (creators cannot vote on their own items) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    className="mc-panel-dark"
                    style={{
                      padding: '10px 14px',
                      border: '2px solid #55b4ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Silkscreen', monospace",
                        fontSize: '0.78rem',
                        color: '#9ad8ff',
                      }}
                    >
                      ✨ YOU CRAFTED THIS ITEM — VIEWING LIVE VOTES &amp; STATS
                    </span>
                    <span
                      style={{
                        fontFamily: "'VT323', monospace",
                        fontSize: '1.15rem',
                        color: '#cccccc',
                      }}
                    >
                      Creators can&apos;t vote on their own items
                    </span>
                  </div>

                  {/* Stats Summary Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    <div
                      className="mc-panel-dark"
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        border:
                          selectedAvgInfo.average !== null
                            ? `2px solid ${getRankForScore(selectedAvgInfo.average).color}`
                            : '2px solid #444',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Silkscreen', monospace",
                          fontSize: '0.68rem',
                          color: '#bbbbbb',
                          marginBottom: '6px',
                        }}
                      >
                        AVERAGE SCORE
                      </div>
                      <div
                        style={{
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: '1.2rem',
                          color:
                            selectedAvgInfo.average !== null
                              ? getRankForScore(selectedAvgInfo.average).color
                              : '#888888',
                        }}
                      >
                        {selectedAvgInfo.average !== null
                          ? `${formatAverageScore(selectedAvgInfo.average)}/10`
                          : '—'}
                      </div>
                      {selectedAvgInfo.average !== null && (
                        <div
                          style={{
                            fontFamily: "'VT323', monospace",
                            fontSize: '1.15rem',
                            color: '#e0e0e0',
                            marginTop: '4px',
                          }}
                        >
                          {getRankForScore(selectedAvgInfo.average).emoji}{' '}
                          {getRankForScore(selectedAvgInfo.average).label}
                        </div>
                      )}
                    </div>

                    <div
                      className="mc-panel-dark"
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        border: '2px solid #444',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Silkscreen', monospace",
                          fontSize: '0.68rem',
                          color: '#bbbbbb',
                          marginBottom: '6px',
                        }}
                      >
                        VOTES RECEIVED
                      </div>
                      <div
                        style={{
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: '1.2rem',
                          color: '#55ff55',
                        }}
                      >
                        {selectedAvgInfo.count}
                        <span style={{ fontSize: '0.78rem', color: '#aaaaaa' }}>
                          /
                          {Math.max(
                            selectedAvgInfo.count,
                            allPlayerList.filter((p) => p.id !== selectedItem.creatorId).length
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          fontFamily: "'VT323', monospace",
                          fontSize: '1.1rem',
                          color: '#cccccc',
                          marginTop: '4px',
                        }}
                      >
                        {allPlayerList.filter((p) => p.id !== selectedItem.creatorId).length === 0
                          ? 'Invite friends to vote!'
                          : 'Eligible voters'}
                      </div>
                    </div>

                    <div
                      className="mc-panel-dark"
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        border: '2px solid #444',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Silkscreen', monospace",
                          fontSize: '0.68rem',
                          color: '#bbbbbb',
                          marginBottom: '6px',
                        }}
                      >
                        HIGH / LOW
                      </div>
                      <div
                        style={{
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: '1.15rem',
                          color: '#ffdd55',
                        }}
                      >
                        {selectedScoreExtremes.high !== null
                          ? `${selectedScoreExtremes.high} / ${selectedScoreExtremes.low}`
                          : '—'}
                      </div>
                      <div
                        style={{
                          fontFamily: "'VT323', monospace",
                          fontSize: '1.1rem',
                          color: '#cccccc',
                          marginTop: '4px',
                        }}
                      >
                        {selectedScoreExtremes.high !== null ? 'Score range' : 'No scores yet'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Player Vote Status Banner (when already voted) */}
                  {myExistingVote && (
                <div
                  className="mc-panel-dark"
                  style={{
                    padding: '10px 14px',
                    border: canVoteOrChange ? '2px solid #55ff55' : '2px solid #d580ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Silkscreen', monospace",
                      fontSize: '0.78rem',
                      color: canVoteOrChange ? '#b8ffb8' : '#e6c2ff',
                    }}
                  >
                    {canVoteOrChange
                      ? `✓ YOU VOTED ${myExistingVote.score}/10 — YOU CAN CHANGE YOUR VOTE ONCE`
                      : myExistingVote.history && myExistingVote.history.length > 0
                        ? `🔒 VOTE LOCKED AT ${myExistingVote.score}/10 (CHANGED FROM ${myExistingVote.history[myExistingVote.history.length - 1].score}/10)`
                        : `🔒 VOTE LOCKED AT ${myExistingVote.score}/10 (1 CHANGE USED)`}
                  </span>
                  <span
                    style={{
                      fontFamily: "'VT323', monospace",
                      fontSize: '1.15rem',
                      color: '#cccccc',
                    }}
                  >
                    {changesRemaining > 0 ? '1 change left' : 'No changes left'}
                  </span>
                </div>
              )}

              {/* 0 to 10 Hotbar / XP Score Picker */}
              <div style={{ opacity: canVoteOrChange ? 1 : 0.65 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Silkscreen', monospace",
                      fontSize: '0.84rem',
                      color: '#2b2b2b',
                    }}
                  >
                    {myExistingVote
                      ? canVoteOrChange
                        ? 'CHANGE YOUR SCORE (0–10):'
                        : 'YOUR FINAL SCORE (LOCKED):'
                      : 'TAP YOUR SCORE (0–10):'}
                  </span>

                  {selectedGrade !== null ? (
                    <span
                      className="mc-badge"
                      style={{
                        backgroundColor: GRADE_RANKS[selectedGrade].bg,
                        color: GRADE_RANKS[selectedGrade].color,
                        fontFamily: "'Silkscreen', monospace",
                        fontSize: '0.82rem',
                        padding: '6px 12px',
                        border: `2px solid ${GRADE_RANKS[selectedGrade].color}`,
                      }}
                    >
                      {GRADE_RANKS[selectedGrade].emoji} {selectedGrade}/10 —{' '}
                      {GRADE_RANKS[selectedGrade].label}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: "'VT323', monospace",
                        fontSize: '1.2rem',
                        color: '#555555',
                      }}
                    >
                      Choose a slot below
                    </span>
                  )}
                </div>

                {/* 11 Big Touch-Friendly Hotbar Slots */}
                <div
                  className="cf-score-grid"
                  style={{
                    backgroundColor: '#3a3a3a',
                    padding: '8px',
                    border: '3px solid #1f1f1f',
                  }}
                >
                  {SCORE_OPTIONS.map((score) => {
                    const isSelected = selectedGrade === score;
                    const rank = GRADE_RANKS[score];
                    return (
                      <button
                        key={score}
                        type="button"
                        disabled={!canVoteOrChange}
                        onClick={() => handlePickScore(score)}
                        aria-pressed={isSelected}
                        style={{
                          minHeight: '54px',
                          minWidth: '44px',
                          cursor: canVoteOrChange ? 'pointer' : 'not-allowed',
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: score === 10 ? '0.82rem' : '0.98rem',
                          color: isSelected ? '#ffffff' : '#e0e0e0',
                          backgroundColor: isSelected ? rank.bg : '#6e6e6e',
                          border: isSelected
                            ? `3px solid ${rank.color}`
                            : '3px solid #2b2b2b',
                          boxShadow: isSelected
                            ? `0 0 12px ${rank.color}, inset 0 2px 0 rgba(255,255,255,0.4)`
                            : 'inset 2px 2px 0 #9a9a9a, inset -2px -2px 0 #484848',
                          transform: isSelected ? 'translateY(-2px) scale(1.04)' : 'none',
                          transition: 'transform 0.08s ease, background-color 0.08s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>

                {/* XP Bar Progress Visualization */}
                <div
                  style={{
                    marginTop: '10px',
                    height: '14px',
                    backgroundColor: '#1b1b1b',
                    border: '2px solid #000',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${selectedGrade === null ? 0 : (selectedGrade / 10) * 100}%`,
                      backgroundColor:
                        selectedGrade !== null && selectedGrade >= 8 ? '#55ff55' : '#80ff20',
                      boxShadow: 'inset 0 -3px 0 #388e14',
                      transition: 'width 0.15s ease',
                    }}
                  />
                </div>
              </div>

              {/* Optional Note + Quick-Tap Tablet Chips */}
              <div style={{ opacity: canVoteOrChange ? 1 : 0.65 }}>
                <label
                  htmlFor="grade-comment-input"
                  style={{
                    display: 'block',
                    fontFamily: "'Silkscreen', monospace",
                    fontSize: '0.78rem',
                    color: '#2b2b2b',
                    marginBottom: '6px',
                  }}
                >
                  VOTE NOTE (OPTIONAL):
                </label>
                <input
                  id="grade-comment-input"
                  type="text"
                  className="mc-input"
                  disabled={!canVoteOrChange}
                  value={comment}
                  maxLength={120}
                  placeholder="Super cool power!"
                  onChange={(e) => setComment(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    fontSize: '1.18rem',
                  }}
                />
                {canVoteOrChange && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginTop: '8px',
                    }}
                  >
                    {QUICK_NOTES.map((note) => (
                      <button
                        key={note}
                        type="button"
                        className="mc-btn"
                        onClick={() => {
                          playSound('click');
                          setComment(note);
                        }}
                        style={{
                          fontSize: '0.74rem',
                          padding: '6px 10px',
                          minHeight: '38px',
                        }}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chunky Submit / Change Vote Button */}
              <button
                type="button"
                className={`mc-btn ${myExistingVote ? 'mc-btn-gold' : 'mc-btn-green'}`}
                disabled={!canSubmit}
                onClick={handleSubmit}
                style={{
                  width: '100%',
                  minHeight: '58px',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '0.88rem',
                  opacity: canSubmit ? 1 : 0.55,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {!canVoteOrChange
                  ? `🔒 VOTE LOCKED (${myExistingVote?.score}/10)`
                  : selectedGrade === null
                    ? 'PICK A SCORE (0–10) FIRST'
                    : myExistingVote
                      ? hasChangedFromExisting
                        ? `CHANGE VOTE TO ${selectedGrade}/10 (USES 1 CHANGE)`
                        : 'PICK A NEW SCORE OR NOTE TO CHANGE'
                      : `SUBMIT VOTE (${selectedGrade}/10)`}
              </button>
                </>
              )}

              {/* All Player Votes & Average Breakdown */}
              <div
                className="mc-panel-dark"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Silkscreen', monospace",
                      fontSize: '0.8rem',
                      color: '#ffdd55',
                    }}
                  >
                    📊 PLAYER VOTES ({selectedAvgInfo.count})
                  </span>
                  {selectedAvgInfo.average !== null ? (
                    <span
                      className="mc-badge"
                      style={{
                        backgroundColor: getRankForScore(selectedAvgInfo.average).bg,
                        color: getRankForScore(selectedAvgInfo.average).color,
                        border: `2px solid ${getRankForScore(selectedAvgInfo.average).color}`,
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: '0.74rem',
                        padding: '5px 10px',
                      }}
                    >
                      AVG {formatAverageScore(selectedAvgInfo.average)}/10
                    </span>
                  ) : (
                    <span
                      style={{
                        fontFamily: "'VT323', monospace",
                        fontSize: '1.15rem',
                        color: '#aaaaaa',
                      }}
                    >
                      No votes yet — be the first!
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(() => {
                    const eligiblePlayers = allPlayerList.filter(
                      (p) => p.id !== selectedItem.creatorId || Boolean(selectedVotes[p.id])
                    );
                    const knownIds = new Set(eligiblePlayers.map((p) => p.id));
                    const extraVoterIds = Object.keys(selectedVotes).filter(
                      (id) => !knownIds.has(id)
                    );
                    const rows = [
                      ...eligiblePlayers.map((p) => ({
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

                    if (rows.length === 0) {
                      return (
                        <div
                          style={{
                            padding: '10px',
                            textAlign: 'center',
                            fontFamily: "'VT323', monospace",
                            fontSize: '1.2rem',
                            color: '#bbbbbb',
                          }}
                        >
                          No other players in this Realm yet — share your Realm invite so friends
                          can vote and leave comments!
                        </div>
                      );
                    }

                    return rows.map((p) => {
                      const v = selectedVotes[p.id];
                      const rank = v ? getRankForScore(v.score) : null;
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
                            backgroundColor: 'rgba(0,0,0,0.28)',
                            border: `2px solid ${p.id === currentPlayerId ? '#55ff55' : '#3a3a3a'}`,
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <img
                                src={getAvatarUrl(p.avatarId)}
                                alt={p.name}
                                className="mc-pixelated"
                                style={{ width: '26px', height: '26px', imageRendering: 'pixelated' }}
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
                                      fontSize: '1.18rem',
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
                              {v && rank ? (
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
                                      backgroundColor: rank.bg,
                                      color: rank.color,
                                      border: `2px solid ${rank.color}`,
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
                                    color: '#888888',
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
                                marginLeft: '34px',
                                padding: '6px 10px',
                                backgroundColor: 'rgba(184, 102, 214, 0.1)',
                                borderLeft: '3px solid #b866d6',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                              }}
                            >
                              {prevHistory.map((h, idx) => (
                                <div
                                  key={`${p.id}-hist-${idx}`}
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
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InboxGrader;
