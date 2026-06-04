'use client';

import { useEffect, useMemo, useState } from 'react';

type DocumentViewerItem = {
  title: string;
  url: string;
  fileType: 'pdf' | 'docx';
};

type DocumentViewerDrawerProps = {
  documents: DocumentViewerItem[];
  watermarkEmail: string;
};

function documentViewerUrl(documentItem: DocumentViewerItem) {
  if (documentItem.fileType === 'docx') {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentItem.url)}`;
  }

  return `${documentItem.url}#toolbar=0&navpanes=0&scrollbar=1`;
}

export function DocumentViewerDrawer({
  documents,
  watermarkEmail,
}: DocumentViewerDrawerProps) {
  const [selectedDocument, setSelectedDocument] = useState<DocumentViewerItem | null>(null);
  const watermarkItems = useMemo(() => Array.from({ length: 42 }), []);

  useEffect(() => {
    if (!selectedDocument) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedDocument(null);
        return;
      }

      // Deter save (Cmd/Ctrl+S) and print-to-PDF (Cmd/Ctrl+P) while a
      // document is open. This is a deterrent, not true prevention: a
      // cross-origin PDF/Office viewer handles its own keyboard events, so
      // this only catches shortcuts aimed at the host page.
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === 's' || key === 'p')) {
        event.preventDefault();
      }
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [selectedDocument]);

  return (
    <>
      <div className="teamlist">
        {documents.map((documentItem, index) => (
          <div className="documentitem" key={`${documentItem.title}-${index}`}>
            <button
              type="button"
              className="pagecard documents document-viewer-card w-inline-block"
              onClick={() => setSelectedDocument(documentItem)}
              disabled={!documentItem.url}
            >
              <div className="documentsrow">
                <div className="documenticon">
                  <img src="/webflow/images/docicon.svg" loading="lazy" alt="" className="docsicon" />
                </div>
                <div>
                  <div className="docname">{documentItem.title}</div>
                  <div className="docdate">Last Updated: Just now</div>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      {selectedDocument ? (
        <div className="speevy-slideout-layer document-viewer-layer" role="dialog" aria-modal="true" aria-label={selectedDocument.title}>
          <button
            type="button"
            className="speevy-slideout-backdrop"
            aria-label="Close document viewer"
            onClick={() => setSelectedDocument(null)}
          />
          <div className="speevy-slideout-panel document-viewer-panel">
            <div className="speevy-slideout-header">
              <div>
                <div className="pagetitle small">{selectedDocument.title}</div>
                <div className="dimsmall document-viewer-subtitle">Last Updated: Just now</div>
              </div>
              <button type="button" className="speevy-slideout-close" aria-label="Close" onClick={() => setSelectedDocument(null)}>
                <div>×</div>
              </button>
            </div>
            <div className="document-viewer-body">
              <iframe
                title={selectedDocument.title}
                src={documentViewerUrl(selectedDocument)}
                className="document-viewer-frame"
                referrerPolicy="no-referrer"
              />
              <div className="document-viewer-watermark" aria-hidden="true">
                <div className="document-viewer-watermark-grid">
                  {watermarkItems.map((_, index) => (
                    <span key={index}>{watermarkEmail}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
