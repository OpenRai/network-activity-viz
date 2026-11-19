import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const minute = 60000;
const now = 100 * minute;

test('Starmap restores older links on widening and keeps current nodes in place', () => {
  const html = read('starmap.html');
  const context = {
    nodes: new Map(), edges: new Map(), sendBy: new Map(), cnt: {},
    winMs: 60 * minute, RM: true, nSends: 0, nPend: 0, hubs: [], last: null,
    random: () => 0.5, hud() {},
  };
  const activity = runInNewContext([
    section(read('js/event-utils.js'), 'function appendBounded', 'function downloadJSON'),
    section(html, 'const activityHistory=', 'async function resolve'),
    section(html, 'function prune(', 'function blip('),
    section(html, 'function setMemoryWindow(', 'gallerySettings.onMemoryChange('),
    '({ handle, setMemoryWindow })',
  ].join('\n'), context);
  for (const [account, age] of [['expired', 61], ['older', 45], ['recent', 5]]) {
    activity.handle({ account, amount: '1000000000000000000000000000000', hash: account,
      block: { subtype: 'send', link_as_account: 'recipient' } }, false, now - age * minute);
  }
  activity.setMemoryWindow(10 * minute, now);
  const recent = context.nodes.get('recent');
  expect([...context.edges.keys()]).toEqual(['recent>recipient']);
  activity.setMemoryWindow(60 * minute, now);
  expect([...context.edges.keys()]).toEqual(['older>recipient', 'recent>recipient']);
  expect(context.nodes.get('recent')).toBe(recent);
  expect(context.cnt.send).toBe(3);
  activity.setMemoryWindow(30 * minute, now);
  expect([...context.edges.keys()]).toEqual(['recent>recipient']);
});

test('NetLoom retains older markers when the displayed window narrows', () => {
  const source = read('js/netloom.js');
  const stats = {};
  const context = {
    T: 10 * minute, Te: 0, t0: now, cnt: {}, last: null, lastMsg: 0,
    markers: [{ at: now - 61 * minute }, { at: now - 45 * minute }, { at: now - 5 * minute }],
    ev: [now - 61 * minute, 1, now - 45 * minute, 1, now - 5 * minute, 1],
    fd: ms => String(ms / minute), $: () => stats,
  };
  const api = runInNewContext([
    section(source, 'const HISTORY_MS=', 'let T='),
    section(source, 'function hud(', 'gallerySettings.onNodeChange(connect)'),
    '({hud, updateWindow})',
  ].join('\n'), context);
  api.updateWindow(now);
  api.hud(now);
  expect(stats.textContent).toContain('1 sends in view');
  expect(context.markers.map(marker => marker.at)).toEqual([now - 45 * minute, now - 5 * minute]);
  context.T = 60 * minute;
  api.updateWindow(now);
  api.hud(now);
  expect(context.Te).toBe(45 * minute);
  expect(stats.textContent).toContain('2 sends in view');
});
