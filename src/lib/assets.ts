/**
 * Pure helper to resolve relative or root-relative `/src/assets/...` paths
 * against a configurable Vite BASE_URL (such as `/cinematch/` on GitHub Pages).
 */
export function resolveAssetWithBase(
  assetPath: string | undefined,
  baseUrl = '/'
): string | undefined {
  if (!assetPath) return undefined;
  const trimmed = assetPath.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const baseWithoutSlashes = normalizedBase.replace(/^\/+/, '');
  const cleanPath = trimmed.replace(/^\/+/, '');

  if (baseWithoutSlashes && cleanPath.startsWith(baseWithoutSlashes)) {
    return `${normalizedBase}${cleanPath.slice(baseWithoutSlashes.length)}`;
  }

  return `${normalizedBase}${cleanPath}`;
}

export function resolveAppAssetUrl(assetPath: string | undefined): string | undefined {
  const base =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
    '/';
  return resolveAssetWithBase(assetPath, base);
}
