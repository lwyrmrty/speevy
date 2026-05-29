import type { ReactNode } from 'react';
import Link from 'next/link';

type SplitAuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function SplitAuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: SplitAuthShellProps) {
  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="flex min-h-screen flex-col justify-between px-6 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="flex w-fit items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-harbor text-sm font-semibold text-white shadow-sm">
            SV
          </span>
          <span className="text-lg font-semibold tracking-tight text-ink">
            Speevy
          </span>
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-14">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-copper">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {description}
          </p>

          <div className="mt-8">{children}</div>
        </div>

        <div className="text-sm text-muted-foreground">
          {footer ?? (
            <p>
              Need help? Email{' '}
              <a
                className="font-medium text-harbor underline-offset-4 hover:underline"
                href="mailto:investors@harpoon.vc"
              >
                investors@harpoon.vc
              </a>
              .
            </p>
          )}
        </div>
      </section>

      <aside className="relative hidden bg-ink p-8 lg:block">
        <div className="relative h-full rounded-[20px] bg-[url('/images/ocean-waves-bg.png')] bg-cover bg-center" />
      </aside>
    </main>
  );
}
