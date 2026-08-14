'use client';

import { useState } from 'react';

import { DownloadIcon } from '@/components/webflow/opportunity-icons';

type OpportunityExportButtonProps = {
  slug: string;
  disabled?: boolean;
  className?: string;
  showIcon?: boolean;
};

export function OpportunityExportButton({
  slug,
  disabled = false,
  className = 'button short w-inline-block',
  showIcon = false,
}: OpportunityExportButtonProps) {
  const [status, setStatus] = useState<'idle' | 'exporting' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleExport = async () => {
    if (disabled || status === 'exporting') {
      return;
    }

    setStatus('exporting');
    setMessage('');

    try {
      const response = await fetch(`/api/opportunities/${encodeURIComponent(slug)}/export`, {
        method: 'POST',
      });
      const payload = await response.json() as { url?: string; filename?: string; message?: string };

      if (!response.ok || !payload.url) {
        setStatus('error');
        setMessage(payload.message || 'Export failed.');
        return;
      }

      const fileResponse = await fetch(payload.url);
      if (!fileResponse.ok) {
        setStatus('error');
        setMessage('Could not download the export.');
        return;
      }

      const blob = await fileResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = payload.filename || 'export.zip';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus('idle');
    } catch {
      setStatus('error');
      setMessage('Export failed.');
    }
  };

  return (
    <div className="opportunity-export-button-wrap">
      <button
        type="button"
        className={className}
        disabled={disabled || status === 'exporting'}
        onClick={() => {
          void handleExport();
        }}
      >
        {showIcon ? <DownloadIcon className="gridrow-icon" /> : null}
        <div>{status === 'exporting' ? 'Exporting…' : 'Export Info'}</div>
      </button>
      {status === 'error' && message ? (
        <div className="opportunity-export-error">{message}</div>
      ) : null}
    </div>
  );
}
