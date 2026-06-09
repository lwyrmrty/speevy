'use client';

import { useRef, useState, useTransition } from 'react';

import { uploadInvestorProfilePicture } from '@/app/admin/investors/actions';
import { InvestorProfileSquare } from '@/components/webflow/investor-profile-square';

export function AdminInvestorProfilePictureUpload({
  lpId,
  fullName,
  email,
  initialPhotoUrl,
  onUploaded,
}: {
  lpId: string;
  fullName: string | null;
  email: string;
  initialPhotoUrl: string | null;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ status: 'success' | 'error'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const displayPhotoUrl = previewUrl ?? photoUrl;

  function handleFileSelected(file: File) {
    setMessage(null);
    setPreviewUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set('lpId', lpId);
    formData.set('file', file);

    startTransition(async () => {
      const result = await uploadInvestorProfilePicture(formData);

      if (result.status === 'success') {
        setPhotoUrl(result.photoUrl);
        setPreviewUrl(null);
        setMessage({ status: 'success', text: result.message });
        onUploaded();
        return;
      }

      setPreviewUrl(null);
      setMessage({ status: 'error', text: result.message });
    });
  }

  return (
    <div className="speevy-profile-photo-upload">
      <div className="align-row">
        <InvestorProfileSquare
          fullName={fullName}
          email={email}
          photoUrl={displayPhotoUrl}
        />
        <div>
          <div className="fieldlabel">Profile Photo</div>
          <div className="dimsmall">Optional. Shown on investor lists instead of initials.</div>
          <button
            type="button"
            className="button short secondary w-inline-block"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
          >
            <div>{isPending ? 'Uploading…' : displayPhotoUrl ? 'Change Photo' : 'Upload Photo'}</div>
          </button>
        </div>
      </div>
      {message ? (
        <div className={`speevy-form-message ${message.status}`} style={{ marginTop: '12px' }}>
          {message.text}
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        disabled={isPending}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            handleFileSelected(file);
          }
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}
