'use client';

import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
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

type OpportunityStatus = 'draft' | 'potential' | 'active' | 'past';
type SectionType = 'richContent' | 'links' | 'media' | 'documents' | 'team' | 'investors';
type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

type SectionCard = {
  id: number;
  type: SectionType;
};

export type OpportunityEditorInitialData = {
  slug: string;
  opportunity?: {
    status: OpportunityStatus;
    title: string;
    teaser: string | null;
    stage: string | null;
    targetAllocationCents: number | string | null;
    minimumInvestmentCents: number | string | null;
    carryPercentageBasisPoints: number | null;
    managementFeeBasisPoints: number | null;
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
  onDragOver,
  onDragStart,
  onDrop,
  onTypeChange,
}: {
  section: SectionCard;
  onDelete: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onTypeChange: (type: SectionType) => void;
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
        {open ? (
          <div className="contentsettings-drawer">
            {section.type === 'richContent' ? (
              <RichTextDrawer />
            ) : section.type === 'links' ? (
              <LinksDrawer />
            ) : section.type === 'documents' ? (
              <DocumentsDrawer />
            ) : section.type === 'team' ? (
              <PeopleDrawer kind="team" />
            ) : section.type === 'investors' ? (
              <PeopleDrawer kind="investors" />
            ) : (
              <MediaDrawer />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionIntroFields({ prefix }: { prefix: string }) {
  return (
    <div className="contentheader">
      <input
        className="formfields w-input"
        maxLength={256}
        name={`${prefix}-Title`}
        data-name={`${prefix} Title`}
        placeholder="Title (Optional)"
        type="text"
      />
      <textarea
        name={`${prefix}-Description`}
        maxLength={5000}
        data-name={`${prefix} Description`}
        placeholder="Short Description (Optional)"
        className="formfields _70 w-input"
      />
    </div>
  );
}

function UploadButton({ label }: { label: string }) {
  return (
    <button type="button" className="thumbnailpicker" aria-label={label}>
      <UploadIcon />
    </button>
  );
}

function LinksDrawer() {
  const [items, setItems] = useState<RepeaterItem[]>([{ id: 1 }]);
  const [nextId, setNextId] = useState(2);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  return (
    <div content-type="links" className="contenttype-block">
      <SectionIntroFields prefix="Links" />
      {items.map((item) => (
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
                <UploadButton label="Upload link thumbnail" />
                <input
                  className="formfields w-input"
                  maxLength={256}
                  name="Link-Title"
                  data-name="Link Title"
                  placeholder="Title"
                  type="text"
                />
              </div>
              <input
                className="formfields urlfield w-input"
                maxLength={256}
                name="Link-Url"
                data-name="Link URL"
                placeholder="Content link"
                type="url"
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

function DocumentsDrawer() {
  const [items, setItems] = useState<RepeaterItem[]>([{ id: 1 }]);
  const [nextId, setNextId] = useState(2);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  return (
    <div content-type="documents" className="contenttype-block">
      <SectionIntroFields prefix="Documents" />
      {items.map((item) => (
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
                <UploadButton label="Upload document" />
                <input
                  className="formfields w-input"
                  maxLength={256}
                  name="Document-Title"
                  data-name="Document Title"
                  placeholder="Document Title"
                  type="text"
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

function SocialRows({ prefix }: { prefix: string }) {
  const [socials, setSocials] = useState([
    { label: 'Website', className: 'socialicons socials dark' },
    { label: 'LinkedIn', className: 'socialicons socials linkedin' },
    { label: 'X / Twitter', className: 'socialicons socials x' },
  ]);
  const [draggedLabel, setDraggedLabel] = useState<string | null>(null);

  return (
    <div className="rowcards wrapped">
      {socials.map((social) => (
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
              <SectionIcon />
            </div>
            <div className="prompt-block">
              <input
                className="formfields-3 w-input"
                maxLength={256}
                name={`${prefix}-${social.label}-Url`}
                data-name={`${prefix} ${social.label} URL`}
                placeholder="facebook.com/company"
                type="url"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalloutRows({
  item,
  label,
  nextCalloutId,
  setItems,
  setNextCalloutId,
}: {
  item: PersonItem;
  label: string;
  nextCalloutId: number;
  setItems: Dispatch<SetStateAction<PersonItem[]>>;
  setNextCalloutId: Dispatch<SetStateAction<number>>;
}) {
  const [draggedCalloutId, setDraggedCalloutId] = useState<number | null>(null);

  return (
    <div className="rowcards wrapped">
      {item.calloutIds.map((calloutId) => (
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
                name={`${label}-Callout`}
                data-name={`${label} Callout`}
                placeholder="e.g. PHD, Stanford"
                type="text"
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

function PeopleDrawer({ kind }: { kind: 'team' | 'investors' }) {
  const [items, setItems] = useState<PersonItem[]>([{ id: 1, calloutIds: [1] }]);
  const [nextId, setNextId] = useState(2);
  const [nextCalloutId, setNextCalloutId] = useState(2);
  const [draggedPersonId, setDraggedPersonId] = useState<number | null>(null);
  const label = kind === 'team' ? 'Team Member' : 'Investor';
  const sectionLabel = kind === 'team' ? 'Team' : 'Investors';

  return (
    <div content-type={kind} className="contenttype-block">
      <SectionIntroFields prefix={sectionLabel} />
      {items.map((item) => (
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
                <UploadButton label={`Upload ${label.toLowerCase()} image`} />
                <input
                  className="formfields w-input"
                  maxLength={256}
                  name={`${label}-Name`}
                  data-name={`${label} Name`}
                  placeholder="Name"
                  type="text"
                />
              </div>
              <input
                className="formfields w-input"
                maxLength={256}
                name={`${label}-Title`}
                data-name={`${label} Title`}
                placeholder="Title"
                type="text"
              />
              <SocialRows prefix={`${label}-${item.id}`} />
              <CalloutRows
                item={item}
                label={label}
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
      ))}
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

function MediaDrawer() {
  return (
    <div content-type="media" className="contenttype-block">
      <SectionIntroFields prefix="Media" />
      <div className="rowcard withdrag">
        <div className="alignrow aligncenter stretch middle">
          <DragHandle />
          <div className="prompt-block">
            <div className="alignrow aligncenter">
              <UploadButton label="Upload media" />
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

function RichTextDrawer() {
  const [bodyJson, setBodyJson] = useState('');
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: '',
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

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const label = Number.isInteger(millions) ? millions.toString() : millions.toFixed(1);
    return `$${label} Million`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return value || '$0';
}

function compactMinAmount(value: string) {
  const amount = moneyToNumber(value);

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const label = Number.isInteger(millions) ? millions.toString() : millions.toFixed(1);
    return `$${label}M`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return value || '$0';
}

function percentLabel(value: string) {
  return value.trim() || '0%';
}

function managementFeeLabel(value: string) {
  return value.trim() ? `${percentLabel(value)} Fee` : 'No Fee';
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
  const rootRef = useRef<HTMLDivElement>(null);
  const initialOpportunity = initialData.opportunity;
  const [status, setStatus] = useState<OpportunityStatus>(initialOpportunity?.status ?? 'draft');
  const [title, setTitle] = useState(initialOpportunity?.title ?? 'Frontier Security');
  const [teaser, setTeaser] = useState(
    initialOpportunity?.teaser ?? 'AI operating system for enterprise security operations',
  );
  const [stage, setStage] = useState(initialOpportunity?.stage ?? 'Pre-Seed');
  const [targetRaise, setTargetRaise] = useState(
    centsToCurrencyInput(initialOpportunity?.targetAllocationCents) || '$2,500,000',
  );
  const [minimumCheck, setMinimumCheck] = useState(
    centsToCurrencyInput(initialOpportunity?.minimumInvestmentCents) || '$100,000',
  );
  const [carry, setCarry] = useState(
    basisPointsToPercentInput(initialOpportunity?.carryPercentageBasisPoints) || '15%',
  );
  const [managementFee, setManagementFee] = useState(
    basisPointsToPercentInput(initialOpportunity?.managementFeeBasisPoints),
  );
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
    })) ?? [];
  const [sections, setSections] = useState<SectionCard[]>(initialSections);
  const [nextSectionId, setNextSectionId] = useState(initialSections.length + 1);
  const [draggedSectionId, setDraggedSectionId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('');

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
      slug: initialData.slug,
      status,
      title,
      teaser,
      stage,
      targetRaise,
      minimumCheck,
      carry,
      managementFee,
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
    formData.set('slug', initialData.slug);
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
      carry: `${percentLabel(carry)} Carry`,
      managementFee: managementFeeLabel(managementFee),
      stage: stage.trim() || 'Stage',
    }),
    [carry, managementFee, minimumCheck, stage, targetRaise],
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
        <a href={`/opportunities/${initialData.slug}`} className="breadcrumbicon w-inline-block">
          <img src={logoSrc} loading="lazy" alt="" className="fullimage" />
        </a>
        <a href={`/opportunities/${initialData.slug}`} className="breadcrumblink">
          {title || 'Untitled Opportunity'}
        </a>
      </div>
      <div className="adminnav-links">
        <a href="#" aria-current="page" className="admin-navlink w-inline-block w--current">
          <div>Edit Opportunity</div>
        </a>
        <a href="#" className="admin-navlink w-inline-block">
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
                      <div className="pillstat litebg">
                        <div>{heroStats.targetRaise}</div>
                      </div>
                      <div className="pillstat litebg">
                        <div>{heroStats.carry}</div>
                      </div>
                      <div className="pillstat litebg">
                        <div>{heroStats.managementFee}</div>
                      </div>
                    </div>
                    <div className="statdivider" />
                    <div className="alignrow">
                      <div className="pillstat litebg">
                        <div>
                          <span className="dimish">Stage:</span> {heroStats.stage}
                        </div>
                      </div>
                      <div className="pillstat litebg">
                        <div>
                          <span className="dimish">Min:</span> {heroStats.minimumCheck}
                        </div>
                      </div>
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
      <div className="floating-savebar">
        <div className="floating-savebar-status">
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
        <button
          type="button"
          className="button short w-inline-block"
          disabled={saveStatus === 'saving'}
          onClick={handleSave}
        >
          <div>Save Changes</div>
        </button>
        <a
          href={`/opportunities/${initialData.slug}`}
          className="button short preview-button w-inline-block"
        >
          <div>Preview</div>
        </a>
      </div>
    </div>
  );
}
