// src/lib/contact-extractor.ts
export interface ExtractedContacts {
  emails: string[];
  phones: string[];
  primaryEmail: string | null;
  primaryPhone: string | null;
  hasDirectContact: boolean;
  portalOrChannel: string;
}

export function extractPublicContactDetails(
  rawText: string,
  sourceUrl: string,
  fallbackContactInfo = ''
): ExtractedContacts {
  const text = `${rawText || ''} ${fallbackContactInfo || ''}`;
  const normalized = text
    .replace(/\s*\[\s*at\s*\]\s*|\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/\s*\[\s*dot\s*\]\s*|\s*\(\s*dot\s*\)\s*/gi, '.');

  const emails = Array.from(
    new Set(normalized.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])
  );
  const phoneMatches =
    normalized.match(/(?:\+91[\s-]?)?(?:0[0-9]{2,4}[\s-]?)?[6-9][0-9]{9}\b|\+[1-9][0-9\s-]{8,14}\b|044-[0-9]{6,8}\b/g) ?? [];
  const phones = Array.from(new Set(phoneMatches.map((p) => p.trim())));

  let domain = 'Official Source Portal';
  try {
    domain = new URL(sourceUrl).hostname;
  } catch {}

  return {
    emails,
    phones,
    primaryEmail: emails[0] ?? null,
    primaryPhone: phones[0] ?? null,
    hasDirectContact: emails.length > 0 || phones.length > 0,
    portalOrChannel: fallbackContactInfo || domain
  };
}
