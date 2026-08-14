import { NextResponse } from 'next/server';

import { authorizeOpportunityExport } from '@/lib/opportunity/export-auth';
import { buildOpportunityExportPack } from '@/lib/opportunity/export-pack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ opportunityId: string }> },
) {
  const { opportunityId: slug } = await context.params;
  const auth = await authorizeOpportunityExport(slug);

  if (auth.status === 'error') {
    return NextResponse.json({ message: auth.message }, { status: auth.httpStatus });
  }

  try {
    const pack = await buildOpportunityExportPack(auth.viewer);
    return NextResponse.json({ url: pack.url, filename: pack.filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
