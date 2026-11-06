import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const widgetSource = readFileSync(path.join(dir, 'turnstile-widget.tsx'), 'utf8');
const frameSource = readFileSync(
  path.join(dir, '../../public/turnstile-frame.html'),
  'utf8',
);

describe('TurnstileWidget', () => {
  it('renders Turnstile in a same-origin iframe so widget errors cannot crash login', () => {
    assert.match(widgetSource, /turnstile-frame\.html/);
    assert.equal(widgetSource.includes('className="cf-turnstile"'), false);
    assert.equal(/data-sitekey/.test(widgetSource), false);
    assert.match(frameSource, /api\.js\?render=explicit/);
  });

  it('copies the iframe token onto the form and retries until the parent acks', () => {
    assert.match(widgetSource, /getToken/);
    assert.match(widgetSource, /attachTurnstileToken/);
    assert.match(widgetSource, /__speevyTurnstileToken/);
    assert.match(frameSource, /__speevyTurnstileToken/);
    assert.match(frameSource, /event\.data\.type === 'ack'/);
    assert.match(frameSource, /getElementsByName\('cf-turnstile-response'\)/);
    assert.match(widgetSource, /Verification complete/);
    assert.match(widgetSource, /\{token \? \(/);
  });
});
