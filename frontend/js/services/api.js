/* NEXUS API client. Wraps fetch with JSON helpers and a single base URL.
 * Same-origin in production (FastAPI serves the frontend), so default is "".
 */
const API_BASE = window.NEXUS_API_BASE || '';

async function _json(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

window.NexusAPI = {
  // ── Audio matching ──
  matchAudio(hashes, clientId) {
    return _json('POST', '/api/match', { hashes, client_id: clientId });
  },

  // ── Track catalog ──
  listTracks() {
    return _json('GET', '/api/tracks');
  },

  uploadTrack(file, name, brand) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    fd.append('brand', brand);
    return fetch(`${API_BASE}/api/tracks`, { method: 'POST', body: fd })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
  },

  // ── Metrics + events ──
  getMetrics() {
    return _json('GET', '/api/metrics');
  },

  reportEvent(type, count = 1) {
    return _json('POST', '/api/metrics/event', { type, count });
  },

  /** Subscribe to the SSE event stream. Returns the EventSource so callers
   *  can `.close()` it on teardown. `handler({ type, data })` is called for
   *  every event published by the backend. */
  subscribeEvents(handler) {
    const es = new EventSource(`${API_BASE}/api/events`);
    es.onmessage = (m) => {
      try { handler(JSON.parse(m.data)); }
      catch (e) { console.warn('bad SSE payload', e); }
    };
    es.onerror = (e) => console.warn('SSE error', e);
    return es;
  },

  // ── Telecom ──
  getTelecomSectors() {
    return _json('GET', '/api/telecom/sectors');
  },
};
