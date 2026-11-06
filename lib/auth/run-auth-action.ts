const AUTH_ACTION_NETWORK_MESSAGE =
  'Could not reach the server. Check your connection and try again.';

function isNavigationError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('digest' in error)) {
    return false;
  }

  const digest = error.digest;
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND'))
  );
}

export async function runAuthAction<
  TState extends { status: string; message: string },
>(
  action: (previous: TState, formData: FormData) => Promise<TState>,
  previous: TState,
  formData: FormData,
): Promise<TState> {
  try {
    return await action(previous, formData);
  } catch (error) {
    if (isNavigationError(error)) {
      throw error;
    }

    return {
      ...previous,
      status: 'error',
      message: AUTH_ACTION_NETWORK_MESSAGE,
    };
  }
}
