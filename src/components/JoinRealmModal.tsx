import React from 'react';
import { RealmInvitePayload } from '../utils/realmInvite';
import { playSound } from '../utils/sounds';

export interface JoinRealmModalProps {
  invite: RealmInvitePayload;
  currentRealmCode: string;
  onAccept: (invite: RealmInvitePayload) => void;
  onDismiss: () => void;
}

export const JoinRealmModal: React.FC<JoinRealmModalProps> = ({
  invite,
  currentRealmCode,
  onAccept,
  onDismiss,
}) => {
  const isDifferentRealm = invite.realmCode !== currentRealmCode;
  const hasCloud = Boolean(invite.projectId);

  return (
    <div
      className="cf-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Realm Invitation"
      onClick={onDismiss}
    >
      <div
        className="mc-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>🏰 Realm Invitation!</h2>
          <button
            type="button"
            className="mc-btn mc-btn-red"
            onClick={() => {
              playSound('click');
              onDismiss();
            }}
            aria-label="Dismiss invitation"
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.96rem', lineHeight: 1.45, color: '#2b2b2b' }}>
          <strong>{invite.inviterName || 'A fellow crafter'}</strong> invited you to join their
          CraftForge Realm!
        </p>

        <div
          style={{
            padding: '14px 16px',
            background: '#1e1e26',
            border: '3px solid #0c0c12',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#aaaaaa', marginBottom: '6px' }}>
            REALM CODE
          </div>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '1.1rem',
              color: '#55ff55',
              letterSpacing: '0.08em',
            }}
          >
            {invite.realmCode}
          </div>
        </div>

        {hasCloud ? (
          <div
            style={{
              padding: '10px 12px',
              background: '#1d4d16',
              color: '#d4ffca',
              border: '2px solid #55ff55',
              fontSize: '0.86rem',
              lineHeight: 1.4,
            }}
          >
            ☁ <strong>Cloud Sync Included!</strong> Your device will automatically connect to live
            cloud sync (<code>{invite.projectId}</code>) and pull the realm&apos;s players &amp;
            items.
          </div>
        ) : (
          <div
            style={{
              padding: '10px 12px',
              background: '#3d2c0a',
              color: '#ffe8a3',
              border: '2px solid #ffaa00',
              fontSize: '0.86rem',
              lineHeight: 1.4,
            }}
          >
            📱 This invite sets your Realm Code to <strong>{invite.realmCode}</strong>. You can
            also enable <strong>☁ Sync</strong> in the top bar for live cross-device sync.
          </div>
        )}

        {isDifferentRealm && (
          <div style={{ fontSize: '0.82rem', color: '#444' }}>
            Switching from your current realm (<strong>{currentRealmCode}</strong>) to{' '}
            <strong>{invite.realmCode}</strong>. Next, enter your Crafter Name &amp; 3-digit PIN to
            log in!
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            className="mc-btn mc-btn-green"
            style={{ flex: 1, minHeight: '48px' }}
            onClick={() => {
              playSound('xp');
              onAccept(invite);
            }}
          >
            ⚔ Join Realm!
          </button>
          <button
            type="button"
            className="mc-btn"
            style={{ minHeight: '48px' }}
            onClick={() => {
              playSound('click');
              onDismiss();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinRealmModal;
