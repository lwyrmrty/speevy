'use client';

import { useState } from 'react';

import { sendOpportunityFollowerUpdate } from '@/app/admin/opportunities/actions';

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="64"
      height="64"
      className="checkicon"
    >
      <g fill="none" fillRule="evenodd">
        <path
          fill="currentColor"
          d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0Z"
        />
      </g>
    </svg>
  );
}

export function OpportunityFollowerNotifyCard({
  followerCount,
  opportunityId,
  opportunityTitle,
}: {
  followerCount: number;
  opportunityId: string;
  opportunityTitle: string;
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [updateNote, setUpdateNote] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error' | null>(null);
  const followerLabel = followerCount === 1 ? '1 follower' : `${followerCount} followers`;

  async function handleSend() {
    const trimmedNote = updateNote.trim();

    if (!trimmedNote) {
      setMessageTone('error');
      setMessage('Add an update note before sending.');
      return;
    }

    if (followerCount === 0) {
      setMessageTone('error');
      setMessage('No followers to notify yet.');
      return;
    }

    if (!window.confirm(`Send this update to ${followerLabel}?`)) {
      return;
    }

    setSending(true);
    setMessage('');
    setMessageTone(null);

    const result = await sendOpportunityFollowerUpdate({
      opportunityId,
      updateNote: trimmedNote,
    });

    setSending(false);

    if (result.status === 'success') {
      setMessageTone('success');
      setMessage(
        result.recipientCount === 1
          ? 'Update sent to 1 follower.'
          : `Update sent to ${result.recipientCount} followers.`,
      );
      setUpdateNote('');
      setComposeOpen(false);
      return;
    }

    setMessageTone('error');
    setMessage(result.message);
  }

  return (
    <div className="cardblock reserve-interest-cardblock notify-followers-cardblock">
      <div>
        <div className="sideheading">Notify Followers</div>
        <div className="sidesubheading">
          {followerLabel} · Add a note on what changed in {opportunityTitle || 'this opportunity'}
        </div>
      </div>
      <div className="formblock w-form">
        <div className={`interestwrapper${composeOpen ? ' interested' : ''}`}>
          <button
            type="button"
            className={`interestedcheck${composeOpen ? ' interested' : ''}`}
            disabled={sending}
            onClick={() => {
              setComposeOpen((current) => !current);
              setMessage('');
              setMessageTone(null);
            }}
          >
            <div>{sending ? 'Sending...' : 'Send update?'}</div>
            <div className="interestchecks-row">
              {composeOpen ? (
                <div className="checkboxtoggle checked">
                  <CheckIcon />
                </div>
              ) : (
                <div className="checkboxtoggle" />
              )}
            </div>
          </button>
          {composeOpen ? (
            <div className="interestamount-drawer">
              <div className="interestedamount-content">
                <div>Update Note</div>
                <textarea
                  className="textfield w-input"
                  maxLength={2000}
                  name="Update-Note"
                  placeholder="What changed in this opportunity?"
                  rows={4}
                  value={updateNote}
                  onChange={(event) => setUpdateNote(event.currentTarget.value)}
                />
                <div className="dimsmall">
                  Followers receive this note by email. Saving the opportunity does not send anything.
                </div>
              </div>
            </div>
          ) : null}
          {composeOpen ? (
            <button
              type="button"
              className="confirmbutton w-inline-block"
              disabled={sending || !updateNote.trim() || followerCount === 0}
              onClick={() => {
                void handleSend();
              }}
            >
              <div>{sending ? 'Sending...' : 'Send Update'}</div>
            </button>
          ) : null}
        </div>
        {message ? (
          <div
            className="loginsubheader"
            style={messageTone === 'error' ? { color: '#b42318' } : undefined}
          >
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );
}
