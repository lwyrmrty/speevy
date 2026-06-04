'use client';

import { useMemo, useRef, useState, useTransition } from 'react';

import {
  assignTag,
  createAndAssignTag,
  removeTag,
  type TagActionResult,
} from '@/app/admin/investors/actions';
import { Badge } from '@/components/base/badges/badges';
import { TAG_COLORS, type Tag, type TagColor } from '@/lib/lp-tags';

// Swatch preview colors (approx. Untitled UI utility-500). The rendered chips
// use the Untitled UI Badge theme classes; these are only for the picker dots.
const SWATCH_HEX: Record<TagColor, string> = {
  gray: '#667085',
  brand: '#7f56d9',
  error: '#f04438',
  warning: '#f79009',
  success: '#17b26a',
  slate: '#64748b',
  sky: '#0ba5ec',
  blue: '#2e90fa',
  indigo: '#6172f3',
  purple: '#7a5af8',
  pink: '#ee46bc',
  orange: '#ef6820',
};

export function LpTagBadge({ tag }: { tag: Tag }) {
  return (
    <Badge type="pill-color" size="sm" color={tag.color}>
      {tag.name}
    </Badge>
  );
}

export function TagColorPicker({
  value,
  onChange,
  label = 'Color',
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label ? <span className="dimsmall">{label}</span> : null}
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Use ${color}`}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
          className="size-5 rounded-full ring-1 ring-inset ring-black/10"
          style={{
            backgroundColor: SWATCH_HEX[color],
            outline: value === color ? '2px solid currentColor' : 'none',
            outlineOffset: '1px',
          }}
        />
      ))}
    </div>
  );
}

export function LpTagEditor({
  lpId,
  assignedTags,
  allTags,
  onChanged,
}: {
  lpId: string;
  assignedTags: Tag[];
  allTags: Tag[];
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('gray');
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<TagActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const assignedIds = useMemo(() => new Set(assignedTags.map((tag) => tag.id)), [assignedTags]);
  const trimmedQuery = query.trim();

  const suggestions = useMemo(() => {
    const lowered = trimmedQuery.toLowerCase();
    return allTags
      .filter((tag) => !assignedIds.has(tag.id))
      .filter((tag) => (lowered ? tag.name.toLowerCase().includes(lowered) : true))
      .slice(0, 8);
  }, [allTags, assignedIds, trimmedQuery]);

  const hasExactMatch = allTags.some(
    (tag) => tag.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const canCreate = trimmedQuery.length > 0 && !hasExactMatch;

  function run(action: () => Promise<TagActionResult>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result);
      if (result.status === 'success') {
        setQuery('');
        setIsOpen(false);
        onChanged();
      }
    });
  }

  function handleAssign(tagId: string) {
    run(() => assignTag({ lpId, tagId }));
  }

  function handleCreate() {
    if (!canCreate) return;
    run(() => createAndAssignTag({ lpId, name: trimmedQuery, color: newColor }));
  }

  function handleRemove(tagId: string) {
    run(() => removeTag({ lpId, tagId }));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {assignedTags.length > 0 ? (
          assignedTags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1">
              <LpTagBadge tag={tag} />
              <button
                type="button"
                aria-label={`Remove ${tag.name}`}
                onClick={() => handleRemove(tag.id)}
                disabled={isPending}
                className="flex size-4 items-center justify-center rounded-full text-quaternary hover:text-secondary disabled:opacity-50"
              >
                <span aria-hidden className="text-sm leading-none">×</span>
              </button>
            </span>
          ))
        ) : (
          <div className="dimish">No tags yet.</div>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          className="textfield w-input"
          placeholder="Add a tag…"
          value={query}
          onChange={(event) => {
            setMessage(null);
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setIsOpen(false), 120);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (suggestions.length === 1 && !canCreate) {
                handleAssign(suggestions[0].id);
              } else if (canCreate) {
                handleCreate();
              }
            }
          }}
        />

        {isOpen && (suggestions.length > 0 || canCreate) ? (
          <div
            className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-secondary bg-primary shadow-lg"
            onMouseDown={() => {
              if (blurTimeout.current) clearTimeout(blurTimeout.current);
            }}
          >
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary"
                onClick={() => handleAssign(tag.id)}
                disabled={isPending}
              >
                <LpTagBadge tag={tag} />
              </button>
            ))}
            {canCreate ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-t border-secondary px-3 py-2 text-left hover:bg-secondary"
                onClick={handleCreate}
                disabled={isPending}
              >
                <span
                  aria-hidden
                  className="inline-block size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: SWATCH_HEX[newColor] }}
                />
                <span className="text-sm">
                  Create <strong>“{trimmedQuery}”</strong>
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {canCreate ? <TagColorPicker value={newColor} onChange={setNewColor} /> : null}

      {message ? (
        <div className={`speevy-form-message ${message.status}`}>{message.message}</div>
      ) : null}
    </div>
  );
}
