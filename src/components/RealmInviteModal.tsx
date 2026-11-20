import React, { useMemo, useState } from 'react';
import { PlayerProfile } from '../types';
import {
  CloudSyncConfig,
  parseFirebaseSnippet,
  sanitizeRealmCode,
} from '../store/itemStore';
import {
  buildGmailComposeUrl,
  buildInviteEmailContent,
  buildJoinUrl,
  buildMailtoUrl,
  generateRandomRealmCode,
} from '../utils/realmInvite';
import { playSound } from '../utils/sounds';

export type RealmModalTab = 'create' | 'invite';

export interface CreateRealmOptions {
  realmCode: string;
  freshChest: boolean;
  keepPlayers: boolean;
  cloudConfig?: CloudSyncConfig;
}

export interface RealmInviteModalProps {
  initialTab: RealmModalTab;
  currentRealmCode: string;
  players: PlayerProfile[];
  inviterName?: string;
  cloudConfig: CloudSyncConfig;
  onCreateRealm: (options: CreateRealmOptions) => void;
  onClose: () => void;
}

export const RealmInviteModal: React.FC<RealmInviteModalProps> = ({
  initialTab,
  currentRealmCode,
  players,
  inviterName,
  cloudConfig,
  onCreateRealm,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<RealmModalTab>(initialTab);

  // Create Realm tab state
  const [newRealmCode, setNewRealmCode] = useState<string>(() => generateRandomRealmCode());
  const [freshChest, setFreshChest] = useState<boolean>(true);
  const [keepPlayers, setKeepPlayers] = useState<boolean>(true);
  const [showCloudSetup, setShowCloudSetup] = useState<boolean>(false);
  const [snippetInput, setSnippetInput] = useState<string>('');
  const [projectIdInput, setProjectIdInput] = useState<string>(cloudConfig.projectId);
  const [apiKeyInput, setApiKeyInput] = useState<string>(cloudConfig.apiKey);
  const [createError, setCreateError] = useState<string>('');
  const [createdBanner, setCreatedBanner] = useState<string>('');

  // Invite via Email tab state
  const [inviteRealmCode, setInviteRealmCode] = useState<string>(currentRealmCode);
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [inviteeName, setInviteeName] = useState<string>('');
  const [personalNote, setPersonalNote] = useState<string>('');
  const [includeCloudInLink, setIncludeCloudInLink] = useState<boolean>(
    Boolean(cloudConfig.enabled && cloudConfig.projectId)
  );
  const [effectiveCloud, setEffectiveCloud] = useState<CloudSyncConfig>(cloudConfig);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [copiedState, setCopiedState] = useState<'none' | 'email' | 'link'>('none');
  const [emailError, setEmailError] = useState<string>('');

  const hasCloudConfigured = Boolean(effectiveCloud.enabled && effectiveCloud.projectId);

  const joinUrl = useMemo(() => {
    return buildJoinUrl({
      realmCode: inviteRealmCode,
      projectId: includeCloudInLink && hasCloudConfigured ? effectiveCloud.projectId : undefined,
      apiKey: includeCloudInLink && hasCloudConfigured ? effectiveCloud.apiKey : undefined,
      inviterName,
    });
  }, [inviteRealmCode, includeCloudInLink, hasCloudConfigured, effectiveCloud, inviterName]);

  const emailContent = useMemo(() => {
    return buildInviteEmailContent({
      realmCode: inviteRealmCode,
      inviterName,
      inviteeName,
      personalNote,
      joinUrl,
      cloudProjectId: includeCloudInLink && hasCloudConfigured ? effectiveCloud.projectId : undefined,
      cloudApiKey: includeCloudInLink && hasCloudConfigured ? effectiveCloud.apiKey : undefined,
      playerNames: players.map((p) => p.name).filter(Boolean),
    });
  }, [
    inviteRealmCode,
    inviterName,
    inviteeName,
    personalNote,
    joinUrl,
    includeCloudInLink,
    hasCloudConfigured,
    effectiveCloud,
    players,
  ]);

  const handleSnippetPaste = (val: string) => {
    setSnippetInput(val);
    const parsed = parseFirebaseSnippet(val);
    if (parsed) {
      setProjectIdInput(parsed.projectId);
      if (parsed.apiKey) setApiKeyInput(parsed.apiKey);
      setCreateError('');
    }
  };

  const handleRandomizeCode = () => {
    playSound('click');
    setNewRealmCode(generateRandomRealmCode());
    setCreateError('');
  };

  const handleCreateSubmit = () => {
    const clean = sanitizeRealmCode(newRealmCode);
    if (!clean || clean.length < 3) {
      setCreateError('Please enter a Realm Code with at least 3 letters or numbers.');
      return;
    }

    let nextCloud: CloudSyncConfig | undefined;
    if (showCloudSetup && projectIdInput.trim()) {
      nextCloud = {
        enabled: true,
        projectId: projectIdInput.trim(),
        apiKey: apiKeyInput.trim(),
      };
      setEffectiveCloud(nextCloud);
      setIncludeCloudInLink(true);
    }

    playSound('craft');
    onCreateRealm({
      realmCode: clean,
      freshChest,
      keepPlayers,
      cloudConfig: nextCloud,
    });

    setInviteRealmCode(clean);
    setCreatedBanner(`Realm "${clean}" created! Send the invite instructions below.`);
    setCreateError('');
    setActiveTab('invite');
  };

  const validateEmailOptional = (): boolean => {
    const trimmed = recipientEmail.trim();
    if (!trimmed) {
      setEmailError('');
      return true;
    }
    const parts = trimmed
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const invalid = parts.find((addr) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr));
    if (invalid) {
      setEmailError(`"${invalid}" doesn't look like a valid email address.`);
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleOpenMailApp = () => {
    if (!validateEmailOptional()) return;
    playSound('xp');
    const url = buildMailtoUrl(recipientEmail, emailContent.subject, emailContent.body);
    window.location.href = url;
  };

  const handleOpenGmail = () => {
    if (!validateEmailOptional()) return;
    playSound('xp');
    const url = buildGmailComposeUrl(recipientEmail, emailContent.subject, emailContent.body);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyText = async (text: string, kind: 'email' | 'link') => {
    playSound('click');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedState(kind);
    window.setTimeout(() => {
      setCopiedState((curr) => (curr === kind ? 'none' : curr));
    }, 2400);
  };

  return (
    <div
      className="cf-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Create Realm & Email Invite"
      onClick={onClose}
    >
      <style>{`
        .cf-realm-modal {
          width: 100%;
          max-width: 680px;
          max-height: 92dvh;
          overflow-y: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cf-realm-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .cf-realm-code-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .cf-realm-code-row .mc-input {
          flex: 1;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.9rem;
          letter-spacing: 0.06em;
          text-align: center;
        }
        .cf-check-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: rgba(0, 0, 0, 0.08);
          border: 2px solid rgba(0, 0, 0, 0.2);
          cursor: pointer;
          font-size: 0.9rem;
          color: #1e1e1e;
        }
        .cf-check-row input[type="checkbox"] {
          width: 20px;
          height: 20px;
          accent-color: #3c8527;
          cursor: pointer;
          flex-shrink: 0;
        }
        .cf-banner-success {
          padding: 10px 12px;
          background: #1d4d16;
          color: #d4ffca;
          border: 2px solid #55ff55;
          font-size: 0.88rem;
        }
        .cf-banner-warn {
          padding: 10px 12px;
          background: #3d2c0a;
          color: #ffe8a3;
          border: 2px solid #ffaa00;
          font-size: 0.86rem;
          line-height: 1.4;
        }
        .cf-invite-summary {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 12px;
          background: #23232c;
          color: #ffffff;
          border: 2px solid #0b0b10;
        }
        .cf-email-preview {
          background: #14141b;
          color: #e6e6f0;
          border: 2px solid #0a0a0f;
          padding: 12px;
          font-family: 'VT323', monospace;
          font-size: 1.15rem;
          line-height: 1.35;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 210px;
          overflow-y: auto;
        }
        .cf-email-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 560px) {
          .cf-email-actions {
            grid-template-columns: 1fr;
          }
          .cf-realm-code-row {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="mc-panel cf-realm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cf-modal-header">
          <h2 className="cf-modal-title">🏰 Realms & Email Invites</h2>
          <button
            type="button"
            className="mc-btn mc-btn-red"
            onClick={() => {
              playSound('click');
              onClose();
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="cf-realm-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            className={`mc-btn ${activeTab === 'create' ? 'mc-btn-green' : ''}`}
            onClick={() => {
              playSound('click');
              setActiveTab('create');
            }}
          >
            🏰 Create New Realm
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'invite'}
            className={`mc-btn ${activeTab === 'invite' ? 'mc-btn-gold' : ''}`}
            onClick={() => {
              playSound('click');
              setActiveTab('invite');
            }}
          >
            ✉ Email Invite
          </button>
        </div>

        {/* TAB 1: CREATE REALM */}
        {activeTab === 'create' && (
          <>
            <p className="cf-modal-desc">
              Start a new CraftForge Realm with its own shared chest and inbox, then email the
              1-click join link & instructions to friends or family!
            </p>

            <div className="cf-form-group">
              <label htmlFor="cf-new-realm-code">New Realm Code</label>
              <div className="cf-realm-code-row">
                <input
                  id="cf-new-realm-code"
                  type="text"
                  className="mc-input"
                  value={newRealmCode}
                  maxLength={24}
                  onChange={(e) => {
                    setNewRealmCode(e.target.value.toUpperCase());
                    setCreateError('');
                  }}
                  placeholder="DIAMOND-FORGE-42"
                />
                <button
                  type="button"
                  className="mc-btn mc-btn-purple"
                  onClick={handleRandomizeCode}
                  title="Generate a fun random Realm Code"
                >
                  🎲 Random
                </button>
              </div>
            </div>

            <label className="cf-check-row">
              <input
                type="checkbox"
                checked={freshChest}
                onChange={(e) => setFreshChest(e.target.checked)}
              />
              <span>
                <strong>Start with a fresh chest</strong> (starter demo items only)
              </span>
            </label>

            <label className="cf-check-row">
              <input
                type="checkbox"
                checked={keepPlayers}
                onChange={(e) => setKeepPlayers(e.target.checked)}
              />
              <span>
                <strong>Keep current player roster</strong> ({players.map((p) => p.name).join(', ')})
              </span>
            </label>

            {/* Cloud Sync status / optional inline setup */}
            {hasCloudConfigured ? (
              <div className="cf-banner-success">
                ☁ <strong>Cloud Sync Active</strong> ({effectiveCloud.projectId}) — Your new realm
                will sync live to Firestore so invited players can join from any device!
              </div>
            ) : (
              <div className="cf-banner-warn">
                <div>
                  <strong>Local Mode:</strong> You can create this realm now and share the invite,
                  or add a free Firebase project below so players on separate devices sync live.
                </div>
                <button
                  type="button"
                  className="mc-btn mc-btn-purple"
                  style={{ marginTop: '8px', minHeight: '38px', fontSize: '0.78rem' }}
                  onClick={() => {
                    playSound('click');
                    setShowCloudSetup((prev) => !prev);
                  }}
                >
                  {showCloudSetup ? '▲ Hide Cloud Sync Setup' : '☁ Add Cloud Sync (Optional)'}
                </button>

                {showCloudSetup && (
                  <div
                    style={{
                      marginTop: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <textarea
                      className="mc-input"
                      rows={2}
                      value={snippetInput}
                      onChange={(e) => handleSnippetPaste(e.target.value)}
                      placeholder='Paste Firebase config snippet { apiKey: "...", projectId: "..." }'
                    />
                    <div className="cf-form-row">
                      <input
                        type="text"
                        className="mc-input"
                        value={projectIdInput}
                        onChange={(e) => setProjectIdInput(e.target.value)}
                        placeholder="Firebase Project ID"
                      />
                      <input
                        type="text"
                        className="mc-input"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="Web API Key (optional)"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {createError && <div className="cf-sync-error">{createError}</div>}

            <div className="cf-modal-actions">
              <button
                type="button"
                className="mc-btn mc-btn-green"
                style={{ flex: 1 }}
                onClick={handleCreateSubmit}
              >
                🏰 Create Realm & Compose Email →
              </button>
            </div>
          </>
        )}

        {/* TAB 2: INVITE VIA EMAIL */}
        {activeTab === 'invite' && (
          <>
            {createdBanner && <div className="cf-banner-success">✓ {createdBanner}</div>}

            <div className="cf-invite-summary">
              <div>
                <div style={{ fontSize: '0.72rem', color: '#aaaaaa' }}>INVITING TO REALM</div>
                <div
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '0.95rem',
                    color: '#55ff55',
                    marginTop: '4px',
                  }}
                >
                  {inviteRealmCode}
                </div>
              </div>
              <span
                className="mc-badge"
                style={{
                  backgroundColor: hasCloudConfigured ? '#245c1b' : '#5c4314',
                  color: hasCloudConfigured ? '#80ff20' : '#ffdf5d',
                }}
              >
                {hasCloudConfigured ? '☁ Cloud Sync Ready' : '📱 Local Code Only'}
              </span>
            </div>

            <div className="cf-form-row">
              <div className="cf-form-group">
                <label htmlFor="cf-invite-email">Recipient Email(s)</label>
                <input
                  id="cf-invite-email"
                  type="email"
                  className="mc-input"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    setEmailError('');
                  }}
                  placeholder="friend@example.com"
                />
              </div>

              <div className="cf-form-group">
                <label htmlFor="cf-invitee-name">Friend&apos;s Name (Optional)</label>
                <input
                  id="cf-invitee-name"
                  type="text"
                  className="mc-input"
                  value={inviteeName}
                  maxLength={32}
                  onChange={(e) => setInviteeName(e.target.value)}
                  placeholder="Alex"
                />
              </div>
            </div>

            <div className="cf-form-group">
              <label htmlFor="cf-invite-note">Personal Message (Optional)</label>
              <input
                id="cf-invite-note"
                type="text"
                className="mc-input"
                value={personalNote}
                maxLength={140}
                onChange={(e) => setPersonalNote(e.target.value)}
                placeholder="Come check out my new Emerald Thunderblade!"
              />
            </div>

            {hasCloudConfigured && (
              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={includeCloudInLink}
                  onChange={(e) => setIncludeCloudInLink(e.target.checked)}
                />
                <span>
                  Include Cloud Sync config in 1-click link (auto-connects their device!)
                </span>
              </label>
            )}

            {emailError && <div className="cf-sync-error">{emailError}</div>}

            {/* Primary Email & Copy Actions */}
            <div className="cf-email-actions">
              <button
                type="button"
                className="mc-btn mc-btn-green"
                onClick={handleOpenMailApp}
                title="Open your default email app with pre-filled join instructions"
              >
                📧 Open Email App
              </button>

              <button
                type="button"
                className="mc-btn mc-btn-gold"
                onClick={handleOpenGmail}
                title="Compose this invite directly in Gmail on the web"
              >
                ✉ Send via Gmail
              </button>

              <button
                type="button"
                className="mc-btn mc-btn-purple"
                onClick={() =>
                  void copyText(
                    `Subject: ${emailContent.subject}\n\n${emailContent.body}`,
                    'email'
                  )
                }
              >
                {copiedState === 'email' ? '✓ Instructions Copied!' : '📋 Copy Email Text'}
              </button>

              <button
                type="button"
                className="mc-btn"
                onClick={() => void copyText(joinUrl, 'link')}
              >
                {copiedState === 'link' ? '✓ Join Link Copied!' : '🔗 Copy 1-Click Link'}
              </button>
            </div>

            {/* Email Preview */}
            <div>
              <button
                type="button"
                className="mc-btn"
                style={{ width: '100%', minHeight: '38px', fontSize: '0.78rem', marginBottom: '6px' }}
                onClick={() => {
                  playSound('click');
                  setShowPreview((prev) => !prev);
                }}
              >
                {showPreview ? '▼ Hide Email Preview' : '▶ Show Email Preview'}
              </button>

              {showPreview && (
                <div className="cf-email-preview" aria-label="Email Invite Preview">
                  <div style={{ color: '#ffdf5d', marginBottom: '6px' }}>
                    Subject: {emailContent.subject}
                  </div>
                  {emailContent.body}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RealmInviteModal;
