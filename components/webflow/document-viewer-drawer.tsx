'use client';

import { useEffect, useMemo, useState } from 'react';

export type DocumentViewerItem = {
  title: string;
  url: string;
  fileType: 'pdf' | 'docx';
  tag?: string | null;
  updatedAt?: string | null;
};

type DocumentViewerDrawerProps = {
  documents: DocumentViewerItem[];
  tagOrder?: string[];
  watermarkEmail: string;
};

function documentViewerUrl(documentItem: DocumentViewerItem) {
  if (documentItem.fileType === 'docx') {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentItem.url)}`;
  }

  return `${documentItem.url}#toolbar=0&navpanes=0&scrollbar=1`;
}

function formatDocumentUpdatedAt(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
    .format(date)
    .replace(',', '');
}

function FolderToggleIcon({ expanded }: { expanded: boolean }) {
  if (expanded) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        className="foldertoggle-icon"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M16 12L12 12L8 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="foldertoggle-icon"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 8L12 12M12 12L12 16M12 12L16 12M12 12L8 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocumentCard({
  documentItem,
  onOpen,
}: {
  documentItem: DocumentViewerItem;
  onOpen: (documentItem: DocumentViewerItem) => void;
}) {
  const isDocx = documentItem.fileType === 'docx';
  const updatedAtLabel = formatDocumentUpdatedAt(documentItem.updatedAt);

  return (
    <div className="documentitem">
      <button
        type="button"
        className="pagecard documents document-viewer-card w-inline-block"
        onClick={() => onOpen(documentItem)}
        disabled={!documentItem.url}
      >
        <div className="documentsrow">
          <div className={isDocx ? 'documenticon blue' : 'documenticon'}>
            <img
              src={isDocx ? '/webflow/images/docicon.svg' : '/webflow/images/pdficon.svg'}
              loading="lazy"
              alt=""
              className="docsicon"
            />
          </div>
          <div>
            <div className="docname">{documentItem.title}</div>
            {updatedAtLabel ? (
              <div className="teamtitle">
                <span className="dimish">Last Updated:</span> {updatedAtLabel}
              </div>
            ) : null}
          </div>
        </div>
      </button>
    </div>
  );
}

function DocumentsFolder({
  tag,
  documents,
  onOpen,
}: {
  tag: string;
  documents: DocumentViewerItem[];
  onOpen: (documentItem: DocumentViewerItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`documentsfolder-wrapper${expanded ? '' : ' is-collapsed'}`}>
      <button
        type="button"
        className="documentsfolder-row"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <h3 className="documentfolder-header">{tag}</h3>
        <div className="foldertoggle-row">
          <FolderToggleIcon expanded={expanded} />
        </div>
      </button>
      {expanded ? (
        <div className="documentsfolder-docs">
          {documents.map((documentItem, index) => (
            <DocumentCard
              key={`${tag}-${documentItem.title}-${index}`}
              documentItem={documentItem}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DocumentViewerDrawer({
  documents,
  tagOrder = [],
  watermarkEmail,
}: DocumentViewerDrawerProps) {
  const [selectedDocument, setSelectedDocument] = useState<DocumentViewerItem | null>(null);
  const watermarkItems = useMemo(() => Array.from({ length: 42 }), []);
  const selectedUpdatedAtLabel = formatDocumentUpdatedAt(selectedDocument?.updatedAt);

  const { untaggedDocuments, folders } = useMemo(() => {
    const normalizedTagOrder = tagOrder
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const untagged: DocumentViewerItem[] = [];
    const byTag = new Map<string, DocumentViewerItem[]>();

    for (const documentItem of documents) {
      const tag = documentItem.tag?.trim() ?? '';

      if (!tag) {
        untagged.push(documentItem);
        continue;
      }

      const existing = byTag.get(tag) ?? [];
      existing.push(documentItem);
      byTag.set(tag, existing);
    }

    const orderedFolders = normalizedTagOrder
      .filter((tag) => (byTag.get(tag)?.length ?? 0) > 0)
      .map((tag) => ({
        tag,
        documents: byTag.get(tag) ?? [],
      }));

    for (const [tag, taggedDocuments] of byTag) {
      if (!normalizedTagOrder.includes(tag) && taggedDocuments.length > 0) {
        orderedFolders.push({ tag, documents: taggedDocuments });
      }
    }

    return {
      untaggedDocuments: untagged,
      folders: orderedFolders,
    };
  }, [documents, tagOrder]);

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
      {untaggedDocuments.length > 0 ? (
        <div className="teamlist">
          {untaggedDocuments.map((documentItem, index) => (
            <DocumentCard
              key={`untagged-${documentItem.title}-${index}`}
              documentItem={documentItem}
              onOpen={setSelectedDocument}
            />
          ))}
        </div>
      ) : null}

      {folders.map((folder) => (
        <DocumentsFolder
          key={folder.tag}
          tag={folder.tag}
          documents={folder.documents}
          onOpen={setSelectedDocument}
        />
      ))}

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
                {selectedUpdatedAtLabel ? (
                  <div className="dimsmall document-viewer-subtitle">
                    Last Updated: {selectedUpdatedAtLabel}
                  </div>
                ) : null}
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
