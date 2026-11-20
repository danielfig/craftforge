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
];

const PLAYER_IDS: PlayerId[] = ['player1', 'player2'];

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
    setLocalPlayers((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        name,
      },
    }));
  };

  const handlePlay = (playerId: PlayerId) => {
    playSound('click');
    const cleanRealm = localRealm.trim().toUpperCase() || 'FAMILY-CRAFT';
    const sanitizedPlayers: Record<PlayerId, PlayerProfile> = {
      player1: {
        ...localPlayers.player1,
        name: localPlayers.player1.name.trim() || 'Dad',
      },
      player2: {
        ...localPlayers.player2,
        name: localPlayers.player2.name.trim() || 'Son',
      },
    };
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
          gap: 24px;
          width: 100%;
          max-width: 960px;
          margin-bottom: 18px;
        }
        @media (max-width: 680px) {
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
          maxWidth: '960px',
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

      {/* Two Big Tactile Player Cards */}
      <div className="cf-profile-cards">
        {PLAYER_IDS.map((pid, idx) => {
          const profile = localPlayers[pid];
          const avatarIdx = getAvatarIndex(profile.avatarId);
          const avatar = AVATARS[avatarIdx];
          const isPlayerOne = idx === 0;
          const displayName = profile.name.trim() || (isPlayerOne ? 'Dad' : 'Son');

          return (
            <div
              key={pid}
              className="mc-panel"
              style={{
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              {/* Player slot badge */}
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  className="mc-badge"
                  style={{
                    backgroundColor: profile.color || (isPlayerOne ? '#3b8526' : '#2d7dd2'),
                    color: '#ffffff',
                    fontFamily: "'Silkscreen', monospace",
                    fontSize: '0.78rem',
                    padding: '5px 10px',
                  }}
                >
                  PLAYER {idx + 1}
                </span>
                <span
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '1.25rem',
                    color: '#3f3f3f',
                  }}
                >
                  {avatar ? avatar.name : 'Crafter'}
                </span>
              </div>

              {/* Avatar picker with Prev / Next */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <button
                  type="button"
                  className="mc-btn"
                  aria-label={`Previous avatar for Player ${idx + 1}`}
                  onClick={() => handleCycleAvatar(pid, -1)}
                  style={{
                    minWidth: '48px',
                    minHeight: '48px',
                    padding: '6px 12px',
                    fontSize: '1.15rem',
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
                    width: '104px',
                    height: '104px',
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
                        width: '84px',
                        height: '84px',
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
                    minWidth: '48px',
                    minHeight: '48px',
                    padding: '6px 12px',
                    fontSize: '1.15rem',
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
                    fontSize: '0.75rem',
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
                  placeholder={isPlayerOne ? 'Dad' : 'Son'}
                  onChange={(e) => handleNameChange(pid, e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: '1.15rem',
                    padding: '10px 12px',
                    textAlign: 'center',
                  }}
                />
              </div>

              {/* Play Button */}
              <button
                type="button"
                className={`mc-btn ${isPlayerOne ? 'mc-btn-green' : 'mc-btn-gold'}`}
                onClick={() => handlePlay(pid)}
                style={{
                  width: '100%',
                  minHeight: '56px',
                  fontSize: '0.95rem',
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
      </div>

      {/* Realm Code Panel */}
      <div
        className="mc-panel-dark"
        style={{
          width: '100%',
          maxWidth: '960px',
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
            Enter the same code on both tablets to share your chest & inbox!
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
