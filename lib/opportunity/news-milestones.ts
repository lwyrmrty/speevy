export type NewsMilestoneItem = {
  title: string;
  url: string;
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

export function extractNewsMilestoneItemsFromSectionData(
  data: Record<string, unknown>,
): NewsMilestoneItem[] {
  const titles = asStringArray(data['Link-Title']);
  const urls = asStringArray(data['Link-Url']);
  const count = Math.max(titles.length, urls.length);

  return Array.from({ length: count }, (_, index) => ({
    title: titles[index]?.trim() ?? '',
    url: urls[index]?.trim() ?? '',
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
      if (item.title && item.url) {
        return `${item.title} — ${item.url}`;
      }

      return item.title || item.url;
    })
    .join('\n');
}
