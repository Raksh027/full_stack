const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatInboxTime(iso: string, now = Date.now()) {
  const date = new Date(iso);
  const diff = now - date.getTime();
  if (diff < MINUTE) {
    return 'Now';
  }
  if (diff < HOUR) {
    return `${Math.max(1, Math.floor(diff / MINUTE))}m`;
  }
  if (diff < DAY) {
    return `${Math.max(1, Math.floor(diff / HOUR))}h`;
  }
  if (diff < 2 * DAY) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatThreadDay(iso: string, now = new Date()) {
  const date = startOfDay(new Date(iso));
  const today = startOfDay(now);
  const diffDays = Math.round((today.getTime() - date.getTime()) / DAY);
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function isSameDay(left: string, right: string) {
  return startOfDay(new Date(left)).getTime() === startOfDay(new Date(right)).getTime();
}
