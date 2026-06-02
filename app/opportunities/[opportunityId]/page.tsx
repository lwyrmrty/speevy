import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { OpportunityInterestCard } from '@/components/webflow/opportunity-interest-card';
import { SectionMiniNav } from '@/components/webflow/section-mini-nav';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import { WebflowStyles } from '@/components/webflow/webflow-styles';
import { INVESTOR_SECTORS } from '@/lib/investor-request';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SectionRow = {
  type: string;
  position: number;
  data: Record<string, unknown>;
};

type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string }[];
  content?: TiptapNode[];
};

const defaultThumbnail = '/webflow/images/cyberwallpaper.webp';
const defaultLogo = '/webflow/images/shield.svg';

const sectionFallbackLabels: Record<string, string> = {
  richContent: 'Summary',
  links: 'Links',
  documents: 'Documents',
  team: 'Team',
  investors: 'Investors',
  media: 'Media',
};

function HomeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      className="homeicon"
    >
      <g>
        <path d="M19.5 0H22C23.1046 0 24 0.895453 24 2.00002V4.5C24 5.60456 23.1046 6.50002 22 6.50002H19.5C18.3955 6.50002 17.5 5.60456 17.5 4.5V2.00002C17.5 0.895453 18.3955 0 19.5 0Z" fill="currentColor" />
        <path d="M10.75 0H13.25C14.3546 0 15.25 0.895453 15.25 2.00002V4.5C15.25 5.60456 14.3546 6.50002 13.25 6.50002H10.75C9.64545 6.50002 8.75 5.60456 8.75 4.5V2.00002C8.75005 0.895453 9.64545 0 10.75 0Z" fill="currentColor" />
        <path d="M2.00002 0H4.5C5.60456 0 6.50002 0.895453 6.50002 2.00002V4.5C6.50002 5.60456 5.60456 6.50002 4.5 6.50002H2.00002C0.895453 6.50002 0 5.60456 0 4.5V2.00002C0 0.895453 0.895453 0 2.00002 0Z" fill="currentColor" />
        <path d="M19.5 8.75H22C23.1046 8.75 24 9.64545 24 10.75V13.25C24 14.3546 23.1046 15.25 22 15.25H19.5C18.3955 15.25 17.5 14.3546 17.5 13.25V10.75C17.5 9.64541 18.3955 8.75 19.5 8.75Z" fill="currentColor" />
        <path d="M10.75 8.75H13.25C14.3546 8.75 15.25 9.64545 15.25 10.75V13.25C15.25 14.3546 14.3546 15.25 13.25 15.25H10.75C9.64545 15.25 8.75 14.3546 8.75 13.25V10.75C8.75005 9.64541 9.64545 8.75 10.75 8.75Z" fill="currentColor" />
        <path d="M2.00002 8.75H4.5C5.60456 8.75 6.50002 9.64545 6.50002 10.75V13.25C6.50002 14.3546 5.60456 15.25 4.5 15.25H2.00002C0.895453 15.25 0 14.3546 0 13.25V10.75C0 9.64541 0.895453 8.75 2.00002 8.75Z" fill="currentColor" />
        <path d="M19.5 17.5H22C23.1046 17.5 24 18.3955 24 19.5V22C24 23.1046 23.1046 24 22 24H19.5C18.3955 24 17.5 23.1046 17.5 22V19.5C17.5 18.3955 18.3955 17.5 19.5 17.5Z" fill="currentColor" />
        <path d="M10.75 17.5H13.25C14.3546 17.5 15.25 18.3955 15.25 19.5V22C15.25 23.1046 14.3546 24 13.25 24H10.75C9.64545 24 8.75 23.1046 8.75 22V19.5C8.75005 18.3955 9.64545 17.5 10.75 17.5Z" fill="currentColor" />
        <path d="M2.00002 17.5H4.5C5.60456 17.5 6.50002 18.3955 6.50002 19.5V22C6.50002 23.1046 5.60456 24 4.5 24H2.00002C0.895453 24 0 23.1046 0 22V19.5C0 18.3955 0.895453 17.5 2.00002 17.5Z" fill="currentColor" />
      </g>
    </svg>
  );
}

function centsToNumber(value: number | string | null) {
  if (value === null) return 0;
  return typeof value === 'string' ? Number(value) : value;
}

function compactRaiseAmount(value: number | string | null) {
  const amount = centsToNumber(value) / 100;

  if (!amount) {
    return null;
  }

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)} Million`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return `$${amount.toLocaleString('en-US')}`;
}

function compactMinAmount(value: number | string | null) {
  const amount = centsToNumber(value) / 100;

  if (!amount) {
    return null;
  }

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }

  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }

  return `$${amount.toLocaleString('en-US')}`;
}

function basisPointsToPercent(value: number | null) {
  if (value === null) return '';
  const percent = value / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function firstString(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  return typeof value === 'string' && value.trim() ? [value] : [];
}

function firstStringAt(value: unknown, index: number) {
  if (Array.isArray(value)) {
    return typeof value[index] === 'string' ? value[index] : '';
  }

  return index === 0 && typeof value === 'string' ? value : '';
}

function normalizeSectors(value: unknown) {
  const sectors = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];

  return Array.from(new Set(
    sectors.filter((sector): sector is string =>
      typeof sector === 'string'
      && sector.trim().length > 0
      && (INVESTOR_SECTORS as readonly string[]).includes(sector),
    ),
  ));
}

function OpportunitySectorPills({
  sectors,
  variant = 'default',
}: {
  sectors: unknown;
  variant?: 'default' | 'lite';
}) {
  const normalizedSectors = normalizeSectors(sectors);

  if (normalizedSectors.length === 0) {
    return null;
  }

  return (
    <div className="alignrow wrap">
      {normalizedSectors.map((sector) => (
        <div key={sector} className={`pillstat _5${variant === 'lite' ? ' litebg' : ''}`}>
          <div className={`pillicon-block${variant === 'lite' ? ' lite' : ''}`}>
            <WebflowSectorIcon sector={sector} className="pillicon" />
          </div>
          <div>{sector}</div>
        </div>
      ))}
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sectionTitle(section: SectionRow) {
  if (section.type === 'richContent') {
    return firstString(section.data['Rich-Text-Title']) || sectionFallbackLabels.richContent;
  }

  const prefix = sectionFallbackLabels[section.type] ?? section.type;
  return firstString(section.data[`${prefix}-Title`]) || prefix;
}

function sectionAnchor(section: SectionRow) {
  return slugify(sectionTitle(section)) || `${section.type}-${section.position}`;
}

function renderTiptapNode(node: TiptapNode, index = 0): React.ReactNode {
  if (node.type === 'text') {
    const text = node.text ?? '';
    return (node.marks ?? []).reduce<React.ReactNode>((children, mark) => {
      if (mark.type === 'bold') return <strong key={`${index}-bold`}>{children}</strong>;
      if (mark.type === 'italic') return <em key={`${index}-italic`}>{children}</em>;
      if (mark.type === 'underline') return <u key={`${index}-underline`}>{children}</u>;
      return children;
    }, text);
  }

  const children = node.content?.map((child, childIndex) => renderTiptapNode(child, childIndex));

  if (node.type === 'paragraph') return <p key={index}>{children}</p>;
  if (node.type === 'heading') {
    const level = node.attrs?.level === 1 || node.attrs?.level === 2 || node.attrs?.level === 3
      ? node.attrs.level
      : 2;
    const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3';
    return <HeadingTag key={index}>{children}</HeadingTag>;
  }
  if (node.type === 'bulletList') return <ul key={index}>{children}</ul>;
  if (node.type === 'orderedList') return <ol key={index}>{children}</ol>;
  if (node.type === 'listItem') return <li key={index}>{children}</li>;
  if (node.type === 'hardBreak') return <br key={index} />;

  return <div key={index}>{children}</div>;
}

function parseTiptapValue(value: string) {
  try {
    return value ? JSON.parse(value) as TiptapNode : null;
  } catch {
    return null;
  }
}

function RichTextValue({ value }: { value: string }) {
  const parsed = parseTiptapValue(value);

  return (
    <div className="richcontent w-richtext">
      {parsed?.content?.length
        ? parsed.content.map((node, index) => renderTiptapNode(node, index))
        : <p>{value}</p>}
    </div>
  );
}

function RichTextSection({ section }: { section: SectionRow }) {
  const title = sectionTitle(section);
  const body = firstString(section.data['Rich-Text-Body']);
  const parsedBody = parseTiptapValue(body);

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h2 className="contentheading">{title}</h2>
      <div className="richcontent w-richtext">
        {parsedBody?.content?.length
          ? parsedBody.content.map((node, index) => renderTiptapNode(node, index))
          : <p>Add rich text content in the editor, save, then preview it here.</p>}
      </div>
    </div>
  );
}

function LinksSection({ section }: { section: SectionRow }) {
  const title = sectionTitle(section);
  const description = firstString(section.data['Links-Description']);
  const linkTitles = asStringArray(section.data['Link-Title']);
  const linkUrls = asStringArray(section.data['Link-Url']);

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h1 className="contentheading">{title}</h1>
      {description ? <RichTextValue value={description} /> : null}
      <div className="articlelist">
        {linkTitles.map((linkTitle, index) => {
          const href = linkUrls[index] || '#';
          const domain = href === '#'
            ? 'Link'
            : new URL(href.startsWith('http') ? href : `https://${href}`).hostname.replace(/^www\./, '');

          return (
            <div className="articleitem" key={`${linkTitle}-${index}`}>
              <a href={href} target="_blank" rel="noreferrer" className="pagecard articlecard w-inline-block">
                <div className="articlethumbnail">
                  <img src="/webflow/images/link-alt.svg" loading="lazy" alt="" className="fullimage" />
                </div>
                <div className="articlecontent">
                  <div className="articletitle">{linkTitle}</div>
                  <div className="articledomain">{domain}</div>
                </div>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentsSection({ section }: { section: SectionRow }) {
  const title = sectionTitle(section);
  const description = firstString(section.data['Documents-Description']);
  const documents = asStringArray(section.data['Document-Title']);

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h1 className="contentheading">{title}</h1>
      {description ? <RichTextValue value={description} /> : null}
      <div className="teamlist">
        {documents.map((documentTitle, index) => (
          <div className="documentitem" key={`${documentTitle}-${index}`}>
            <a href="#" className="pagecard documents w-inline-block">
              <div className="documentsrow">
                <div className="documenticon">
                  <img src="/webflow/images/pdficon.svg" loading="lazy" alt="" className="docsicon" />
                </div>
                <div>
                  <div className="docname">{documentTitle}</div>
                  <div className="docdate">Last Updated: Just now</div>
                </div>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericSection({ section }: { section: SectionRow }) {
  const title = sectionTitle(section);
  const prefix = sectionFallbackLabels[section.type] ?? section.type;
  const description = firstString(section.data[`${prefix}-Description`]);

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h1 className="contentheading">{title}</h1>
      {description ? <RichTextValue value={description} /> : null}
    </div>
  );
}

function TeamLikeSection({
  section,
  assetUrls,
}: {
  section: SectionRow;
  assetUrls: Record<string, string>;
}) {
  const title = sectionTitle(section);
  const isInvestors = section.type === 'investors';
  const prefix = isInvestors ? 'Investor' : 'Team Member';
  const sectionPrefix = isInvestors ? 'Investors' : 'Team';
  const description = firstString(section.data[`${sectionPrefix}-Description`]);
  const legacyNames = asStringArray(section.data[`${prefix}-Name`]);
  const legacyCallouts = asStringArray(section.data[`${prefix}-Callout`]);
  const savedIds = Object.keys(section.data)
    .map((key) => key.match(new RegExp(`^${prefix}-(\\d+)-Name$`))?.[1])
    .filter((id): id is string => Boolean(id))
    .map(Number)
    .sort((a, b) => a - b);
  const peopleIds = savedIds.length
    ? savedIds
    : legacyNames.map((_, index) => index + 1);
  const legacyCalloutsForIndex = (index: number) => {
    if (peopleIds.length <= 1) {
      return legacyCallouts;
    }

    const baseCount = Math.floor(legacyCallouts.length / peopleIds.length);
    const remainder = legacyCallouts.length % peopleIds.length;
    const start = index * baseCount + Math.min(index, remainder);
    const count = baseCount + (index < remainder ? 1 : 0);
    return legacyCallouts.slice(start, start + count);
  };

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h1 className="contentheading">{title}</h1>
      {description ? <RichTextValue value={description} /> : null}
      <div className="teamlist">
        {peopleIds.map((personId, index) => {
          const name = firstString(section.data[`${prefix}-${personId}-Name`])
            || firstStringAt(section.data[`${prefix}-Name`], index);
          const personTitle = firstString(section.data[`${prefix}-${personId}-Title`])
            || firstStringAt(section.data[`${prefix}-Title`], index);
          const imageStorageKey = firstString(section.data[`${prefix}-${personId}-Image-Storage-Key`])
            || firstStringAt(section.data[`${prefix}-Image-Storage-Key`], index);
          const personCallouts = asStringArray(section.data[`${prefix}-${personId}-Callout`]);
          const callouts = personCallouts.length ? personCallouts : legacyCalloutsForIndex(index);

          return (
          <div className="teamitem" key={`${name}-${index}`}>
            <div className="pagecard full">
              <div className="teamhead-row">
                <a href="#" className={`teamthumbnail${isInvestors ? ' med' : ''} w-inline-block`}>
                  <img
                    src={imageStorageKey
                      ? assetUrls[imageStorageKey] ?? (isInvestors
                        ? '/webflow/images/harpoon_ventures_portfolio_logo.jpeg'
                        : '/webflow/images/photograph.svg')
                      : isInvestors
                        ? '/webflow/images/harpoon_ventures_portfolio_logo.jpeg'
                        : '/webflow/images/photograph.svg'}
                    loading="lazy"
                    alt=""
                    className="fullimage"
                  />
                </a>
                <div>
                  <div>
                    <div className="teamname">{name}</div>
                    <div className="teamtitle">{personTitle}</div>
                  </div>
                </div>
              </div>
              {callouts.length > 0 ? (
                <div className="teamcallouts">
                  {callouts.map((callout, calloutIndex) => (
                    <div className="teamcallout" key={`${callout}-${calloutIndex}`}>
                      <div>{callout}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function OpportunitySection({
  section,
  assetUrls,
}: {
  section: SectionRow;
  assetUrls: Record<string, string>;
}) {
  if (section.type === 'richContent') return <RichTextSection section={section} />;
  if (section.type === 'links') return <LinksSection section={section} />;
  if (section.type === 'documents') return <DocumentsSection section={section} />;
  if (section.type === 'team' || section.type === 'investors') {
    return <TeamLikeSection section={section} assetUrls={assetUrls} />;
  }
  return <GenericSection section={section} />;
}

export default async function OpportunityPreviewPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { opportunityId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const { data: lp } = await supabase
    .from('lps')
    .select('status')
    .eq('profile_id', user.id)
    .maybeSingle();
  const isAdmin = profile?.role === 'admin';

  if (!isAdmin && lp?.status !== 'approved') {
    redirect('/onboarding');
  }

  const contentClient = isAdmin ? supabase : serverSupabase;
  const { data: opportunity } = await contentClient
    .from('opportunities')
    .select(
      `
        id,
        slug,
        title,
        teaser,
        opportunity_sectors,
        stage,
        target_allocation_cents,
        minimum_investment_cents,
        origination_fee_cents,
        carry_percentage_basis_points,
        management_fee_basis_points,
        thumbnail_storage_key,
        logo_storage_key,
        status,
        password_protected
      `,
    )
    .eq('slug', opportunityId)
    .is('archived_at', null)
    .maybeSingle();

  if (!opportunity || (!isAdmin && !['active', 'potential'].includes(opportunity.status))) {
    notFound();
  }

  if (!isAdmin && opportunity.password_protected) {
    notFound();
  }

  if (!isAdmin) {
    await supabase.from('audit_log').insert({
      actor_profile_id: user.id,
      actor_role: 'lp',
      action: 'opportunity.viewed',
      entity_type: 'opportunity',
      entity_id: opportunity.id,
      metadata: { slug: opportunity.slug },
    });
  }

  const { data: sections } = await contentClient
    .from('opportunity_sections')
    .select('type, position, data')
    .eq('opportunity_id', opportunity.id)
    .order('position', { ascending: true });

  const signedAssetUrl = async (storageKey: string | null) => {
    if (!storageKey) return null;
    const { data } = await supabase.storage
      .from('opportunity-assets')
      .createSignedUrl(storageKey, 60 * 60);
    return data?.signedUrl ?? null;
  };

  const [thumbnailUrl, logoUrl] = await Promise.all([
    signedAssetUrl(opportunity.thumbnail_storage_key),
    signedAssetUrl(opportunity.logo_storage_key),
  ]);
  const orderedSections = (sections ?? []) as SectionRow[];
  const sectionAssetKeys = Array.from(new Set(
    orderedSections.flatMap((section) =>
      Object.entries(section.data).flatMap(([key, value]) =>
        key.endsWith('Image-Storage-Key') ? asStringArray(value) : [],
      ),
    ),
  ));
  const sectionAssetUrlEntries = await Promise.all(
    sectionAssetKeys.map(async (storageKey) => [
      storageKey,
      await signedAssetUrl(storageKey),
    ] as const),
  );
  const sectionAssetUrls = Object.fromEntries(
    sectionAssetUrlEntries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
  const carry = basisPointsToPercent(opportunity.carry_percentage_basis_points);
  const managementFee = basisPointsToPercent(opportunity.management_fee_basis_points);
  const raiseLabel = compactRaiseAmount(opportunity.target_allocation_cents);
  const minimumLabel = compactMinAmount(opportunity.minimum_investment_cents);
  const originationFeeLabel = compactMinAmount(opportunity.origination_fee_cents);
  const sectionNavItems = orderedSections.map((section) => ({
    href: `#${sectionAnchor(section)}`,
    label: sectionTitle(section),
  }));

  return (
    <>
      <WebflowStyles />
      <div className="pagewrapper">
        <div className="pagenav">
          <div className="pagecontainer navcontainer">
            <div className="navalign">
              <Link href="/opportunities" className="navlogo-link w-inline-block">
                <img
                  loading="lazy"
                  src="/webflow/images/Harpoon-Logo.png"
                  alt="Harpoon"
                  sizes="(max-width: 931px) 100vw, 931px"
                  srcSet="/webflow/images/Harpoon-Logo-p-500.png 500w, /webflow/images/Harpoon-Logo-p-800.png 800w, /webflow/images/Harpoon-Logo.png 931w"
                  className="navlogo"
                />
              </Link>
              <div className="navalign">
                <Link href="/opportunities" className="navlink w-inline-block">
                  <div>All Opportunities</div>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="pagecontainer">
          <div className="pagecontent">
            <div className="tocwrapper">
              <div className="toclist">
                {orderedSections.map((section) => (
                  <a key={`${section.type}-${section.position}`} href="#" className="tocline w-inline-block" />
                ))}
              </div>
            </div>
            <div className="pagemain nogap">
              <div className="breadcrumbrow">
                <Link href="/opportunities" className="breadcrumbicon w-inline-block">
                  <HomeIcon />
                </Link>
                <div className="breadcrumbdivider">//</div>
                <Link href={`/opportunities/${opportunity.slug}`} className="breadcrumbicon w-inline-block">
                  <img src={logoUrl ?? defaultLogo} loading="lazy" alt="" className="fullimage" />
                </Link>
                <Link href={`/opportunities/${opportunity.slug}`} className="breadcrumblink w--current">
                  {opportunity.title}
                </Link>
              </div>
              {sectionNavItems.length > 1 ? <SectionMiniNav items={sectionNavItems} /> : null}
              <div className="herocard">
                <img
                  src={thumbnailUrl ?? defaultThumbnail}
                  loading="lazy"
                  sizes="100vw"
                  alt=""
                  className="fullimage"
                />
                <div className="herooverlay">
                  <div className="herologo-row">
                    <div className="herologo">
                      <img src={logoUrl ?? defaultLogo} loading="lazy" alt="" className="fullimage" />
                    </div>
                    <div className="herocontent">
                      <div className="heroheading">{opportunity.title}</div>
                      <div className="herosubheading">{opportunity.teaser}</div>
                      <div className="hero-pill-stack">
                        <OpportunitySectorPills sectors={opportunity.opportunity_sectors} variant="lite" />
                        <div className="herostats-row">
                          <div className="alignrow">
                            {raiseLabel ? (
                              <div className="pillstat litebg">
                                <div>{raiseLabel}</div>
                              </div>
                            ) : null}
                            <div className="pillstat litebg">
                              <div>{carry ? `${carry} Carry` : '0% Carry'}</div>
                            </div>
                            <div className="pillstat litebg">
                              <div>{managementFee ? `${managementFee} Fee` : 'No Fee'}</div>
                            </div>
                            {originationFeeLabel ? (
                              <div className="pillstat litebg">
                                <div><span className="dimish">Origination:</span> {originationFeeLabel}</div>
                              </div>
                            ) : null}
                          </div>
                          <div className="statdivider" />
                          <div className="alignrow">
                            <div className="pillstat litebg">
                              <div><span className="dimish">Stage:</span> {opportunity.stage}</div>
                            </div>
                            {minimumLabel ? (
                              <div className="pillstat litebg">
                                <div><span className="dimish">Min:</span> {minimumLabel}</div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {orderedSections.map((section) => (
                <OpportunitySection
                  key={`${section.type}-${section.position}`}
                  section={section}
                  assetUrls={sectionAssetUrls}
                />
              ))}
            </div>
            <div className="pageside">
              <div className="pagecard sidecard">
                <div className="cardblock">
                  <div className="alignrow _10">
                    <div className="cardlogo sm">
                      <img src={logoUrl ?? defaultLogo} loading="lazy" alt="" className="fullimage" />
                    </div>
                    <div>
                      <div className="sideheading">{opportunity.title}</div>
                      <div className="sidesubheading">{opportunity.teaser}</div>
                    </div>
                  </div>
                  <div className="div-block-2">
                    <OpportunitySectorPills sectors={opportunity.opportunity_sectors} />
                    <div className="alignrow wrap">
                      {raiseLabel ? (
                        <div className="pillstat">
                          <div>{raiseLabel}</div>
                        </div>
                      ) : null}
                      <div className="pillstat">
                        <div>{carry ? `${carry} Carry` : '0% Carry'}</div>
                      </div>
                      <div className="pillstat">
                        <div>{managementFee ? `${managementFee} Fee` : 'No Fee'}</div>
                      </div>
                      {originationFeeLabel ? (
                        <div className="pillstat">
                          <div><span className="dimish">Origination:</span> {originationFeeLabel}</div>
                        </div>
                      ) : null}
                    </div>
                    <div className="alignrow wrap">
                      <div className="pillstat">
                        <div><span className="dimish">Stage:</span> {opportunity.stage}</div>
                      </div>
                      {minimumLabel ? (
                        <div className="pillstat">
                          <div><span className="dimish">Min:</span> {minimumLabel}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="cardblock reserve-interest-cardblock">
                  <div>
                    <div className="sideheading">Reserve Interest</div>
                    <div className="sidesubheading">Update the opportunity with your interest and estimated check</div>
                  </div>
                  <div className="formblock w-form">
                    <OpportunityInterestCard
                      minimumInvestmentCents={centsToNumber(opportunity.minimum_investment_cents)}
                      opportunityId={opportunity.id}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
