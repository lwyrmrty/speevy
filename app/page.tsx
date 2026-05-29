import { OpportunityCard } from '@/components/opportunity-card';
import { Watermark } from '@/components/watermark';
import { MainNavigation } from '@/components/main-navigation';
import { activity, lpProfile, opportunities } from '@/lib/mock-data';
import { statusLabel } from '@/lib/format';

export default function Home() {
  const activeOpportunities = opportunities.filter(
    (opportunity) => opportunity.status !== 'past',
  );

  return (
    <>
      <MainNavigation />
      <main className="min-h-screen px-6 py-8 text-ink sm:px-10 lg:px-12">
        <section className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-6 rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-copper">
                Harpoon Ventures
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-6xl">
                Speevy
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                A fast, private LP portal for reviewing curated SPV opportunities,
                signing gated materials, and indicating interest with confidence.
              </p>
            </div>
            <div className="rounded-3xl bg-harbor p-5 text-white shadow-glow">
              <p className="text-sm text-white/70">Signed in as</p>
              <p className="mt-2 text-xl font-semibold">{lpProfile.fullName}</p>
              <p className="text-sm text-white/70">{lpProfile.email}</p>
              <div className="mt-4 flex gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white/15 px-3 py-1">
                  {statusLabel(lpProfile.status)}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1">
                  {statusLabel(lpProfile.accreditationStatus)}
                </span>
              </div>
            </div>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
            <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/76 p-6 shadow-sm backdrop-blur">
              <Watermark email={lpProfile.email} />
              <div className="relative">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-copper">
                      LP Opportunity Room
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold text-ink">
                      {activeOpportunities.length} opportunities available
                    </h2>
                  </div>
                  <button className="w-fit rounded-full border border-harbor/20 bg-white px-5 py-3 text-sm font-semibold text-harbor shadow-sm transition hover:border-harbor hover:bg-harbor hover:text-white">
                    Request admin help
                  </button>
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-2">
                  {activeOpportunities.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.id}
                      opportunity={opportunity}
                    />
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-[2rem] bg-ink p-6 text-white shadow-glow">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-copper">
                  Interest Flow
                </p>
                <h2 className="mt-3 text-2xl font-semibold">Two steps, no noise.</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  LPs first indicate interest, then submit a dollar amount. Minimum
                  checks and access rules belong in Server Actions and RLS, not UI.
                </p>
                <div className="mt-5 rounded-2xl bg-white/10 p-4">
                  <p className="text-3xl font-semibold">$1.25M</p>
                  <p className="text-sm text-white/60">Sample indicated interest</p>
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-copper">
                  Activity
                </p>
                <ul className="mt-4 space-y-3">
                  {activity.map((item) => (
                    <li
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[2rem] border border-copper/20 bg-copper/10 p-6">
                <p className="text-sm font-semibold text-copper">Build posture</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  This preview keeps the real rules visible: invite-only access,
                  approved LPs, NDA-gated sections, audit trails, and no public signup.
                </p>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
