// src/lib/deduplication.ts
const TRACKING_QUERY_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', 'ref', 'sid', '_ga', 'trk'
]);

/**
 * Normalizes a raw URL into a canonical form for Requirement #6 deduplication:
 * - Lowercases scheme and hostname
 * - Strips tracking query parameters while preserving resource identifiers (e.g. id, docId, filePath)
 * - Sorts remaining query parameters alphabetically
 * - Removes URL fragments (#...) and redundant trailing slashes
 */
export function normalizeCanonicalUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  return parsed.toString();
}

export async function computeCanonicalUrlHash(canonicalUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function computeOrgTitleFingerprint(organizationName: string, title: string): string {
  const normOrg = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return `${normOrg}::${normTitle}`;
}
