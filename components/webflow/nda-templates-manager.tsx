'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  archiveNdaTemplate,
  createNdaTemplate,
  setAccountDefaultNdaTemplate,
  type NdaTemplateSummary,
} from '@/app/admin/nda-templates/actions';

type NdaTemplatesManagerProps = {
  templates: NdaTemplateSummary[];
};

const DEFAULT_FIELDS_CONFIG_JSON = `{
  "format": "docx",
  "places": [
    { "key": "signer_signs_here", "type": "signature", "recipient_key": "signer", "height": 48 },
    { "key": "signer_signed_at", "type": "recipient_completed_date", "recipient_key": "signer" },
    { "key": "signer_name", "type": "recipient_name", "recipient_key": "signer" },
    { "key": "signer_email", "type": "recipient_email", "recipient_key": "signer" }
  ]
}`;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function NdaTemplatesManager({ templates }: NdaTemplatesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceFileUrl, setSourceFileUrl] = useState('');
  const [fieldsConfigJson, setFieldsConfigJson] = useState(DEFAULT_FIELDS_CONFIG_JSON);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSourceFileUrl('');
    setFieldsConfigJson(DEFAULT_FIELDS_CONFIG_JSON);
  };

  const handleCreate = () => {
    setMessage(null);

    const trimmedConfig = fieldsConfigJson.trim();
    let fieldsConfig: Record<string, unknown> | undefined;
    if (trimmedConfig) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmedConfig);
      } catch {
        setMessage({ kind: 'error', text: 'Signature field configuration must be valid JSON.' });
        return;
      }
      if (!isPlainObject(parsed)) {
        setMessage({ kind: 'error', text: 'Signature field configuration must be valid JSON.' });
        return;
      }
      fieldsConfig = parsed;
    }

    startTransition(async () => {
      const result = await createNdaTemplate({
        name,
        description: description || undefined,
        sourceFileUrl,
        ...(fieldsConfig ? { fieldsConfig } : {}),
      });

      if (result.status === 'success') {
        resetForm();
        setMessage({ kind: 'success', text: result.message });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: result.message });
      }
    });
  };

  const handleArchive = (id: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await archiveNdaTemplate({ id });

      if (result.status === 'success') {
        setMessage({ kind: 'success', text: result.message });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: result.message });
      }
    });
  };

  const handleSetAccountDefault = (id: string) => {
    setMessage(null);
    startTransition(async () => {
      const result = await setAccountDefaultNdaTemplate({ id });

      if (result.status === 'success') {
        setMessage({ kind: 'success', text: result.message });
        router.refresh();
      } else {
        setMessage({ kind: 'error', text: result.message });
      }
    });
  };

  return (
    <div>
      <div className="cardblock">
        <div>
          <div className="sideheading">Add NDA document</div>
        </div>
        <div className="formfields-block">
          <div className="fieldlabel">Name</div>
          <input
            className="formfields w-input"
            placeholder="e.g. Standard Mutual NDA v2"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </div>
        <div className="formfields-block spacetop">
          <div className="fieldlabel">Description (optional)</div>
          <input
            className="formfields w-input"
            placeholder="Internal note about this NDA"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </div>
        <div className="formfields-block spacetop">
          <div className="fieldlabel">SignatureAPI Library file URL</div>
          <input
            className="formfields w-input"
            placeholder="https://…"
            type="url"
            value={sourceFileUrl}
            onChange={(event) => setSourceFileUrl(event.currentTarget.value)}
          />
        </div>
        <div className="formfields-block spacetop">
          <div className="fieldlabel">Signature field configuration (JSON)</div>
          <textarea
            className="formfields w-input"
            rows={10}
            value={fieldsConfigJson}
            onChange={(event) => setFieldsConfigJson(event.currentTarget.value)}
            style={{ fontFamily: 'monospace', resize: 'vertical' }}
          />
          <div className="dimish" style={{ marginTop: 6 }}>
            Keys must match the [[place]] markers in the document (e.g.
            [[signer_signs_here]]).
          </div>
        </div>
        <div className="spacetop" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="button short w-inline-block"
            onClick={handleCreate}
            disabled={isPending}
            style={{ border: 'none', cursor: isPending ? 'not-allowed' : 'pointer' }}
          >
            <div>{isPending ? 'Saving…' : 'Add document'}</div>
          </button>
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

      <div className="contenttable" style={{ marginTop: 24 }}>
        <div className="tablerow headerrow">
          <div className="tablecell first">
            <div>Document</div>
          </div>
          <div className="tablecell">
            <div>Provider</div>
          </div>
          <div className="tablecell">
            <div>Version</div>
          </div>
          <div className="tablecell">
            <div>Account default</div>
          </div>
          <div className="tablecell actions">
            <div>Actions</div>
          </div>
        </div>
        {templates.length ? (
          templates.map((template) => (
            <div className="tablerow" key={template.id}>
              <div className="tablecell first">
                <div>
                  <div className="cellname">{template.name}</div>
                  {template.description ? (
                    <div className="dimish">{template.description}</div>
                  ) : null}
                </div>
              </div>
              <div className="tablecell">
                <div>{template.signatureProvider}</div>
              </div>
              <div className="tablecell">
                <div>v{template.version}</div>
              </div>
              <div className="tablecell">
                {template.isAccountDefault ? (
                  <div className="cellstatus">Account default</div>
                ) : (
                  <button
                    type="button"
                    className="actionlinks w-inline-block"
                    onClick={() => handleSetAccountDefault(template.id)}
                    disabled={isPending}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div>Set as account default</div>
                  </button>
                )}
              </div>
              <div className="tablecell actions">
                <button
                  type="button"
                  className="actionlinks w-inline-block"
                  onClick={() => handleArchive(template.id)}
                  disabled={isPending}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div>Archive</div>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="tablerow">
            <div className="tablecell first">
              <div>No NDA documents yet. Add one above.</div>
            </div>
            <div className="tablecell">
              <div>-</div>
            </div>
            <div className="tablecell">
              <div>-</div>
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
