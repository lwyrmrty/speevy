/** Canonical LP-facing production URL when NEXT_PUBLIC_APP_URL is unset. */
export const DEFAULT_APP_URL = 'https://spv.harpoon.vc';

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, '');
}

export function getAppOrigin(): string {
  try {
    return new URL(getAppUrl()).origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

export function buildAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAppUrl()}${normalizedPath}`;
}
