export const LOGIN_SUCCESS_PATHS = [
  '/admin',
  '/opportunities',
  '/onboarding',
] as const;

export type LoginSuccessPath = (typeof LOGIN_SUCCESS_PATHS)[number];

export function isSafeLoginRedirect(path: string): path is LoginSuccessPath {
  return (LOGIN_SUCCESS_PATHS as readonly string[]).includes(path);
}

export function followLoginRedirect(path: string | undefined): void {
  if (!path || !isSafeLoginRedirect(path)) return;
  window.location.replace(path);
}
