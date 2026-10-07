import { calculateAge, parseISODate, toISODate } from '../date';

describe('date utils', () => {
  it('round-trips a calendar date without timezone drift', () => {
    const date = new Date(1999, 0, 31);
    expect(toISODate(date)).toBe('1999-01-31');
    expect(parseISODate('1999-01-31')?.getTime()).toBe(date.getTime());
  });

  it('only counts a birthday once it has passed this year', () => {
    const now = new Date(2026, 5, 15);
    expect(calculateAge(new Date(2008, 5, 16), now)).toBe(17);
    expect(calculateAge(new Date(2008, 5, 15), now)).toBe(18);
  });

  it('rejects malformed dates', () => {
    expect(parseISODate('15/06/2008')).toBeNull();
  });
});
