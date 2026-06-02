'use client';

import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type FormEvent,
  type SetStateAction,
} from 'react';

import {
  saveOpportunityDraft,
  uploadOpportunityAsset,
} from '@/app/admin/opportunities/actions';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import { INVESTOR_SECTORS, type InvestorSector } from '@/lib/investor-request';

type OpportunityStatus = 'draft' | 'potential' | 'active' | 'past';
type SectionType = 'richContent' | 'links' | 'media' | 'documents' | 'team' | 'investors';
type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type SectionCard = {
  id: number;
  type: SectionType;
  data?: Record<string, unknown>;
};

export type OpportunityEditorInitialData = {
  slug: string;
  createNew?: boolean;
  opportunity?: {
    status: OpportunityStatus;
    title: string;
    teaser: string | null;
    sectors: string[] | null;
    stage: string | null;
    targetAllocationCents: number | string | null;
    minimumInvestmentCents: number | string | null;
    originationFeeCents: number | string | null;
    carryPercentageBasisPoints: number | null;
    managementFeeBasisPoints: number | null;
    websiteUrl: string | null;
    linkedinUrl: string | null;
    twitterUrl: string | null;
    ndaRequired: boolean;
    watermarkEnabled: boolean;
    passwordProtected: boolean;
    thumbnailStorageKey: string | null;
    logoStorageKey: string | null;
    thumbnailUrl: string | null;
    logoUrl: string | null;
  } | null;
  sections?: {
    type: string;
    position: number;
    data: Record<string, unknown>;
  }[];
};

type RepeaterItem = {
  id: number;
};

type PersonItem = {
  id: number;
  calloutIds: number[];
};

type CheckboxRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const statusLabels: Record<OpportunityStatus, string> = {
  draft: 'Draft',
  potential: 'Potential',
  active: 'Active',
  past: 'Past',
};

const statusPillClass: Record<OpportunityStatus, string> = {
  draft: 'selectpill draft',
  potential: 'selectpill',
  active: 'selectpill active',
  past: 'selectpill past',
};

const statusIconClass: Record<OpportunityStatus, string> = {
  draft: 'selectlink-icon orange',
  potential: 'selectlink-icon',
  active: 'selectlink-icon green',
  past: 'selectlink-icon',
};

const defaultThumbnail = '/webflow/images/photograph.svg';
const defaultLogo = '/webflow/images/shield.svg';
const defaultHeroCover = '/webflow/images/nnnoise-1.svg';

const sectionTypeLabels: Record<SectionType, string> = {
  richContent: 'Rich Text',
  links: 'Links',
  media: 'Media',
  documents: 'Documents',
  team: 'Team',
  investors: 'Investors',
};

function reorderById<T extends { id: number }>(items: T[], draggedId: number, targetId: number) {
  const from = items.findIndex((item) => item.id === draggedId);
  const to = items.findIndex((item) => item.id === targetId);

  if (from === -1 || to === -1 || from === to) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'opportunity';
}

function reorderValues<T>(items: T[], dragged: T, target: T) {
  const from = items.indexOf(dragged);
  const to = items.indexOf(target);

  if (from === -1 || to === -1 || from === to) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function startRowDrag(event: DragEvent<HTMLElement>) {
  event.dataTransfer.effectAllowed = 'move';
}

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
          className="path-ozypi"
        />
      </g>
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="selecticon"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1ZM16.7682 10.1402C17.1218 9.7159 17.0645 9.08534 16.6402 8.73177C16.2159 8.37821 15.5853 8.43553 15.2318 8.85981L10.9328 14.0186L8.70711 11.7929C8.31658 11.4024 7.68342 11.4024 7.29289 11.7929C6.90237 12.1834 6.90237 12.8166 7.29289 13.2071L10.2929 16.2071C10.4916 16.4058 10.7646 16.5117 11.0453 16.499C11.326 16.4862 11.5884 16.356 11.7682 16.1402L16.7682 10.1402Z"
        fill="currentColor"
        className="path-x7qfd"
      />
    </svg>
  );
}

function DropdownChevron() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="dropdowntoggle"
    >
      <path
        d="M10 8L14 12L10 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="path-xynr"
      />
    </svg>
  );
}

function DragHandle() {
  return (
    <div className="draggingblock" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        className="dragicons"
      >
        <path
          d="M11 18C11 19.1 10.1 20 9 20C7.9 20 7 19.1 7 18C7 16.9 7.9 16 9 16C10.1 16 11 16.9 11 18ZM9 10C7.9 10 7 10.9 7 12C7 13.1 7.9 14 9 14C10.1 14 11 13.1 11 12C11 10.9 10.1 10 9 10ZM9 4C7.9 4 7 4.9 7 6C7 7.1 7.9 8 9 8C10.1 8 11 7.1 11 6C11 4.9 10.1 4 9 4ZM15 8C16.1 8 17 7.1 17 6C17 4.9 16.1 4 15 4C13.9 4 13 4.9 13 6C13 7.1 13.9 8 15 8ZM15 10C13.9 10 13 10.9 13 12C13 13.1 13.9 14 15 14C16.1 14 17 13.1 17 12C17 10.9 16.1 10 15 10ZM15 16C13.9 16 13 16.9 13 18C13 19.1 13.9 20 15 20C16.1 20 17 19.1 17 18C17 16.9 16.1 16 15 16Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="actionicon"
    >
      <path d="M14.5 18C15.3284 18 16 17.3284 16 16.5V10.5C16 9.67158 15.3284 9 14.5 9C13.6716 9 13 9.67158 13 10.5V16.5C13 17.3284 13.6716 18 14.5 18Z" fill="currentColor" />
      <path d="M9.5 18C10.3284 18 11 17.3284 11 16.5V10.5C11 9.67158 10.3284 9 9.5 9C8.67158 9 8 9.67158 8 10.5V16.5C8 17.3284 8.67158 18 9.5 18Z" fill="currentColor" />
      <path d="M23 4.5C23 3.67158 22.3285 3 21.5 3H17.724C17.0921 1.20736 15.4007 0.00609375 13.5 0H10.5C8.59928 0.00609375 6.90789 1.20736 6.27602 3H2.5C1.67158 3 1 3.67158 1 4.5C1 5.32842 1.67158 6 2.5 6H3.00002V18.5C3.00002 21.5376 5.46245 24 8.5 24H15.5C18.5376 24 21 21.5376 21 18.5V6H21.5C22.3285 6 23 5.32842 23 4.5ZM18 18.5C18 19.8807 16.8807 21 15.5 21H8.5C7.1193 21 6.00002 19.8807 6.00002 18.5V6H18V18.5Z" fill="currentColor" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="uploadicon"
    >
      <path
        d="M17 17C19.7614 17 22 14.7614 22 12C22 9.23858 19.7614 7 17 7C16.5971 7 16.2053 7.04766 15.83 7.13765L14.5 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.83 7.13765C15.2238 4.75905 13.0673 3 10.5 3C7.46243 3 5 5.46243 5 8.5C5 8.70871 5.01163 8.9147 5.03426 9.11736C5.03426 9.11736 5.1875 10 5.5 10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.03426 9.11737C3.29168 9.54938 2 11.1238 2 13C2 15.2091 3.79086 17 6 17C6 17 6.21895 17 7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12L12 21M12 12L9.5 14M12 12L14.5 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SectionIcon() {
  return (
    <div className="navbarlink-icon branded">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        className="navicon"
      >
        <path
          d="M10.4986 7.49586L12.7507 5.24378C14.4091 3.58541 17.0978 3.5854 18.7562 5.24378C20.4146 6.90216 20.4146 9.59093 18.7562 11.2493L16.5041 13.5014M6.5 11.5L5.24378 12.7507C3.58541 14.4091 3.5854 17.0978 5.24378 18.7562C6.90216 20.4146 9.59093 20.4146 11.2493 18.7562L12.5 17.5M9.5 14.5L14.5 9.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function SectionCardEditor({
  section,
  onDelete,
  onDirty,
  onUploadError,
  onDragOver,
  onDragStart,
  onDrop,
  onTypeChange,
  uploadSlug,
}: {
  section: SectionCard;
  onDelete: () => void;
  onDirty: () => void;
  onUploadError: (message: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onTypeChange: (type: SectionType) => void;
  uploadSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const sectionTypes = Object.keys(sectionTypeLabels) as SectionType[];

  return (
    <div
      className="rowcard verticaldown"
      data-opportunity-section=""
      data-section-id={section.id}
      data-section-type={section.type}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="alignrow aligncenter">
        <DragHandle />
        <div className="dropdownblocks full">
          <button
            type="button"
            className="dropdownbuttons _100 w-inline-block"
            onClick={() => setTypeMenuOpen(!typeMenuOpen)}
          >
            <div className="align-row">
              <SectionIcon />
              <div>{sectionTypeLabels[section.type]}</div>
            </div>
            <DropdownChevron />
          </button>
          <div className="widgetsmodal" style={{ display: typeMenuOpen ? 'block' : 'none' }}>
            <div className="widgetsmodal-block">
              <div className="pillswrapper">
                {sectionTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="selectpill w-inline-block"
                    onClick={() => {
                      onTypeChange(type);
                      setTypeMenuOpen(false);
                    }}
                  >
                    <div className="alignrow aligncenter">
                      <SectionIcon />
                      <div>{sectionTypeLabels[type]}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="rowcard-actions">
          <button type="button" className="rowcard-action delete w-inline-block" onClick={onDelete}>
            <DeleteIcon />
          </button>
        </div>
      </div>
      <div className="contentsettings">
        <button
          type="button"
          className="contentsettings-toggle"
          onClick={() => setOpen(!open)}
        >
          <div>{section.type === 'media' || section.type === 'documents' ? 'Configure' : 'Settings'}</div>
        </button>
        <div className="contentsettings-drawer" style={{ display: open ? 'block' : 'none' }}>
          {section.type === 'richContent' ? (
            <RichTextDrawer initialData={section.data} />
          ) : section.type === 'links' ? (
            <LinksDrawer
              initialData={section.data}
              uploadSlug={uploadSlug}
              onDirty={onDirty}
              onUploadError={onUploadError}
            />
          ) : section.type === 'documents' ? (
            <DocumentsDrawer
              initialData={section.data}
              uploadSlug={uploadSlug}
              onDirty={onDirty}
              onUploadError={onUploadError}
            />
          ) : section.type === 'team' ? (
            <PeopleDrawer
              kind="team"
              initialData={section.data}
              uploadSlug={uploadSlug}
              onDirty={onDirty}
              onUploadError={onUploadError}
            />
          ) : section.type === 'investors' ? (
            <PeopleDrawer
              kind="investors"
              initialData={section.data}
              uploadSlug={uploadSlug}
              onDirty={onDirty}
              onUploadError={onUploadError}
            />
          ) : (
            <MediaDrawer
              initialData={section.data}
              uploadSlug={uploadSlug}
              onDirty={onDirty}
              onUploadError={onUploadError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function storedRichTextValue(value: string) {
  if (!value) return '';

  try {
    JSON.parse(value);
    return value;
  } catch {
    return JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: value }],
        },
      ],
    });
  }
}

function stringValues(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  return typeof value === 'string' ? [value] : [];
}

function TiptapDescriptionField({
  name,
  initialValue,
  onDirty,
}: {
  name: string;
  initialValue: string;
  onDirty: () => void;
}) {
  const normalizedInitialValue = storedRichTextValue(initialValue);
  const [bodyJson, setBodyJson] = useState(normalizedInitialValue);
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: parseRichTextBody(normalizedInitialValue),
    editorProps: {
      attributes: {
        class: 'textdoc-content-inner',
      },
    },
    immediatelyRender: false,
    onUpdate({ editor: currentEditor }) {
      setBodyJson(JSON.stringify(currentEditor.getJSON()));
      onDirty();
    },
  });

  const toolbarButtons = [
    {
      label: 'Bold',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bbe0879061e6f24c92972_bold.svg',
      active: editor?.isActive('bold') ?? false,
      onClick: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bdcfcd81923bac81af3e4_italic.svg',
      active: editor?.isActive('italic') ?? false,
      onClick: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Underline',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bdd0798736d065bc84222_underline.svg',
      active: editor?.isActive('underline') ?? false,
      onClick: () => editor?.chain().focus().toggleUnderline().run(),
    },
    'divider' as const,
    {
      label: 'Bullet List',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bbe0809043a4c57c7ac50_list.svg',
      active: editor?.isActive('bulletList') ?? false,
      onClick: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered List',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bddf670a5db883e5590a3_numberslist.svg',
      active: editor?.isActive('orderedList') ?? false,
      onClick: () => editor?.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <>
      <input type="hidden" name={name} value={bodyJson} readOnly />
      <div className="tiptap-wrapper description">
        <div className="textstyles-row">
          {toolbarButtons.map((button, index) =>
            button === 'divider' ? (
              <div key={`divider-${index}`} className="textstyle-divider" />
            ) : (
              <button
                key={button.label}
                type="button"
                className={`textstyle-block w-inline-block${button.active ? ' active' : ''}`}
                aria-label={button.label}
                onClick={button.onClick}
              >
                <img src={button.icon} loading="lazy" alt="" className="textsyle-icon" />
              </button>
            ),
          )}
        </div>
        <div className="textdoc-content description">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}

function SectionIntroFields({
  prefix,
  initialData,
  onDirty,
}: {
  prefix: string;
  initialData?: Record<string, unknown>;
  onDirty: () => void;
}) {
  const titleValue = initialData?.[`${prefix}-Title`];
  const descriptionValue = initialData?.[`${prefix}-Description`];
  const title = typeof titleValue === 'string' ? titleValue : '';
  const description = typeof descriptionValue === 'string' ? descriptionValue : '';

  return (
    <div className="contentheader">
      <input
        className="formfields w-input"
        maxLength={256}
        name={`${prefix}-Title`}
        data-name={`${prefix} Title`}
        placeholder="Title (Optional)"
        type="text"
        defaultValue={title}
      />
      <TiptapDescriptionField
        name={`${prefix}-Description`}
        initialValue={description}
        onDirty={onDirty}
      />
    </div>
  );
}

function UploadButton({
  label,
  name,
  initialStorageKey = '',
  accept = 'image/*',
  assetKind = 'section',
  onError,
  slug,
  onDirty,
}: {
  label: string;
  name: string;
  initialStorageKey?: string;
  accept?: string;
  assetKind?: 'section' | 'document';
  onError: (message: string) => void;
  slug: string;
  onDirty: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState('');
  const [previewType, setPreviewType] = useState<'image' | 'document' | ''>('');
  const [storageKey, setStorageKey] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleChange = async (file: File) => {
    if (file.type.startsWith('image/')) {
      setPreviewType('image');
      setPreviewSrc(URL.createObjectURL(file));
    } else {
      setPreviewType('document');
      setPreviewSrc('');
    }
    setUploading(true);

    const formData = new FormData();
    formData.set('slug', slug);
    formData.set('kind', assetKind);
    formData.set('file', file);

    const result = await uploadOpportunityAsset(formData);
    setUploading(false);

    if (result.status === 'success') {
      setStorageKey(result.storageKey);
      if (file.type.startsWith('image/')) {
        setPreviewSrc(result.signedUrl);
      }
      onDirty();
      return;
    }

    onError(result.message);
  };

  return (
    <>
      <button
        type="button"
        className="thumbnailpicker"
        aria-label={label}
        onClick={() => inputRef.current?.click()}
      >
        {previewType === 'document' ? (
          <img src="/webflow/images/docicon.svg" loading="lazy" alt="" className="docsicon" />
        ) : previewSrc ? (
          <img alt="" src={previewSrc} loading="lazy" className="full-image" />
        ) : (
          <UploadIcon />
        )}
      </button>
      {storageKey || initialStorageKey ? (
        <input name={name} type="hidden" value={storageKey || initialStorageKey} readOnly />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        disabled={uploading}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          if (file) {
            void handleChange(file);
          }

          event.currentTarget.value = '';
        }}
      />
    </>
  );
}

function LinksDrawer({
  initialData,
  uploadSlug,
  onDirty,
  onUploadError,
}: {
  initialData?: Record<string, unknown>;
  uploadSlug: string;
  onDirty: () => void;
  onUploadError: (message: string) => void;
}) {
  const linkTitles = stringValues(initialData?.['Link-Title']);
  const linkUrls = stringValues(initialData?.['Link-Url']);
  const linkImages = stringValues(initialData?.['Link-Image-Storage-Key']);
  const initialItemCount = Math.max(linkTitles.length, linkUrls.length, linkImages.length, 1);
  const initialItems = Array.from({ length: initialItemCount }, (_, index) => ({ id: index + 1 }));
  const [items, setItems] = useState<RepeaterItem[]>(initialItems);
  const [nextId, setNextId] = useState(initialItems.length + 1);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  return (
    <div content-type="links" className="contenttype-block">
      <SectionIntroFields prefix="Links" initialData={initialData} onDirty={onDirty} />
      {items.map((item, index) => (
        <div
          key={item.id}
          className="rowcard withdrag"
          draggable
          onDragStart={(event) => {
            startRowDrag(event);
            setDraggedId(item.id);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedId !== null) {
              setItems((current) => reorderById(current, draggedId, item.id));
              setDraggedId(null);
            }
          }}
        >
          <div className="alignrow aligncenter stretch middle">
            <DragHandle />
            <div className="prompt-block">
              <div className="alignrow aligncenter">
                <UploadButton
                  label="Upload link thumbnail"
                  name="Link-Image-Storage-Key"
                  initialStorageKey={linkImages[index] ?? ''}
                  slug={uploadSlug}
                  onDirty={onDirty}
                  onError={onUploadError}
                />
                <input
                  className="formfields w-input"
                  maxLength={256}
                  name="Link-Title"
                  data-name="Link Title"
                  placeholder="Title"
                  type="text"
                  defaultValue={linkTitles[index] ?? ''}
                />
              </div>
              <input
                className="formfields urlfield w-input"
                maxLength={256}
                name="Link-Url"
                data-name="Link URL"
                placeholder="Content link"
                type="url"
                defaultValue={linkUrls[index] ?? ''}
              />
            </div>
          </div>
          <div className="rowcard-actions">
            <button
              type="button"
              className="rowcard-action delete w-inline-block"
              onClick={() => setItems((current) => current.filter((link) => link.id !== item.id))}
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="contentsettings-toggle rounded"
        onClick={() => {
          setItems((current) => [...current, { id: nextId }]);
          setNextId((current) => current + 1);
        }}
      >
        <div>Add New Link</div>
      </button>
    </div>
  );
}

function DocumentsDrawer({
  initialData,
  uploadSlug,
  onDirty,
  onUploadError,
}: {
  initialData?: Record<string, unknown>;
  uploadSlug: string;
  onDirty: () => void;
  onUploadError: (message: string) => void;
}) {
  const documentTitles = stringValues(initialData?.['Document-Title']);
  const documentStorageKeys = stringValues(initialData?.['Document-Storage-Key']);
  const initialItemCount = Math.max(documentTitles.length, documentStorageKeys.length, 1);
  const initialItems = Array.from({ length: initialItemCount }, (_, index) => ({ id: index + 1 }));
  const [items, setItems] = useState<RepeaterItem[]>(initialItems);
  const [nextId, setNextId] = useState(initialItems.length + 1);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  return (
    <div content-type="documents" className="contenttype-block">
      <SectionIntroFields prefix="Documents" initialData={initialData} onDirty={onDirty} />
      {items.map((item, index) => (
        <div
          key={item.id}
          className="rowcard withdrag"
          draggable
          onDragStart={(event) => {
            startRowDrag(event);
            setDraggedId(item.id);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedId !== null) {
              setItems((current) => reorderById(current, draggedId, item.id));
              setDraggedId(null);
            }
          }}
        >
          <div className="alignrow aligncenter stretch middle">
            <DragHandle />
            <div className="prompt-block">
              <div className="alignrow aligncenter">
                <UploadButton
                  label="Upload document"
                  name="Document-Storage-Key"
                  accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  assetKind="document"
                  initialStorageKey={documentStorageKeys[index] ?? ''}
                  slug={uploadSlug}
                  onDirty={onDirty}
                  onError={onUploadError}
                />
                <input
                  className="formfields w-input"
                  maxLength={256}
                  name="Document-Title"
                  data-name="Document Title"
                  placeholder="Document Title"
                  type="text"
                  defaultValue={documentTitles[index] ?? ''}
                />
              </div>
            </div>
          </div>
          <div className="rowcard-actions">
            <button
              type="button"
              className="rowcard-action delete w-inline-block"
              onClick={() => setItems((current) => current.filter((document) => document.id !== item.id))}
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="contentsettings-toggle rounded"
        onClick={() => {
          setItems((current) => [...current, { id: nextId }]);
          setNextId((current) => current + 1);
        }}
      >
        <div>Add New Document</div>
      </button>
    </div>
  );
}

function SocialIcon({ label }: { label: string }) {
  if (label === 'LinkedIn') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="socialicon">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.42857 8.96884H13.1429V10.8193C13.6783 9.75524 15.0503 8.79887 17.1114 8.79887C21.0623 8.79887 22 10.9167 22 14.8028V22H18V15.6878C18 13.4748 17.4646 12.2266 16.1029 12.2266C14.2143 12.2266 13.4286 13.5722 13.4286 15.6878V22H9.42857V8.96884ZM2.57143 21.83H6.57143V8.79887H2.57143V21.83ZM7.14286 4.54958C7.14286 4.88439 7.07635 5.21593 6.94712 5.52526C6.81789 5.83458 6.62848 6.11565 6.3897 6.3524C6.15092 6.58915 5.86745 6.77695 5.55547 6.90508C5.24349 7.0332 4.90911 7.09915 4.57143 7.09915C4.23374 7.09915 3.89937 7.0332 3.58739 6.90508C3.27541 6.77695 2.99193 6.58915 2.75315 6.3524C2.51437 6.11565 2.32496 5.83458 2.19574 5.52526C2.06651 5.21593 2 4.88439 2 4.54958C2 3.87339 2.27092 3.22489 2.75315 2.74675C3.23539 2.26862 3.88944 2 4.57143 2C5.25341 2 5.90747 2.26862 6.3897 2.74675C6.87194 3.22489 7.14286 3.87339 7.14286 4.54958Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (label === 'X / Twitter') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="socialicon">
        <path
          d="M13.8076 10.4686L20.8808 2H19.2046L13.063 9.3532L8.15769 2H2.5L9.91779 13.1193L2.5 22H4.17621L10.6619 14.2348L15.8423 22H21.5L13.8072 10.4686H13.8076ZM11.5118 13.2173L10.7602 12.1101L4.78017 3.29968H7.35474L12.1807 10.4099L12.9323 11.5172L19.2054 20.7594H16.6309L11.5118 13.2177V13.2173Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="socialicon">
      <path d="M2 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(90 12 12)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SocialRows({
  prefix,
  initialData,
}: {
  prefix: string;
  initialData?: Record<string, unknown>;
}) {
  const [socials, setSocials] = useState([
    { label: 'Website', className: 'socialicons socials dark', placeholder: 'company.com' },
    { label: 'LinkedIn', className: 'socialicons socials linkedin', placeholder: 'linkedin.com/in/name' },
    { label: 'X / Twitter', className: 'socialicons socials x', placeholder: 'x.com/username' },
  ]);
  const [draggedLabel, setDraggedLabel] = useState<string | null>(null);

  return (
    <div className="rowcards wrapped">
      {socials.map((social) => {
        const urlFieldName = `${prefix}-${social.label}-Url`;
        const defaultUrl = initialData?.[urlFieldName];

        return (
        <div
          key={social.label}
          className="rowcard withdrag"
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            startRowDrag(event);
            setDraggedLabel(social.label);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (draggedLabel) {
              setSocials((current) => {
                const dragged = current.find((item) => item.label === draggedLabel);
                return dragged ? reorderValues(current, dragged, social) : current;
              });
              setDraggedLabel(null);
            }
          }}
        >
          <div className="alignrow aligncenter stretch middle">
            <DragHandle />
            <div className={social.className}>
              <SocialIcon label={social.label} />
            </div>
            <div className="prompt-block">
              <input
                className="formfields-3 w-input"
                maxLength={256}
                name={urlFieldName}
                data-name={`${prefix} ${social.label} URL`}
                placeholder={social.placeholder}
                type="url"
                defaultValue={typeof defaultUrl === 'string' ? defaultUrl : ''}
              />
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}

function CalloutRows({
  item,
  label,
  initialCallouts,
  nextCalloutId,
  setItems,
  setNextCalloutId,
}: {
  item: PersonItem;
  label: string;
  initialCallouts: string[];
  nextCalloutId: number;
  setItems: Dispatch<SetStateAction<PersonItem[]>>;
  setNextCalloutId: Dispatch<SetStateAction<number>>;
}) {
  const [draggedCalloutId, setDraggedCalloutId] = useState<number | null>(null);

  return (
    <div className="rowcards wrapped">
      {item.calloutIds.map((calloutId, index) => (
        <div
          key={calloutId}
          className="rowcard withdrag"
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            startRowDrag(event);
            setDraggedCalloutId(calloutId);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (draggedCalloutId !== null) {
              setItems((current) =>
                current.map((person) =>
                  person.id === item.id
                    ? {
                        ...person,
                        calloutIds: reorderValues(
                          person.calloutIds,
                          draggedCalloutId,
                          calloutId,
                        ),
                      }
                    : person,
                ),
              );
              setDraggedCalloutId(null);
            }
          }}
        >
          <div className="alignrow aligncenter stretch middle">
            <DragHandle />
            <div className="prompt-block">
              <input
                className="formfields-3 w-input"
                maxLength={256}
                name={`${label}-${item.id}-Callout`}
                data-name={`${label} Callout`}
                placeholder="e.g. PHD, Stanford"
                type="text"
                defaultValue={initialCallouts[index] ?? ''}
              />
            </div>
          </div>
          <div className="rowcard-actions">
            <button
              type="button"
              className="rowcard-action delete w-inline-block"
              onClick={() =>
                setItems((current) =>
                  current.map((person) =>
                    person.id === item.id
                      ? {
                          ...person,
                          calloutIds: person.calloutIds.filter((id) => id !== calloutId),
                        }
                      : person,
                  ),
                )
              }
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="contentsettings-toggle rounded"
        onClick={() => {
          setItems((current) =>
            current.map((person) =>
              person.id === item.id
                ? { ...person, calloutIds: [...person.calloutIds, nextCalloutId] }
                : person,
            ),
          );
          setNextCalloutId((current) => current + 1);
        }}
      >
        <div>Add New Callout</div>
      </button>
    </div>
  );
}

function PeopleDrawer({
  kind,
  initialData,
  uploadSlug,
  onDirty,
  onUploadError,
}: {
  kind: 'team' | 'investors';
  initialData?: Record<string, unknown>;
  uploadSlug: string;
  onDirty: () => void;
  onUploadError: (message: string) => void;
}) {
  const label = kind === 'team' ? 'Team Member' : 'Investor';
  const sectionLabel = kind === 'team' ? 'Team' : 'Investors';
  const legacyNames = stringValues(initialData?.[`${label}-Name`]);
  const legacyTitles = stringValues(initialData?.[`${label}-Title`]);
  const legacyImages = stringValues(initialData?.[`${label}-Image-Storage-Key`]);
  const legacyCallouts = stringValues(initialData?.[`${label}-Callout`]);
  const savedIds = Object.keys(initialData ?? {})
    .map((key) => key.match(new RegExp(`^${label}-(\\d+)-`))?.[1])
    .filter((id): id is string => Boolean(id))
    .map(Number);
  const initialIds = Array.from(new Set(savedIds)).sort((a, b) => a - b);
  const initialPersonCount = Math.max(initialIds.length, legacyNames.length, 1);
  const initialItems = Array.from({ length: initialPersonCount }, (_, index) => {
    const id = initialIds[index] ?? index + 1;
    const directCallouts = stringValues(initialData?.[`${label}-${id}-Callout`]);
    const fallbackCalloutCount = directCallouts.length || Math.max(1, Math.ceil(legacyCallouts.length / initialPersonCount));

    return {
      id,
      calloutIds: Array.from({ length: fallbackCalloutCount }, (__, calloutIndex) => calloutIndex + 1),
    };
  });
  const maxInitialPersonId = Math.max(...initialItems.map((item) => item.id));
  const maxInitialCalloutId = Math.max(...initialItems.flatMap((item) => item.calloutIds));
  const [items, setItems] = useState<PersonItem[]>(initialItems);
  const [nextId, setNextId] = useState(maxInitialPersonId + 1);
  const [nextCalloutId, setNextCalloutId] = useState(maxInitialCalloutId + 1);
  const [draggedPersonId, setDraggedPersonId] = useState<number | null>(null);

  const legacyCalloutsForIndex = (index: number) => {
    if (initialPersonCount <= 1) {
      return legacyCallouts;
    }

    const baseCount = Math.floor(legacyCallouts.length / initialPersonCount);
    const remainder = legacyCallouts.length % initialPersonCount;
    const start = index * baseCount + Math.min(index, remainder);
    const count = baseCount + (index < remainder ? 1 : 0);
    return legacyCallouts.slice(start, start + count);
  };

  return (
    <div content-type={kind} className="contenttype-block">
      <SectionIntroFields prefix={sectionLabel} initialData={initialData} onDirty={onDirty} />
      {items.map((item, index) => {
        const name = typeof initialData?.[`${label}-${item.id}-Name`] === 'string'
          ? initialData[`${label}-${item.id}-Name`] as string
          : legacyNames[index] ?? '';
        const title = typeof initialData?.[`${label}-${item.id}-Title`] === 'string'
          ? initialData[`${label}-${item.id}-Title`] as string
          : legacyTitles[index] ?? '';
        const imageStorageKey = typeof initialData?.[`${label}-${item.id}-Image-Storage-Key`] === 'string'
          ? initialData[`${label}-${item.id}-Image-Storage-Key`] as string
          : legacyImages[index] ?? '';
        const initialCallouts = stringValues(initialData?.[`${label}-${item.id}-Callout`]);
        const callouts = initialCallouts.length ? initialCallouts : legacyCalloutsForIndex(index);

        return (
        <div
          key={item.id}
          className="rowcard withdrag"
          draggable
          onDragStart={(event) => {
            startRowDrag(event);
            setDraggedPersonId(item.id);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedPersonId !== null) {
              setItems((current) => reorderById(current, draggedPersonId, item.id));
              setDraggedPersonId(null);
            }
          }}
        >
          <div className="alignrow aligncenter stretch middle">
            <DragHandle />
            <div className="prompt-block">
              <div className="alignrow aligncenter">
                <UploadButton
                  label={`Upload ${label.toLowerCase()} image`}
                  name={`${label}-${item.id}-Image-Storage-Key`}
                  initialStorageKey={imageStorageKey}
                  slug={uploadSlug}
                  onDirty={onDirty}
                  onError={onUploadError}
                />
                <input
                  className="formfields w-input"
                  maxLength={256}
                  name={`${label}-${item.id}-Name`}
                  data-name={`${label} Name`}
                  placeholder="Name"
                  type="text"
                  defaultValue={name}
                />
              </div>
              <input
                className="formfields w-input"
                maxLength={256}
                name={`${label}-${item.id}-Title`}
                data-name={`${label} Title`}
                placeholder="Title"
                type="text"
                defaultValue={title}
              />
              <SocialRows prefix={`${label}-${item.id}`} initialData={initialData} />
              <CalloutRows
                item={item}
                label={label}
                initialCallouts={callouts}
                nextCalloutId={nextCalloutId}
                setItems={setItems}
                setNextCalloutId={setNextCalloutId}
              />
            </div>
          </div>
          <div className="rowcard-actions">
            <button
              type="button"
              className="rowcard-action delete w-inline-block"
              onClick={() => setItems((current) => current.filter((person) => person.id !== item.id))}
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
        );
      })}
      <button
        type="button"
        className="contentsettings-toggle rounded"
        onClick={() => {
          setItems((current) => [...current, { id: nextId, calloutIds: [nextCalloutId] }]);
          setNextId((current) => current + 1);
          setNextCalloutId((current) => current + 1);
        }}
      >
        <div>Add New {label}</div>
      </button>
    </div>
  );
}

function MediaDrawer({
  initialData,
  uploadSlug,
  onDirty,
  onUploadError,
}: {
  initialData?: Record<string, unknown>;
  uploadSlug: string;
  onDirty: () => void;
  onUploadError: (message: string) => void;
}) {
  return (
    <div content-type="media" className="contenttype-block">
      <SectionIntroFields prefix="Media" initialData={initialData} onDirty={onDirty} />
      <div className="rowcard withdrag">
        <div className="alignrow aligncenter stretch middle">
          <DragHandle />
          <div className="prompt-block">
            <div className="alignrow aligncenter">
              <UploadButton
                label="Upload media"
                name="Media-Storage-Key"
                slug={uploadSlug}
                onDirty={onDirty}
                onError={onUploadError}
              />
              <input
                className="formfields w-input"
                maxLength={256}
                name="Media-Title"
                data-name="Media Title"
                placeholder="Title"
                type="text"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseRichTextBody(bodyJson: string) {
  if (!bodyJson) return '';

  try {
    return JSON.parse(bodyJson);
  } catch {
    return '';
  }
}

function RichTextDrawer({ initialData }: { initialData?: Record<string, unknown> }) {
  const title = typeof initialData?.['Rich-Text-Title'] === 'string'
    ? initialData['Rich-Text-Title']
    : '';
  const initialBodyJson = typeof initialData?.['Rich-Text-Body'] === 'string'
    ? initialData['Rich-Text-Body']
    : '';
  const [bodyJson, setBodyJson] = useState(initialBodyJson);
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: parseRichTextBody(initialBodyJson),
    editorProps: {
      attributes: {
        class: 'textdoc-content-inner',
      },
    },
    immediatelyRender: false,
    onUpdate({ editor: currentEditor }) {
      setBodyJson(JSON.stringify(currentEditor.getJSON()));
    },
  });

  const toolbarButtons = [
    {
      label: 'Bold',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bbe0879061e6f24c92972_bold.svg',
      active: editor?.isActive('bold') ?? false,
      onClick: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bdcfcd81923bac81af3e4_italic.svg',
      active: editor?.isActive('italic') ?? false,
      onClick: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Underline',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bdd0798736d065bc84222_underline.svg',
      active: editor?.isActive('underline') ?? false,
      onClick: () => editor?.chain().focus().toggleUnderline().run(),
    },
    'divider' as const,
    {
      label: 'Heading 1',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bbe089fe1c49315071979_h1.svg',
      active: editor?.isActive('heading', { level: 1 }) ?? false,
      className: 'h',
      onClick: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'Heading 2',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bbe08ec3a382c45e2952a_h2.svg',
      active: editor?.isActive('heading', { level: 2 }) ?? false,
      className: 'h',
      onClick: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Heading 3',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bbe08dc7f322014c7d9e2_h3.svg',
      active: editor?.isActive('heading', { level: 3 }) ?? false,
      className: 'h',
      onClick: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    'divider' as const,
    {
      label: 'Bullet List',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bbe0809043a4c57c7ac50_list.svg',
      active: editor?.isActive('bulletList') ?? false,
      onClick: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered List',
      icon: 'https://cdn.prod.website-files.com/6904240f9360489fd59ec0b9/691bddf670a5db883e5590a3_numberslist.svg',
      active: editor?.isActive('orderedList') ?? false,
      onClick: () => editor?.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div content-type="rich-text" className="contenttype-block">
      <div className="contentheader">
        <input
          className="formfields w-input"
          maxLength={256}
          name="Rich-Text-Title"
          data-name="Rich Text Title"
          placeholder="Title"
          type="text"
          defaultValue={title}
        />
        <input
          type="hidden"
          name="Rich-Text-Body"
          data-name="Rich Text Body"
          value={bodyJson}
          readOnly
        />
        <div className="tiptap-wrapper">
          <div className="textstyles-row">
            {toolbarButtons.map((button, index) =>
              button === 'divider' ? (
                <div key={`divider-${index}`} className="textstyle-divider" />
              ) : (
                <button
                  key={button.label}
                  type="button"
                  className={`textstyle-block w-inline-block${button.active ? ' active' : ''}`}
                  aria-label={button.label}
                  onClick={button.onClick}
                >
                  <img
                    src={button.icon}
                    loading="lazy"
                    alt=""
                    className={`textsyle-icon${button.className ? ` ${button.className}` : ''}`}
                  />
                </button>
              ),
            )}
          </div>
          <div className="textdoc-content">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCurrencyInput(value: string) {
  const digits = value.replace(/[^\d]/g, '');

  if (!digits) {
    return '';
  }

  return `$${Number(digits).toLocaleString('en-US')}`;
}

function centsToCurrencyInput(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return '';
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return `$${Math.round(numericValue / 100).toLocaleString('en-US')}`;
}

function formatPercentInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '');

  if (!cleaned) {
    return '';
  }

  return `${cleaned.replace(/(\..*)\./g, '$1')}%`;
}

function basisPointsToPercentInput(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '';
  }

  const percent = value / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function moneyToNumber(value: string) {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function compactRaiseAmount(value: string) {
  const amount = moneyToNumber(value);

  if (!amount) {
    return null;
  }

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const label = Number.isInteger(millions) ? millions.toString() : millions.toFixed(1);
    return `$${label} Million`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return value;
}

function compactMinAmount(value: string) {
  const amount = moneyToNumber(value);

  if (!amount) {
    return null;
  }

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const label = Number.isInteger(millions) ? millions.toString() : millions.toFixed(1);
    return `$${label}M`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return value;
}

function percentLabel(value: string) {
  return value.trim() || '0%';
}

function managementFeeLabel(value: string) {
  return value.trim() ? `${percentLabel(value)} Fee` : 'No Fee';
}

function normalizeOpportunitySectors(value: string[] | null | undefined) {
  return Array.from(new Set(
    (value ?? []).filter((sector): sector is InvestorSector =>
      (INVESTOR_SECTORS as readonly string[]).includes(sector),
    ),
  ));
}

function SectorDropdownIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="dropdowntoggle"
      style={{ transform: open ? 'rotate(90deg)' : undefined }}
    >
      <path
        d="M10 8L14 12L10 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OpportunitySectorDropdown({
  selectedSectors,
  onChange,
}: {
  selectedSectors: InvestorSector[];
  onChange: (sectors: InvestorSector[]) => void;
}) {
  const sectorDropdownRef = useRef<HTMLDivElement>(null);
  const [sectorsOpen, setSectorsOpen] = useState(false);

  useEffect(() => {
    if (!sectorsOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node
        && !sectorDropdownRef.current?.contains(event.target)
      ) {
        setSectorsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [sectorsOpen]);

  function toggleSector(sector: InvestorSector) {
    onChange(
      selectedSectors.includes(sector)
        ? selectedSectors.filter((item) => item !== sector)
        : [...selectedSectors, sector],
    );
  }

  return (
    <div ref={sectorDropdownRef} className="dropdownblocks full opportunity-sector-dropdown">
      <button
        type="button"
        className="dropdownbuttons _100 signup-sector-dropdown-button w-inline-block"
        aria-expanded={sectorsOpen}
        onClick={() => setSectorsOpen((current) => !current)}
      >
        <div className="align-row">
          <div>{selectedSectors.length} Selected</div>
        </div>
        <SectorDropdownIcon open={sectorsOpen} />
      </button>
      <div className={`dropdownmodal signup-dropdown${sectorsOpen ? ' open' : ''}`}>
        <div className="widgetsmodal-block">
          <div className="pillswrapper">
            {INVESTOR_SECTORS.map((sector) => {
              const selected = selectedSectors.includes(sector);

              return (
                <button
                  key={sector}
                  type="button"
                  className={`selectpill w-inline-block${selected ? ' selected' : ''}`}
                  onClick={() => toggleSector(sector)}
                >
                  <div className="alignrow aligncenter">
                    <div className={`selectlink-icon${selected ? ' selected' : ''}`}>
                      <WebflowSectorIcon sector={sector} />
                    </div>
                    <div>{sector}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckboxRow({ label, checked, onChange }: CheckboxRowProps) {
  return (
    <button
      type="button"
      className="checkboxrow"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <div className="interestchecks-row">
        {checked ? (
          <div className="checkboxtoggle checked">
            <CheckIcon />
          </div>
        ) : (
          <div className="checkboxtoggle" />
        )}
      </div>
      <div>
        <div>{label}</div>
      </div>
    </button>
  );
}

function UploadPicker({
  className,
  imageSrc,
  label,
  onChange,
}: {
  className: string;
  imageSrc: string;
  label: string;
  onChange: (src: string, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
      >
        <img alt="" src={imageSrc} loading="lazy" className="full-image" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          if (!file) {
            return;
          }

          onChange(URL.createObjectURL(file), file);
        }}
      />
    </>
  );
}

function StatusDropdown({
  status,
  onChange,
}: {
  status: OpportunityStatus;
  onChange: (status: OpportunityStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: OpportunityStatus[] = ['draft', 'potential', 'active', 'past'];

  return (
    <div className="dropdownblocks full">
      <button
        type="button"
        className="dropdownbuttons _100 w-inline-block"
        onClick={() => setOpen(!open)}
      >
        <div className="alignrow aligncenter">
          <div className={statusPillClass[status]}>
            <div className="alignrow aligncenter">
              <div className={statusIconClass[status]}>
                <StatusIcon />
              </div>
              <div>{statusLabels[status]}</div>
            </div>
          </div>
        </div>
        <DropdownChevron />
      </button>
      <div className="dropdownmodal short" style={{ display: open ? 'block' : 'none' }}>
        <div className="widgetsmodal-block">
          <div className="pillswrapper">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                className={`${statusPillClass[option]} w-inline-block`}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <div className="alignrow aligncenter">
                  <div className={statusIconClass[option]}>
                    <StatusIcon />
                  </div>
                  <div>{statusLabels[option]}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpportunityEditor({
  initialData = { slug: 'frontier-security' },
}: {
  initialData?: OpportunityEditorInitialData;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const initialOpportunity = initialData.opportunity;
  const isCreating = initialData.createNew ?? false;
  const [status, setStatus] = useState<OpportunityStatus>(initialOpportunity?.status ?? 'draft');
  const [title, setTitle] = useState(initialOpportunity?.title ?? '');
  const [teaser, setTeaser] = useState(
    initialOpportunity?.teaser ?? '',
  );
  const [selectedSectors, setSelectedSectors] = useState<InvestorSector[]>(
    normalizeOpportunitySectors(initialOpportunity?.sectors),
  );
  const [stage, setStage] = useState(initialOpportunity?.stage ?? '');
  const [targetRaise, setTargetRaise] = useState(
    centsToCurrencyInput(initialOpportunity?.targetAllocationCents),
  );
  const [minimumCheck, setMinimumCheck] = useState(
    centsToCurrencyInput(initialOpportunity?.minimumInvestmentCents),
  );
  const [originationFee, setOriginationFee] = useState(
    centsToCurrencyInput(initialOpportunity?.originationFeeCents),
  );
  const [carry, setCarry] = useState(
    basisPointsToPercentInput(initialOpportunity?.carryPercentageBasisPoints),
  );
  const [managementFee, setManagementFee] = useState(
    basisPointsToPercentInput(initialOpportunity?.managementFeeBasisPoints),
  );
  const [websiteUrl, setWebsiteUrl] = useState(initialOpportunity?.websiteUrl ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(initialOpportunity?.linkedinUrl ?? '');
  const [twitterUrl, setTwitterUrl] = useState(initialOpportunity?.twitterUrl ?? '');
  const [ndaRequired, setNdaRequired] = useState(initialOpportunity?.ndaRequired ?? false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(initialOpportunity?.watermarkEnabled ?? false);
  const [passwordProtected, setPasswordProtected] = useState(initialOpportunity?.passwordProtected ?? false);
  const [password, setPassword] = useState('');
  const [thumbnailSrc, setThumbnailSrc] = useState(initialOpportunity?.thumbnailUrl ?? defaultThumbnail);
  const [logoSrc, setLogoSrc] = useState(initialOpportunity?.logoUrl ?? defaultLogo);
  const [thumbnailStorageKey, setThumbnailStorageKey] = useState(initialOpportunity?.thumbnailStorageKey ?? '');
  const [logoStorageKey, setLogoStorageKey] = useState(initialOpportunity?.logoStorageKey ?? '');
  const initialSections =
    initialData.sections?.map((section, index) => ({
      id: index + 1,
      type: (section.type in sectionTypeLabels ? section.type : 'richContent') as SectionType,
      data: section.data,
    })) ?? [];
  const [sections, setSections] = useState<SectionCard[]>(initialSections);
  const [nextSectionId, setNextSectionId] = useState(initialSections.length + 1);
  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const canSave = saveStatus === 'dirty' || saveStatus === 'error';

  const markDirty = () => {
    setSaveStatus('dirty');
    setSaveMessage('');
  };

  const serializeSectionData = (sectionElement: HTMLElement) => {
    const data: Record<string, unknown> = {};
    const fields = sectionElement.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input[name], textarea[name], select[name]',
    );

    fields.forEach((field) => {
      const value = field.value;
      const existing = data[field.name];

      if (existing === undefined) {
        data[field.name] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        data[field.name] = [existing, value];
      }
    });

    return data;
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveMessage('');

    const sectionElements = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[data-section-id]') ?? [],
    );

    const result = await saveOpportunityDraft({
      slug: isCreating ? slugify(title) : initialData.slug,
      createNew: isCreating,
      status,
      title,
      teaser,
      sectors: selectedSectors,
      stage,
      targetRaise,
      minimumCheck,
      originationFee,
      carry,
      managementFee,
      websiteUrl,
      linkedinUrl,
      twitterUrl,
      ndaRequired,
      watermarkEnabled,
      passwordProtected,
      password,
      thumbnailStorageKey,
      logoStorageKey,
      sections: sectionElements.map((sectionElement, position) => ({
        clientId: Number(sectionElement.dataset.sectionId ?? position),
        type: sectionElement.dataset.sectionType ?? 'richContent',
        position,
        data: serializeSectionData(sectionElement),
      })),
    });

    if (result.status === 'success') {
      setSaveStatus('saved');
      setSaveMessage('');

      if (isCreating) {
        router.replace(`/admin/opportunities/${result.slug}/edit`);
      }

      return;
    }

    setSaveStatus('error');
    setSaveMessage(result.message);
  };

  const handleOpportunityImageUpload = async (
    file: File,
    kind: 'thumbnail' | 'logo',
    previewUrl: string,
  ) => {
    if (kind === 'thumbnail') {
      setThumbnailSrc(previewUrl);
    } else {
      setLogoSrc(previewUrl);
    }

    setSaveStatus('saving');
    setSaveMessage(kind === 'thumbnail' ? 'Uploading thumbnail...' : 'Uploading logo...');

    const formData = new FormData();
    formData.set('slug', isCreating ? slugify(title) : initialData.slug);
    formData.set('kind', kind);
    formData.set('file', file);

    const result = await uploadOpportunityAsset(formData);

    if (result.status === 'success') {
      if (kind === 'thumbnail') {
        setThumbnailSrc(result.signedUrl);
        setThumbnailStorageKey(result.storageKey);
      } else {
        setLogoSrc(result.signedUrl);
        setLogoStorageKey(result.storageKey);
      }

      markDirty();
      return;
    }

    setSaveStatus('error');
    setSaveMessage(result.message);
  };

  const heroStats = useMemo(
    () => ({
      targetRaise: compactRaiseAmount(targetRaise),
      minimumCheck: compactMinAmount(minimumCheck),
      originationFee: compactMinAmount(originationFee),
      carry: `${percentLabel(carry)} Carry`,
      managementFee: managementFeeLabel(managementFee),
      stage: stage.trim() || 'Stage',
    }),
    [carry, managementFee, minimumCheck, originationFee, stage, targetRaise],
  );

  return (
    <div ref={rootRef} className="pagecontainer breadcrumb" onInput={markDirty}>
      <div className="breadcrumbrow">
        <a href="/admin/opportunities" className="breadcrumbicon w-inline-block" aria-label="Opportunities">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            className="homeicon"
          >
            <g>
              <path d="M19.5 0H22C23.1046 0 24 0.895453 24 2.00002V4.5C24 5.60456 23.1046 6.50002 22 6.50002H19.5C18.3955 6.50002 17.5 5.60456 17.5 4.5V2.00002C17.5 0.895453 18.3955 0 19.5 0Z" fill="currentColor" />
              <path d="M10.75 0H13.25C14.3546 0 15.25 0.895453 15.25 2.00002V4.5C15.25 5.60456 14.3546 6.50002 13.25 6.50002H10.75C9.64545 6.50002 8.75 5.60456 8.75 4.5V2.00002C8.75005 0.895453 9.64545 0 10.75 0Z" fill="currentColor" />
              <path d="M2.00002 0H4.5C5.60456 0 6.50002 0.895453 6.50002 2.00002V4.5C6.50002 5.60456 5.60456 6.50002 4.5 6.50002H2.00002C0.895453 6.50002 0 5.60456 0 4.5V2.00002C0 0.895453 0.895453 0 2.00002 0Z" fill="currentColor" />
              <path d="M19.5 8.75H22C23.1046 8.75 24 9.64545 24 10.75V13.25C24 14.3546 23.1046 15.25 22 15.25H19.5C18.3955 15.25 17.5 14.3546 17.5 13.25V10.75C17.5 9.64541 18.3955 8.75 19.5 8.75Z" fill="currentColor" />
              <path d="M10.75 8.75H13.25C14.3546 8.75 15.25 9.64545 15.25 10.75V13.25C15.25 14.3546 14.3546 15.25 13.25 15.25H10.75C9.64545 15.25 8.75 14.3546 8.75 13.25V10.75C8.75005 9.64541 9.64545 8.75 10.75 8.75Z" fill="currentColor" />
              <path d="M2.00002 8.75H4.5C5.60456 8.75 6.50002 9.64545 6.50002 10.75V13.25C6.50002 14.3546 5.60456 15.25 4.5 15.25H2.00002C0.895453 15.25 0 14.3546 0 13.25V10.75C0 9.64541 0.895453 8.75 2.00002 8.75Z" fill="currentColor" />
              <path d="M19.5 17.5H22C23.1046 17.5 24 18.3955 24 19.5V22C24 23.1046 23.1046 24 22 24H19.5C18.3955 24 17.5 23.1046 17.5 22V19.5C17.5 18.3955 18.3955 17.5 19.5 17.5Z" fill="currentColor" />
              <path d="M10.75 17.5H13.25C14.3546 17.5 15.25 18.3955 15.25 19.5V22C15.25 23.1046 14.3546 24 13.25 24H10.75C9.64545 24 8.75 23.1046 8.75 22V19.5C8.75005 18.3955 9.64545 17.5 10.75 17.5Z" fill="currentColor" />
              <path d="M2.00002 17.5H4.5C5.60456 17.5 6.50002 18.3955 6.50002 19.5V22C6.50002 23.1046 5.60456 24 4.5 24H2.00002C0.895453 24 0 23.1046 0 22V19.5C0 18.3955 0.895453 17.5 2.00002 17.5Z" fill="currentColor" />
            </g>
          </svg>
        </a>
        <div className="breadcrumbdivider">//</div>
        <a href={isCreating ? '#' : `/opportunities/${initialData.slug}`} className="breadcrumbicon w-inline-block">
          <img src={logoSrc} loading="lazy" alt="" className="fullimage" />
        </a>
        <a href={isCreating ? '#' : `/opportunities/${initialData.slug}`} className="breadcrumblink">
          {title || 'Untitled Opportunity'}
        </a>
      </div>
      <div className="adminnav-links">
        <a href="#" aria-current="page" className="admin-navlink w-inline-block w--current">
          <div>Edit Opportunity</div>
        </a>
        <a
          href={isCreating ? '#' : `/admin/opportunities/${initialData.slug}/interest`}
          className="admin-navlink w-inline-block"
        >
          <div>Investor Interest</div>
        </a>
      </div>
      <div className="pagecontent lowtop">
        <div className="pagemain">
          <div className="herocard">
            <img
              src={thumbnailSrc}
              loading="lazy"
              sizes="100vw"
              alt=""
              className="fullimage"
            />
            <div className="herooverlay">
              <div className="herologo-row">
                <div className="herologo">
                  <img src={logoSrc} loading="lazy" alt="" className="fullimage" />
                </div>
                <div className="herocontent">
                  <div className="heroheading">{title || 'Opportunity Name'}</div>
                  <div className="herosubheading">{teaser || 'Short Description'}</div>
                  <div className="herostats-row">
                    <div className="alignrow">
                      {heroStats.targetRaise ? (
                        <div className="pillstat litebg">
                          <div>{heroStats.targetRaise}</div>
                        </div>
                      ) : null}
                      <div className="pillstat litebg">
                        <div>{heroStats.carry}</div>
                      </div>
                      <div className="pillstat litebg">
                        <div>{heroStats.managementFee}</div>
                      </div>
                      {heroStats.originationFee ? (
                        <div className="pillstat litebg">
                          <div>
                            <span className="dimish">Origination:</span> {heroStats.originationFee}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="statdivider" />
                    <div className="alignrow">
                      <div className="pillstat litebg">
                        <div>
                          <span className="dimish">Stage:</span> {heroStats.stage}
                        </div>
                      </div>
                      {heroStats.minimumCheck ? (
                        <div className="pillstat litebg">
                          <div>
                            <span className="dimish">Min:</span> {heroStats.minimumCheck}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="w-form">
            <form id="email-form-3" name="email-form-3" data-name="Email Form 3" onSubmit={handleFormSubmit}>
              <div className="rowcards">
                {sections.map((section) => (
                  <SectionCardEditor
                    key={section.id}
                    section={section}
                    uploadSlug={isCreating ? slugify(title) : initialData.slug}
                    onDirty={markDirty}
                    onUploadError={(message) => {
                      setSaveStatus('error');
                      setSaveMessage(message);
                    }}
                    onDelete={() => {
                      setSections((current) => current.filter((item) => item.id !== section.id));
                      markDirty();
                    }}
                    onDragStart={(event) => {
                      startRowDrag(event);
                      setDraggedSectionId(section.id);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedSectionId !== null) {
                        setSections((current) =>
                          reorderById(current, draggedSectionId, section.id),
                        );
                        setDraggedSectionId(null);
                        markDirty();
                      }
                    }}
                    onTypeChange={(type) => {
                      setSections((current) =>
                        current.map((item) => (item.id === section.id ? { ...item, type } : item)),
                      );
                      markDirty();
                    }}
                  />
                ))}
                <button
                  type="button"
                  className="bulkaction-button tall w-inline-block"
                  onClick={() => {
                    setSections((current) => [
                      ...current,
                      { id: nextSectionId, type: 'richContent' },
                    ]);
                    setNextSectionId((current) => current + 1);
                    markDirty();
                  }}
                >
                  <div>New Content Block</div>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="pageside wide">
          <div className="pagecard sidecard no-sticky">
            <div className="formblock w-form">
              <form id="email-form-4" name="email-form-4" data-name="Email Form 4" onSubmit={handleFormSubmit}>
                <div className="cardblock">
                  <div className="fieldblock">
                    <label htmlFor="opportunity-status" className="fieldlabel">
                      Status
                    </label>
                    <StatusDropdown
                      status={status}
                      onChange={(nextStatus) => {
                        setStatus(nextStatus);
                        markDirty();
                      }}
                    />
                    <input id="opportunity-status" type="hidden" value={status} readOnly />
                  </div>
                </div>

                <div className="cardblock">
                  <div>
                    <div className="sideheading">Opportunity Info</div>
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <input
                        className="formfields w-input"
                        maxLength={256}
                        name="Opportunity-Title"
                        data-name="Opportunity Title"
                        placeholder="Opportunity Name"
                        type="text"
                        id="Opportunity-Title"
                        value={title}
                        onChange={(event) => setTitle(event.currentTarget.value)}
                      />
                      <UploadPicker
                        className="thumbnailpicker wide"
                        imageSrc={thumbnailSrc}
                        label="Upload opportunity thumbnail"
                        onChange={(src, file) => handleOpportunityImageUpload(file, 'thumbnail', src)}
                      />
                      <UploadPicker
                        className="thumbnailpicker"
                        imageSrc={logoSrc}
                        label="Upload opportunity logo"
                        onChange={(src, file) => handleOpportunityImageUpload(file, 'logo', src)}
                      />
                    </div>
                    <textarea
                      id="Photos-Description"
                      name="Photos-Description"
                      maxLength={5000}
                      data-name="Photos Description"
                      placeholder="Short Description"
                      className="formfields _70 w-input"
                      value={teaser}
                      onChange={(event) => setTeaser(event.currentTarget.value)}
                    />
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <div className="formfields-block">
                        <div className="fieldlabel">Opportunity Sectors</div>
                        <OpportunitySectorDropdown
                          selectedSectors={selectedSectors}
                          onChange={(sectors) => {
                            setSelectedSectors(sectors);
                            markDirty();
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <div className="formfields-block">
                        <div className="fieldlabel">Opportunity Stage</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Stage"
                          data-name="Stage"
                          placeholder="e.g. Pre-Seed"
                          type="text"
                          value={stage}
                          onChange={(event) => setStage(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <div className="formfields-block">
                        <div className="fieldlabel">Amount to be Raised</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Target-Raise"
                          data-name="Target Raise"
                          placeholder="e.g. $2,500,000"
                          type="text"
                          inputMode="numeric"
                          value={targetRaise}
                          onChange={(event) => setTargetRaise(formatCurrencyInput(event.currentTarget.value))}
                        />
                      </div>
                      <div className="formfields-block">
                        <div className="fieldlabel">Minimum Check Size</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Minimum-Check"
                          data-name="Minimum Check"
                          placeholder="e.g. $100,000"
                          type="text"
                          inputMode="numeric"
                          value={minimumCheck}
                          onChange={(event) => setMinimumCheck(formatCurrencyInput(event.currentTarget.value))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <div className="formfields-block">
                        <div className="fieldlabel">Carry %</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Carry"
                          data-name="Carry"
                          placeholder="e.g. 15%"
                          type="text"
                          inputMode="decimal"
                          value={carry}
                          onChange={(event) => setCarry(formatPercentInput(event.currentTarget.value))}
                        />
                      </div>
                      <div className="formfields-block">
                        <div className="fieldlabel">Management Fee</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Management-Fee"
                          data-name="Management Fee"
                          placeholder="e.g. 25%"
                          type="text"
                          inputMode="decimal"
                          value={managementFee}
                          onChange={(event) => setManagementFee(formatPercentInput(event.currentTarget.value))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <div className="formfields-block">
                        <div className="fieldlabel">Origination Fee</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Origination-Fee"
                          data-name="Origination Fee"
                          placeholder="e.g. $250,000"
                          type="text"
                          inputMode="numeric"
                          value={originationFee}
                          onChange={(event) => setOriginationFee(formatCurrencyInput(event.currentTarget.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cardblock">
                  <div>
                    <div className="sideheading">Links and Socials</div>
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <div className="formfields-block">
                        <div className="fieldlabel">Website</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Website-Url"
                          data-name="Website URL"
                          placeholder="https://company.com"
                          type="url"
                          value={websiteUrl}
                          onChange={(event) => setWebsiteUrl(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <div className="formfields-block">
                        <div className="fieldlabel">LinkedIn</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="LinkedIn-Url"
                          data-name="LinkedIn URL"
                          placeholder="https://linkedin.com/company/name"
                          type="url"
                          value={linkedinUrl}
                          onChange={(event) => setLinkedinUrl(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="contentheader">
                    <div className="alignrow aligncenter">
                      <div className="formfields-block">
                        <div className="fieldlabel">Twitter / X</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Twitter-Url"
                          data-name="Twitter URL"
                          placeholder="https://x.com/username"
                          type="url"
                          value={twitterUrl}
                          onChange={(event) => setTwitterUrl(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cardblock">
                  <div>
                    <div className="sideheading">Opportunity Settings</div>
                  </div>
                  <div className="fieldblock">
                    <CheckboxRow
                      label="Require NDA"
                      checked={ndaRequired}
                      onChange={(checked) => {
                        setNdaRequired(checked);
                        markDirty();
                      }}
                    />
                  </div>
                  <div className="fieldblock">
                    <CheckboxRow
                      label="Watermark"
                      checked={watermarkEnabled}
                      onChange={(checked) => {
                        setWatermarkEnabled(checked);
                        markDirty();
                      }}
                    />
                  </div>
                  <div className="fieldblock">
                    <CheckboxRow
                      label="Password protected"
                      checked={passwordProtected}
                      onChange={(checked) => {
                        setPasswordProtected(checked);
                        markDirty();
                      }}
                    />
                    {passwordProtected ? (
                      <div className="formfields-block spacetop">
                        <div className="fieldlabel">Password</div>
                        <input
                          className="formfields w-input"
                          maxLength={256}
                          name="Opportunity-Password"
                          data-name="Opportunity Password"
                          placeholder="e.g. dealio"
                          type="text"
                          value={password}
                          onChange={(event) => setPassword(event.currentTarget.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </form>
              <div className="w-form-done">
                <div>Thank you! Your submission has been received!</div>
              </div>
              <div className="w-form-fail">
                <div>Oops! Something went wrong while submitting the form.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="floating-savebar editor-savebar-card">
        <div className="floating-savebar-status editor-savebar-status">
          {saveStatus === 'dirty'
            ? 'Unsaved changes'
            : saveStatus === 'saving'
              ? 'Saving...'
            : saveStatus === 'saved'
              ? 'Changes Saved'
              : saveStatus === 'error'
                ? saveMessage || 'Save failed'
                : 'No changes yet'}
        </div>
        <div className="editor-savebar-actions">
          <button
            type="button"
            className="button short editor-savebar-button w-inline-block"
            disabled={!canSave}
            onClick={handleSave}
          >
            <div>Save Changes</div>
          </button>
          <a
            href={isCreating ? '#' : `/opportunities/${initialData.slug}`}
            className="button short preview-button editor-savebar-button editor-savebar-preview-button w-inline-block"
          >
            <div>Preview</div>
          </a>
        </div>
      </div>
    </div>
  );
}
