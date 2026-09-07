# timezone-meeting-planner

Add the cities your team is in and slide through the day to find an hour that
falls in working (or fringe) hours for everyone. Daylight saving is handled for
the exact date chosen via the browser's Intl time-zone data. City list, date and
proposed time all live in the URL for sharing. Client-side only.

**Live:** https://timezone-meeting-planner.correia95.workers.dev/

## Stack

- React 18 + TypeScript + Vite, no runtime deps beyond React
- Static-assets Cloudflare Worker
- `Intl.DateTimeFormat` for all offset / DST maths (no tz library bundled)

## Engine

[`src/zones.ts`](src/zones.ts): curated city → IANA list; `offsetMinutes(tz, at)`
diffs the wall clock formatted in the zone against the UTC instant; `wallHour` /
`wallLabel` for the grid; `band(hour)` classifies work / fringe / off / sleep.
`instantFor(anchorTz, date, hour)` in the app builds the reference instant with a
one-pass DST correction.

Verified in Node: Sydney UTC+10 / London UTC+1 / New York UTC-4 in September;
Sydney UTC+11 / London UTC+0 / New York UTC-5 in January (DST flips correct).

## Develop / deploy

```bash
npm install
npm run dev
npm run deploy
```
