import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import {
  getAccountNdaCeremonyForOutsider,
  getOutsiderAccountNdaGateState,
} from '@/app/account/nda/actions';
import { GlanceChatWidget } from '@/components/glance-chat-widget';
import { DocumentViewerDrawer } from '@/components/webflow/document-viewer-drawer';
import { OpportunityInterestCard } from '@/components/webflow/opportunity-interest-card';
import { OpportunityPasswordGate } from '@/components/webflow/opportunity-password-gate';
import { OutsiderNdaGate } from '@/components/webflow/outsider-account-nda';
import { PageWatermark } from '@/components/webflow/page-watermark';
import { SectionMiniNav } from '@/components/webflow/section-mini-nav';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import { WebflowStyles } from '@/components/webflow/webflow-styles';
import { INVESTOR_SECTORS } from '@/lib/investor-request';
import {
  opportunityAccessCookieName,
  verifyOpportunityAccessToken,
} from '@/lib/opportunity-access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const SHAREABLE_STATUSES = ['active', 'potential', 'coming_soon', 'closed'];

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
  links: 'News and Milestones',
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

function WebsiteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="socialicon">
      <path d="M2 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(90 12 12)" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="socialicon">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.42857 8.96884H13.1429V10.8193C13.6783 9.75524 15.0503 8.79887 17.1114 8.79887C21.0623 8.79887 22 10.9167 22 14.8028V22H18V15.6878C18 13.4748 17.4646 12.2266 16.1029 12.2266C14.2143 12.2266 13.4286 13.5722 13.4286 15.6878V22H9.42857V8.96884ZM2.57143 21.83H6.57143V8.79887H2.57143V21.83ZM7.14286 4.54958C7.14286 4.88439 7.07635 5.21593 6.94712 5.52526C6.81789 5.83458 6.62848 6.11565 6.3897 6.3524C6.15092 6.58915 5.86745 6.77695 5.55547 6.90508C5.24349 7.0332 4.90911 7.09915 4.57143 7.09915C4.23374 7.09915 3.89937 7.0332 3.58739 6.90508C3.27541 6.77695 2.99193 6.58915 2.75315 6.3524C2.51437 6.11565 2.32496 5.83458 2.19574 5.52526C2.06651 5.21593 2 4.88439 2 4.54958C2 3.87339 2.27092 3.22489 2.75315 2.74675C3.23539 2.26862 3.88944 2 4.57143 2C5.25341 2 5.90747 2.26862 6.3897 2.74675C6.87194 3.22489 7.14286 3.87339 7.14286 4.54958Z"
        fill="currentColor"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" className="socialicon">
      <path
        d="M13.8076 10.4686L20.8808 2H19.2046L13.063 9.3532L8.15769 2H2.5L9.91779 13.1193L2.5 22H4.17621L10.6619 14.2348L15.8423 22H21.5L13.8072 10.4686H13.8076ZM11.5118 13.2173L10.7602 12.1101L4.78017 3.29968H7.35474L12.1807 10.4099L12.9323 11.5172L19.2054 20.7594H16.6309L11.5118 13.2177V13.2173Z"
        fill="currentColor"
      />
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

function externalUrl(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
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

function asNumberArray(value: unknown) {
  return asStringArray(value)
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
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

function LinksSection({
  section,
  assetUrls,
}: {
  section: SectionRow;
  assetUrls: Record<string, string>;
}) {
  const title = sectionTitle(section);
  const description = firstString(section.data['Links-Description']);
  const linkTitles = asStringArray(section.data['Link-Title']);
  const linkUrls = asStringArray(section.data['Link-Url']);
  const linkImageStorageKeys = asStringArray(section.data['Link-Image-Storage-Key']);

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h1 className="contentheading">{title}</h1>
      {description ? <RichTextValue value={description} /> : null}
      <div className="articlelist">
        {linkTitles.map((linkTitle, index) => {
          const href = linkUrls[index] || '#';
          const imageStorageKey = linkImageStorageKeys[index] ?? '';
          const domain = href === '#'
            ? 'Link'
            : new URL(href.startsWith('http') ? href : `https://${href}`).hostname.replace(/^www\./, '');

          return (
            <div className="articleitem" key={`${linkTitle}-${index}`}>
              <a href={href} target="_blank" rel="noreferrer" className="pagecard articlecard w-inline-block">
                <div className="articlethumbnail">
                  <img
                    src={assetUrls[imageStorageKey] ?? '/webflow/images/link-alt.svg'}
                    loading="lazy"
                    alt=""
                    className="fullimage"
                  />
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

function DocumentsSection({
  section,
  assetUrls,
  watermarkEmail,
}: {
  section: SectionRow;
  assetUrls: Record<string, string>;
  watermarkEmail: string;
}) {
  const title = sectionTitle(section);
  const description = firstString(section.data['Documents-Description']);
  const documents = asStringArray(section.data['Document-Title']);
  const documentStorageKeys = asStringArray(section.data['Document-Storage-Key']);
  const documentItems = documents.map((documentTitle, index) => {
    const storageKey = documentStorageKeys[index] ?? '';

    return {
      title: documentTitle,
      url: assetUrls[storageKey] ?? '',
      fileType: storageKey.toLowerCase().endsWith('.docx') ? 'docx' as const : 'pdf' as const,
    };
  });

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h1 className="contentheading">{title}</h1>
      {description ? <RichTextValue value={description} /> : null}
      <DocumentViewerDrawer documents={documentItems} watermarkEmail={watermarkEmail} />
    </div>
  );
}

const teamMemberSocialPlatforms = [
  {
    label: 'Website',
    className: 'sociallink web w-inline-block',
    icon: <WebsiteIcon />,
  },
  {
    label: 'LinkedIn',
    className: 'sociallink w-inline-block',
    icon: <LinkedInIcon />,
  },
  {
    label: 'X / Twitter',
    className: 'sociallink x w-inline-block',
    icon: <XIcon />,
  },
] as const;

function personSocialLinks(
  data: Record<string, unknown>,
  prefix: string,
  personId: number,
) {
  return teamMemberSocialPlatforms.flatMap((platform) => {
    const href = externalUrl(firstString(data[`${prefix}-${personId}-${platform.label}-Url`]));
    return href ? [{ ...platform, href }] : [];
  });
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
    .map(Number);
  const uniqueSavedIds = Array.from(new Set(savedIds));
  const savedOrder = asNumberArray(section.data[`${sectionPrefix}-Order`]);
  const peopleIds = savedOrder.length
    ? [
        ...savedOrder.filter((id) => uniqueSavedIds.includes(id)),
        ...uniqueSavedIds.filter((id) => !savedOrder.includes(id)).sort((a, b) => a - b),
      ]
    : uniqueSavedIds.length
      ? uniqueSavedIds.sort((a, b) => a - b)
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
          const socialLinks = personSocialLinks(section.data, prefix, personId);
          const thumbnailHref = socialLinks.find((link) => link.label === 'LinkedIn')?.href ?? '#';

          return (
          <div className="teamitem" key={`${name}-${index}`}>
            <div className="pagecard full">
              <div className="teamhead-row">
                <a
                  href={thumbnailHref}
                  target={thumbnailHref !== '#' ? '_blank' : undefined}
                  rel={thumbnailHref !== '#' ? 'noopener noreferrer' : undefined}
                  className={`teamthumbnail${isInvestors ? ' med' : ''} w-inline-block`}
                >
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
                  {socialLinks.length > 0 ? (
                    <div className="socialsrow">
                      {socialLinks.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={link.className}
                        >
                          {link.icon}
                        </a>
                      ))}
                    </div>
                  ) : null}
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
  watermarkEmail,
}: {
  section: SectionRow;
  assetUrls: Record<string, string>;
  watermarkEmail: string;
}) {
  if (section.type === 'richContent') return <RichTextSection section={section} />;
  if (section.type === 'links') return <LinksSection section={section} assetUrls={assetUrls} />;
  if (section.type === 'documents') {
    return <DocumentsSection section={section} assetUrls={assetUrls} watermarkEmail={watermarkEmail} />;
  }
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
  const { opportunityId } = await params;
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  const supabase = createSupabaseAdminClient();

  let isAdmin = false;
  let lp: { id: string; status: string } | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = profile?.role === 'admin';
    const { data: lpRow } = await supabase
      .from('lps')
      .select('id, status')
      .eq('profile_id', user.id)
      .maybeSingle();
    lp = lpRow;
  }

  // Lightweight gate lookup. Always via the service-role client because an
  // outsider (no auth session) must be able to reach the password gate, and
  // because we need to know whether the opportunity is password protected
  // before deciding how to authorize the viewer.
  const { data: gate } = await supabase
    .from('opportunities')
    .select('id, slug, title, teaser, status, password_protected')
    .eq('slug', opportunityId)
    .is('archived_at', null)
    .maybeSingle();

  if (!gate) {
    notFound();
  }

  // status is the single source of truth for "not in Draft"; published_at no
  // longer gates visibility. A draft is never shareable (admin-only).
  const isShareable = SHAREABLE_STATUSES.includes(gate.status);

  const isApprovedLp = lp?.status === 'approved';

  // Resolve the outsider access cookie for password-protected opportunities.
  let guestEmail: string | null = null;
  if (gate.password_protected && !isAdmin && !isApprovedLp) {
    const cookieStore = await cookies();
    const token = cookieStore.get(opportunityAccessCookieName(gate.id))?.value;
    guestEmail = verifyOpportunityAccessToken(token, gate.id);
  }

  // Password-protected, shared via direct link: outsiders (not admins or approved
  // LPs) must unlock with the admin-chosen password + their email. A draft that
  // is also password protected is admin-only (never shareable).
  if (gate.password_protected && !isAdmin && !isApprovedLp) {
    if (!isShareable) {
      notFound();
    }

    if (!guestEmail) {
      return (
        <>
          <WebflowStyles />
          <OpportunityPasswordGate slug={gate.slug} title={gate.title} teaser={gate.teaser} />
        </>
      );
    }
  }

  // Invited LP-only behavior for non-outsider viewers.
  if (!gate.password_protected || isApprovedLp) {
    if (!user) {
      redirect('/login');
    }

    if (!isAdmin && lp?.status !== 'approved') {
      redirect('/onboarding');
    }
  }

  const viewerKind: 'admin' | 'lp' | 'guest' = isAdmin
    ? 'admin'
    : guestEmail
      ? 'guest'
      : 'lp';
  const isGuest = viewerKind === 'guest';
  const canAccessOpportunitiesList = isAdmin || lp?.status === 'approved';
  const viewerEmail = isGuest ? (guestEmail ?? '') : (user?.email ?? '');

  // Hard NDA gate for OUTSIDERS only. Before touching the opportunity body,
  // sections, or signed-asset URLs, an unlocked outsider must have signed the
  // standard ACCOUNT-level NDA. This does not affect admins or invited LPs.
  // Graceful allow-through when no account-default template is configured (so a
  // missing admin default never locks everyone out) or when the NDA is signed.
  if (isGuest) {
    const ndaGate = await getOutsiderAccountNdaGateState(gate.id);
    if (ndaGate.hasAccountTemplate && !ndaGate.signed) {
      const ceremony = await getAccountNdaCeremonyForOutsider(gate.id);

      // `already_signed`/`skipped` (signed in a race, or no resolvable lp row)
      // fall through to the normal render; only block on success/error. The
      // gate intentionally shows NO opportunity title, teaser, or body — the
      // full split-panel ceremony lives in OutsiderNdaGate.
      if (ceremony.status === 'success' || ceremony.status === 'error') {
        return (
          <>
            <WebflowStyles />
            <OutsiderNdaGate result={ceremony} opportunityId={gate.id} />
          </>
        );
      }
    }
  }

  // Belt and suspenders: admins and outsiders read via the service-role client
  // (guarded by the checks above); invited LPs read via their RLS-bound session
  // so the database independently enforces their access.
  const contentClient = viewerKind === 'lp' ? serverSupabase : supabase;
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
        website_url,
        linkedin_url,
        twitter_url,
        thumbnail_storage_key,
        logo_storage_key,
        status,
        password_protected,
        watermark_enabled
      `,
    )
    .eq('slug', opportunityId)
    .is('archived_at', null)
    .maybeSingle();

  if (!opportunity || (viewerKind !== 'admin' && !isShareable)) {
    notFound();
  }

  // Resolve the viewer's LP id for interest lookups: invited LP via session,
  // outsider via the email they unlocked with.
  let interestLpId: string | null = lp?.id ?? null;
  if (isGuest && guestEmail) {
    const { data: guestLp } = await supabase
      .from('lps')
      .select('id')
      .eq('email', guestEmail)
      .maybeSingle();
    interestLpId = guestLp?.id ?? null;
  }

  if (viewerKind === 'lp') {
    await supabase.from('audit_log').insert({
      actor_profile_id: user?.id ?? null,
      actor_role: 'lp',
      action: 'opportunity.viewed',
      entity_type: 'opportunity',
      entity_id: opportunity.id,
      metadata: { slug: opportunity.slug },
    });
  } else if (isGuest) {
    await supabase.from('audit_log').insert({
      actor_profile_id: null,
      actor_role: 'lp',
      action: 'opportunity.viewed',
      entity_type: 'opportunity',
      entity_id: opportunity.id,
      metadata: { slug: opportunity.slug, lp_id: interestLpId, source: 'password_gate' },
    });
  }

  let existingInterest: {
    amount_cents: number | string | null;
    status: string;
  } | null = null;

  if (interestLpId) {
    const { data } = await supabase
      .from('interests')
      .select('amount_cents, status')
      .eq('opportunity_id', opportunity.id)
      .eq('lp_id', interestLpId)
      .is('withdrawn_at', null)
      .maybeSingle();

    existingInterest = data;
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
        key.endsWith('Storage-Key') ? asStringArray(value) : [],
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
  const stageLabel = opportunity.stage?.trim() || null;
  const showDealTerms = opportunity.status !== 'closed'
    && opportunity.status !== 'potential'
    && opportunity.status !== 'coming_soon';
  const useCompactHeroMetaRow = opportunity.status === 'closed'
    || opportunity.status === 'potential'
    || opportunity.status === 'coming_soon';
  const hasPrimaryStats = Boolean(raiseLabel || originationFeeLabel || showDealTerms);
  const initialInterestAmountCents = existingInterest?.amount_cents == null
    ? null
    : centsToNumber(existingInterest.amount_cents);
  const socialLinks = [
    {
      href: externalUrl(opportunity.website_url),
      label: 'Website',
      className: 'sociallink website web w-inline-block',
      icon: <WebsiteIcon />,
    },
    {
      href: externalUrl(opportunity.linkedin_url),
      label: 'LinkedIn',
      className: 'sociallink w-inline-block',
      icon: <LinkedInIcon />,
    },
    {
      href: externalUrl(opportunity.twitter_url),
      label: 'Twitter / X',
      className: 'sociallink x w-inline-block',
      icon: <XIcon />,
    },
  ].flatMap((link) => (link.href ? [{ ...link, href: link.href }] : []));
  const sectionNavItems = orderedSections.map((section) => ({
    href: `#${sectionAnchor(section)}`,
    label: sectionTitle(section),
  }));

  return (
    <>
      <WebflowStyles />
      <div id="opportunity-top" className="pagewrapper speevy-opportunity-detail">
        {opportunity.watermark_enabled ? <PageWatermark email={viewerEmail} /> : null}
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
              {canAccessOpportunitiesList ? (
                <div className="navalign">
                  <Link href="/opportunities" className="navlink w-inline-block">
                    <div>All Opportunities</div>
                  </Link>
                </div>
              ) : null}
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
                {canAccessOpportunitiesList ? (
                  <>
                    <Link href="/opportunities" className="breadcrumbicon w-inline-block">
                      <HomeIcon />
                    </Link>
                    <div className="breadcrumbdivider">//</div>
                  </>
                ) : null}
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
                        {socialLinks.length > 0 ? (
                          <>
                            <div className="herostats-row">
                              <div className="alignrow">
                                {socialLinks.map((link) => (
                                  <a
                                    key={link.label}
                                    href={link.href}
                                    className="pillstat litebg link hero-social-link w-inline-block"
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={link.label}
                                  >
                                    {link.icon}
                                  </a>
                                ))}
                              </div>
                            </div>
                            <div className="hero-social-divider" />
                          </>
                        ) : null}
                        {useCompactHeroMetaRow ? (
                          <div
                            className={`herostats-row ${opportunity.status === 'closed' ? 'closed-hero-meta-row' : 'past-hero-meta-row'}`}
                          >
                            <OpportunitySectorPills sectors={opportunity.opportunity_sectors} variant="lite" />
                            {stageLabel || minimumLabel ? (
                              <div className="alignrow">
                                {stageLabel ? (
                                  <div className="pillstat litebg">
                                    <div><span className="dimish">Stage:</span> {stageLabel}</div>
                                  </div>
                                ) : null}
                                {minimumLabel ? (
                                  <div className="pillstat litebg">
                                    <div><span className="dimish">Min:</span> {minimumLabel}</div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <>
                            <OpportunitySectorPills sectors={opportunity.opportunity_sectors} variant="lite" />
                            <div className="herostats-row">
                              {hasPrimaryStats ? (
                                <>
                                  <div className="alignrow">
                                    {raiseLabel ? (
                                      <div className="pillstat litebg">
                                        <div>{raiseLabel}</div>
                                      </div>
                                    ) : null}
                                    {showDealTerms ? (
                                      <>
                                        <div className="pillstat litebg">
                                          <div>{carry ? `${carry} Carry` : '0% Carry'}</div>
                                        </div>
                                        <div className="pillstat litebg">
                                          <div>{managementFee ? `${managementFee} Fee` : 'No Fee'}</div>
                                        </div>
                                      </>
                                    ) : null}
                                    {originationFeeLabel ? (
                                      <div className="pillstat litebg">
                                        <div><span className="dimish">Origination:</span> {originationFeeLabel}</div>
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="statdivider" />
                                </>
                              ) : null}
                              {stageLabel || minimumLabel ? (
                                <div className="alignrow">
                                  {stageLabel ? (
                                    <div className="pillstat litebg">
                                      <div><span className="dimish">Stage:</span> {stageLabel}</div>
                                    </div>
                                  ) : null}
                                  {minimumLabel ? (
                                    <div className="pillstat litebg">
                                      <div><span className="dimish">Min:</span> {minimumLabel}</div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
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
                  watermarkEmail={viewerEmail}
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
                      {socialLinks.length > 0 ? (
                        <div className="alignrow sidecard-social-row">
                          {socialLinks.map((link) => (
                            <a
                              key={link.label}
                              href={link.href}
                              className={link.className}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={link.label}
                            >
                              {link.icon}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="sidecard-info-divider" />
                  <div className="div-block-2">
                    {useCompactHeroMetaRow ? (
                      <div className="alignrow wrap">
                        <OpportunitySectorPills sectors={opportunity.opportunity_sectors} />
                        {stageLabel ? (
                          <div className="pillstat">
                            <div><span className="dimish">Stage:</span> {stageLabel}</div>
                          </div>
                        ) : null}
                        {minimumLabel ? (
                          <div className="pillstat">
                            <div><span className="dimish">Min:</span> {minimumLabel}</div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <OpportunitySectorPills sectors={opportunity.opportunity_sectors} />
                        {hasPrimaryStats ? (
                          <div className="alignrow wrap">
                            {raiseLabel ? (
                              <div className="pillstat">
                                <div>{raiseLabel}</div>
                              </div>
                            ) : null}
                            {showDealTerms ? (
                              <>
                                <div className="pillstat">
                                  <div>{carry ? `${carry} Carry` : '0% Carry'}</div>
                                </div>
                                <div className="pillstat">
                                  <div>{managementFee ? `${managementFee} Fee` : 'No Fee'}</div>
                                </div>
                              </>
                            ) : null}
                            {originationFeeLabel ? (
                              <div className="pillstat">
                                <div><span className="dimish">Origination:</span> {originationFeeLabel}</div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {stageLabel || minimumLabel ? (
                          <div className="alignrow wrap">
                            {stageLabel ? (
                              <div className="pillstat">
                                <div><span className="dimish">Stage:</span> {stageLabel}</div>
                              </div>
                            ) : null}
                            {minimumLabel ? (
                              <div className="pillstat">
                                <div><span className="dimish">Min:</span> {minimumLabel}</div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <div className="cardblock reserve-interest-cardblock">
                  <div>
                    <div className="sideheading">
                      {opportunity.status === 'closed' ? 'Interested?' : 'Reserve Interest'}
                    </div>
                    <div className="sidesubheading">
                      {opportunity.status === 'closed'
                        ? 'Let us know if you would like updates if this opportunity becomes available again.'
                        : 'Update the opportunity with your interest and estimated check'}
                    </div>
                  </div>
                  <div className="formblock w-form">
                    <OpportunityInterestCard
                      initialAmountCents={initialInterestAmountCents}
                      initialInterested={Boolean(existingInterest)}
                      minimumInvestmentCents={centsToNumber(opportunity.minimum_investment_cents)}
                      opportunityId={opportunity.id}
                      variant={opportunity.status === 'closed' ? 'closed' : 'standard'}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Logged-in viewers only — guest shared-link views must not load the widget. */}
        {isGuest ? null : <GlanceChatWidget />}
      </div>
    </>
  );
}
