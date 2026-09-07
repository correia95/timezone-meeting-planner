import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CITIES,
  type City,
  band,
  byId,
  detectHomeId,
  fmtOffset,
  offsetMinutes,
  wallHour,
  wallLabel,
} from './zones';

// A reference instant is: a base date (midnight UTC of chosen day) + the slider
// hour interpreted in the anchor city's local time.

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readState() {
  try {
    const p = new URL(window.location.href).searchParams;
    const ids = (p.get('c') || '').split(',').map((s) => s.trim()).filter((s) => byId(s));
    return {
      ids: ids.length ? ids : [detectHomeId(), 'lon', 'nyc'],
      anchor: p.get('a') && byId(p.get('a')!) ? p.get('a')! : null,
      date: p.get('d') || todayISO(),
      hour: p.get('h') != null ? Math.max(0, Math.min(23.5, Number(p.get('h')))) : 10,
    };
  } catch {
    return { ids: [detectHomeId(), 'lon', 'nyc'], anchor: null, date: todayISO(), hour: 10 };
  }
}

// Build the instant for a given anchor-local hour on the chosen date.
function instantFor(anchorTz: string, dateStr: string, hour: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wholeHour = Math.floor(hour);
  const minute = Math.round((hour - wholeHour) * 60);
  // guess UTC then correct using the anchor's offset at that guess
  let guess = Date.UTC(y, m - 1, d, wholeHour, minute);
  const off = offsetMinutes(anchorTz, new Date(guess));
  guess -= off * 60000;
  // one correction pass handles DST edges
  const off2 = offsetMinutes(anchorTz, new Date(guess));
  if (off2 !== off) guess = Date.UTC(y, m - 1, d, wholeHour, minute) - off2 * 60000;
  return new Date(guess);
}

export default function App() {
  const init = readState();
  const [ids, setIds] = useState<string[]>(init.ids);
  const [anchorId, setAnchorId] = useState<string>(init.anchor || init.ids[0]);
  const [dateStr, setDateStr] = useState(init.date);
  const [hour, setHour] = useState(init.hour);
  const [picker, setPicker] = useState('');
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState(false);
  const liveTimer = useRef<number | undefined>(undefined);

  const cities = useMemo(() => ids.map(byId).filter(Boolean) as City[], [ids]);
  const anchor = byId(anchorId) || cities[0];

  const refInstant = useMemo(
    () => (anchor ? instantFor(anchor.tz, dateStr, hour) : new Date()),
    [anchor, dateStr, hour],
  );

  // live mode: follow real "now"
  useEffect(() => {
    if (!live) return;
    const sync = () => {
      const now = new Date();
      setDateStr(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      );
      if (anchor) setHour(Math.round(wallHour(anchor.tz, now) * 2) / 2);
    };
    sync();
    liveTimer.current = window.setInterval(sync, 30000);
    return () => window.clearInterval(liveTimer.current);
  }, [live, anchorId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('c', ids.join(','));
      u.searchParams.set('a', anchorId);
      u.searchParams.set('d', dateStr);
      u.searchParams.set('h', String(hour));
      window.history.replaceState(null, '', u.toString());
    } catch {
      /* ignore */
    }
  }, [ids, anchorId, dateStr, hour]);

  const addCity = (id: string) => {
    if (id && !ids.includes(id)) setIds([...ids, id]);
    setPicker('');
  };
  const removeCity = (id: string) => {
    const next = ids.filter((x) => x !== id);
    setIds(next);
    if (anchorId === id && next.length) setAnchorId(next[0]);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const available = CITIES.filter((c) => !ids.includes(c.id));

  // overlap summary: how many hours of the day everyone is at least "fringe"
  const overlap = useMemo(() => {
    if (cities.length < 2) return null;
    let count = 0;
    const good: number[] = [];
    for (let h = 0; h < 24; h++) {
      const inst = anchor ? instantFor(anchor.tz, dateStr, h) : new Date();
      const bands = cities.map((c) => band(wallHour(c.tz, inst)));
      if (bands.every((b) => b === 'work' || b === 'fringe')) {
        count++;
        good.push(h);
      }
    }
    return { count, good };
  }, [cities, anchor, dateStr]);

  return (
    <div className="app">
      <header>
        <h1>Time Zone Meeting Planner</h1>
        <p className="tag">
          Add the cities your team is in and slide through the day to find an hour that works for
          everyone. Daylight saving is handled automatically. Share the link and everyone sees the
          same plan.
        </p>
      </header>

      <div className="controls">
        <label className="c-field">
          <span>Add a city</span>
          <select value={picker} onChange={(e) => addCity(e.target.value)}>
            <option value="">Choose…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.city} — {c.region}
              </option>
            ))}
          </select>
        </label>
        <label className="c-field">
          <span>Date</span>
          <input type="date" value={dateStr} onChange={(e) => { setLive(false); setDateStr(e.target.value); }} />
        </label>
        <label className="c-field check">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          <span>Follow now</span>
        </label>
      </div>

      <div className="anchorline">
        <span>Reference time in</span>
        <select value={anchorId} onChange={(e) => setAnchorId(e.target.value)}>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.city}
            </option>
          ))}
        </select>
        <strong>
          {String(Math.floor(hour)).padStart(2, '0')}:{String(Math.round((hour % 1) * 60)).padStart(2, '0')}
        </strong>
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={23.5}
        step={0.5}
        value={hour}
        onChange={(e) => { setLive(false); setHour(Number(e.target.value)); }}
        aria-label="Reference hour"
      />

      {overlap && (
        <p className="overlap">
          {overlap.count === 0 ? (
            <>No hour of this day falls in working or fringe hours for everyone.</>
          ) : (
            <>
              <b>{overlap.count} hour{overlap.count === 1 ? '' : 's'}</b> work for everyone
              {overlap.good.length ? (
                <>
                  {' '}
                  (in {anchor?.city}:{' '}
                  {overlap.good.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ')})
                </>
              ) : null}
            </>
          )}
        </p>
      )}

      <div className="gridwrap">
        <table className="grid">
          <tbody>
            {cities.map((c) => {
              const label = wallLabel(c.tz, refInstant);
              const off = offsetMinutes(c.tz, refInstant);
              return (
                <tr key={c.id}>
                  <th>
                    <button className="rm" onClick={() => removeCity(c.id)} aria-label={`Remove ${c.city}`}>
                      ×
                    </button>
                    <span className="cname">{c.city}</span>
                    <span className="cmeta">
                      {label.day} {label.date} · {fmtOffset(off)}
                    </span>
                    <span className="ctime">{label.time}</span>
                  </th>
                  {hours.map((h) => {
                    const inst = anchor ? instantFor(anchor.tz, dateStr, h) : refInstant;
                    const lw = wallHour(c.tz, inst);
                    const b = band(lw);
                    const isRef = Math.floor(hour) === h;
                    return (
                      <td key={h} className={`cell b-${b}${isRef ? ' ref' : ''}`}>
                        {Math.round(lw) % 24 === 0 ? <i>12a</i> : Math.round(lw) === 12 ? <i>12p</i> : Math.round(lw) % 24}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span><i className="sw b-work" /> 9–17</span>
        <span><i className="sw b-fringe" /> early / late</span>
        <span><i className="sw b-off" /> outside hours</span>
        <span><i className="sw b-sleep" /> 23–06</span>
      </div>

      <button className="share" onClick={share}>
        {copied ? 'Link copied' : 'Copy shareable link'}
      </button>

      <section className="explainer">
        <h2>How to use it</h2>
        <p>
          Each row is a city and each column is one hour of the chosen day. The number in a cell is
          the local time in that city for that column, and the colour shows whether it lands in normal
          working hours (green), the early/late fringe most people will still take a call (amber), or
          outside hours. Drag the slider — the highlighted column is your proposed meeting time, shown
          in the reference city you pick above.
        </p>
        <h3>Daylight saving</h3>
        <p>
          Offsets are calculated for the exact date you choose using your browser's time zone data,
          so a meeting planned for next month uses next month's rules. This matters most in March,
          April, October and November, when different countries switch on different weekends and the
          gap between two cities can change by an hour or two for a few weeks.
        </p>
        <h3>What counts as a working hour</h3>
        <p>
          The green band is 09:00–17:00 local. The amber fringe is 07:00–09:00 and 17:00–20:00 — fine
          for the occasional call, less so as a standing weekly meeting. Anything from 20:00 is shown
          as outside hours, and 23:00–06:00 is marked as sleep. These are rules of thumb; adjust
          expectations for your own team.
        </p>
        <h3>Is anything sent to a server?</h3>
        <p>
          No. The whole planner runs in your browser. Your city list, date and time are stored only
          in the page link, which is what the copy button gives you to send to colleagues.
        </p>
        <footer>Time Zone Meeting Planner · DST-aware · no sign-up · runs in your browser</footer>
      </section>
    </div>
  );
}
