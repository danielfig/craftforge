import React, { useState, useEffect } from 'react';
import { PlayerId, PlayerProfile } from '../types';
import { AVATARS } from '../assets/textures';
import { playSound } from '../utils/sounds';

export interface ProfileGateProps {
  players: Record<PlayerId, PlayerProfile>;
  realmCode: string;
  onSelectPlayer: (
    playerId: PlayerId,
    updatedPlayers: Record<PlayerId, PlayerProfile>,
    realmCode: string
  ) => void;
}

const SPLASH_TEXTS = [
  '100% Blocky!',
  'Rate 0 to 10!',
  'Craft & Share!',
  'Pixel Powered!',
  'Enchanted Fun!',
  'Double Chest Ready!',
  '3+ Players Welcome!',
];

const PLAYER_ACCENT_COLORS = [
  '#3b8526',
  '#2d7dd2',
  '#9b59b6',
  '#d97706',
  '#e11d48',
  '#0d9488',
];

const PLAY_BTN_CLASSES = ['mc-btn-green', 'mc-btn-gold', 'mc-btn-purple'];

export const ProfileGate: React.FC<ProfileGateProps> = ({
  players,
  realmCode,
  onSelectPlayer,
}) => {
  const [localPlayers, setLocalPlayers] = useState<Record<PlayerId, PlayerProfile>>(players);
  const [localRealm, setLocalRealm] = useState<string>(realmCode || 'FAMILY-CRAFT');
  const [splashIndex, setSplashIndex] = useState<number>(0);

  useEffect(() => {
    setLocalPlayers(players);
  }, [players]);

  useEffect(() => {
    if (realmCode) {
      setLocalRealm(realmCode);
    }
  }, [realmCode]);

  const playerList = Object.values(localPlayers);

  const getAvatarIndex = (avatarId: string): number => {
    if (!AVATARS || AVATARS.length === 0) return 0;
    const idx = AVATARS.findIndex((a) => a.id === avatarId);
    return idx >= 0 ? idx : 0;
  };

  const handleCycleAvatar = (playerId: PlayerId, delta: number) => {
    if (!AVATARS || AVATARS.length === 0) return;
    playSound('click');
    setLocalPlayers((prev) => {
      const current = prev[playerId];
      if (!current) return prev;
      const currentIdx = getAvatarIndex(current.avatarId);
      const nextIdx = (currentIdx + delta + AVATARS.length) % AVATARS.length;
      return {
        ...prev,
        [playerId]: {
          ...current,
          avatarId: AVATARS[nextIdx].id,
        },
      };
    });
  };

  const handleNameChange = (playerId: PlayerId, name: string) => {
    setLocalPlayers((prev) => {
      const current = prev[playerId];
      if (!current) return prev;
      return {
        ...prev,
        [playerId]: {
          ...current,
          name,
        },
      };
    });
  };

  const handleAddPlayer = () => {
    playSound('click');
    setLocalPlayers((prev) => {
      let nextNum = 3;
      while (prev[`player${nextNum}`]) {
        nextNum += 1;
      }
      const newId: PlayerId = `player${nextNum}`;
      const existingList = Object.values(prev);
      const usedAvatarIds = new Set(existingList.map((p) => p.avatarId));
      const nextAvatar =
        AVATARS.find((a) => !usedAvatarIds.has(a.id)) ||
        AVATARS[existingList.length % Math.max(1, AVATARS.length)];
      const nextColor =
        PLAYER_ACCENT_COLORS[existingList.length % PLAYER_ACCENT_COLORS.length];

      return {
        ...prev,
        [newId]: {
          id: newId,
          name: `Player ${nextNum}`,
          avatarId: nextAvatar ? nextAvatar.id : 'knight',
          color: nextColor,
        },
      };
    });
  };

  const handleRemovePlayer = (playerId: PlayerId) => {
    if (playerList.length <= 2) return;
    playSound('click');
    setLocalPlayers((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  };

  const handlePlay = (playerId: PlayerId) => {
    playSound('click');
    const cleanRealm = localRealm.trim().toUpperCase() || 'FAMILY-CRAFT';
    const sanitizedPlayers: Record<PlayerId, PlayerProfile> = {};
    Object.values(localPlayers).forEach((profile, idx) => {
      const fallbackName = idx === 0 ? 'Dad' : idx === 1 ? 'Son' : `Player ${idx + 1}`;
      sanitizedPlayers[profile.id] = {
        ...profile,
        name: profile.name.trim() || fallbackName,
      };
    });
    onSelectPlayer(playerId, sanitizedPlayers, cleanRealm);
  };

  const handleCycleSplash = () => {
    playSound('click');
    setSplashIndex((prev) => (prev + 1) % SPLASH_TEXTS.length);
  };

  return (
    <div className="cf-profile-gate">
      <style>{`
        @keyframes mc-splash-bounce {
          0%, 100% { transform: rotate(-11deg) scale(1); }
          50% { transform: rotate(-11deg) scale(1.09); }
        }
        .cf-profile-gate {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 24px 28px;
          box-sizing: border-box;
          position: relative;
        }
        .cf-profile-cards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          width: 100%;
          max-width: 1140px;
          margin-bottom: 18px;
        }
        @media (min-width: 960px) {
          .cf-profile-cards {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 660px) {
          .cf-profile-cards {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>

      {/* Chunky 3D Minecraft Title Header */}
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          marginBottom: '22px',
          maxWidth: '1140px',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 'clamp(1.85rem, 5.2vw, 3.5rem)',
            letterSpacing: '0.06em',
            color: '#e8e8e8',
            margin: 0,
            lineHeight: 1.15,
            textShadow:
              '0 3px 0 #a0a0a0, 0 6px 0 #666666, 0 9px 0 #3a3a3a, 0 12px 0 #1b1b1b, 4px 14px 0 rgba(0,0,0,0.65)',
            userSelect: 'none',
          }}
        >
          CRAFTFORGE
        </h1>

        <button
          type="button"
          onClick={handleCycleSplash}
          title="Tap for another splash!"
          style={{
            position: 'relative',
            display: 'inline-block',
            marginTop: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'Silkscreen', 'Press Start 2P', monospace",
            fontSize: 'clamp(0.9rem, 2.2vw, 1.25rem)',
            fontWeight: 700,
            color: '#ffff55',
            textShadow: '2px 2px 0 #3f3f00, 3px 3px 0 #000000',
            animation: 'mc-splash-bounce 1.3s ease-in-out infinite',
            padding: '4px 10px',
          }}
        >
          {SPLASH_TEXTS[splashIndex]}
        </button>

        <p
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '1.45rem',
            color: '#f2f2f2',
            textShadow: '2px 2px 0 rgba(0,0,0,0.85)',
            margin: '8px 0 0',
          }}
        >
          Design custom Minecraft items, send them over, and rate them 0 to 10!
        </p>
      </div>

      {/* Dynamic Player Cards + Add Player Card */}
      <div className="cf-profile-cards">
        {playerList.map((profile, idx) => {
          const pid = profile.id;
          const avatarIdx = getAvatarIndex(profile.avatarId);
          const avatar = AVATARS[avatarIdx];
          const fallbackName = idx === 0 ? 'Dad' : idx === 1 ? 'Son' : `Player ${idx + 1}`;
          const displayName = profile.name.trim() || fallbackName;
          const badgeColor =
            profile.color || PLAYER_ACCENT_COLORS[idx % PLAYER_ACCENT_COLORS.length];
          const playBtnClass = PLAY_BTN_CLASSES[idx % PLAY_BTN_CLASSES.length];
          const canRemove = playerList.length > 2 && pid !== 'player1' && pid !== 'player2';

          return (
            <div
              key={pid}
              className="mc-panel"
              style={{
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              {/* Player slot badge + optional remove button */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  className="mc-badge"
                  style={{
                    backgroundColor: badgeColor,
                    color: '#ffffff',
                    fontFamily: "'Silkscreen', monospace",
                    fontSize: '0.76rem',
                    padding: '5px 10px',
                  }}
                >
                  PLAYER {idx + 1}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: "'VT323', monospace",
                      fontSize: '1.22rem',
                      color: '#3f3f3f',
                    }}
                  >
                    {avatar ? avatar.name : 'Crafter'}
                  </span>
                  {canRemove && (
                    <button
                      type="button"
                      className="mc-btn mc-btn-red"
                      onClick={() => handleRemovePlayer(pid)}
                      aria-label={`Remove ${displayName}`}
                      title={`Remove ${displayName}`}
                      style={{
                        minWidth: '34px',
                        minHeight: '34px',
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        fontFamily: "'Press Start 2P', monospace",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Avatar picker with Prev / Next */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  className="mc-btn"
                  aria-label={`Previous avatar for Player ${idx + 1}`}
                  onClick={() => handleCycleAvatar(pid, -1)}
                  style={{
                    minWidth: '46px',
                    minHeight: '46px',
                    padding: '6px 10px',
                    fontSize: '1.1rem',
                  }}
                >
                  ◀
                </button>

                <button
                  type="button"
                  onClick={() => handleCycleAvatar(pid, 1)}
                  title="Tap to change avatar"
                  className="mc-slot"
                  style={{
                    width: '96px',
                    height: '96px',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {avatar ? (
                    <img
                      src={avatar.dataUrl}
                      alt={avatar.name}
                      className="mc-pixelated"
                      style={{
                        width: '78px',
                        height: '78px',
                        imageRendering: 'pixelated',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '1.5rem' }}>
                      ?
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="mc-btn"
                  aria-label={`Next avatar for Player ${idx + 1}`}
                  onClick={() => handleCycleAvatar(pid, 1)}
                  style={{
                    minWidth: '46px',
                    minHeight: '46px',
                    padding: '6px 10px',
                    fontSize: '1.1rem',
                  }}
                >
                  ▶
                </button>
              </div>

              {/* Inline Name Edit */}
              <div style={{ width: '100%' }}>
                <label
                  htmlFor={`player-name-${pid}`}
                  style={{
                    display: 'block',
                    fontFamily: "'Silkscreen', monospace",
                    fontSize: '0.74rem',
                    color: '#373737',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                  }}
                >
                  Crafter Name
                </label>
                <input
                  id={`player-name-${pid}`}
                  type="text"
                  className="mc-input"
                  value={profile.name}
                  maxLength={18}
                  placeholder={fallbackName}
                  onChange={(e) => handleNameChange(pid, e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '1.12rem',
                    padding: '10px 12px',
                    textAlign: 'center',
                  }}
                />
              </div>

              {/* Play Button */}
              <button
                type="button"
                className={`mc-btn ${playBtnClass}`}
                onClick={() => handlePlay(pid)}
                style={{
                  width: '100%',
                  minHeight: '54px',
                  fontSize: '0.88rem',
                  fontFamily: "'Press Start 2P', monospace",
                  letterSpacing: '0.03em',
                  marginTop: '4px',
                }}
              >
                PLAY AS {displayName.toUpperCase()}
              </button>
            </div>
          );
        })}

        {/* Chunky + ADD PLAYER Card */}
        <button
          type="button"
          onClick={handleAddPlayer}
          className="mc-panel-dark"
          style={{
            padding: '24px 20px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            minHeight: '260px',
            border: '3px dashed #7a7a7a',
            textAlign: 'center',
            transition: 'transform 0.1s ease, border-color 0.12s ease',
          }}
        >
          <div
            className="mc-slot"
            style={{
              width: '76px',
              height: '76px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '2.2rem',
              color: '#55ff55',
              textShadow: '2px 2px 0 #000',
            }}
          >
            +
          </div>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '0.9rem',
              color: '#ffffff',
              textShadow: '2px 2px 0 #000',
              lineHeight: 1.4,
            }}
          >
            + ADD PLAYER
          </div>
          <div
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: '1.25rem',
              color: '#cccccc',
              maxWidth: '220px',
              lineHeight: 1.25,
            }}
          >
            Invite another sibling, parent, or friend to this Realm!
          </div>
        </button>
      </div>

      {/* Realm Code Panel */}
      <div
        className="mc-panel-dark"
        style={{
          width: '100%',
          maxWidth: '1140px',
          padding: '14px 22px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ flex: '1 1 280px' }}>
          <div
            style={{
              fontFamily: "'Silkscreen', monospace",
              fontSize: '0.88rem',
              color: '#55ff55',
              marginBottom: '4px',
            }}
          >
            REALM CODE
          </div>
          <div
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: '1.25rem',
              color: '#d0d0d0',
              lineHeight: 1.2,
            }}
          >
            Enter the same code on all tablets to share your chest & inbox!
          </div>
        </div>

        <input
          type="text"
          className="mc-input"
          aria-label="Realm Code"
          value={localRealm}
          maxLength={24}
          placeholder="FAMILY-CRAFT"
          onChange={(e) => setLocalRealm(e.target.value.toUpperCase())}
          style={{
            flex: '0 1 260px',
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '0.88rem',
            padding: '12px 14px',
            textAlign: 'center',
            letterSpacing: '0.08em',
          }}
        />
      </div>
    </div>
  );
};

export default ProfileGate;
