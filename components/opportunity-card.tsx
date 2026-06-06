import type { Opportunity } from '@/lib/mock-data';
import { formatCents } from '@/lib/format';

const statusStyles: Record<Opportunity['status'], string> = {
  potential: 'bg-slate-100 text-slate-700 ring-slate-200',
  coming_soon: 'bg-slate-100 text-slate-700 ring-slate-200',
  upcoming: 'bg-amber-50 text-amber-800 ring-amber-200',
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  closed: 'bg-slate-200 text-slate-600 ring-slate-300',
};

const statusDisplayLabels: Partial<Record<Opportunity['status'], string>> = {
  coming_soon: 'Coming Soon',
  closed: 'Closed',
};

type OpportunityCardProps = {
  opportunity: Opportunity;
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const statusText = statusDisplayLabels[opportunity.status]
    ?? opportunity.status.charAt(0).toUpperCase() + opportunity.status.slice(1);

  return (
    <article className="group overflow-hidden rounded-3xl border border-white/70 bg-white/88 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-copper">
            {opportunity.sector}
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-ink">
            {opportunity.companyName}
          </h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyles[opportunity.status]}`}
        >
          {statusText}
        </span>
      </div>

      <p className="mt-4 min-h-16 text-sm leading-6 text-slate-600">
        {opportunity.teaser}
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-2xl bg-mist p-3">
          <dt className="text-xs text-slate-500">Minimum</dt>
          <dd className="mt-1 font-semibold text-ink">
            {formatCents(opportunity.minimumInvestmentCents)}
          </dd>
        </div>
        <div className="rounded-2xl bg-mist p-3">
          <dt className="text-xs text-slate-500">Allocation</dt>
          <dd className="mt-1 font-semibold text-ink">
            {formatCents(opportunity.targetAllocationCents)}
          </dd>
        </div>
        <div className="rounded-2xl bg-mist p-3">
          <dt className="text-xs text-slate-500">Signal</dt>
          <dd className="mt-1 font-semibold text-ink">{opportunity.traction}</dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">
          {opportunity.ndaRequired ? 'NDA required for materials' : 'Materials available'}
        </p>
        <button className="rounded-full bg-harbor px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-ink">
          View preview
        </button>
      </div>
    </article>
  );
}
