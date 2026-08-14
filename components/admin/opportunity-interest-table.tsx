'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  addInterestNote,
  sendInterestCrmEmails,
  updateInterestConfirmedAmount,
  updateInterestOwner,
  updateInterestPipelineStatus,
  updateInterestPriority,
} from '@/app/admin/opportunities/[opportunityId]/interest/actions';
import {
  AUTHOR_NOTE_STYLES,
  CLOSING_EMAIL_TEMPLATE,
  EMAIL_VARIABLES,
  INTEREST_PIPELINE_STATUS_OPTIONS,
  INTEREST_PRIORITIES,
  PIPELINE_STATUS_LABELS,
  PIPELINE_STATUS_PILL,
  PRIORITY_LABELS,
  PRIORITY_PILL,
  colorForProfileId,
  firstNameFromLabel,
  formatDateTimeLabel,
  formatUsdFromCents,
  formatUsdInput,
  formatUsdSumFromCents,
  initialsForLabel,
  isPipelineStatus,
  isPriority,
  teamMemberLabel,
  type InterestCrmNote,
  type InterestCrmRow,
  type InterestCrmTeamMember,
  type InterestPipelineStatus,
  type InterestPriority,
} from '@/lib/interest-crm';

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" className="checkicon">
      <g fill="none" fillRule="evenodd">
        <path
          fill="currentColor"
          d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0Z"
        />
      </g>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="gridrow-icon lg">
      <path d="M20 5.5L12 13L4 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="5" width="18" height="14" rx="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type MoneySortField = 'amountCents' | 'confirmedAmountCents';
type SortDirection = 'asc' | 'desc';
type MoneySort = { field: MoneySortField; direction: SortDirection };

function pillClass(extra?: string) {
  return extra ? `cellpill ${extra}` : 'cellpill';
}

function MoneySortHeader({
  label,
  field,
  sort,
  onToggle,
}: {
  label: string;
  field: MoneySortField;
  sort: MoneySort | null;
  onToggle: (field: MoneySortField) => void;
}) {
  const active = sort?.field === field;
  const ariaSort = active ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none';

  return (
    <button
      type="button"
      className="tablecell header speevy-sort-cell"
      onClick={() => onToggle(field)}
      aria-label={`Sort by ${label}`}
      aria-sort={ariaSort}
    >
      <span className="speevy-table-sort-button">
        <span>{label}</span>
        <span className="speevy-sort-indicator" aria-hidden="true">
          {active ? (sort.direction === 'desc' ? '↓' : '↑') : '↕'}
        </span>
      </span>
    </button>
  );
}

const EMAIL_VARIABLE_PATTERN = new RegExp(
  EMAIL_VARIABLES.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g',
);

function escapeEmailHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function highlightEmailBody(text: string) {
  EMAIL_VARIABLE_PATTERN.lastIndex = 0;
  return escapeEmailHtml(text)
    .replace(EMAIL_VARIABLE_PATTERN, '<span class="variablecallout email-variable">$&</span>')
    .replaceAll('\n', '<br>');
}

function isEmailBlock(node: Node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = (node as HTMLElement).tagName;
  return tag === 'DIV' || tag === 'P';
}

function serializeEmailBody(root: HTMLElement) {
  const pieces: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      pieces.push((node.textContent ?? '').replaceAll('\u00a0', ' '));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    if (el.tagName === 'BR') {
      const parent = el.parentNode;
      const filler = parent !== root && parent !== null && isEmailBlock(parent) && parent.childNodes.length === 1;
      if (!filler) pieces.push('\n');
      return;
    }

    if (isEmailBlock(el) && pieces.join('').length > 0) {
      pieces.push('\n');
    }

    for (const child of el.childNodes) walk(child);
  }

  for (const child of root.childNodes) walk(child);

  if (!(root.textContent ?? '').replaceAll('\u00a0', '')) return '';
  return pieces.join('');
}

function offsetFromRange(root: HTMLElement, range: Range, startEdge: boolean) {
  const pre = document.createRange();
  pre.selectNodeContents(root);
  try {
    if (startEdge) pre.setEnd(range.startContainer, range.startOffset);
    else pre.setEnd(range.endContainer, range.endOffset);
  } catch {
    return serializeEmailBody(root).length;
  }

  const holder = document.createElement('div');
  holder.appendChild(pre.cloneContents());
  return serializeEmailBody(holder).length;
}

function caretOffsets(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) {
    const length = serializeEmailBody(root).length;
    return { start: length, end: length };
  }

  const range = selection.getRangeAt(0);
  const start = offsetFromRange(root, range, true);
  return {
    start,
    end: range.collapsed ? start : offsetFromRange(root, range, false),
  };
}

function setCaretOffset(root: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let remaining = offset;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
      remaining -= length;
      continue;
    }

    if ((node as HTMLElement).tagName !== 'BR') continue;
    if (remaining <= 0) {
      const range = document.createRange();
      range.setStartBefore(node);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    remaining -= 1;
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

type EmailBodyEditorHandle = {
  insertToken: (token: string) => void;
  getPlainText: () => string;
};

const EmailBodyEditor = forwardRef<EmailBodyEditorHandle, {
  value: string;
  onChange: (value: string) => void;
}>(function EmailBodyEditor({ value, onChange }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const pendingFocusRef = useRef(false);
  const composingRef = useRef(false);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    el.innerHTML = value ? highlightEmailBody(value) : '<br>';

    if (pendingCaretRef.current === null) return;
    if (pendingFocusRef.current) {
      el.focus();
      pendingFocusRef.current = false;
    }
    setCaretOffset(el, pendingCaretRef.current);
    pendingCaretRef.current = null;
  }, [value]);

  useImperativeHandle(ref, () => ({
    insertToken(token: string) {
      const el = rootRef.current;
      let start = value.length;
      let end = value.length;

      if (el) {
        const selection = window.getSelection();
        const hasCaret = Boolean(selection && selection.rangeCount > 0 && el.contains(selection.anchorNode));
        if (hasCaret) {
          const offsets = caretOffsets(el);
          start = Math.max(0, Math.min(offsets.start, value.length));
          end = Math.max(start, Math.min(offsets.end, value.length));
        }
      }

      pendingCaretRef.current = start + token.length;
      pendingFocusRef.current = true;
      onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    },
    getPlainText() {
      const el = rootRef.current;
      return el ? serializeEmailBody(el) : value;
    },
  }), [onChange, value]);

  function handleInput() {
    const el = rootRef.current;
    if (!el || composingRef.current) return;
    pendingCaretRef.current = caretOffsets(el).start;
    onChange(serializeEmailBody(el));
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }

  return (
    <div
      ref={rootRef}
      className="emailarea-input"
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-label="Email body"
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
        handleInput();
      }}
      onBeforeInput={(event) => {
        if (event.nativeEvent.inputType.startsWith('format')) event.preventDefault();
      }}
    />
  );
});

function FilterDropdown({
  label,
  selectedCount,
  children,
}: {
  label: string;
  selectedCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div className={`dropdownwrapper${open ? ' open' : ''}`} ref={rootRef}>
      <button type="button" className="dropdownbutton" onClick={() => setOpen((value) => !value)}>
        <div>{label}</div>
        <div className={`filterpill-selected${selectedCount ? '' : ' hide'}`}>
          <div>{selectedCount}</div>
        </div>
      </button>
      <div className="dropdownselector">
        <div className="linedivider-label">
          <div>
            {selectedCount} <span className="dim-2">Selected</span>
          </div>
          <div className="linedivider-2" />
        </div>
        <div className="filtersrow">{children}</div>
      </div>
    </div>
  );
}

export function OpportunityInterestTable({
  opportunitySlug,
  opportunityTitle,
  rows,
  teamMembers,
  currentAdmin,
}: {
  opportunitySlug: string;
  opportunityTitle: string;
  rows: InterestCrmRow[];
  teamMembers: InterestCrmTeamMember[];
  currentAdmin: InterestCrmTeamMember;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState(rows);
  const [query, setQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<InterestPipelineStatus[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<InterestPriority[]>([]);
  const [ownerFilters, setOwnerFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<MoneySort | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailBody, setEmailBody] = useState(CLOSING_EMAIL_TEMPLATE);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const emailEditorRef = useRef<EmailBodyEditorHandle>(null);

  useEffect(() => {
    setItems(rows);
  }, [rows]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((row) => {
      if (statusFilters.length && !statusFilters.includes(row.pipelineStatus)) return false;
      if (priorityFilters.length && (!row.priority || !priorityFilters.includes(row.priority))) return false;
      if (ownerFilters.length && (!row.ownerProfileId || !ownerFilters.includes(row.ownerProfileId))) return false;
      if (!needle) return true;
      return [row.investorName, row.investorEmail, row.entityName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });

    if (!sort) return filtered;

    return [...filtered].sort((left, right) => {
      if (sort.field === 'confirmedAmountCents') {
        const leftEmpty = left.confirmedAmountCents == null;
        const rightEmpty = right.confirmedAmountCents == null;
        if (leftEmpty !== rightEmpty) {
          if (sort.direction === 'desc') return leftEmpty ? 1 : -1;
          return leftEmpty ? -1 : 1;
        }
        const leftValue = left.confirmedAmountCents ?? 0;
        const rightValue = right.confirmedAmountCents ?? 0;
        return sort.direction === 'desc' ? rightValue - leftValue : leftValue - rightValue;
      }

      return sort.direction === 'desc'
        ? right.amountCents - left.amountCents
        : left.amountCents - right.amountCents;
    });
  }, [items, ownerFilters, priorityFilters, query, sort, statusFilters]);

  const visibleIds = visibleItems.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const selectedRows = items.filter((row) => selectedIds.includes(row.id));
  const totalInterestCents = visibleItems.reduce((sum, row) => sum + row.amountCents, 0);
  const totalConfirmedCents = visibleItems.reduce((sum, row) => sum + (row.confirmedAmountCents ?? 0), 0);

  function runAction(nextItems: InterestCrmRow[], action: () => Promise<{ status: 'success' } | { status: 'error'; message: string }>) {
    setError(null);
    setItems(nextItems);
    startTransition(async () => {
      const result = await action();
      if (result.status === 'error') {
        setItems(rows);
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function toggleId(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function toggleFilter<T extends string>(value: T, selected: T[], setSelected: (next: T[]) => void) {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  function toggleSort(field: MoneySortField) {
    setSort((current) => {
      if (current?.field !== field) return { field, direction: 'desc' };
      return { field, direction: current.direction === 'desc' ? 'asc' : 'desc' };
    });
  }

  return (
    <>
      <div className="tableheader">
        <div className="pagetitle">Interested Investors</div>
      </div>

      <div className="filterheader">
        <div className="alignrow aligncenter">
          <div className="searchform-block w-form">
            <input
              className="searchfield w-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search investors"
            />
          </div>
          <div className="textdivider" />
          <FilterDropdown label="Status" selectedCount={statusFilters.length}>
            {INTEREST_PIPELINE_STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                className={`filterspill${statusFilters.includes(status) ? ' selected' : ''}`}
                onClick={() => toggleFilter(status, statusFilters, setStatusFilters)}
              >
                <div>{PIPELINE_STATUS_LABELS[status]}</div>
              </button>
            ))}
          </FilterDropdown>
          <FilterDropdown label="Priority" selectedCount={priorityFilters.length}>
            {INTEREST_PRIORITIES.map((priority) => (
              <button
                key={priority}
                type="button"
                className={`filterspill${priorityFilters.includes(priority) ? ' selected' : ''}`}
                onClick={() => toggleFilter(priority, priorityFilters, setPriorityFilters)}
              >
                <div>{PRIORITY_LABELS[priority]}</div>
              </button>
            ))}
          </FilterDropdown>
          <FilterDropdown label="Owner" selectedCount={ownerFilters.length}>
            {teamMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`filterspill${ownerFilters.includes(member.id) ? ' selected' : ''}`}
                onClick={() => toggleFilter(member.id, ownerFilters, setOwnerFilters)}
              >
                <div>{firstNameFromLabel(teamMemberLabel(member))}</div>
              </button>
            ))}
          </FilterDropdown>
        </div>
        <div className="alignrow aligncenter rightalign">
          <div className="dropdownwrapper">
            <button
              type="button"
              className="dropdownbutton action"
              disabled={selectedIds.length === 0}
              onClick={() => setEmailOpen(true)}
            >
              <EmailIcon />
              <div>Send Email</div>
            </button>
          </div>
        </div>
      </div>

      <div className="contenttable tooltip-table speevy-interest-crm-table">
        <div className="tablerow headerrow">
          <div className="tablecell first header">
            <div className="interestchecks-row">
              <button
                type="button"
                className={`checkboxtoggle sm${allVisibleSelected ? ' checked' : ''}`}
                aria-label={allVisibleSelected ? 'Deselect all investors' : 'Select all investors'}
                onClick={toggleAllVisible}
              >
                {allVisibleSelected ? <CheckIcon /> : null}
              </button>
            </div>
            <div>Investor</div>
          </div>
          <MoneySortHeader label="Interest $" field="amountCents" sort={sort} onToggle={toggleSort} />
          <MoneySortHeader label="Confirmed $" field="confirmedAmountCents" sort={sort} onToggle={toggleSort} />
          <div className="tablecell header"><div>Status</div></div>
          <div className="tablecell header"><div>Priority</div></div>
          <div className="tablecell header"><div>Owner</div></div>
          <div className="tablecell last"><div>Notes</div></div>
        </div>

        {visibleItems.length ? visibleItems.map((item) => {
          const selected = selectedIds.includes(item.id);
          const latestNote = item.notes.at(-1);
          return (
            <div className={`tablerow${selected ? ' selected' : ''}`} key={item.id}>
              <div className="tablecell first">
                <div className="interestchecks-row">
                  <button
                    type="button"
                    className={`checkboxtoggle sm${selected ? ' checked' : ''}`}
                    aria-label={`Select ${item.investorName}`}
                    onClick={() => toggleId(item.id)}
                  >
                    {selected ? <CheckIcon /> : null}
                  </button>
                </div>
                <a href={`/admin/investors?investor=${item.lpId}`} className="oppicon w-inline-block">
                  {item.photoUrl ? <img src={item.photoUrl} alt="" className="fullimage" /> : <div>{initialsForLabel(item.investorName)}</div>}
                </a>
                <div>
                  <div className="cellname">{item.investorName}</div>
                  <div className="cellsub">{item.entityName || item.investorEmail}</div>
                </div>
              </div>
              <div className="tablecell interest-crm-hover-cell">
                <div className="interest-crm-cell-fill">
                  <div className="speevy-tooltip" aria-label={`Indicated ${formatDateTimeLabel(item.indicatedAt)}`}>
                    <div>{formatUsdFromCents(item.amountCents)}</div>
                    <div className="speevy-tooltip-panel" role="tooltip">
                      Indicated {formatDateTimeLabel(item.indicatedAt)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="tablecell interest-crm-hover-cell">
                <ConfirmedAmountEditor
                  row={item}
                  disabled={isPending}
                  onSave={(amount) => {
                    const cents = amount.replace(/[^\d]/g, '');
                    const confirmedAmountCents = cents ? Number(cents) * 100 : null;
                    runAction(
                      items.map((row) =>
                        row.id === item.id
                          ? {
                              ...row,
                              confirmedAmountCents,
                              confirmedByName: confirmedAmountCents === null ? null : teamMemberLabel(currentAdmin),
                              confirmedAt: confirmedAmountCents === null ? null : new Date().toISOString(),
                            }
                          : row,
                      ),
                      () => updateInterestConfirmedAmount({
                        interestId: item.id,
                        opportunitySlug,
                        amount,
                      }),
                    );
                  }}
                />
              </div>
              <div className="tablecell interest-crm-hover-cell">
                <StatusPicker
                  status={item.pipelineStatus}
                  disabled={isPending}
                  onChange={(pipelineStatus) => {
                    runAction(
                      items.map((row) => (row.id === item.id ? { ...row, pipelineStatus } : row)),
                      () => updateInterestPipelineStatus({
                        interestId: item.id,
                        opportunitySlug,
                        pipelineStatus,
                      }),
                    );
                  }}
                />
              </div>
              <div className="tablecell interest-crm-hover-cell">
                <PriorityPicker
                  priority={item.priority}
                  disabled={isPending}
                  onChange={(priority) => {
                    runAction(
                      items.map((row) => (row.id === item.id ? { ...row, priority } : row)),
                      () => updateInterestPriority({
                        interestId: item.id,
                        opportunitySlug,
                        priority,
                      }),
                    );
                  }}
                />
              </div>
              <div className="tablecell interest-crm-hover-cell">
                <OwnerPicker
                  ownerProfileId={item.ownerProfileId}
                  ownerName={item.ownerName}
                  teamMembers={teamMembers}
                  disabled={isPending}
                  onChange={(ownerProfileId) => {
                    const owner = teamMembers.find((member) => member.id === ownerProfileId) ?? null;
                    runAction(
                      items.map((row) =>
                        row.id === item.id
                          ? {
                              ...row,
                              ownerProfileId,
                              ownerName: owner ? teamMemberLabel(owner) : null,
                            }
                          : row,
                      ),
                      () => updateInterestOwner({
                        interestId: item.id,
                        opportunitySlug,
                        ownerProfileId,
                      }),
                    );
                  }}
                />
              </div>
              <div className="tablecell last interest-crm-hover-cell">
                <NotesEditor
                  row={item}
                  latestNote={latestNote ?? null}
                  disabled={isPending}
                  currentAdmin={currentAdmin}
                  onAdd={(body) => {
                    const optimisticNote: InterestCrmNote = {
                      id: `temp-${Date.now()}`,
                      body,
                      createdAt: new Date().toISOString(),
                      authorProfileId: currentAdmin.id,
                      authorName: teamMemberLabel(currentAdmin),
                    };
                    runAction(
                      items.map((row) =>
                        row.id === item.id ? { ...row, notes: [...row.notes, optimisticNote] } : row,
                      ),
                      () => addInterestNote({
                        interestId: item.id,
                        opportunitySlug,
                        body,
                      }),
                    );
                  }}
                />
              </div>
            </div>
          );
        }) : (
          <div className="tablerow">
            <div className="tablecell first header">
              <div>No investor interest yet.</div>
            </div>
            <div className="tablecell header" />
            <div className="tablecell header" />
            <div className="tablecell header" />
            <div className="tablecell header" />
            <div className="tablecell header" />
            <div className="tablecell last" />
          </div>
        )}

        {visibleItems.length ? (
          <div className="tablerow footerrow">
            <div className="tablecell first header">
              <div>{visibleItems.length} {visibleItems.length === 1 ? 'investor' : 'investors'}</div>
            </div>
            <div className="tablecell header"><div>{formatUsdSumFromCents(totalInterestCents)}</div></div>
            <div className="tablecell header"><div>{formatUsdSumFromCents(totalConfirmedCents)}</div></div>
            <div className="tablecell header" />
            <div className="tablecell header" />
            <div className="tablecell header" />
            <div className="tablecell last" />
          </div>
        ) : null}
      </div>

      {error ? <div className="speevy-form-message error">{error}</div> : null}

      <div
        className={`modalwrapper${emailOpen ? ' open' : ''}`}
        onClick={() => setEmailOpen(false)}
        role="presentation"
      >
        <div className="emailmodal" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Send email">
          <div className="emailcolumn">
            <form
              className="formblock w-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedRows.length) return;
                setEmailMessage(null);
                startTransition(async () => {
                  const result = await sendInterestCrmEmails({
                    opportunitySlug,
                    interestIds: selectedRows.map((row) => row.id),
                    body: emailEditorRef.current?.getPlainText() ?? emailBody,
                  });
                  if (result.status === 'error') {
                    setEmailMessage(result.message);
                    return;
                  }
                  setEmailMessage(`Sent to ${result.sent} investor${result.sent === 1 ? '' : 's'}.`);
                });
              }}
            >
              <div className="emailarea">
                <EmailBodyEditor ref={emailEditorRef} value={emailBody} onChange={setEmailBody} />
              </div>
              <input
                type="submit"
                className="button sendbutton w-button"
                value={isPending ? 'Sending…' : 'Send Email'}
                disabled={isPending || selectedRows.length === 0}
              />
              {emailMessage ? <div className="speevy-form-message">{emailMessage}</div> : null}
            </form>
          </div>
          <div className="emailside-col">
            <div>
              <div className="linedivider-label">
                <div>Variables</div>
                <div className="linedivider-3" />
              </div>
              <div className="alignrow wrap">
                {EMAIL_VARIABLES.map((token) => (
                  <button
                    key={token}
                    type="button"
                    className="pillselect"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => emailEditorRef.current?.insertToken(token)}
                  >
                    <div>{token}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="linedivider-label">
                <div>Templates</div>
                <div className="linedivider-3" />
              </div>
              <div className="alignrow">
                <button type="button" className="pillselect" onClick={() => setEmailBody(CLOSING_EMAIL_TEMPLATE)}>
                  <div>Closing</div>
                </button>
              </div>
            </div>
            <div className="sendingto">
              <div className="linedivider-label">
                <div>Sending to</div>
                <div className="linedivider-3" />
              </div>
              <div className="alignrow sendingto-emails">
                {selectedRows.length ? selectedRows.map((row) => (
                  <div className="cellpill sendto" key={row.id}>
                    <div>{row.investorName}</div>
                    <div className="subemail">{row.entityName || row.investorEmail}</div>
                  </div>
                )) : (
                  <div className="dim">Select investors with the checkboxes.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatusPicker({
  status,
  disabled,
  onChange,
}: {
  status: InterestPipelineStatus;
  disabled: boolean;
  onChange: (status: InterestPipelineStatus) => void;
}) {
  return (
    <RowMenu
      disabled={disabled}
      trigger={(
        <div className={pillClass(PIPELINE_STATUS_PILL[status])}>
          <div>{PIPELINE_STATUS_LABELS[status]}</div>
        </div>
      )}
    >
      {INTEREST_PIPELINE_STATUS_OPTIONS.map((value) => (
        <button
          key={value}
          type="button"
          className={pillClass(PIPELINE_STATUS_PILL[value])}
          onClick={() => {
            if (isPipelineStatus(value) && value !== status) onChange(value);
          }}
        >
          <div>{PIPELINE_STATUS_LABELS[value]}</div>
        </button>
      ))}
    </RowMenu>
  );
}

function PriorityPicker({
  priority,
  disabled,
  onChange,
}: {
  priority: InterestPriority | null;
  disabled: boolean;
  onChange: (priority: InterestPriority | null) => void;
}) {
  return (
    <RowMenu
      disabled={disabled}
      trigger={priority ? (
        <div className={pillClass(PRIORITY_PILL[priority])}>
          <div>{PRIORITY_LABELS[priority]}</div>
        </div>
      ) : (
        <div className="dim">-</div>
      )}
    >
      <button type="button" className="filterspill" onClick={() => onChange(null)}>
        <div>Unset</div>
      </button>
      {INTEREST_PRIORITIES.map((value) => (
        <button
          key={value}
          type="button"
          className={pillClass(PRIORITY_PILL[value])}
          onClick={() => {
            if (isPriority(value) && value !== priority) onChange(value);
          }}
        >
          <div>{PRIORITY_LABELS[value]}</div>
        </button>
      ))}
    </RowMenu>
  );
}

function OwnerPillPhoto({
  label,
  photoUrl,
}: {
  label: string;
  photoUrl?: string | null;
}) {
  return (
    <div className="pillphoto">
      {photoUrl ? (
        <img src={photoUrl} alt="" className="fullimage" />
      ) : (
        <div>{initialsForLabel(label)}</div>
      )}
    </div>
  );
}

function OwnerPicker({
  ownerProfileId,
  ownerName,
  teamMembers,
  disabled,
  onChange,
}: {
  ownerProfileId: string | null;
  ownerName: string | null;
  teamMembers: InterestCrmTeamMember[];
  disabled: boolean;
  onChange: (ownerProfileId: string | null) => void;
}) {
  const selectedOwner = teamMembers.find((member) => member.id === ownerProfileId);

  return (
    <RowMenu
      disabled={disabled}
      trigger={ownerName ? (
        <div className="cellpill owner">
          <OwnerPillPhoto label={ownerName} photoUrl={selectedOwner?.photoUrl} />
          <div>{firstNameFromLabel(ownerName)}</div>
        </div>
      ) : (
        <div className="dim">-</div>
      )}
    >
      <button type="button" className="filterspill" onClick={() => onChange(null)}>
        <div>Unassigned</div>
      </button>
      {teamMembers.map((member) => {
        const label = teamMemberLabel(member);

        return (
          <button
            key={member.id}
            type="button"
            className="cellpill owner"
            onClick={() => {
              if (member.id !== ownerProfileId) onChange(member.id);
            }}
          >
            <OwnerPillPhoto label={label} photoUrl={member.photoUrl} />
            <div>{firstNameFromLabel(label)}</div>
          </button>
        );
      })}
    </RowMenu>
  );
}

function RowMenu({
  trigger,
  children,
  disabled,
}: {
  trigger: ReactNode;
  children: ReactNode;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div className={`dropdownwrapper interest-crm-cell-fill${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="interest-crm-cell-button"
      >
        {trigger}
      </button>
      <div className="dropdownselector" style={{ width: 180 }}>
        <div className="filtersrow">{children}</div>
      </div>
    </div>
  );
}

function ConfirmedAmountEditor({
  row,
  disabled,
  onSave,
}: {
  row: InterestCrmRow;
  disabled: boolean;
  onSave: (amount: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(
    row.confirmedAmountCents ? formatUsdInput(String(Math.round(row.confirmedAmountCents / 100))) : '',
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const hover = row.confirmedByName && row.confirmedAt
    ? `Added by ${row.confirmedByName} · ${formatDateTimeLabel(row.confirmedAt)}`
    : 'Click to add a confirmed amount';

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div className="interest-crm-cell-fill" ref={rootRef}>
      <button
        type="button"
        className="interest-crm-cell-button"
        disabled={disabled}
        onClick={() => {
          setDraft(
            row.confirmedAmountCents ? formatUsdInput(String(Math.round(row.confirmedAmountCents / 100))) : '',
          );
          setOpen(true);
        }}
      >
        <div className="speevy-tooltip" aria-label={hover}>
          <div>
            {row.confirmedAmountCents ? formatUsdFromCents(row.confirmedAmountCents) : <span className="dim">$</span>}
          </div>
          <div className="speevy-tooltip-panel" role="tooltip">
            {hover}
          </div>
        </div>
      </button>
      {open ? (
        <form
          className="interest-crm-amount-editor"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onSave(draft);
            setOpen(false);
          }}
        >
          <input
            className="searchfield w-input"
            style={{ width: '100%', backgroundImage: 'none', paddingLeft: 12 }}
            value={draft}
            onChange={(event) => setDraft(formatUsdInput(event.target.value))}
            placeholder="$500,000"
            inputMode="numeric"
            aria-label="Confirmed amount"
          />
          <button type="submit" className="button sendbutton w-button interest-crm-amount-save">
            Save
          </button>
        </form>
      ) : null}
    </div>
  );
}

function NotesEditor({
  row,
  latestNote,
  disabled,
  currentAdmin,
  onAdd,
}: {
  row: InterestCrmRow;
  latestNote: InterestCrmNote | null;
  disabled: boolean;
  currentAdmin: InterestCrmTeamMember;
  onAdd: (body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const latestColor = latestNote ? colorForProfileId(latestNote.authorProfileId) : 'gray';
  const latestStyles = AUTHOR_NOTE_STYLES[latestColor];

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div className="interest-crm-cell-fill" ref={rootRef}>
      <button
        type="button"
        className="interest-crm-cell-button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {latestNote ? (
          <div className={`notetext ${latestStyles.name}`}>
            {latestNote.body}
          </div>
        ) : (
          <div className="dim">-</div>
        )}
      </button>
      {open ? (
        <div className="interest-crm-note-panel">
          {row.notes.map((note) => {
            const color = colorForProfileId(note.authorProfileId);
            const styles = AUTHOR_NOTE_STYLES[color];
            return (
              <div key={note.id} className={`interest-crm-note-item ${styles.bar}`}>
                <div className={styles.name} style={{ fontSize: 12, fontWeight: 600 }}>{note.authorName}</div>
                <div style={{ fontSize: 13 }}>{note.body}</div>
              </div>
            );
          })}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const body = draft.trim();
              if (!body) return;
              onAdd(body);
              setDraft('');
            }}
          >
            <textarea
              className="emailarea-input"
              style={{ minHeight: 70, border: '1.5px solid var(--border)', borderRadius: 7, padding: 8 }}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Add a note as ${firstNameFromLabel(teamMemberLabel(currentAdmin))}…`}
            />
            <button type="submit" className="button sendbutton w-button interest-crm-amount-save" disabled={!draft.trim()}>
              Add note
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
