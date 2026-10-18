import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Shared loader for eventSettings/global.
 *
 * - Never renders hardcoded event data: returns the last admin-synced values
 *   from localStorage instantly (stale-while-revalidate), or null until Firestore responds.
 * - De-duplicates the Firestore read across all components on the page.
 */
const CACHE_KEY = 'rangtal_event_settings_v1';

let memoryCache = null;
let inflight = null;
const listeners = new Set();

function readCache() {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) memoryCache = JSON.parse(raw);
  } catch { /* storage unavailable or corrupt */ }
  return memoryCache;
}

function fetchSettings() {
  if (!inflight) {
    inflight = getDoc(doc(db, 'eventSettings', 'global'))
      .then(snap => {
        const data = snap.exists() ? snap.data() : {};
        memoryCache = data;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
        listeners.forEach(fn => fn(data));
        return data;
      })
      .catch(err => {
        console.error('Failed to load event settings', err);
        inflight = null; // allow retry on next mount
        throw err;
      });
  }
  return inflight;
}

const DEFAULT_EVENT = {
  eventName: 'Rangtal Garba Night',
  location: 'JSPM UNIVERSITY GROUND',
  organizer: 'Rhythm Rebels',
  timing: '7:00 PM to 12:00 AM\nDaily during Navratri',
  dressCode: 'Traditional Indian\nMandatory'
};

export default function useEventSettings() {
  const [settings, setSettings] = useState(() => readCache());
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let active = true;
    const onUpdate = (data) => { if (active) { setSettings(data); setSynced(true); } };
    listeners.add(onUpdate);
    fetchSettings().then(onUpdate).catch(() => { if (active) setSynced(true); });
    return () => { active = false; listeners.delete(onUpdate); };
  }, []);

  const mergedEvent = {
    ...DEFAULT_EVENT,
    ...(settings?.EVENT || {})
  };

  return { settings, event: mergedEvent, synced };
}

/** Formats an admin date string like "2026-10-17" → "17-October - 2026". */
export function formatEventDate(dStr) {
  if (!dStr) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dStr).trim());
  const d = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]) : new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const month = d.toLocaleString('en-IN', { month: 'long' });
  return `${d.getDate()}-${month} - ${d.getFullYear()}`;
}
