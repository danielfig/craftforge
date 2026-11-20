import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CraftItem, ItemRarity, PlayerId, PlayerProfile } from '../types';
import { AVATARS, renderPixelsToDataUrl } from '../assets/textures';
import { playSound } from '../utils/sounds';

export interface InboxGraderProps {
  items: CraftItem[];
  players: Record<PlayerId, PlayerProfile>;
  currentPlayerId: PlayerId;
  onGradeItem: (itemId: string, grade: number, comment: string) => void;
}

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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const benchRef = useRef<HTMLDivElement | null>(null);

  const unratedItems = useMemo(
    () =>
      items
        .filter((item) => item.recipientId === currentPlayerId && item.grade === null)
        .sort((a, b) => b.createdAt - a.createdAt),
    [items, currentPlayerId]
  );

  // Auto-select the first unrated item when list changes so Pixel Tablet split-view is immediately active
  useEffect(() => {
    if (unratedItems.length === 0) {
      setSelectedItemId(null);
      return;
    }
    const stillExists = unratedItems.some((item) => item.id === selectedItemId);
    if (!stillExists) {
      setSelectedItemId(unratedItems[0].id);
      setSelectedGrade(null);
      setComment('');
    }
  }, [unratedItems, selectedItemId]);

  const selectedItem = useMemo(
    () => unratedItems.find((item) => item.id === selectedItemId) || unratedItems[0] || null,
    [unratedItems, selectedItemId]
  );

  // Render pixel art data URLs for unrated items
  const previewUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of unratedItems) {
      map[item.id] = renderPixelsToDataUrl(item.pixels, 8);
    }
    return map;
  }, [unratedItems]);

  const otherPlayerId: PlayerId = currentPlayerId === 'player1' ? 'player2' : 'player1';
  const otherPlayer = players[otherPlayerId];

  const handleSelectItem = (itemId: string) => {
    playSound('chest');
    setSelectedItemId(itemId);
    setSelectedGrade(null);
    setComment('');
    if (window.innerWidth < 900 && benchRef.current) {
      benchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePickScore = (score: number) => {
    playSound('grade');
    setSelectedGrade(score);
  };

  const handleSubmit = () => {
    if (!selectedItem || selectedGrade === null) return;
    playSound('xp');
    onGradeItem(selectedItem.id, selectedGrade, comment.trim());
    setSelectedGrade(null);
    setComment('');
  };

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
            max-height: calc(100vh - 210px);
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
          marginBottom: '16px',
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
            INBOX TO RATE
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              fontFamily: "'VT323', monospace",
              fontSize: '1.3rem',
              color: '#d8d8d8',
            }}
          >
            Pick a glowing chest item and score it from 0 to 10 on the Grading Bench!
          </p>
        </div>

        <div
          className="mc-badge"
          style={{
            backgroundColor: unratedItems.length > 0 ? '#b8860b' : '#3b8526',
            color: '#ffffff',
            fontFamily: "'Silkscreen', monospace",
            fontSize: '0.85rem',
            padding: '8px 14px',
          }}
        >
          {unratedItems.length === 0
            ? 'ALL CAUGHT UP!'
            : `${unratedItems.length} WAITING FOR GRADE`}
        </div>
      </div>

      {/* Empty State */}
      {unratedItems.length === 0 ? (
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
            ✨
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
            All items rated! Go craft a new one!
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
            When {otherPlayer?.name || 'your partner'} crafts something new for you, it will
            appear here as a glowing chest ready for your 0–10 rating.
          </p>
        </div>
      ) : (
        /* Pixel Tablet Wide Split View: Left Queue + Right Active 0-10 Grading Bench */
        <div className="cf-inbox-split">
          {/* LEFT: Unrated Glowing Chest Queue */}
          <div className="cf-inbox-list">
            {unratedItems.map((item) => {
              const creator = players[item.creatorId];
              const creatorAvatar = creator ? getAvatarUrl(creator.avatarId) : '';
              const rarityColor = RARITY_COLORS[item.rarity] || '#ffffff';
              const isActive = selectedItem?.id === item.id;

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
                    border: isActive ? '3px solid #ffd700' : '3px solid #7d6218',
                    boxShadow: isActive
                      ? '0 0 20px rgba(255, 215, 0, 0.4), inset 0 0 12px rgba(255, 215, 0, 0.16)'
                      : '0 0 10px rgba(255, 215, 0, 0.14)',
                    backgroundColor: isActive ? '#2d2619' : undefined,
                    transition: 'transform 0.1s ease, border-color 0.12s ease',
                  }}
                >
                  {/* Top row: Creator & Time */}
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
                        From {creator?.name || 'Crafter'}
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "'VT323', monospace",
                        fontSize: '1.05rem',
                        color: isActive ? '#ffdd55' : '#aaaaaa',
                      }}
                    >
                      {isActive ? '▶ GRADING' : formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  {/* Middle: Pixel Art Slot + Title & Description */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                        <span
                          className="mc-badge"
                          style={{
                            fontSize: '0.62rem',
                            textTransform: 'uppercase',
                            backgroundColor: '#3a3a4a',
                            color: '#ddd',
                            padding: '2px 6px',
                          }}
                        >
                          {item.category}
                        </span>
                        <span
                          className="mc-badge"
                          style={{
                            fontSize: '0.62rem',
                            textTransform: 'uppercase',
                            backgroundColor: '#262030',
                            color: rarityColor,
                            padding: '2px 6px',
                          }}
                        >
                          {item.rarity}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: "'VT323', monospace",
                          fontSize: '1.12rem',
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

          {/* RIGHT: Spacious Active 0-10 Grading Bench */}
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
                  0–10 GRADING BENCH
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
                    {players[selectedItem.creatorId] && (
                      <img
                        src={getAvatarUrl(players[selectedItem.creatorId].avatarId)}
                        alt={players[selectedItem.creatorId].name}
                        className="mc-pixelated"
                        style={{ width: '24px', height: '24px', imageRendering: 'pixelated' }}
                      />
                    )}
                    <span>Crafted by {players[selectedItem.creatorId]?.name || 'Crafter'}</span>
                  </div>
                </div>
              </div>

              {/* 0 to 10 Hotbar / XP Score Picker */}
              <div>
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
                    TAP YOUR SCORE (0–10):
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
                        onClick={() => handlePickScore(score)}
                        aria-pressed={isSelected}
                        style={{
                          minHeight: '54px',
                          minWidth: '44px',
                          cursor: 'pointer',
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
              <div>
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
                  GRADING NOTE (OPTIONAL):
                </label>
                <input
                  id="grade-comment-input"
                  type="text"
                  className="mc-input"
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
              </div>

              {/* Chunky Submit Grade Button */}
              <button
                type="button"
                className="mc-btn mc-btn-green"
                disabled={selectedGrade === null}
                onClick={handleSubmit}
                style={{
                  width: '100%',
                  minHeight: '58px',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '0.95rem',
                  opacity: selectedGrade === null ? 0.55 : 1,
                  cursor: selectedGrade === null ? 'not-allowed' : 'pointer',
                }}
              >
                {selectedGrade === null
                  ? 'PICK A SCORE (0–10) FIRST'
                  : `SUBMIT GRADE (${selectedGrade}/10)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InboxGrader;
