export type NewsMilestoneItem = {
  title: string;
  url: string;
  date: string;
};

type SectionLike = {
  type: string;
  data: Record<string, unknown>;
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  if (typeof value === 'string') {
    return value.trim() ? [value] : [];
  }

  return [];
}

export function newsMilestoneItemKey(item: NewsMilestoneItem): string {
  return `${item.title.trim().toLowerCase()}|${item.url.trim().toLowerCase()}`;
}

export function formatNewsMilestoneDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatNewsMilestonePublicationLine(date: string, domain: string): string {
  const dateLabel = formatNewsMilestoneDate(date);
  const trimmedDomain = domain.trim();

  if (dateLabel && trimmedDomain) {
    return `${dateLabel} • ${trimmedDomain}`;
  }

  return dateLabel || trimmedDomain;
}

export function extractNewsMilestoneItemsFromSectionData(
  data: Record<string, unknown>,
): NewsMilestoneItem[] {
  const titles = asStringArray(data['Link-Title']);
  const urls = asStringArray(data['Link-Url']);
  const dates = asStringArray(data['Link-Date']);
  const count = Math.max(titles.length, urls.length, dates.length);

  return Array.from({ length: count }, (_, index) => ({
    title: titles[index]?.trim() ?? '',
    url: urls[index]?.trim() ?? '',
    date: dates[index]?.trim() ?? '',
  })).filter((item) => item.title.length > 0 || item.url.length > 0);
}

export function extractNewsMilestoneItemsFromSections(
  sections: SectionLike[],
): NewsMilestoneItem[] {
  return sections
    .filter((section) => section.type === 'links')
    .flatMap((section) => extractNewsMilestoneItemsFromSectionData(section.data));
}

export function findNewNewsMilestoneItems(
  previousItems: NewsMilestoneItem[],
  nextItems: NewsMilestoneItem[],
): NewsMilestoneItem[] {
  const previousKeys = new Set(previousItems.map(newsMilestoneItemKey));
  return nextItems.filter((item) => !previousKeys.has(newsMilestoneItemKey(item)));
}

export function formatNewsMilestoneSummary(items: NewsMilestoneItem[]): string {
  return items
    .map((item) => {
      const dateLabel = formatNewsMilestoneDate(item.date);
      const titleWithDate = item.title && dateLabel
        ? `${item.title} (${dateLabel})`
        : item.title;

      if (titleWithDate && item.url) {
        return `${titleWithDate} — ${item.url}`;
      }

      return titleWithDate || item.url;
    })
    .join('\n');
}
