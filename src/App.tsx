import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/minecraft.css';
import { CraftItem, ItemVote, ItemVoteSnapshot, PlayerId, PlayerProfile, RealmState } from './types';
import {
  CloudSyncConfig,
  MAX_VOTE_CHANGES,
  PLAYER_ACCENT_COLORS,
  SyncStatus,
  createStarterRealm,
  findPlayerByName,
  generateItemId,
  getCandidateRealmHashes,
  getItemVotes,
  hashPin,
  hashRealmSecret,
  isDemoItem,
  loadActivePlayer,
  loadCloudConfig,
  loadRealmState,
  mergeRealmStates,
  pullRealmFromCloud,
  pullRealmFromCloudWithFallback,
  pushRealmToCloud,
  saveActivePlayer,
  saveRealmState,
  validateRealmName,
  validateRealmPassword,
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
  const [cloudConfig] = useState<CloudSyncConfig>(() => loadCloudConfig());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => ({
    state: loadRealmState().realmCodeHash ? 'syncing' : 'synced',
    message: loadRealmState().realmCodeHash
      ? 'Connecting to CraftForge Cloud...'
      : 'CraftForge Cloud Ready',
    lastSyncedAt: null,
  }));

  // Realm & Invite Modal state
  const [showRealmModal, setShowRealmModal] = useState(false);
  const [realmModalTab, setRealmModalTab] = useState<RealmModalTab>('create');
  const [pendingInvite, setPendingInvite] = useState<RealmInvitePayload | null>(() =>
    parseInviteFromLocation()
  );
  const [toastMessage, setToastMessage] = useState<string>('');

  // Keep latest realm in a ref for async cloud sync merges
  const realmRef = useRef(realm);
  realmRef.current = realm;
  const syncInFlightRef = useRef(false);
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
      if (syncInFlightRef.current) return;
      const cfg = configOverride || cloudConfig;
      const initial = realmOverride || realmRef.current;

      if (!cfg.enabled || !cfg.projectId) {
        setSyncStatus({ state: 'local', message: 'Local Mode', lastSyncedAt: null });
        return;
      }

      if (!initial.realmCodeHash && !initial.realmPassword) {
        setSyncStatus({ state: 'synced', message: 'CraftForge Cloud Ready', lastSyncedAt: null });
        return;
      }

      syncInFlightRef.current = true;
      setSyncStatus((prev) => ({ ...prev, state: 'syncing', message: 'Syncing...' }));
      try {
        const remote = await pullRealmFromCloud(
          cfg,
          initial.realmCode,
          initial.realmPassword,
          initial.realmCodeHash
        );
        // Re-read the freshest local state AFTER the network pull so concurrent local votes/saves are never overwritten
        const latestLocal = realmRef.current;
        const stillSameRealm =
          latestLocal.realmCode === initial.realmCode &&
          latestLocal.realmCodeHash === initial.realmCodeHash;
        if (!stillSameRealm) {
          return;
        }
        let finalState = latestLocal;
        if (remote) {
          finalState = mergeRealmStates(latestLocal, remote);
          realmRef.current = finalState;
          setRealm(finalState);
        }
        await pushRealmToCloud(cfg, finalState);
        setSyncStatus({
          state: 'synced',
          message: `Synced (${finalState.realmCode})`,
          lastSyncedAt: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        setSyncStatus({ state: 'error', message: msg, lastSyncedAt: null });
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [cloudConfig]
  );

  // Poll Firestore every 8s when connected to a Realm
  useEffect(() => {
    if (!cloudConfig.enabled || !cloudConfig.projectId) {
      setSyncStatus({ state: 'local', message: 'Local Mode', lastSyncedAt: null });
      return;
    }
    if (!realm.realmCodeHash && !realm.realmPassword) {
      setSyncStatus({ state: 'synced', message: 'CraftForge Cloud Ready', lastSyncedAt: null });
      return;
    }
    void syncNow();
    const timer = window.setInterval(() => {
      void syncNow();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [cloudConfig, realm.realmCode, realm.realmCodeHash, realm.realmPassword, syncNow]);

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
        item.creatorId !== activePlayerId &&
        !getItemVotes(item)[activePlayerId]
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
    realmName: string;
    realmPassword: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const cleanName = params.name.trim();
    const cleanPin = params.pin.trim();
    if (!cleanName) {
      return { ok: false, error: 'Please enter a Crafter Name!' };
    }
    if (!/^\d{3}$/.test(cleanPin)) {
      return { ok: false, error: 'PIN must be exactly 3 digits (000–999)!' };
    }

    const realmNameCheck = validateRealmName(params.realmName);
    if (!realmNameCheck.valid) {
      return { ok: false, error: realmNameCheck.error || 'Invalid Realm Name.' };
    }
    const realmCodeCheck = validateRealmPassword(params.realmPassword);
    if (!realmCodeCheck.valid) {
      return { ok: false, error: realmCodeCheck.error || 'Invalid Realm Code.' };
    }

    const cleanRealmName = realmNameCheck.cleaned;
    const cleanRealmPassword = realmCodeCheck.cleaned;
    const candidateHashes = getCandidateRealmHashes(cleanRealmName, cleanRealmPassword);
    let targetHash = candidateHashes[0] || hashRealmSecret(cleanRealmName, cleanRealmPassword);

    const isSameLocalRealm =
      realmRef.current.realmCode === cleanRealmName &&
      Boolean(
        (realmRef.current.realmCodeHash &&
          candidateHashes.includes(realmRef.current.realmCodeHash)) ||
          (realmRef.current.realmPassword &&
            realmRef.current.realmPassword.trim().toLowerCase() ===
              cleanRealmPassword.toLowerCase())
      );

    if (isSameLocalRealm && realmRef.current.realmCodeHash) {
      targetHash = realmRef.current.realmCodeHash;
    }

    let workingRealm: RealmState = isSameLocalRealm
      ? {
          ...realmRef.current,
          realmPassword: cleanRealmPassword,
          realmCodeHash: targetHash,
        }
      : createStarterRealm(cleanRealmName, cleanRealmPassword);

    // Verify Realm Name + Realm Code against Firestore (case-insensitive with legacy fallback)
    if (cloudConfig.enabled && cloudConfig.projectId) {
      setSyncStatus((prev) => ({ ...prev, state: 'syncing', message: 'Joining Realm...' }));
      try {
        const found = await pullRealmFromCloudWithFallback(
          cloudConfig,
          cleanRealmName,
          cleanRealmPassword
        );
        if (!found && !isSameLocalRealm) {
          setSyncStatus({ state: 'synced', message: 'CraftForge Cloud Ready', lastSyncedAt: null });
          return {
            ok: false,
            error: `Realm "${cleanRealmName}" not found or wrong Realm Code! Double-check both, or tap "Create New Realm".`,
          };
        }
        if (found) {
          targetHash = found.matchedHash;
          workingRealm = mergeRealmStates(
            {
              ...workingRealm,
              realmPassword: cleanRealmPassword,
              realmCodeHash: targetHash,
            },
            found.remote
          );
        }
        setSyncStatus({
          state: 'synced',
          message: `Synced (${cleanRealmName})`,
          lastSyncedAt: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not reach Firestore';
        setSyncStatus({ state: 'error', message: msg, lastSyncedAt: null });
        if (!isSameLocalRealm) {
          return { ok: false, error: `Could not connect to CraftForge Cloud: ${msg}` };
        }
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
    setActivePlayerId(loggedInId);

    if (cloudConfig.enabled && cloudConfig.projectId) {
      try {
        await pushRealmToCloud(cloudConfig, nextRealm);
        setSyncStatus({
          state: 'synced',
          message: `Synced (${cleanRealmName})`,
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
      | 'id'
      | 'realmCode'
      | 'creatorId'
      | 'recipientId'
      | 'createdAt'
      | 'grade'
      | 'gradeComment'
      | 'gradedAt'
      | 'votes'
    >
  ) => {
    if (!activePlayerId) return;
    const latest = realmRef.current;
    const newItem: CraftItem = {
      ...draft,
      id: generateItemId(),
      realmCode: latest.realmCode,
      creatorId: activePlayerId,
      recipientId: 'all',
      createdAt: Date.now(),
      grade: null,
      votes: {},
    };
    const nextRealm: RealmState = {
      ...latest,
      items: [newItem, ...latest.items],
    };
    realmRef.current = nextRealm;
    setRealm(nextRealm);
    if (cloudConfig.enabled && cloudConfig.projectId) {
      void pushRealmToCloud(cloudConfig, nextRealm).catch(() => {
        // next poll will reconcile
      });
    }
  };

  const handleGradeItem = (itemId: string, grade: number, comment: string) => {
    if (!activePlayerId) return;
    const latest = realmRef.current;
    const target = latest.items.find((item) => item.id === itemId);
    if (!target || target.creatorId === activePlayerId) return;

    const existingVotes = getItemVotes(target);
    const prevVote = existingVotes[activePlayerId];
    if (prevVote && (prevVote.changesUsed ?? 0) >= MAX_VOTE_CHANGES) {
      return;
    }

    const clampedGrade = Math.max(0, Math.min(10, Math.round(grade)));
    const trimmedComment = comment.trim() || undefined;
    const now = Date.now();
    const nextHistory: ItemVoteSnapshot[] | undefined = prevVote
      ? [
          ...(prevVote.history || []),
          {
            score: prevVote.score,
            ...(prevVote.comment ? { comment: prevVote.comment } : {}),
            votedAt: prevVote.votedAt,
          },
        ]
      : undefined;
    const nextVote: ItemVote = {
      playerId: activePlayerId,
      score: clampedGrade,
      ...(trimmedComment ? { comment: trimmedComment } : {}),
      votedAt: now,
      changesUsed: prevVote ? (prevVote.changesUsed ?? 0) + 1 : 0,
      ...(nextHistory && nextHistory.length > 0 ? { history: nextHistory } : {}),
    };

    const nextVotes: Record<PlayerId, ItemVote> = {
      ...existingVotes,
      [activePlayerId]: nextVote,
    };

    const voteValues = Object.values(nextVotes);
    const average =
      voteValues.length > 0
        ? Math.round((voteValues.reduce((acc, v) => acc + v.score, 0) / voteValues.length) * 10) /
          10
        : null;

    const nextRealm: RealmState = {
      ...latest,
      items: latest.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              votes: nextVotes,
              grade: average,
              gradeComment: trimmedComment ?? item.gradeComment,
              gradedAt: now,
            }
          : item
      ),
    };
    realmRef.current = nextRealm;
    setRealm(nextRealm);
    if (cloudConfig.enabled && cloudConfig.projectId) {
      void pushRealmToCloud(cloudConfig, nextRealm).catch(() => {
        // next poll will reconcile
      });
    }
  };

  const handleToggleHideItem = (itemId: string) => {
    if (!activePlayerId) return;
    const latest = realmRef.current;
    const target = latest.items.find((item) => item.id === itemId);
    if (!target || isDemoItem(target) || target.creatorId !== activePlayerId) return;
    const nextRealm: RealmState = {
      ...latest,
      items: latest.items.map((item) =>
        item.id === itemId && !isDemoItem(item) && item.creatorId === activePlayerId
          ? {
              ...item,
              hidden: !item.hidden,
              hiddenUpdatedAt: Date.now(),
            }
          : item
      ),
    };
    realmRef.current = nextRealm;
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

  const handleOpenRealmModal = (tab: RealmModalTab) => {
    playSound('click');
    setRealmModalTab(tab);
    setShowRealmModal(true);
  };

  const handleCreateRealm = async (
    options: CreateRealmOptions
  ): Promise<{ ok: boolean; error?: string }> => {
    const nameCheck = validateRealmName(options.realmName);
    if (!nameCheck.valid) {
      return { ok: false, error: nameCheck.error || 'Invalid Realm Name.' };
    }
    const codeCheck = validateRealmPassword(options.realmCode);
    if (!codeCheck.valid) {
      return { ok: false, error: codeCheck.error || 'Invalid Realm Code.' };
    }

    const cleanName = nameCheck.cleaned;
    const cleanPassword = codeCheck.cleaned;

    // Check if a realm with this Realm Name + Realm Code (any casing) already exists in Firestore
    if (cloudConfig.enabled && cloudConfig.projectId) {
      try {
        const existing = await pullRealmFromCloudWithFallback(
          cloudConfig,
          cleanName,
          cleanPassword
        );
        if (existing) {
          return {
            ok: false,
            error: `Realm "${cleanName}" with that Realm Code already exists! Join it instead or pick a different Realm Name.`,
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not connect to Firestore';
        return { ok: false, error: `Could not reach CraftForge Cloud: ${msg}` };
      }
    }

    const baseRealm = createStarterRealm(cleanName, cleanPassword);
    const nextPlayers: Record<PlayerId, PlayerProfile> =
      activePlayerId && currentPlayer ? { [activePlayerId]: currentPlayer } : {};

    const nextRealm: RealmState = {
      ...baseRealm,
      players: nextPlayers,
    };

    if (cloudConfig.enabled && cloudConfig.projectId) {
      try {
        await pushRealmToCloud(cloudConfig, nextRealm);
        setSyncStatus({
          state: 'synced',
          message: `Synced (${cleanName})`,
          lastSyncedAt: Date.now(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save realm to Firestore';
        setSyncStatus({ state: 'error', message: msg, lastSyncedAt: null });
        return { ok: false, error: `Could not save realm to CraftForge Cloud: ${msg}` };
      }
    }

    setRealm(nextRealm);
    showToast(`🏰 Created Realm "${cleanName}"!`);
    return { ok: true };
  };

  const handleAcceptInvite = (invite: RealmInvitePayload) => {
    clearInviteFromUrl();
    setPendingInvite(null);

    const nameCheck = validateRealmName(invite.realmName);
    const codeCheck = validateRealmPassword(invite.realmCode);
    if (!nameCheck.valid || !codeCheck.valid) {
      showToast('⚠ Invite link is invalid or incomplete.');
      return;
    }

    const cleanName = nameCheck.cleaned;
    const cleanPassword = codeCheck.cleaned;
    const candidateHashes = getCandidateRealmHashes(cleanName, cleanPassword);
    const hash = candidateHashes[0] || hashRealmSecret(cleanName, cleanPassword);

    const isSame =
      realm.realmCode === cleanName &&
      Boolean(
        (realm.realmCodeHash && candidateHashes.includes(realm.realmCodeHash)) ||
          (realm.realmPassword &&
            realm.realmPassword.trim().toLowerCase() === cleanPassword.toLowerCase())
      );
    const nextRealm: RealmState = isSame
      ? {
          ...realm,
          realmPassword: cleanPassword,
          realmCodeHash: realm.realmCodeHash || hash,
        }
      : createStarterRealm(cleanName, cleanPassword);

    setRealm(nextRealm);
    setActivePlayerId(null);

    if (cloudConfig.enabled && cloudConfig.projectId) {
      void pullRealmFromCloudWithFallback(cloudConfig, cleanName, cleanPassword)
        .then((found) => {
          if (found) {
            setRealm((curr) =>
              mergeRealmStates(
                { ...curr, realmCodeHash: found.matchedHash },
                found.remote
              )
            );
            setSyncStatus({
              state: 'synced',
              message: `Synced (${cleanName})`,
              lastSyncedAt: Date.now(),
            });
          }
        })
        .catch(() => {
          // Will retry on login
        });
    }

    showToast(`⚔ Loaded Realm "${cleanName}"! Enter your Crafter Name & 3-digit PIN to join.`);
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
          currentRealmName={realm.realmCode}
          currentRealmCode={realm.realmPassword}
          inviterName={currentPlayer?.name}
          onCreateRealm={handleCreateRealm}
          onClose={() => setShowRealmModal(false)}
        />
      )}

      {pendingInvite && (
        <JoinRealmModal
          invite={pendingInvite}
          currentRealmName={realm.realmCode}
          onAccept={handleAcceptInvite}
          onDismiss={handleDismissInvite}
        />
      )}
    </>
  );

  if (!activePlayerId || !currentPlayer) {
    return (
      <>
        <ProfileGate
          realmName={realm.realmCode}
          realmPassword={realm.realmPassword}
          syncStatus={syncStatus}
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
            onClick={() => handleOpenRealmModal('invite')}
            title={syncStatus.message}
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
            title="Create a Realm or Email Invite"
          >
            ✉ Share / New Realm
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
          🗳️ Vote on Items
          {unratedCount > 0 && (
            <span className="mc-badge cf-unrated-badge" aria-label={`${unratedCount} items to vote on`}>
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
            onVoteItem={handleGradeItem}
          />
        )}
      </main>

      {/* Global Overlays (Cloud Sync, Realm Invite, Join Modal, Toast) */}
      {globalOverlays}
    </div>
  );
}
