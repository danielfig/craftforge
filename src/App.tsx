import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/minecraft.css';
import { CraftItem, PlayerId, PlayerProfile, RealmState } from './types';
import {
  CloudSyncConfig,
  PLAYER_ACCENT_COLORS,
  SyncStatus,
  createStarterRealm,
  findPlayerByName,
  generateItemId,
  hashPin,
  isDemoItem,
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
import {
  CreateRealmOptions,
  RealmInviteModal,
  RealmModalTab,
} from './components/RealmInviteModal';
import { JoinRealmModal } from './components/JoinRealmModal';
import {
  RealmInvitePayload,
  clearInviteFromUrl,
  parseInviteFromLocation,
} from './utils/realmInvite';
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
  const [showRealmModal, setShowRealmModal] = useState(false);
  const [realmModalTab, setRealmModalTab] = useState<RealmModalTab>('create');
  const [pendingInvite, setPendingInvite] = useState<RealmInvitePayload | null>(() =>
    parseInviteFromLocation()
  );
  const [toastMessage, setToastMessage] = useState<string>('');
  const [snippetInput, setSnippetInput] = useState('');
  const [projectIdInput, setProjectIdInput] = useState(cloudConfig.projectId);
  const [apiKeyInput, setApiKeyInput] = useState(cloudConfig.apiKey);
  const [realmCodeInput, setRealmCodeInput] = useState(realm.realmCode);
  const [syncError, setSyncError] = useState('');

  // Keep latest realm in a ref for async cloud sync merges
  const realmRef = useRef(realm);
  realmRef.current = realm;
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  // Listen for #join=... invite links pasted/opened while app is running
  useEffect(() => {
    const onHashChange = () => {
      const invite = parseInviteFromLocation();
      if (invite) {
        setPendingInvite(invite);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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

  const currentPlayer: PlayerProfile | null =
    activePlayerId && realm.players[activePlayerId] ? realm.players[activePlayerId] : null;
  const otherPlayers = useMemo(
    () => Object.values(realm.players).filter((p) => p.id !== activePlayerId),
    [realm.players, activePlayerId]
  );

  const unratedCount = useMemo(() => {
    if (!activePlayerId) return 0;
    return realm.items.filter(
      (item) =>
        !item.hidden &&
        !isDemoItem(item) &&
        item.recipientId === activePlayerId &&
        item.grade === null
    ).length;
  }, [realm.items, activePlayerId]);

  const visibleItemCount = useMemo(
    () => realm.items.filter((item) => !item.hidden && !isDemoItem(item)).length,
    [realm.items]
  );

  const handleLogin = async (params: {
    name: string;
    pin: string;
    avatarId: string;
    realmCode: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const cleanName = params.name.trim();
    const cleanPin = params.pin.trim();
    if (!cleanName) {
      return { ok: false, error: 'Please enter a Crafter Name!' };
    }
    if (!/^\d{3}$/.test(cleanPin)) {
      return { ok: false, error: 'PIN must be exactly 3 digits (000–999)!' };
    }

    const cleanCode = sanitizeRealmCode(params.realmCode);
    let workingRealm: RealmState = {
      ...realmRef.current,
      realmCode: cleanCode,
    };

    // Pull latest realm from Firestore before checking/claiming name so PINs sync across devices
    if (cloudConfig.enabled && cloudConfig.projectId) {
      setSyncStatus((prev) => ({ ...prev, state: 'syncing', message: 'Checking Realm...' }));
      try {
        const remote = await pullRealmFromCloud(cloudConfig, cleanCode);
        if (remote) {
          workingRealm = mergeRealmStates(workingRealm, remote);
        }
        setSyncStatus({
          state: 'synced',
          message: `Synced (${cleanCode})`,
          lastSyncedAt: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        setSyncStatus({ state: 'error', message: msg, lastSyncedAt: null });
      }
    }

    const existing = findPlayerByName(workingRealm.players, cleanName);
    let loggedInId: PlayerId;
    let nextRealm: RealmState = workingRealm;

    if (existing) {
      const expectedHash = hashPin(existing.name, cleanPin);
      if (existing.pinHash) {
        if (existing.pinHash !== expectedHash) {
          return { ok: false, error: `Wrong 3-digit PIN for ${existing.name}!` };
        }
        loggedInId = existing.id;
      } else {
        // Legacy player without pinHash: lock with first entered 3-digit PIN
        const lockedPlayer: PlayerProfile = {
          ...existing,
          pinHash: expectedHash,
        };
        nextRealm = {
          ...workingRealm,
          players: {
            ...workingRealm.players,
            [existing.id]: lockedPlayer,
          },
        };
        loggedInId = existing.id;
      }
    } else {
      const playerIndex = Object.keys(workingRealm.players).length;
      const newId: PlayerId = `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const newPlayer: PlayerProfile = {
        id: newId,
        name: cleanName,
        avatarId: params.avatarId || AVATARS[0]?.id || 'knight',
        color: PLAYER_ACCENT_COLORS[playerIndex % PLAYER_ACCENT_COLORS.length],
        pinHash: hashPin(cleanName, cleanPin),
      };
      nextRealm = {
        ...workingRealm,
        players: {
          ...workingRealm.players,
          [newId]: newPlayer,
        },
      };
      loggedInId = newId;
    }

    setRealm(nextRealm);
    setRealmCodeInput(cleanCode);
    setActivePlayerId(loggedInId);

    if (cloudConfig.enabled && cloudConfig.projectId) {
      try {
        await pushRealmToCloud(cloudConfig, nextRealm);
        setSyncStatus({
          state: 'synced',
          message: `Synced (${cleanCode})`,
          lastSyncedAt: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        setSyncStatus({ state: 'error', message: msg, lastSyncedAt: null });
      }
    }

    return { ok: true };
  };

  const handleSendItem = (
    draft: Omit<
      CraftItem,
      'id' | 'realmCode' | 'creatorId' | 'recipientId' | 'createdAt' | 'grade' | 'gradeComment' | 'gradedAt'
    >,
    recipientId: PlayerId
  ) => {
    if (!activePlayerId) return;
    const resolvedRecipient =
      recipientId && realm.players[recipientId] && recipientId !== activePlayerId
        ? recipientId
        : otherPlayers[0]?.id;
    if (!resolvedRecipient) return;
    const newItem: CraftItem = {
      ...draft,
      id: generateItemId(),
      realmCode: realm.realmCode,
      creatorId: activePlayerId,
      recipientId: resolvedRecipient,
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
    const target = realm.items.find((item) => item.id === itemId);
    if (!target || isDemoItem(target)) return;
    const clampedGrade = Math.max(0, Math.min(10, Math.round(grade)));
    const nextRealm: RealmState = {
      ...realm,
      items: realm.items.map((item) =>
        item.id === itemId && !isDemoItem(item)
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
    const target = realm.items.find((item) => item.id === itemId);
    if (!target || isDemoItem(target) || target.creatorId !== activePlayerId) return;
    const nextRealm: RealmState = {
      ...realm,
      items: realm.items.map((item) =>
        item.id === itemId && !isDemoItem(item) && item.creatorId === activePlayerId
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

  const handleOpenRealmModal = (tab: RealmModalTab) => {
    playSound('click');
    setRealmModalTab(tab);
    setShowRealmModal(true);
  };

  const handleCreateRealm = (options: CreateRealmOptions) => {
    const cleanCode = sanitizeRealmCode(options.realmCode);
    const nextPlayers: Record<PlayerId, PlayerProfile> = options.keepPlayers
      ? realm.players
      : {};
    const nextItems: CraftItem[] = options.freshChest
      ? createStarterRealm(cleanCode).items
      : realm.items.map((item) => ({ ...item, realmCode: cleanCode }));

    const nextRealm: RealmState = {
      realmCode: cleanCode,
      players: nextPlayers,
      items: nextItems,
    };

    setRealm(nextRealm);
    setRealmCodeInput(cleanCode);

    if (activePlayerId && !nextPlayers[activePlayerId]) {
      setActivePlayerId(null);
    }

    let activeCfg = cloudConfig;
    if (options.cloudConfig && options.cloudConfig.enabled && options.cloudConfig.projectId) {
      activeCfg = options.cloudConfig;
      setCloudConfig(activeCfg);
      saveCloudConfig(activeCfg);
    }

    if (activeCfg.enabled && activeCfg.projectId) {
      void pushRealmToCloud(activeCfg, nextRealm)
        .then(() => {
          setSyncStatus({
            state: 'synced',
            message: `Synced (${cleanCode})`,
            lastSyncedAt: Date.now(),
          });
        })
        .catch(() => {
          void syncNow(activeCfg, nextRealm);
        });
    }

    showToast(`🏰 Created Realm "${cleanCode}"!`);
  };

  const handleAcceptInvite = (invite: RealmInvitePayload) => {
    clearInviteFromUrl();
    setPendingInvite(null);

    const cleanCode = sanitizeRealmCode(invite.realmCode);
    const nextRealm: RealmState =
      cleanCode !== realm.realmCode ? createStarterRealm(cleanCode) : realm;

    setRealm(nextRealm);
    setRealmCodeInput(cleanCode);
    setActivePlayerId(null);

    let activeCfg = cloudConfig;
    if (invite.projectId) {
      activeCfg = {
        enabled: true,
        projectId: invite.projectId,
        apiKey: invite.apiKey || '',
      };
      setCloudConfig(activeCfg);
      saveCloudConfig(activeCfg);
    }

    if (activeCfg.enabled && activeCfg.projectId) {
      void syncNow(activeCfg, nextRealm);
    }

    showToast(`⚔ Joined Realm "${cleanCode}"! Log in with your Crafter Name & 3-digit PIN.`);
  };

  const handleDismissInvite = () => {
    clearInviteFromUrl();
    setPendingInvite(null);
  };

  const getAvatarUrl = (avatarId: string) =>
    AVATARS.find((a) => a.id === avatarId)?.dataUrl || AVATARS[0]?.dataUrl || '';

  const globalOverlays = (
    <>
      <style>{`
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
        .cf-toast {
          position: fixed;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1200;
          padding: 12px 18px;
          background: #1a2d15;
          color: #d7ffca;
          border: 3px solid #55ff55;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
          font-family: 'Silkscreen', monospace;
          font-size: 0.86rem;
          text-align: center;
          max-width: min(92vw, 560px);
        }
        @media (max-width: 720px) {
          .cf-form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {toastMessage && (
        <div className="cf-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {showRealmModal && (
        <RealmInviteModal
          initialTab={realmModalTab}
          currentRealmCode={realm.realmCode}
          players={Object.values(realm.players)}
          inviterName={currentPlayer?.name}
          cloudConfig={cloudConfig}
          onCreateRealm={handleCreateRealm}
          onClose={() => setShowRealmModal(false)}
        />
      )}

      {pendingInvite && (
        <JoinRealmModal
          invite={pendingInvite}
          currentRealmCode={realm.realmCode}
          onAccept={handleAcceptInvite}
          onDismiss={handleDismissInvite}
        />
      )}

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
              CraftForge works offline right away! To sync live across devices, paste a free
              Firebase Firestore config (see README.md) and use the same{' '}
              <strong>Realm Code</strong> on every device.
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
              <button
                type="button"
                className="mc-btn mc-btn-purple"
                onClick={() => {
                  setShowSyncModal(false);
                  handleOpenRealmModal('invite');
                }}
              >
                ✉ Email Join Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (!activePlayerId || !currentPlayer) {
    return (
      <>
        <ProfileGate
          realmCode={realm.realmCode}
          syncStatus={syncStatus}
          onOpenSyncModal={handleOpenSyncModal}
          onOpenRealmInvite={handleOpenRealmModal}
          onLogin={handleLogin}
        />
        {globalOverlays}
      </>
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
        .cf-switcher-wrap {
          position: relative;
        }
        .cf-switcher-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          z-index: 950;
          min-width: 220px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
        }
        .cf-switcher-item {
          width: 100%;
          min-height: 44px;
          padding: 6px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          text-align: left;
        }
        .cf-switcher-item-left {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .cf-switcher-divider {
          height: 2px;
          background: #555;
          margin: 2px 0;
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
        .cf-sync-status-bar {
          padding: 8px 10px;
          background: #222;
          color: #e8e8e8;
          border: 2px solid #000;
          font-size: 0.9rem;
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
            className="mc-btn mc-btn-green"
            onClick={() => handleOpenRealmModal('invite')}
            title="Create a Realm or Email Join Instructions"
          >
            ✉ Realm &amp; Invite
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
            className="mc-btn mc-btn-red"
            onClick={handleBackToTitle}
            title="Log Out to Login Screen"
          >
            🚪 Log Out
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
            otherPlayers={otherPlayers}
            onSendItem={handleSendItem}
          />
        )}

        {activeTab === 'inbox' && (
          <InboxGrader
            items={realm.items.filter((item) => !item.hidden && !isDemoItem(item))}
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

      {/* Global Overlays (Cloud Sync, Realm Invite, Join Modal, Toast) */}
      {globalOverlays}
    </div>
  );
}
