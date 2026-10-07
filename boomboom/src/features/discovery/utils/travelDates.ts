import { parseISODate, toISODate } from '@/shared/utils/date';

export function parseTravelDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const iso = parseISODate(value);
  if (iso) {
    return iso;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTravelDate(value?: string | null): string {
  const date = parseTravelDate(value);
  if (!date) {
    return value?.trim() || '';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function travelDatePayload(date: Date | null): string {
  return date ? toISODate(date) : '';
}
