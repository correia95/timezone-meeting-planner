// Curated city -> IANA timezone list. The browser's Intl database does the
// actual offset/DST maths; this is only for the picker and nice labels.

export interface City {
  id: string; // stable slug for URLs
  city: string;
  region: string; // country / state for disambiguation
  tz: string; // IANA zone
}

export const CITIES: City[] = [
  { id: 'syd', city: 'Sydney', region: 'Australia', tz: 'Australia/Sydney' },
  { id: 'mel', city: 'Melbourne', region: 'Australia', tz: 'Australia/Melbourne' },
  { id: 'bne', city: 'Brisbane', region: 'Australia', tz: 'Australia/Brisbane' },
  { id: 'per', city: 'Perth', region: 'Australia', tz: 'Australia/Perth' },
  { id: 'adl', city: 'Adelaide', region: 'Australia', tz: 'Australia/Adelaide' },
  { id: 'akl', city: 'Auckland', region: 'New Zealand', tz: 'Pacific/Auckland' },
  { id: 'sin', city: 'Singapore', region: 'Singapore', tz: 'Asia/Singapore' },
  { id: 'hkg', city: 'Hong Kong', region: 'China', tz: 'Asia/Hong_Kong' },
  { id: 'tyo', city: 'Tokyo', region: 'Japan', tz: 'Asia/Tokyo' },
  { id: 'sha', city: 'Shanghai', region: 'China', tz: 'Asia/Shanghai' },
  { id: 'del', city: 'Delhi / Mumbai', region: 'India', tz: 'Asia/Kolkata' },
  { id: 'dxb', city: 'Dubai', region: 'UAE', tz: 'Asia/Dubai' },
  { id: 'ist', city: 'Istanbul', region: 'Türkiye', tz: 'Europe/Istanbul' },
  { id: 'jnb', city: 'Johannesburg', region: 'South Africa', tz: 'Africa/Johannesburg' },
  { id: 'ath', city: 'Athens', region: 'Greece', tz: 'Europe/Athens' },
  { id: 'ber', city: 'Berlin', region: 'Germany', tz: 'Europe/Berlin' },
  { id: 'par', city: 'Paris', region: 'France', tz: 'Europe/Paris' },
  { id: 'mad', city: 'Madrid', region: 'Spain', tz: 'Europe/Madrid' },
  { id: 'ams', city: 'Amsterdam', region: 'Netherlands', tz: 'Europe/Amsterdam' },
  { id: 'lon', city: 'London', region: 'United Kingdom', tz: 'Europe/London' },
  { id: 'lis', city: 'Lisbon', region: 'Portugal', tz: 'Europe/Lisbon' },
  { id: 'sao', city: 'São Paulo', region: 'Brazil', tz: 'America/Sao_Paulo' },
  { id: 'nyc', city: 'New York', region: 'US Eastern', tz: 'America/New_York' },
  { id: 'tor', city: 'Toronto', region: 'Canada', tz: 'America/Toronto' },
  { id: 'chi', city: 'Chicago', region: 'US Central', tz: 'America/Chicago' },
  { id: 'den', city: 'Denver', region: 'US Mountain', tz: 'America/Denver' },
  { id: 'lax', city: 'Los Angeles', region: 'US Pacific', tz: 'America/Los_Angeles' },
  { id: 'sfo', city: 'San Francisco', region: 'US Pacific', tz: 'America/Los_Angeles' },
  { id: 'mex', city: 'Mexico City', region: 'Mexico', tz: 'America/Mexico_City' },
  { id: 'hnl', city: 'Honolulu', region: 'Hawaii', tz: 'Pacific/Honolulu' },
  { id: 'utc', city: 'UTC', region: 'Coordinated Universal Time', tz: 'UTC' },
];

export const byId = (id: string) => CITIES.find((c) => c.id === id);

// Offset of a zone from UTC, in minutes, at a given instant.
export function offsetMinutes(tz: string, at: Date): number {
  // Format the instant in the target zone and in UTC, diff the wall clocks.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUTC - at.getTime()) / 60000);
}

export function fmtOffset(mins: number): string {
  const sign = mins >= 0 ? '+' : '-';
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

// Wall-clock hour (0-23, may be fractional for :30 zones) of an instant in a zone.
export function wallHour(tz: string, at: Date): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const h = Number(p.find((x) => x.type === 'hour')?.value);
  const m = Number(p.find((x) => x.type === 'minute')?.value);
  return h + m / 60;
}

export function wallLabel(tz: string, at: Date): { time: string; day: string; date: string } {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(at);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short' }).format(at);
  return { time, day, date };
}

export function detectHomeId(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const exact = CITIES.find((c) => c.tz === tz);
    if (exact) return exact.id;
  } catch {
    /* ignore */
  }
  return 'lon';
}

// Classify an hour for shading. Working = 9-17, fringe = 7-9 & 17-20, off otherwise.
export type Band = 'work' | 'fringe' | 'off' | 'sleep';
export function band(hour: number): Band {
  if (hour >= 9 && hour < 17) return 'work';
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 20)) return 'fringe';
  if (hour >= 23 || hour < 6) return 'sleep';
  return 'off';
}
