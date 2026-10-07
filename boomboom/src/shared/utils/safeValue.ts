/** Coerce messy API values so screens never read null/undefined unsafely. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  try {
    return { ...(value as Record<string, unknown>) };
  } catch {
    return {};
  }
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

export function asNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const text = asString(value).trim();
  return text ? text : null;
}

export function asId(value: unknown): string {
  return asString(value).trim();
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function asNullableNumber(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return fallback;
}

export function asStringArray(value: unknown): string[] {
  return asArray(value)
    .map(item => asString(item).trim())
    .filter(Boolean);
}

export function formatKm(
  value: unknown,
  digits = 1,
  empty = '0.0',
): string {
  const km = asNullableNumber(value);
  if (km == null) {
    return empty;
  }
  return km.toFixed(digits);
}

export function primaryPhotoUrl(
  photos: unknown,
  fallback?: string | null,
): string | undefined {
  const first = asArray(photos)[0];
  const fromList = isRecord(first) ? asString(first.url).trim() : '';
  if (fromList) {
    return fromList;
  }
  const extra = asString(fallback).trim();
  return extra || undefined;
}
