import type { Metadata } from 'next';
import Link from 'next/link';

import {
  HeaderNavigationSimpleDemo,
  MainNavigation,
} from '@/components/main-navigation';
import { dashboardSubItems } from '@/components/application/app-navigation/navigation-items';
import { TableAlternatingFillsDemo } from '@/components/application/table/table-alternating-fills-demo';

export const metadata: Metadata = {
  description: 'Preview reusable Speevy application components.',
};

export default function ComponentsPage() {
  return (
    <>
      <MainNavigation />
      <main className="min-h-screen px-6 py-8 text-ink sm:px-10 lg:px-12">
        <section className="mx-auto max-w-7xl space-y-8">
          <header className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-copper">
              Component preview
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">
              Main navigation
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Use this page to preview and tune the header navigation before
              applying it across the rest of the app.
            </p>
          </header>

          <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-sm backdrop-blur">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-ink">
                Untitled UI simple header demo
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                This renders the saved demo component with Dashboard marked
                active.
              </p>
            </div>
            <div className="bg-mist/60">
              <HeaderNavigationSimpleDemo />
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur md:p-6">
            <div className="mb-5 px-1">
              <h2 className="text-xl font-semibold text-ink">
                Untitled UI table demo
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                This renders the real Untitled UI table source using the
                Alternating fills 01 composition.
              </p>
            </div>
            <TableAlternatingFillsDemo />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
              <h2 className="text-xl font-semibold text-ink">
                Dashboard subitems
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                These are saved with the navigation component and ready to use
                when the dashboard needs a secondary nav.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {dashboardSubItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-harbor/10 bg-white px-4 py-2 text-sm font-medium text-harbor transition hover:border-harbor hover:bg-harbor hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] bg-ink p-6 text-white shadow-glow">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-copper">
                Edit targets
              </p>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Change the base header in{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5">
                  header-navigation.tsx
                </code>{' '}
                or update route items in{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5">
                  main-navigation.tsx
                </code>
                .
              </p>
            </aside>
          </section>
        </section>
      </main>
    </>
  );
}
