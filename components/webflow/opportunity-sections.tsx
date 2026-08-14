import { DocumentViewerDrawer } from '@/components/webflow/document-viewer-drawer';
import { GalleryLightbox } from '@/components/webflow/gallery-lightbox';
import { LinkedInIcon, WebsiteIcon, XIcon } from '@/components/webflow/opportunity-icons';
import { WebflowSectorIcon } from '@/components/webflow/sector-icon';
import { formatNewsMilestonePublicationLine } from '@/lib/opportunity/news-milestones';
import {
  asNumberArray,
  asStringArray,
  defaultOpportunityLogo,
  defaultOpportunityThumbnail,
  externalUrl,
  firstString,
  firstStringAt,
  isIncludedInExport,
  normalizeSectors,
  parseTiptapValue,
  sectionAnchor,
  sectionFallbackLabels,
  sectionTitle,
  type OpportunitySectionRow,
  type TiptapNode,
} from '@/lib/opportunity/section-data';

export type OpportunityHeroModel = {
  title: string;
  teaser: string | null;
  status: string;
  sectors: unknown;
  thumbnailUrl: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  raiseLabel: string | null;
  originationFeeLabel: string | null;
  carry: string;
  managementFee: string;
  stageLabel: string | null;
  minimumLabel: string | null;
};

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
    // Dynamic heading tag is constrained to h1–h3 by the level check above.
    const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3';
    return <HeadingTag key={index}>{children}</HeadingTag>;
  }
  if (node.type === 'bulletList') return <ul key={index}>{children}</ul>;
  if (node.type === 'orderedList') return <ol key={index}>{children}</ol>;
  if (node.type === 'listItem') return <li key={index}>{children}</li>;
  if (node.type === 'hardBreak') return <br key={index} />;

  return <div key={index}>{children}</div>;
}

export function RichTextValue({ value }: { value: string }) {
  const parsed = parseTiptapValue(value);

  return (
    <div className="richcontent w-richtext">
      {parsed?.content?.length
        ? parsed.content.map((node, index) => renderTiptapNode(node, index))
        : <p>{value}</p>}
    </div>
  );
}

export function OpportunitySectorPills({
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

export function opportunitySocialLinks(opportunity: Pick<OpportunityHeroModel, 'websiteUrl' | 'linkedinUrl' | 'twitterUrl'>) {
  return [
    {
      href: externalUrl(opportunity.websiteUrl),
      label: 'Website',
      className: 'sociallink website web w-inline-block',
      icon: <WebsiteIcon />,
    },
    {
      href: externalUrl(opportunity.linkedinUrl),
      label: 'LinkedIn',
      className: 'sociallink w-inline-block',
      icon: <LinkedInIcon />,
    },
    {
      href: externalUrl(opportunity.twitterUrl),
      label: 'Twitter / X',
      className: 'sociallink x w-inline-block',
      icon: <XIcon />,
    },
  ].flatMap((link) => (link.href ? [{ ...link, href: link.href }] : []));
}

export function OpportunityHero({
  opportunity,
  thumbnailUrl,
  logoUrl,
  imageLoading = 'lazy',
}: {
  opportunity: OpportunityHeroModel;
  thumbnailUrl: string | null;
  logoUrl: string | null;
  imageLoading?: 'lazy' | 'eager';
}) {
  const socialLinks = opportunitySocialLinks(opportunity);
  const showDealTerms = opportunity.status !== 'closed'
    && opportunity.status !== 'potential'
    && opportunity.status !== 'upcoming';
  const useCompactHeroMetaRow = opportunity.status === 'closed'
    || opportunity.status === 'potential'
    || opportunity.status === 'upcoming';
  const hasPrimaryStats = Boolean(
    opportunity.raiseLabel || opportunity.originationFeeLabel || showDealTerms,
  );

  return (
    <div className="herocard">
      <img
        src={thumbnailUrl ?? defaultOpportunityThumbnail}
        loading={imageLoading}
        sizes="100vw"
        alt=""
        className="fullimage"
      />
      <div className="herooverlay">
        <div className="herologo-row">
          <div className="herologo">
            <img src={logoUrl ?? defaultOpportunityLogo} loading={imageLoading} alt="" className="fullimage" />
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
                  <OpportunitySectorPills sectors={opportunity.sectors} variant="lite" />
                  {opportunity.stageLabel || opportunity.minimumLabel ? (
                    <div className="alignrow">
                      {opportunity.stageLabel ? (
                        <div className="pillstat litebg">
                          <div><span className="dimish">Stage:</span> {opportunity.stageLabel}</div>
                        </div>
                      ) : null}
                      {opportunity.minimumLabel ? (
                        <div className="pillstat litebg">
                          <div><span className="dimish">Min:</span> {opportunity.minimumLabel}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <OpportunitySectorPills sectors={opportunity.sectors} variant="lite" />
                  <div className="herostats-row">
                    {hasPrimaryStats ? (
                      <>
                        <div className="alignrow">
                          {opportunity.raiseLabel ? (
                            <div className="pillstat litebg">
                              <div>{opportunity.raiseLabel}</div>
                            </div>
                          ) : null}
                          {showDealTerms ? (
                            <>
                              <div className="pillstat litebg">
                                <div>{opportunity.carry ? `${opportunity.carry} Carry` : '0% Carry'}</div>
                              </div>
                              <div className="pillstat litebg">
                                <div>{opportunity.managementFee ? `${opportunity.managementFee} Fee` : 'No Fee'}</div>
                              </div>
                            </>
                          ) : null}
                          {opportunity.originationFeeLabel ? (
                            <div className="pillstat litebg">
                              <div><span className="dimish">Origination:</span> {opportunity.originationFeeLabel}</div>
                            </div>
                          ) : null}
                        </div>
                        <div className="statdivider" />
                      </>
                    ) : null}
                    {opportunity.stageLabel || opportunity.minimumLabel ? (
                      <div className="alignrow">
                        {opportunity.stageLabel ? (
                          <div className="pillstat litebg">
                            <div><span className="dimish">Stage:</span> {opportunity.stageLabel}</div>
                          </div>
                        ) : null}
                        {opportunity.minimumLabel ? (
                          <div className="pillstat litebg">
                            <div><span className="dimish">Min:</span> {opportunity.minimumLabel}</div>
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
  );
}

function RichTextSection({ section }: { section: OpportunitySectionRow }) {
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
  mode,
}: {
  section: OpportunitySectionRow;
  assetUrls: Record<string, string>;
  mode: 'page' | 'print';
}) {
  const title = sectionTitle(section);
  const description = firstString(section.data['Links-Description']);
  const linkTitles = asStringArray(section.data['Link-Title']);
  const linkUrls = asStringArray(section.data['Link-Url']);
  const linkDates = asStringArray(section.data['Link-Date']);
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
            ? ''
            : new URL(href.startsWith('http') ? href : `https://${href}`).hostname.replace(/^www\./, '');
          const publicationLine = formatNewsMilestonePublicationLine(linkDates[index] ?? '', domain);

          return (
            <div className="articleitem" key={`${linkTitle}-${index}`}>
              <a href={href} target="_blank" rel="noreferrer" className="pagecard articlecard w-inline-block">
                <div className="articlethumbnail">
                  <img
                    src={assetUrls[imageStorageKey] ?? '/webflow/images/link-alt.svg'}
                    loading={mode === 'print' ? 'eager' : 'lazy'}
                    alt=""
                    className="fullimage"
                  />
                </div>
                <div className="articlecontent">
                  <div className="articletitle">{linkTitle}</div>
                  {publicationLine ? <div className="articledomain">{publicationLine}</div> : null}
                </div>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDocumentUpdatedAt(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
    .format(date)
    .replace(',', '');
}

function DocumentsSection({
  section,
  assetUrls,
  watermarkEmail,
  mode,
}: {
  section: OpportunitySectionRow;
  assetUrls: Record<string, string>;
  watermarkEmail: string;
  mode: 'page' | 'print';
}) {
  const title = sectionTitle(section);
  const description = firstString(section.data['Documents-Description']);
  const documents = asStringArray(section.data['Document-Title']);
  const documentStorageKeys = asStringArray(section.data['Document-Storage-Key']);
  const documentTags = asStringArray(section.data['Document-Tag']);
  const documentUpdatedAts = asStringArray(section.data['Document-Updated-At']);
  const tagOrder = asStringArray(section.data['Documents-Tag']);
  const documentItems = documents.flatMap((documentTitle, index) => {
    if (mode === 'print' && !isIncludedInExport(section.data['Document-Include-In-Export'], index)) {
      return [];
    }

    const storageKey = documentStorageKeys[index] ?? '';
    const tag = documentTags[index]?.trim() ?? '';
    const updatedAt = documentUpdatedAts[index]?.trim() ?? '';

    return [{
      title: documentTitle,
      url: assetUrls[storageKey] ?? '',
      fileType: storageKey.toLowerCase().endsWith('.docx') ? 'docx' as const : 'pdf' as const,
      tag: tag.length > 0 ? tag : null,
      updatedAt: updatedAt.length > 0 ? updatedAt : null,
    }];
  });

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h1 className="contentheading">{title}</h1>
      {description ? <RichTextValue value={description} /> : null}
      {mode === 'print' ? (
        <div className="export-document-list">
          {documentItems.map((documentItem, index) => {
            const updatedLabel = formatDocumentUpdatedAt(documentItem.updatedAt);
            const meta = [documentItem.tag, updatedLabel].filter(Boolean).join(' · ');

            return (
              <div className="pagecard export-document-card" key={`${documentItem.title}-${index}`}>
                <div className="articletitle">{documentItem.title}</div>
                {meta ? <div className="articledomain">{meta}</div> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <DocumentViewerDrawer
          documents={documentItems}
          tagOrder={tagOrder}
          watermarkEmail={watermarkEmail}
        />
      )}
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

const MEDIA_LAYOUTS = new Set(['1', '2', '3', '4', '5', '6']);

function mediaStorageKeys(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : ''));
  }

  return typeof value === 'string' ? [value] : [];
}

function MediaSection({
  section,
  assetUrls,
}: {
  section: OpportunitySectionRow;
  assetUrls: Record<string, string>;
}) {
  const title = sectionTitle(section);
  const description = firstString(section.data['Media-Description']);
  const items = mediaStorageKeys(section.data['Media-Storage-Key']).flatMap((storageKey, index) => {
    const imageUrl = storageKey.trim() ? assetUrls[storageKey.trim()] ?? '' : '';
    if (!imageUrl) {
      return [];
    }

    return [{
      imageUrl,
      caption: firstStringAt(section.data['Media-Item-Description'], index).trim(),
    }];
  });
  const savedLayout = firstString(section.data['Media-Layout']);
  const layout = MEDIA_LAYOUTS.has(savedLayout)
    ? savedLayout
    : String(Math.min(Math.max(items.length, 1), 6));

  return (
    <div id={sectionAnchor(section)} className="contentsection">
      <h1 className="contentheading">{title}</h1>
      {description ? <RichTextValue value={description} /> : null}
      {items.length > 0 ? (
        <GalleryLightbox items={items} layout={layout} title={title} />
      ) : null}
    </div>
  );
}

function GenericSection({ section }: { section: OpportunitySectionRow }) {
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
  mode,
}: {
  section: OpportunitySectionRow;
  assetUrls: Record<string, string>;
  mode: 'page' | 'print';
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
                    loading={mode === 'print' ? 'eager' : 'lazy'}
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

export function OpportunitySection({
  section,
  assetUrls,
  watermarkEmail,
  mode = 'page',
}: {
  section: OpportunitySectionRow;
  assetUrls: Record<string, string>;
  watermarkEmail: string;
  mode?: 'page' | 'print';
}) {
  if (section.type === 'richContent') return <RichTextSection section={section} />;
  if (section.type === 'links') return <LinksSection section={section} assetUrls={assetUrls} mode={mode} />;
  if (section.type === 'documents') {
    if (mode === 'print') {
      return null;
    }

    return (
      <DocumentsSection
        section={section}
        assetUrls={assetUrls}
        watermarkEmail={watermarkEmail}
        mode={mode}
      />
    );
  }
  if (section.type === 'team' || section.type === 'investors') {
    return <TeamLikeSection section={section} assetUrls={assetUrls} mode={mode} />;
  }
  if (section.type === 'media') {
    if (mode === 'print') {
      return null;
    }

    return <MediaSection section={section} assetUrls={assetUrls} />;
  }
  return <GenericSection section={section} />;
}
