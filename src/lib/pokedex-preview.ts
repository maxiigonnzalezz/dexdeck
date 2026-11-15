export const MAX_PREVIEW_ROWS = 15;

export function visiblePreviewRows<T>(rows: readonly T[]): T[] {
  return rows.slice(0, MAX_PREVIEW_ROWS);
}

export function remainingPreviewRows(rows: readonly unknown[]): number {
  return Math.max(0, rows.length - MAX_PREVIEW_ROWS);
}

export function safeSpriteSource(input: { sprite_path?: unknown; sprite_url?: unknown } | null | undefined): string {
  if (!input) return '';
  if (typeof input.sprite_path === 'string') {
    const localPath = input.sprite_path.trim();
    if (localPath && !localPath.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(localPath)) {
      return localPath;
    }
  }

  if (typeof input.sprite_url !== 'string') return '';
  try {
    const url = new URL(input.sprite_url);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function spriteFallbackName(name: unknown): string {
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 1).toLocaleUpperCase() : '?';
}
