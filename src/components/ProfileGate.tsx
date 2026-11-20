import React, { useState, useEffect } from 'react';
import { AVATARS } from '../assets/textures';
import { SyncStatus } from '../store/itemStore';
import { playSound } from '../utils/sounds';

export interface ProfileGateProps {
  realmCode: string;
  syncStatus: SyncStatus;
  onOpenSyncModal: () => void;
  onOpenRealmInvite?: (initialTab: 'create' | 'invite') => void;
  onLogin: (params: {
    name: string;
    pin: string;
    avatarId: string;
    realmCode: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const SPLASH_TEXTS = [
  '100% Blocky!',
  'Rate 0 to 10!',
  'Craft & Share!',
  'Pixel Powered!',
  'Enchanted Fun!',
  'Double Chest Ready!',
  'PIN Protected!',
];

export const ProfileGate: React.FC<ProfileGateProps> = ({
  realmCode,
  syncStatus,
  onOpenSyncModal,
  onOpenRealmInvite,
  onLogin,
}) => {
  const [name, setName] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [avatarIdx, setAvatarIdx] = useState<number>(0);
  const [localRealm, setLocalRealm] = useState<string>(realmCode || 'FAMILY-CRAFT');
  const [splashIndex, setSplashIndex] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (realmCode) {
      setLocalRealm(realmCode);
    }
  }, [realmCode]);

  const currentAvatar =
    AVATARS && AVATARS.length > 0 ? AVATARS[avatarIdx % AVATARS.length] : null;

  const handleCycleAvatar = (delta: number) => {
    if (!AVATARS || AVATARS.length === 0) return;
    playSound('click');
    setAvatarIdx((prev) => (prev + delta + AVATARS.length) % AVATARS.length);
  };

  const handleCycleSplash = () => {
    playSound('click');
    setSplashIndex((prev) => (prev + 1) % SPLASH_TEXTS.length);
  };

  const handlePinChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 3);
    setPin(digitsOnly);
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      playSound('click');
      setError('Please enter your Crafter Name!');
      return;
    }

    if (!/^\d{3}$/.test(pin)) {
      playSound('click');
      setError('Please enter a 3-digit PIN (numbers 0–9).');
      return;
    }

    playSound('click');
    setError('');
    setSubmitting(true);

    try {
      const cleanRealm = localRealm.trim().toUpperCase() || 'FAMILY-CRAFT';
      const result = await onLogin({
        name: trimmedName,
        pin,
        avatarId: currentAvatar ? currentAvatar.id : 'knight',
        realmCode: cleanRealm,
      });

      if (!result.ok) {
        setError(result.error || 'Login failed. Please check your 3-digit PIN.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const syncDotColor =
    syncStatus.state === 'synced'
      ? '#55ff55'
      : syncStatus.state === 'syncing'
        ? '#ffdd55'
        : syncStatus.state === 'error'
          ? '#ff5555'
          : '#aaaaaa';

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
          padding: 20px 20px 32px;
          box-sizing: border-box;
          position: relative;
        }
        .cf-login-card {
          width: 100%;
          max-width: 540px;
          box-sizing: border-box;
          margin-bottom: 16px;
        }
        .cf-realm-bar {
          width: 100%;
          max-width: 540px;
          box-sizing: border-box;
        }
      `}</style>

      {/* Chunky 3D Minecraft Title Header */}
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          marginBottom: '20px',
          maxWidth: '680px',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 'clamp(1.85rem, 5.2vw, 3.4rem)',
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
      </div>

      {/* Single Sleek Minecraft LOGIN Panel */}
      <form
        onSubmit={handleSubmit}
        className="mc-panel cf-login-card"
        style={{
          padding: '24px 26px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)',
            color: '#2b2b2b',
            letterSpacing: '0.05em',
          }}
        >
          CRAFTER LOGIN
        </h2>

        {/* Avatar Portrait Cycler (No class name label!) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
          }}
        >
          <button
            type="button"
            className="mc-btn"
            aria-label="Previous avatar"
            onClick={() => handleCycleAvatar(-1)}
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
            onClick={() => handleCycleAvatar(1)}
            aria-label="Cycle avatar"
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
            {currentAvatar ? (
              <img
                src={currentAvatar.dataUrl}
                alt="Player Avatar"
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
            aria-label="Next avatar"
            onClick={() => handleCycleAvatar(1)}
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

        {/* Crafter Name Input */}
        <div style={{ width: '100%' }}>
          <label
            htmlFor="login-crafter-name"
            style={{
              display: 'block',
              fontFamily: "'Silkscreen', monospace",
              fontSize: '0.78rem',
              color: '#373737',
              marginBottom: '6px',
              textTransform: 'uppercase',
            }}
          >
            Crafter Name
          </label>
          <input
            id="login-crafter-name"
            type="text"
            className="mc-input"
            value={name}
            maxLength={18}
            autoComplete="username"
            placeholder="Enter your name"
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontSize: '1.2rem',
              padding: '12px 14px',
              textAlign: 'center',
            }}
          />
        </div>

        {/* 3-Digit PIN Input with Show/Hide Toggle */}
        <div style={{ width: '100%' }}>
          <label
            htmlFor="login-crafter-pin"
            style={{
              display: 'block',
              fontFamily: "'Silkscreen', monospace",
              fontSize: '0.78rem',
              color: '#373737',
              marginBottom: '6px',
              textTransform: 'uppercase',
            }}
          >
            3-Digit PIN
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            <input
              id="login-crafter-pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              autoComplete="current-password"
              className="mc-input"
              value={pin}
              placeholder="•••"
              onChange={(e) => handlePinChange(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                boxSizing: 'border-box',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '1.25rem',
                letterSpacing: '0.45em',
                padding: '12px 14px',
                textAlign: 'center',
              }}
            />
            <button
              type="button"
              className="mc-btn"
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              title={showPin ? 'Hide PIN' : 'Show PIN'}
              onClick={() => {
                playSound('click');
                setShowPin((prev) => !prev);
              }}
              style={{
                minWidth: '52px',
                minHeight: '48px',
                padding: '6px 12px',
                fontSize: '1.15rem',
              }}
            >
              {showPin ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Helper Note */}
        <p
          style={{
            margin: 0,
            fontFamily: "'VT323', monospace",
            fontSize: '1.22rem',
            color: '#444444',
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          First time using a name? Your 3-digit PIN locks it. Returning? Enter your PIN to log in.
        </p>

        {/* Error Alert Box */}
        {error && (
          <div
            role="alert"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#5c1414',
              border: '3px solid #ff5555',
              color: '#ffdddd',
              padding: '10px 14px',
              fontFamily: "'Silkscreen', monospace",
              fontSize: '0.78rem',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Big Chunky Green PLAY / LOGIN Button */}
        <button
          type="submit"
          className="mc-btn mc-btn-green"
          disabled={submitting}
          style={{
            width: '100%',
            minHeight: '58px',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '0.98rem',
            letterSpacing: '0.04em',
            opacity: submitting ? 0.65 : 1,
            cursor: submitting ? 'wait' : 'pointer',
          }}
        >
          {submitting ? 'CHECKING PIN...' : 'PLAY / LOGIN'}
        </button>
      </form>

      {/* Bottom Realm Code + Cloud Sync Bar */}
      <div
        className="mc-panel-dark cf-realm-bar"
        style={{
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ flex: '1 1 160px' }}>
            <div
              style={{
                fontFamily: "'Silkscreen', monospace",
                fontSize: '0.82rem',
                color: '#55ff55',
                marginBottom: '2px',
              }}
            >
              REALM CODE
            </div>
            <div
              style={{
                fontFamily: "'VT323', monospace",
                fontSize: '1.15rem',
                color: '#cccccc',
              }}
            >
              Same code = shared chest & inbox
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
              flex: '1 1 180px',
              maxWidth: '240px',
              width: '100%',
              boxSizing: 'border-box',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '0.8rem',
              padding: '10px 12px',
              textAlign: 'center',
              letterSpacing: '0.06em',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            paddingTop: '10px',
            borderTop: '2px solid rgba(255,255,255,0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: syncDotColor,
                display: 'inline-block',
                border: '1px solid #000',
              }}
            />
            <span
              style={{
                fontFamily: "'VT323', monospace",
                fontSize: '1.2rem',
                color: '#dcdcdc',
              }}
            >
              {syncStatus.message}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {onOpenRealmInvite && (
              <>
                <button
                  type="button"
                  className="mc-btn mc-btn-green"
                  onClick={() => {
                    playSound('click');
                    onOpenRealmInvite('create');
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '8px 12px',
                    fontSize: '0.76rem',
                  }}
                >
                  🏰 Create Realm
                </button>
                <button
                  type="button"
                  className="mc-btn mc-btn-gold"
                  onClick={() => {
                    playSound('click');
                    onOpenRealmInvite('invite');
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '8px 12px',
                    fontSize: '0.76rem',
                  }}
                >
                  ✉ Email Invite
                </button>
              </>
            )}
            <button
              type="button"
              className="mc-btn"
              onClick={() => {
                playSound('click');
                onOpenSyncModal();
              }}
              style={{
                minHeight: '44px',
                padding: '8px 14px',
                fontSize: '0.76rem',
              }}
            >
              ☁ Cloud Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileGate;
