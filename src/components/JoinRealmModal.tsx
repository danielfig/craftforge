import React from 'react';
import { RealmInvitePayload } from '../utils/realmInvite';
import { playSound } from '../utils/sounds';

export interface JoinRealmModalProps {
  invite: RealmInvitePayload;
  currentRealmName: string;
  onAccept: (invite: RealmInvitePayload) => void;
  onDismiss: () => void;
}

export const JoinRealmModal: React.FC<JoinRealmModalProps> = ({
  invite,
  currentRealmName,
  onAccept,
  onDismiss,
}) => {
  const isDifferentRealm = invite.realmName !== currentRealmName;

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
          maxWidth: '480px',
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
            REALM NAME
          </div>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '1.05rem',
              color: '#55ff55',
              letterSpacing: '0.06em',
            }}
          >
            {invite.realmName}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#ffdf5d', marginTop: '8px' }}>
            ✓ Realm Code included in invite link
          </div>
        </div>

        {isDifferentRealm && (
          <div style={{ fontSize: '0.84rem', color: '#444' }}>
            Tap <strong>Join Realm</strong> to load <strong>{invite.realmName}</strong>, then enter
            your Crafter Name &amp; 3-digit PIN to start crafting!
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
