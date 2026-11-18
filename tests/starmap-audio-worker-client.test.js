import {test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/starmap-audio-worker-client.js', import.meta.url), 'utf8');

test('Starmap expires stalled work, preserves fresh queued cues, and tears down when idle', async () => {
  const workers = [];
  const timers = new Map();
  let now = 0;
  const timeOrigin = 1000;
  function advance(target) {
    while (timers.size) {
      const [callback, at] = [...timers].sort((a, b) => a[1] - b[1])[0];
      if (at > target) break;
      now = at;
      timers.delete(callback);
      callback();
    }
    now = target;
  }
  class Worker {
    constructor() { workers.push(this); }
    postMessage(message) { this.message = message; }
    terminate() { this.terminated = true; }
  }
  const context = vm.createContext({
    Worker, URL, document:{currentScript:{src:'https://example.test/js/starmap-audio-worker-client.js'}},
    performance:{now:() => now, timeOrigin},
    setTimeout(callback, delay) { timers.set(callback, now + delay); return callback; },
    clearTimeout(callback) { timers.delete(callback); },
  });
  vm.runInContext(source, context);
  const client = context.createStarmapAudioWorker();
  const first = client.generate({pitch:220});
  const stale = client.generate({pitch:330});
  advance(200);
  const fresh = client.generate({pitch:440});
  expect(workers).toHaveLength(1);
  expect(workers[0].message.cue.pitch).toBe(220);
  expect(client.pending).toBe(3);
  advance(250);
  expect(await first).toEqual({expired:true});
  expect(await stale).toEqual({expired:true});
  expect(workers[0].terminated).toBe(true);
  expect(workers[1].message.cue.pitch).toBe(440);
  const {id} = workers[1].message;
  workers[1].onmessage({data:{id, samples:new Float32Array(8), startedAt:1251, computeMs:1}});
  expect((await fresh).queueMs).toBe(51);
  expect(client.pending).toBe(0);
  advance(5250);
  expect(workers[1].terminated).toBe(true);
  expect(client.active).toBe(false);
});
