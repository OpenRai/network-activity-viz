'use strict';
// Shared, same-origin cache for confirmed Nano blocks. Timestamps are local
// observation times: Nano blocks do not contain a network timestamp.
(() => {
  const KEY = 'nano-gallery-confirmed-events-v1';
  const VERSION = 1;
  const LIMIT = 600;
  const TTL = 60 * 60 * 1000;
  const FLUSH_DELAY = 400;
  const events = new Map();
  let flushTimer = 0;

  function parse(value) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return null; }
  }

  function normalize(event, now) {
    if (!event || typeof event !== 'object' || typeof event.hash !== 'string' || !event.hash ||
        !Number.isFinite(event.lastSeenAt) || event.lastSeenAt > now || now - event.lastSeenAt > TTL ||
        !event.message || typeof event.message !== 'object') return null;
    const hash=event.hash.toUpperCase();
    return {hash, lastSeenAt:event.lastSeenAt, message:{...event.message,hash}};
  }

  function mergeMessage(oldMessage, newMessage) {
    const oldBlock = parse(oldMessage?.block), newBlock = parse(newMessage?.block);
    return {
      ...oldMessage,
      ...newMessage,
      block: oldBlock && newBlock && typeof oldBlock === 'object' && typeof newBlock === 'object'
        ? {...oldBlock, ...newBlock}
        : newMessage?.block ?? oldMessage?.block
    };
  }

  function trim(now) {
    for (const [hash, event] of events) {
      if (event.lastSeenAt > now || now - event.lastSeenAt > TTL) events.delete(hash);
    }
    if (events.size > LIMIT) {
      const oldest = [...events.values()].sort((a,b) => a.lastSeenAt - b.lastSeenAt);
      for (const event of oldest.slice(0, events.size - LIMIT)) events.delete(event.hash);
    }
  }

  function mergeStored(now) {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved || saved.version !== VERSION || !Array.isArray(saved.events)) return;
      for (const raw of saved.events) {
        const event = normalize(raw, now);
        if (!event) continue;
        const existing = events.get(event.hash);
        if (!existing || event.lastSeenAt > existing.lastSeenAt) events.set(event.hash, event);
      }
      trim(now);
    } catch {}
  }

  function flush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = 0;
    const now = Date.now();
    mergeStored(now);
    trim(now);
    try { localStorage.setItem(KEY, JSON.stringify({version:VERSION, events:[...events.values()]})); } catch {}
  }

  function scheduleFlush() {
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY);
  }

  function restore(now = Date.now()) {
    mergeStored(now);
    trim(now);
    scheduleFlush();
    return [...events.values()]
      .sort((a,b) => a.lastSeenAt - b.lastSeenAt)
      .map(event => ({...event, elapsedMs:Math.max(0, now - event.lastSeenAt)}));
  }

  function record(packet, lastSeenAt = Date.now()) {
    const message = packet?.message;
    if (packet?.topic !== 'confirmation' || !message || typeof message.hash !== 'string' || !message.hash || !Number.isFinite(lastSeenAt)) return null;
    trim(lastSeenAt);
    const hash=message.hash.toUpperCase();
    const old = events.get(hash);
    const event = {
      hash,
      lastSeenAt,
      message:old ? mergeMessage(old.message, {...message,hash}) : {...message,hash}
    };
    events.set(event.hash, event);
    trim(lastSeenAt);
    scheduleFlush();
    return {event:{...event, elapsedMs:0}, isNew:!old};
  }

  function migrateMountainsCache(now = Date.now()) {
    try {
      const saved = JSON.parse(localStorage.getItem('nano-send-mountains-events-v1') || '[]');
      if (!Array.isArray(saved)) return;
      const byHash = new Map();
      for (const item of saved) {
        if (!item || typeof item.hash !== 'string' || !item.hash || !Number.isFinite(item.at) ||
            item.at > now || now - item.at > TTL || !['send','receive','open'].includes(item.subtype)) continue;
        const hash=item.hash.toUpperCase(), previous=byHash.get(hash);
        if (!previous || item.at > previous.at) byHash.set(hash,item);
      }
      for (const item of [...byHash.values()].sort((a,b)=>a.at-b.at).slice(-LIMIT)) {
        record({topic:'confirmation',message:{hash:item.hash,account:item.account,amount:item.amount,block:{subtype:item.subtype,link:item.source||''}}},item.at);
      }
      localStorage.removeItem('nano-send-mountains-events-v1');
    } catch {}
  }

  addEventListener('pagehide', flush);
  addEventListener('storage', event => {
    if (event.key === KEY) mergeStored(Date.now());
  });
  window.nanoEventCache = {record, restore, flush};
  migrateMountainsCache();
})();
