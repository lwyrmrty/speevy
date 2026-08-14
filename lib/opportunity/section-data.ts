import { INVESTOR_SECTORS } from '@/lib/investor-request';

export type OpportunitySectionRow = {
  type: string;
  position: number;
  data: Record<string, unknown>;
};

export type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string }[];
  content?: TiptapNode[];
};

export const defaultOpportunityThumbnail = '/webflow/images/cyberwallpaper.webp';
export const defaultOpportunityLogo = '/webflow/images/shield.svg';

export const sectionFallbackLabels: Record<string, string> = {
  richContent: 'Summary',
  links: 'News and Milestones',
  documents: 'Documents',
  team: 'Team',
  investors: 'Investors',
  media: 'Media',
};

export function firstString(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  return typeof value === 'string' ? value : '';
}

export function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  return typeof value === 'string' && value.trim() ? [value] : [];
}

export function asNumberArray(value: unknown) {
  return asStringArray(value)
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function firstStringAt(value: unknown, index: number) {
  if (Array.isArray(value)) {
    return typeof value[index] === 'string' ? value[index] : '';
  }

  return index === 0 && typeof value === 'string' ? value : '';
}

export function isIncludedInExport(value: unknown, index = 0) {
  if (typeof value === 'boolean') {
    return value;
  }

  const flags = Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : typeof item === 'boolean' ? String(item) : ''))
    : typeof value === 'string'
      ? [value]
      : [];

  if (flags.length === 0) {
    return true;
  }

  const raw = (flags[index] ?? '').trim().toLowerCase();
  if (!raw) {
    return true;
  }

  return raw !== 'false' && raw !== '0';
}

export function isSectionIncludedInExport(section: Pick<OpportunitySectionRow, 'data'>) {
  return isIncludedInExport(section.data['Include-In-Export']);
}

export function centsToNumber(value: number | string | null) {
  if (value === null) return 0;
  return typeof value === 'string' ? Number(value) : value;
}

export function compactRaiseAmount(value: number | string | null) {
  const amount = centsToNumber(value) / 100;

  if (!amount) {
    return null;
  }

  let label: string;

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    label = `$${Number.isInteger(millions) ? millions : millions.toFixed(1)} Million`;
  } else if (amount >= 1_000) {
    label = `$${Math.round(amount / 1_000)}k`;
  } else {
    label = `$${amount.toLocaleString('en-US')}`;
  }

  return `${label} Available`;
}

export function compactMinAmount(value: number | string | null) {
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

export function basisPointsToPercent(value: number | null) {
  if (value === null) return '';
  const percent = value / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

export function externalUrl(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function normalizeSectors(value: unknown) {
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

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sectionTitle(section: OpportunitySectionRow) {
  if (section.type === 'richContent') {
    return firstString(section.data['Rich-Text-Title']) || sectionFallbackLabels.richContent;
  }

  const prefix = sectionFallbackLabels[section.type] ?? section.type;
  return firstString(section.data[`${prefix}-Title`]) || prefix;
}

export function sectionAnchor(section: OpportunitySectionRow) {
  return slugify(sectionTitle(section)) || `${section.type}-${section.position}`;
}

export function parseTiptapValue(value: string) {
  try {
    // Tiptap stores a JSON document; the editor is the only writer.
    return value ? JSON.parse(value) as TiptapNode : null;
  } catch {
    return null;
  }
}

export function collectSectionStorageKeys(sections: OpportunitySectionRow[]) {
  return Array.from(new Set(
    sections.flatMap((section) =>
      Object.entries(section.data).flatMap(([key, value]) =>
        key.endsWith('Storage-Key') ? asStringArray(value) : [],
      ),
    ),
  ));
}

export type ExportAssetRef = {
  title: string;
  storageKey: string;
};

export function getExportableDocuments(section: OpportunitySectionRow): ExportAssetRef[] {
  if (section.type !== 'documents' || !isSectionIncludedInExport(section)) {
    return [];
  }

  const titles = asStringArray(section.data['Document-Title']);
  const keys = asStringArray(section.data['Document-Storage-Key']);

  return titles.flatMap((title, index) => {
    if (!isIncludedInExport(section.data['Document-Include-In-Export'], index)) {
      return [];
    }

    const storageKey = keys[index] ?? '';
    if (!storageKey) {
      return [];
    }

    return [{ title: title.trim() || `document-${index + 1}`, storageKey }];
  });
}

export function getExportableMedia(section: OpportunitySectionRow): ExportAssetRef[] {
  if (section.type !== 'media' || !isSectionIncludedInExport(section)) {
    return [];
  }

  const titles = asStringArray(section.data['Media-Title']);
  const keys = asStringArray(section.data['Media-Storage-Key']);

  return keys.flatMap((storageKey, index) => {
    if (!isIncludedInExport(section.data['Media-Include-In-Export'], index)) {
      return [];
    }

    if (!storageKey) {
      return [];
    }

    return [{
      title: (titles[index] ?? titles[0] ?? '').trim() || `media-${index + 1}`,
      storageKey,
    }];
  });
}

export function sectionsForExport(sections: OpportunitySectionRow[]) {
  return sections.filter(isSectionIncludedInExport);
}

export function sanitizeExportFilename(value: string) {
  const sanitized = value
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim();

  return sanitized || 'untitled';
}
