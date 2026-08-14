import { existsSync } from 'node:fs';

import { getAppUrl } from '@/lib/app-url';

function localChromePath() {
  if (process.env.CHROME_EXECUTABLE_PATH && existsSync(process.env.CHROME_EXECUTABLE_PATH)) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function localPrintBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.hostname === 'localhost') {
        url.hostname = '127.0.0.1';
      }
      return url.origin;
    } catch {
      // Fall through to the process port.
    }
  }

  return `http://127.0.0.1:${process.env.PORT || '3000'}`;
}

const CHROMIUM_PACK_VERSION = '149.0.0';

function chromiumPackUrl() {
  if (process.env.CHROMIUM_PACK_URL) {
    return process.env.CHROMIUM_PACK_URL;
  }

  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_PACK_VERSION}/chromium-v${CHROMIUM_PACK_VERSION}-pack.${arch}.tar`;
}

function printBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.EXPORT_PRINT_BASE_URL) {
    return process.env.EXPORT_PRINT_BASE_URL.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return localPrintBaseUrl();
  }

  return getAppUrl();
}

export function buildExportPrintUrl(slug: string, token: string) {
  return `${printBaseUrl()}/opportunities/${encodeURIComponent(slug)}/export-print?token=${encodeURIComponent(token)}`;
}

export async function renderOpportunityOverviewPdf(printUrl: string) {
  const { default: puppeteer } = await import('puppeteer-core');
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);
  const localExecutablePath = localChromePath();

  let browser;
  if (isServerless || !localExecutablePath) {
    // Vercel file tracing drops the 66MB Chromium bin from @sparticuz/chromium.
    // The -min package downloads the official pack into /tmp on first invoke.
    const { default: chromium } = await import('@sparticuz/chromium-min');
    chromium.setGraphicsMode = false;
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 1800 },
      executablePath: await chromium.executablePath(chromiumPackUrl()),
      headless: true,
    });
  } else {
    browser = await puppeteer.launch({
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
      defaultViewport: { width: 1280, height: 1800 },
      executablePath: localExecutablePath,
      headless: true,
    });
  }

  try {
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 45_000 });
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((image) => {
          image.loading = 'eager';
          if (image.complete) {
            return undefined;
          }

          return new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          });
        }),
      );
    });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.45in', bottom: '0.5in', left: '0.45in' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
