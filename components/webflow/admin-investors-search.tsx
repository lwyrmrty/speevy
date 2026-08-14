'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function AdminInvestorsSearch({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const next = draft.trim();
    if (next === value) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set('q', next);
      } else {
        params.delete('q');
      }
      params.delete('page');
      params.delete('investor');

      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [draft, pathname, router, searchParams, value]);

  return (
    <div className="searchform-block w-form" data-pending={isPending ? 'true' : undefined}>
      <input
        className="searchfield w-input"
        type="search"
        value={draft}
        placeholder="Search"
        aria-label="Search investors"
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
    </div>
  );
}
