import React, { useMemo, useState } from 'react';
import {
  REALM_NAME_MAX,
  REALM_NAME_MIN,
  REALM_PASSWORD_MAX,
  REALM_PASSWORD_MIN,
  sanitizeRealmName,
  validateRealmName,
  validateRealmPassword,
} from '../store/itemStore';
import {
  buildGmailComposeUrl,
  buildInviteEmailContent,
  buildJoinUrl,
  buildMailtoUrl,
  generateRandomRealmName,
  generateRandomRealmPassword,
} from '../utils/realmInvite';
import { playSound } from '../utils/sounds';

export type RealmModalTab = 'create' | 'invite';

export interface CreateRealmOptions {
  realmName: string;
  realmCode: string; // Realm password
}

export interface RealmInviteModalProps {
  initialTab: RealmModalTab;
  currentRealmName: string;
  currentRealmCode?: string;
  inviterName?: string;
  onCreateRealm: (options: CreateRealmOptions) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export const RealmInviteModal: React.FC<RealmInviteModalProps> = ({
  initialTab,
  currentRealmName,
  currentRealmCode,
  inviterName,
  onCreateRealm,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<RealmModalTab>(initialTab);

  // Create Realm state
  const [newRealmName, setNewRealmName] = useState<string>('');
  const [newRealmCode, setNewRealmCode] = useState<string>('');
  const [showNewCode, setShowNewCode] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');
  const [createdBanner, setCreatedBanner] = useState<string>('');

  // Share / Invite state
  const [shareRealmName, setShareRealmName] = useState<string>(currentRealmName);
  const [shareRealmCode, setShareRealmCode] = useState<string>(currentRealmCode || '');
  const [showShareCode, setShowShareCode] = useState<boolean>(false);
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [personalNote, setPersonalNote] = useState<string>('');
  const [copiedState, setCopiedState] = useState<'none' | 'email' | 'link'>('none');
  const [emailError, setEmailError] = useState<string>('');

  const joinUrl = useMemo(() => {
    if (!shareRealmName || !shareRealmCode) return '';
    return buildJoinUrl({
      realmName: shareRealmName,
      realmCode: shareRealmCode,
      inviterName,
    });
  }, [shareRealmName, shareRealmCode, inviterName]);

  const emailContent = useMemo(() => {
    return buildInviteEmailContent({
      realmName: shareRealmName || 'MY-REALM',
      realmCode: shareRealmCode || '(your realm code)',
      inviterName,
      personalNote,
      joinUrl: joinUrl || window.location.origin + window.location.pathname,
    });
  }, [shareRealmName, shareRealmCode, inviterName, personalNote, joinUrl]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;

    const nameCheck = validateRealmName(newRealmName);
    if (!nameCheck.valid) {
      setCreateError(nameCheck.error || 'Invalid Realm Name.');
      return;
    }

    const codeCheck = validateRealmPassword(newRealmCode);
    if (!codeCheck.valid) {
      setCreateError(codeCheck.error || 'Invalid Realm Code.');
      return;
    }

    setCreateError('');
    setCreating(true);
    try {
      const result = await onCreateRealm({
        realmName: nameCheck.cleaned,
        realmCode: codeCheck.cleaned,
      });
      if (!result.ok) {
        setCreateError(result.error || 'Could not create realm. Please try again.');
        return;
      }
      playSound('craft');
      setShareRealmName(nameCheck.cleaned);
      setShareRealmCode(codeCheck.cleaned);
      setShowShareCode(true);
      setCreatedBanner(`Realm "${nameCheck.cleaned}" created & saved to cloud!`);
      setActiveTab('invite');
    } finally {
      setCreating(false);
    }
  };

  const validateShareReady = (): boolean => {
    if (!shareRealmCode.trim()) {
      setEmailError('Create a Realm first (or enter your Realm Code) before sending an invite.');
      return false;
    }
    const trimmed = recipientEmail.trim();
    if (trimmed) {
      const parts = trimmed
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const invalid = parts.find((addr) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr));
      if (invalid) {
        setEmailError(`"${invalid}" doesn't look like a valid email address.`);
        return false;
      }
    }
    setEmailError('');
    return true;
  };

  const handleOpenMailApp = () => {
    if (!validateShareReady()) return;
    playSound('xp');
    window.location.href = buildMailtoUrl(recipientEmail, emailContent.subject, emailContent.body);
  };

  const handleOpenGmail = () => {
    if (!validateShareReady()) return;
    playSound('xp');
    window.open(
      buildGmailComposeUrl(recipientEmail, emailContent.subject, emailContent.body),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const copyText = async (text: string, kind: 'email' | 'link') => {
    if (!validateShareReady()) return;
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
      aria-label="Create or Share Realm"
      onClick={onClose}
    >
      <style>{`
        .cf-realm-modal {
          width: 100%;
          max-width: 580px;
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
        .cf-input-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .cf-input-row .mc-input {
          flex: 1;
          min-width: 0;
        }
        .cf-field-hint {
          font-family: 'VT323', monospace;
          font-size: 1.1rem;
          color: #444;
          margin-top: 2px;
        }
        .cf-banner-success {
          padding: 10px 12px;
          background: #1d4d16;
          color: #d4ffca;
          border: 2px solid #55ff55;
          font-size: 0.86rem;
        }
        .cf-realm-creds {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 12px;
          background: #1f1f28;
          color: #ffffff;
          border: 2px solid #0b0b10;
        }
        .cf-cred-label {
          font-size: 0.68rem;
          color: #aaaaaa;
          text-transform: uppercase;
        }
        .cf-cred-value {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.84rem;
          color: #55ff55;
          margin-top: 5px;
          word-break: break-all;
        }
        .cf-email-preview {
          background: #14141b;
          color: #e6e6f0;
          border: 2px solid #0a0a0f;
          padding: 11px 12px;
          font-family: 'VT323', monospace;
          font-size: 1.12rem;
          line-height: 1.32;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 185px;
          overflow-y: auto;
        }
        .cf-email-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 540px) {
          .cf-realm-creds,
          .cf-email-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="mc-panel cf-realm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cf-modal-header">
          <h2 className="cf-modal-title">🏰 Realms</h2>
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
            🏰 Create Realm
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
          <form
            onSubmit={handleCreateSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <p className="cf-modal-desc">
              Pick a <strong>Realm Name</strong> and create a secret <strong>Realm Code</strong>{' '}
              (password). Anyone with both can join and add items to your shared chest!
            </p>

            <div className="cf-form-group">
              <label htmlFor="cf-create-realm-name">Realm Name</label>
              <div className="cf-input-row">
                <input
                  id="cf-create-realm-name"
                  type="text"
                  className="mc-input"
                  value={newRealmName}
                  maxLength={REALM_NAME_MAX}
                  autoCapitalize="characters"
                  autoComplete="off"
                  onChange={(e) => {
                    setNewRealmName(sanitizeRealmName(e.target.value));
                    setCreateError('');
                  }}
                  placeholder="DRAGONKEEP"
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '0.86rem',
                    letterSpacing: '0.06em',
                  }}
                />
                <button
                  type="button"
                  className="mc-btn mc-btn-purple"
                  onClick={() => {
                    playSound('click');
                    setNewRealmName(generateRandomRealmName());
                    setCreateError('');
                  }}
                  title="Generate a random Realm Name"
                >
                  🎲
                </button>
              </div>
              <div className="cf-field-hint">
                {REALM_NAME_MIN}–{REALM_NAME_MAX} characters, one word, no spaces (A–Z, 0–9, -, _)
              </div>
            </div>

            <div className="cf-form-group">
              <label htmlFor="cf-create-realm-code">Realm Code (Password)</label>
              <div className="cf-input-row">
                <input
                  id="cf-create-realm-code"
                  type={showNewCode ? 'text' : 'password'}
                  className="mc-input"
                  value={newRealmCode}
                  maxLength={REALM_PASSWORD_MAX}
                  autoComplete="new-password"
                  onChange={(e) => {
                    setNewRealmCode(e.target.value.replace(/\s+/g, ''));
                    setCreateError('');
                  }}
                  placeholder="creeper42"
                />
                <button
                  type="button"
                  className="mc-btn"
                  onClick={() => {
                    playSound('click');
                    setShowNewCode((prev) => !prev);
                  }}
                  title={showNewCode ? 'Hide Realm Code' : 'Show Realm Code'}
                >
                  {showNewCode ? '🙈' : '👁'}
                </button>
                <button
                  type="button"
                  className="mc-btn mc-btn-purple"
                  onClick={() => {
                    playSound('click');
                    setNewRealmCode(generateRandomRealmPassword());
                    setShowNewCode(true);
                    setCreateError('');
                  }}
                  title="Generate a random Realm Code"
                >
                  🎲
                </button>
              </div>
              <div className="cf-field-hint">
                {REALM_PASSWORD_MIN}–{REALM_PASSWORD_MAX} characters, no spaces — share this with
                friends so they can join!
              </div>
            </div>

            {createError && <div className="cf-sync-error">⚠ {createError}</div>}

            <button
              type="submit"
              className="mc-btn mc-btn-green"
              disabled={creating}
              style={{ minHeight: '50px', marginTop: '4px' }}
            >
              {creating ? 'SAVING REALM...' : '🏰 Create Realm & Get Invite →'}
            </button>
          </form>
        )}

        {/* TAB 2: SHARE / EMAIL INVITE */}
        {activeTab === 'invite' && (
          <>
            {createdBanner && <div className="cf-banner-success">✓ {createdBanner}</div>}

            <div className="cf-realm-creds">
              <div>
                <div className="cf-cred-label">Realm Name</div>
                <div className="cf-cred-value">{shareRealmName || '—'}</div>
              </div>
              <div>
                <div
                  className="cf-cred-label"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>Realm Code</span>
                  {shareRealmCode && (
                    <button
                      type="button"
                      onClick={() => setShowShareCode((prev) => !prev)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ffdf5d',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        padding: 0,
                      }}
                    >
                      {showShareCode ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>
                <div className="cf-cred-value" style={{ color: '#ffdf5d' }}>
                  {shareRealmCode ? (showShareCode ? shareRealmCode : '••••••••') : 'Not set'}
                </div>
              </div>
            </div>

            {!shareRealmCode && (
              <div className="cf-sync-error">
                This realm doesn&apos;t have a Realm Code yet. Tap <strong>🏰 Create Realm</strong>{' '}
                to create one with a Realm Name + Realm Code!
              </div>
            )}

            <div className="cf-form-row">
              <div className="cf-form-group">
                <label htmlFor="cf-invite-email">Friend&apos;s Email (Optional)</label>
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
                <label htmlFor="cf-invite-note">Personal Note (Optional)</label>
                <input
                  id="cf-invite-note"
                  type="text"
                  className="mc-input"
                  value={personalNote}
                  maxLength={120}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  placeholder="Come rate my new sword!"
                />
              </div>
            </div>

            {emailError && <div className="cf-sync-error">⚠ {emailError}</div>}

            <div className="cf-email-actions">
              <button
                type="button"
                className="mc-btn mc-btn-green"
                onClick={handleOpenMailApp}
                disabled={!shareRealmCode}
              >
                📧 Open Email App
              </button>

              <button
                type="button"
                className="mc-btn mc-btn-gold"
                onClick={handleOpenGmail}
                disabled={!shareRealmCode}
              >
                ✉ Send via Gmail
              </button>

              <button
                type="button"
                className="mc-btn mc-btn-purple"
                disabled={!shareRealmCode}
                onClick={() =>
                  void copyText(
                    `Subject: ${emailContent.subject}\n\n${emailContent.body}`,
                    'email'
                  )
                }
              >
                {copiedState === 'email' ? '✓ Invite Copied!' : '📋 Copy Invite'}
              </button>

              <button
                type="button"
                className="mc-btn"
                disabled={!shareRealmCode}
                onClick={() => void copyText(joinUrl, 'link')}
              >
                {copiedState === 'link' ? '✓ Link Copied!' : '🔗 Copy 1-Tap Link'}
              </button>
            </div>

            {shareRealmCode && (
              <div className="cf-email-preview" aria-label="Email Preview">
                <div style={{ color: '#ffdf5d', marginBottom: '4px' }}>
                  Subject: {emailContent.subject}
                </div>
                {emailContent.body}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RealmInviteModal;
