'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  createTag,
  deleteTag,
  updateTag,
  type TagActionResult,
} from '@/app/admin/investors/actions';
import { LpTagBadge, TagColorPicker } from '@/components/webflow/lp-tag-editor';
import { DEFAULT_TAG_COLOR, type TagColor, type TagWithCount } from '@/lib/lp-tags';

type TagsManagerProps = {
  tags: TagWithCount[];
};

export function TagsManager({ tags }: TagsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>(DEFAULT_TAG_COLOR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<TagColor>(DEFAULT_TAG_COLOR);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const run = (action: () => Promise<TagActionResult>, onSuccess?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.status === 'success') {
        setMessage({ kind: 'success', text: result.message });
        onSuccess?.();
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: result.message });
      }
    });
  };

  const handleCreate = () => {
    run(
      () => createTag({ name, color }),
      () => {
        setName('');
        setColor(DEFAULT_TAG_COLOR);
      },
    );
  };

  const startEditing = (tag: TagWithCount) => {
    setConfirmingDeleteId(null);
    setMessage(null);
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = (id: string) => {
    run(
      () => updateTag({ id, name: editName, color: editColor }),
      () => setEditingId(null),
    );
  };

  const handleDelete = (id: string) => {
    run(() => deleteTag({ id }), () => setConfirmingDeleteId(null));
  };

  return (
    <div>
      <div className="cardblock">
        <div>
          <div className="sideheading">Create tag</div>
        </div>
        <div className="formfields-block">
          <div className="fieldlabel">Name</div>
          <input
            className="formfields w-input"
            placeholder="e.g. Anchor LP"
            maxLength={50}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </div>
        <div className="formfields-block spacetop">
          <div className="fieldlabel">Color</div>
          <TagColorPicker value={color} onChange={setColor} label="" />
        </div>
        <div className="spacetop" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="button short w-inline-block"
            onClick={handleCreate}
            disabled={isPending || name.trim().length === 0}
            style={{ border: 'none', cursor: isPending ? 'not-allowed' : 'pointer' }}
          >
            <div>{isPending ? 'Saving…' : 'Create tag'}</div>
          </button>
          {name.trim().length > 0 ? (
            <LpTagBadge tag={{ id: 'preview', name: name.trim(), color, createdAt: '' }} />
          ) : null}
        </div>
        {message ? (
          <div
            className="fieldlabel spacetop"
            style={{ marginTop: 10, color: message.kind === 'error' ? '#c0392b' : '#1e8449' }}
          >
            {message.text}
          </div>
        ) : null}
      </div>

      <div className="contenttable speevy-responsive-table" style={{ marginTop: 24 }}>
        <div className="tablerow headerrow">
          <div className="tablecell first">
            <div>Tag</div>
          </div>
          <div className="tablecell">
            <div>Investors</div>
          </div>
          <div className="tablecell actions">
            <div>Actions</div>
          </div>
        </div>
        {tags.length ? (
          tags.map((tag) => {
            const isEditing = editingId === tag.id;
            const isConfirmingDelete = confirmingDeleteId === tag.id;

            return (
              <div className="tablerow" key={tag.id}>
                <div className="tablecell first">
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                      <input
                        className="formfields w-input"
                        maxLength={50}
                        value={editName}
                        onChange={(event) => setEditName(event.currentTarget.value)}
                      />
                      <TagColorPicker value={editColor} onChange={setEditColor} label="" />
                    </div>
                  ) : (
                    <LpTagBadge tag={tag} />
                  )}
                </div>
                <div className="tablecell">
                  <div>
                    {tag.lpCount} {tag.lpCount === 1 ? 'investor' : 'investors'}
                  </div>
                </div>
                <div className="tablecell actions">
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        type="button"
                        className="actionlinks w-inline-block"
                        onClick={() => handleSaveEdit(tag.id)}
                        disabled={isPending || editName.trim().length === 0}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <div>Save</div>
                      </button>
                      <button
                        type="button"
                        className="actionlinks w-inline-block"
                        onClick={() => setEditingId(null)}
                        disabled={isPending}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <div className="dimish">Cancel</div>
                      </button>
                    </div>
                  ) : isConfirmingDelete ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="dimsmall">
                        Delete{tag.lpCount > 0 ? ` and remove from ${tag.lpCount} ${tag.lpCount === 1 ? 'investor' : 'investors'}` : ''}?
                      </span>
                      <button
                        type="button"
                        className="actionlinks w-inline-block"
                        onClick={() => handleDelete(tag.id)}
                        disabled={isPending}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b' }}
                      >
                        <div>Confirm</div>
                      </button>
                      <button
                        type="button"
                        className="actionlinks w-inline-block"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={isPending}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <div className="dimish">Cancel</div>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        type="button"
                        className="actionlinks w-inline-block"
                        onClick={() => startEditing(tag)}
                        disabled={isPending}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <div>Edit</div>
                      </button>
                      <button
                        type="button"
                        className="actionlinks w-inline-block"
                        onClick={() => {
                          setEditingId(null);
                          setMessage(null);
                          setConfirmingDeleteId(tag.id);
                        }}
                        disabled={isPending}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <div>Delete</div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="tablerow">
            <div className="tablecell first">
              <div>No tags yet. Create one above.</div>
            </div>
            <div className="tablecell">
              <div>-</div>
            </div>
            <div className="tablecell actions">
              <div>-</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
