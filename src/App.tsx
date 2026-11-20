import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/minecraft.css';
import { CraftItem, PlayerId, PlayerProfile, RealmState } from './types';
import {
  CloudSyncConfig,
  SyncStatus,
  generateItemId,
  loadActivePlayer,
  loadCloudConfig,
  loadRealmState,
  mergeRealmStates,
  parseFirebaseSnippet,
  pullRealmFromCloud,
  pushRealmToCloud,
  sanitizeRealmCode,
  saveActivePlayer,
  saveCloudConfig,
  saveRealmState,
} from './store/itemStore';
import { ProfileGate } from './components/ProfileGate';
import { ItemStudio } from './components/ItemStudio';
import { InboxGrader } from './components/InboxGrader';
import { SharedChest } from './components/SharedChest';
import { AVATARS } from './assets/textures';
import { isMuted, playSound, setMuted } from './utils/sounds';

type ActiveTab = 'studio' | 'inbox' | 'chest';

export default function App() {
  const [realm, setRealm] = useState<RealmState>(() => loadRealmState());
  const [activePlayerId, setActivePlayerId] = useState<PlayerId | null>(() => loadActivePlayer());
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig>(() => loadCloudConfig());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => ({
    state: loadCloudConfig().enabled ? 'syncing' : 'local',
    message: loadCloudConfig().enabled ? 'Connecting to Realm...' : 'Local Mode',
    lastSyncedAt: null,
  }));

  // Cloud Sync Modal state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [snippetInput, setSnippetInput] = useState('');
  const [projectIdInput, setProjectIdInput] = useState(cloudConfig.projectId);
  const [apiKeyInput, setApiKeyInput] = useState(cloudConfig.apiKey);
  const [realmCodeInput, setRealmCodeInput] = useState(realm.realmCode);
  const [syncError, setSyncError] = useState('');

  // Keep latest realm in a ref for async cloud sync merges
  const realmRef = useRef(realm);
  realmRef.current = realm;

  // Persist realm to localStorage on every change
  useEffect(() => {
    saveRealmState(realm);
  }, [realm]);

  // Persist active player selection
  useEffect(() => {
    saveActivePlayer(activePlayerId);
  }, [activePlayerId]);

  const syncNow = useCallback(
    async (configOverride?: CloudSyncConfig, realmOverride?: RealmState) => {
      const cfg = configOverride || cloudConfig;
      const current = realmOverride || realmRef.current;

      if (!cfg.enabled || !cfg.projectId) {
        setSyncStatus({ state: 'local', message: 'Local Mode', lastSyncedAt: null });
        return;
      }

      setSyncStatus((prev) => ({ ...prev, state: 'syncing', message: 'Syncing...' }));
      try {
        const remote = await pullRealmFromCloud(cfg, current.realmCode);
        let finalState = current;
        if (remote) {
          finalState = mergeRealmStates(current, remote);
          setRealm(finalState);
        }
        await pushRealmToCloud(cfg, finalState);
        setSyncStatus({
          state: 'synced',
          message: `Synced (${current.realmCode})`,
          lastSyncedAt: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        setSyncStatus({ state: 'error', message: msg, lastSyncedAt: null });
      }
    },
    [cloudConfig]
  );

  // Poll Firestore every 8s when Cloud Sync is enabled
  useEffect(() => {
    if (!cloudConfig.enabled || !cloudConfig.projectId) {
      setSyncStatus({ state: 'local', message: 'Local Mode', lastSyncedAt: null });
      return;
    }
    void syncNow();
    const timer = window.setInterval(() => {
      void syncNow();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [cloudConfig, realm.realmCode, syncNow]);

  const currentPlayer: PlayerProfile | null = activePlayerId ? realm.players[activePlayerId] : null;
  const otherPlayerId: PlayerId = activePlayerId === 'player1' ? 'player2' : 'player1';
  const otherPlayer: PlayerProfile = realm.players[otherPlayerId];

  const unratedCount = useMemo(() => {
    if (!activePlayerId) return 0;
    return realm.items.filter(
      (item) => !item.hidden && item.recipientId === activePlayerId && item.grade === null
    ).length;
  }, [realm.items, activePlayerId]);

  const visibleItemCount = useMemo(
    () => realm.items.filter((item) => !item.hidden).length,
    [realm.items]
  );

  const handleSelectPlayer = (
    playerId: PlayerId,
    updatedPlayers: Record<PlayerId, PlayerProfile>,
    newRealmCode: string
  ) => {
    const cleanCode = sanitizeRealmCode(newRealmCode);
    const nextRealm: RealmState = {
      ...realm,
      realmCode: cleanCode,
      players: updatedPlayers,
    };
    setRealm(nextRealm);
    setRealmCodeInput(cleanCode);
    setActivePlayerId(playerId);
    if (cloudConfig.enabled && cloudConfig.projectId) {
      void syncNow(cloudConfig, nextRealm);
    }
  };

  const handleSendItem = (
    draft: Omit<
      CraftItem,
      'id' | 'realmCode' | 'creatorId' | 'recipientId' | 'createdAt' | 'grade' | 'gradeComment' | 'gradedAt'
    >
  ) => {
    if (!activePlayerId) return;
    const newItem: CraftItem = {
      ...draft,
      id: generateItemId(),
      realmCode: realm.realmCode,
      creatorId: activePlayerId,
      recipientId: otherPlayerId,
      createdAt: Date.now(),
      grade: null,
    };
    const nextRealm: RealmState = {
      ...realm,
      items: [newItem, ...realm.items],
    };
    setRealm(nextRealm);
    if (cloudConfig.enabled && cloudConfig.projectId) {
      void pushRealmToCloud(cloudConfig, nextRealm).catch(() => {
        // next poll will reconcile
      });
    }
  };

  const handleGradeItem = (itemId: string, grade: number, comment: string) => {
    const clampedGrade = Math.max(0, Math.min(10, Math.round(grade)));
    const nextRealm: RealmState = {
      ...realm,
      items: realm.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              grade: clampedGrade,
              gradeComment: comment.trim() || undefined,
              gradedAt: Date.now(),
            }
          : item
      ),
    };
    setRealm(nextRealm);
    if (cloudConfig.enabled && cloudConfig.projectId) {
      void pushRealmToCloud(cloudConfig, nextRealm).catch(() => {
        // next poll will reconcile
      });
    }
  };

  const handleToggleHideItem = (itemId: string) => {
    if (!activePlayerId) return;
    const nextRealm: RealmState = {
      ...realm,
      items: realm.items.map((item) =>
        item.id === itemId && item.creatorId === activePlayerId
          ? {
              ...item,
              hidden: !item.hidden,
              hiddenUpdatedAt: Date.now(),
            }
          : item
      ),
    };
    setRealm(nextRealm);
    if (cloudConfig.enabled && cloudConfig.projectId) {
      void pushRealmToCloud(cloudConfig, nextRealm).catch(() => {
        // next poll will reconcile
      });
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) {
      playSound('click');
    }
  };

  const handleQuickSwitchPlayer = () => {
    playSound('click');
    setActivePlayerId(otherPlayerId);
  };

  const handleBackToTitle = () => {
    playSound('click');
    setActivePlayerId(null);
  };

  const handleOpenSyncModal = () => {
    playSound('click');
    setProjectIdInput(cloudConfig.projectId);
    setApiKeyInput(cloudConfig.apiKey);
    setRealmCodeInput(realm.realmCode);
    setSnippetInput('');
    setSyncError('');
    setShowSyncModal(true);
  };

  const handleSnippetPaste = (val: string) => {
    setSnippetInput(val);
    const parsed = parseFirebaseSnippet(val);
    if (parsed) {
      setProjectIdInput(parsed.projectId);
      if (parsed.apiKey) setApiKeyInput(parsed.apiKey);
      setSyncError('');
    }
  };

  const handleSaveCloudSync = (enable: boolean) => {
    playSound('click');
    const cleanCode = sanitizeRealmCode(realmCodeInput);
    const updatedRealm: RealmState = { ...realm, realmCode: cleanCode };
    setRealm(updatedRealm);

    if (!enable) {
      const disabledCfg: CloudSyncConfig = {
        enabled: false,
        projectId: projectIdInput.trim(),
        apiKey: apiKeyInput.trim(),
      };
      setCloudConfig(disabledCfg);
      saveCloudConfig(disabledCfg);
      setSyncStatus({ state: 'local', message: 'Local Mode', lastSyncedAt: null });
      setShowSyncModal(false);
      return;
    }

    if (!projectIdInput.trim()) {
      setSyncError('Please enter your Firebase Project ID (or paste your Firebase config snippet).');
      return;
    }

    const nextCfg: CloudSyncConfig = {
      enabled: true,
      projectId: projectIdInput.trim(),
      apiKey: apiKeyInput.trim(),
    };
    setCloudConfig(nextCfg);
    saveCloudConfig(nextCfg);
    setShowSyncModal(false);
    void syncNow(nextCfg, updatedRealm);
  };

  const getAvatarUrl = (avatarId: string) =>
    AVATARS.find((a) => a.id === avatarId)?.dataUrl || AVATARS[0]?.dataUrl || '';

  if (!activePlayerId || !currentPlayer) {
    return (
      <ProfileGate
        players={realm.players}
        realmCode={realm.realmCode}
        onSelectPlayer={handleSelectPlayer}
      />
    );
  }

  return (
    <div className="cf-app-shell">
      <style>{`
        .cf-app-shell {
          min-height: 100dvh;
          width: 100%;
          max-width: 1360px;
          margin: 0 auto;
          padding: 10px 14px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-sizing: border-box;
        }
        .cf-topbar {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 12px;
          box-sizing: border-box;
        }
        .cf-topbar-left,
        .cf-topbar-right {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .cf-brand-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          padding: 6px 12px;
        }
        .cf-avatar-mini {
          width: 28px;
          height: 28px;
          display: block;
          border: 2px solid #212121;
          background: #3a3a3a;
        }
        .cf-player-name {
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .cf-realm-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 44px;
          padding: 6px 12px;
          cursor: pointer;
          border: 2px solid #212121;
        }
        .cf-sync-dot {
          width: 10px;
          height: 10px;
          display: inline-block;
          border: 2px solid #111;
          flex-shrink: 0;
        }
        .cf-topbar-right .mc-btn {
          min-height: 44px;
          padding: 8px 12px;
        }
        .cf-tabs {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .cf-tab-btn {
          min-height: 50px;
          padding: 10px 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.95rem;
          position: relative;
        }
        .cf-tab-active {
          transform: translateY(1px);
          outline: 3px solid #ffff55;
          outline-offset: -3px;
        }
        .cf-unrated-badge {
          background: #ff5555;
          color: #ffffff;
          border: 2px solid #550000;
          padding: 2px 8px;
          font-size: 0.8rem;
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.85);
          animation: cf-pulse 1.5s infinite ease-in-out;
        }
        @keyframes cf-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        .cf-main {
          flex: 1;
          width: 100%;
          min-width: 0;
        }
        .cf-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(0, 0, 0, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .cf-modal {
          width: 100%;
          max-width: 620px;
          max-height: 90dvh;
          overflow-y: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cf-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .cf-modal-title {
          margin: 0;
          font-size: 1.1rem;
        }
        .cf-modal-desc {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.45;
          color: #2b2b2b;
        }
        .cf-form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .cf-form-group label {
          font-size: 0.85rem;
          font-weight: 700;
          color: #222;
        }
        .cf-form-group .mc-input {
          width: 100%;
          box-sizing: border-box;
          min-height: 44px;
        }
        .cf-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .cf-sync-status-bar {
          padding: 8px 10px;
          background: #222;
          color: #e8e8e8;
          border: 2px solid #000;
          font-size: 0.9rem;
        }
        .cf-sync-error {
          padding: 8px 10px;
          background: #4a1212;
          color: #ffb3b3;
          border: 2px solid #ff5555;
          font-size: 0.85rem;
        }
        .cf-modal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 4px;
        }
        .cf-modal-actions .mc-btn {
          min-height: 46px;
          padding: 10px 14px;
        }
        @media (max-width: 720px) {
          .cf-app-shell {
            padding: 8px;
          }
          .cf-tabs {
            grid-template-columns: 1fr;
          }
          .cf-form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Minecraft Top Bar */}
      <header className="cf-topbar mc-panel-dark">
        <div className="cf-topbar-left">
          <button
            type="button"
            className="mc-btn cf-brand-btn"
            onClick={handleBackToTitle}
            title="Back to Title Screen"
          >
            <img
              src={getAvatarUrl(currentPlayer.avatarId)}
              alt={currentPlayer.name}
              className="mc-pixelated cf-avatar-mini"
            />
            <span className="cf-player-name" style={{ color: currentPlayer.color }}>
              {currentPlayer.name}
            </span>
          </button>

          <button
            type="button"
            className="mc-badge cf-realm-pill"
            onClick={handleOpenSyncModal}
            title="Realm & Cloud Sync Settings"
          >
            <span
              className="cf-sync-dot"
              style={{
                background:
                  syncStatus.state === 'synced'
                    ? '#55ff55'
                    : syncStatus.state === 'syncing'
                      ? '#ffff55'
                      : syncStatus.state === 'error'
                        ? '#ff5555'
                        : '#aaaaaa',
              }}
            />
            <span>REALM: {realm.realmCode}</span>
          </button>
        </div>

        <div className="cf-topbar-right">
          <button
            type="button"
            className="mc-btn"
            onClick={handleToggleMute}
            title={muted ? 'Unmute Sounds' : 'Mute Sounds'}
          >
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>

          <button
            type="button"
            className="mc-btn mc-btn-purple"
            onClick={handleOpenSyncModal}
            title="Cloud Sync Settings"
          >
            ☁ Sync
          </button>

          <button
            type="button"
            className="mc-btn mc-btn-gold"
            onClick={handleQuickSwitchPlayer}
            title={`Quick switch to ${otherPlayer.name}`}
          >
            ⇄ {otherPlayer.name}
          </button>
        </div>
      </header>

      {/* Chunky 3-Tab Minecraft Navigation */}
      <nav className="cf-tabs" aria-label="Main Navigation">
        <button
          type="button"
          className={`mc-btn cf-tab-btn ${activeTab === 'studio' ? 'mc-btn-green cf-tab-active' : ''}`}
          onClick={() => {
            playSound('click');
            setActiveTab('studio');
          }}
        >
          ⚒ Item Studio
        </button>

        <button
          type="button"
          className={`mc-btn cf-tab-btn ${activeTab === 'inbox' ? 'mc-btn-gold cf-tab-active' : ''}`}
          onClick={() => {
            playSound('click');
            setActiveTab('inbox');
          }}
        >
          📬 Inbox to Rate
          {unratedCount > 0 && (
            <span className="mc-badge cf-unrated-badge" aria-label={`${unratedCount} unrated items`}>
              {unratedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`mc-btn cf-tab-btn ${activeTab === 'chest' ? 'mc-btn-purple cf-tab-active' : ''}`}
          onClick={() => {
            playSound('chest');
            setActiveTab('chest');
          }}
        >
          🧰 Shared Chest ({visibleItemCount})
        </button>
      </nav>

      {/* Main Content Stage */}
      <main className="cf-main">
        {activeTab === 'studio' && (
          <ItemStudio
            currentPlayer={currentPlayer}
            otherPlayer={otherPlayer}
            onSendItem={handleSendItem}
          />
        )}

        {activeTab === 'inbox' && (
          <InboxGrader
            items={realm.items.filter((item) => !item.hidden)}
            players={realm.players}
            currentPlayerId={activePlayerId}
            onGradeItem={handleGradeItem}
          />
        )}

        {activeTab === 'chest' && (
          <SharedChest
            items={realm.items}
            players={realm.players}
            currentPlayerId={activePlayerId}
            onToggleHideItem={handleToggleHideItem}
          />
        )}
      </main>

      {/* Cloud Sync Settings Modal */}
      {showSyncModal && (
        <div
          className="cf-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Cloud Sync Settings"
          onClick={() => setShowSyncModal(false)}
        >
          <div className="mc-panel cf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cf-modal-header">
              <h2 className="cf-modal-title">☁ Realm & Cloud Sync</h2>
              <button
                type="button"
                className="mc-btn mc-btn-red"
                onClick={() => {
                  playSound('click');
                  setShowSyncModal(false);
                }}
              >
                ✕
              </button>
            </div>

            <p className="cf-modal-desc">
              CraftForge works offline right away! To sync live between Dad&apos;s device and
              Kiddo&apos;s Android tablet, paste a free Firebase Firestore config (see README.md) and
              use the same <strong>Realm Code</strong> on both devices.
            </p>

            <div className="cf-form-group">
              <label htmlFor="cf-realm-code">Realm Code (Shared Secret)</label>
              <input
                id="cf-realm-code"
                type="text"
                className="mc-input"
                value={realmCodeInput}
                onChange={(e) => setRealmCodeInput(e.target.value)}
                placeholder="FAMILY-CRAFT"
              />
            </div>

            <div className="cf-form-group">
              <label htmlFor="cf-firebase-snippet">
                Quick Paste Firebase Config Snippet (Optional)
              </label>
              <textarea
                id="cf-firebase-snippet"
                className="mc-input"
                rows={3}
                value={snippetInput}
                onChange={(e) => handleSnippetPaste(e.target.value)}
                placeholder={'Paste { apiKey: "...", projectId: "..." } here to auto-fill'}
              />
            </div>

            <div className="cf-form-row">
              <div className="cf-form-group">
                <label htmlFor="cf-project-id">Firebase Project ID</label>
                <input
                  id="cf-project-id"
                  type="text"
                  className="mc-input"
                  value={projectIdInput}
                  onChange={(e) => setProjectIdInput(e.target.value)}
                  placeholder="my-craftforge-123"
                />
              </div>

              <div className="cf-form-group">
                <label htmlFor="cf-api-key">Web API Key (optional)</label>
                <input
                  id="cf-api-key"
                  type="text"
                  className="mc-input"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                />
              </div>
            </div>

            <div className="cf-sync-status-bar">
              Status: <strong>{syncStatus.message}</strong>
            </div>

            {syncError && <div className="cf-sync-error">{syncError}</div>}

            <div className="cf-modal-actions">
              <button
                type="button"
                className="mc-btn mc-btn-green"
                onClick={() => handleSaveCloudSync(true)}
              >
                Save & Enable Cloud Sync
              </button>
              {cloudConfig.enabled && (
                <button
                  type="button"
                  className="mc-btn mc-btn-gold"
                  onClick={() => {
                    playSound('click');
                    void syncNow();
                  }}
                >
                  ↻ Sync Now
                </button>
              )}
              <button
                type="button"
                className="mc-btn"
                onClick={() => handleSaveCloudSync(false)}
              >
                Use Local Only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
