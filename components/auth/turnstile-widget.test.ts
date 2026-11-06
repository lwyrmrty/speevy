import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'turnstile-widget.tsx'),
  'utf8',
);

describe('TurnstileWidget', () => {
  it('uses explicit render and does not opt into implicit auto-render', () => {
    assert.match(source, /api\.js\?render=explicit/);
    assert.equal(source.includes('className="cf-turnstile"'), false);
    assert.equal(/data-sitekey/.test(source), false);
  });
});
