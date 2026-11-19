import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../js/hdr-highlights.js', import.meta.url), 'utf8');

function setup({ range = true, extended = true, webGPU = true, saved = 'true' } = {}) {
  const setting = Object.assign(new EventTarget(), { checked: false, disabled: false });
  const settingRow = { hidden: true, querySelector: () => setting };
  const media = Object.assign(new EventTarget(), { matches: range });
  const canvas = { setAttribute() {} };
  const stored = new Map([['hdr', saved]]);
  const uploads = [];
  let loseDevice;
  const noop = () => {};
  const device = {
    lost: new Promise(resolve => { loseDevice = resolve; }),
    pushErrorScope: noop, popErrorScope: async () => null,
    createShaderModule: noop, createBuffer: noop, createBindGroup: noop,
    createRenderPipelineAsync: async () => ({ getBindGroupLayout: noop }),
    destroy: noop, queue: { writeBuffer: (_buffer, _offset, data, start, count) => uploads.push(Array.from(data.slice(start, count))), submit: noop },
    createCommandEncoder: () => ({
      beginRenderPass: () => ({ setPipeline: noop, setBindGroup: noop, setVertexBuffer: noop, draw: noop, end: noop }),
      finish: noop,
    }),
  };
  canvas.getContext = () => ({
    configure: noop, unconfigure: noop,
    getConfiguration: () => ({ toneMapping: { mode: extended ? 'extended' : 'standard' } }),
    getCurrentTexture: () => ({ createView: noop }),
  });
  const hdr = runInNewContext(source + '\ncreateHdrHighlights(before, settingRow, "hdr")', {
    before: { before: noop }, settingRow, isSecureContext: true, URLSearchParams,
    console: { warn: noop },
    localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
    document: Object.assign(new EventTarget(), { createElement: () => canvas }),
    matchMedia: query => query.includes('dynamic-range') ? media : Object.assign(new EventTarget(), { matches: false }),
    navigator: { gpu: webGPU ? { requestAdapter: async () => ({ requestDevice: async () => device }) } : undefined },
    GPUBufferUsage: { VERTEX: 1, COPY_DST: 2, UNIFORM: 4 },
  });
  return { hdr, setting, settingRow, canvas, stored, loseDevice, media, uploads };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('HDR preference visibility follows display capability independently of the renderer', async () => {
  for (const options of [{ range: false }, { extended: false }, { webGPU: false }]) {
    const { hdr, setting, settingRow, canvas } = setup(options);
    await settle();
    expect(hdr.active()).toBe(false);
    expect(settingRow.hidden).toBe(options.range === false);
    expect(setting.disabled).toBe(false);
    expect(canvas.hidden).toBe(true);
  }
});

test('HDR defaults to on and respects a saved off preference', async () => {
  for (const saved of [null, 'false']) {
    const { hdr, setting, settingRow } = setup({ saved });
    await settle();
    expect(settingRow.hidden).toBe(false);
    expect(settingRow.innerHTML).toContain(">Enable HDR highlights<");
    expect(setting.checked).toBe(saved === null);
    expect(hdr.active()).toBe(saved === null);
  }
});

test('HDR preference persists and the layer hides on toggle, range change, and device loss', async () => {
  const { hdr, setting, canvas, stored, loseDevice, media } = setup();
  await settle();
  const draw = () => {
    hdr.add(20, 20, 3, 1, 40, 40, 3);
    hdr.draw(40, 40, 1);
    expect(canvas.hidden).toBe(false);
  };
  draw();
  expect(setting.disabled).toBe(false);
  setting.checked = false;
  setting.dispatchEvent(new Event('change'));
  expect(canvas.hidden).toBe(true);
  expect(stored.get('hdr')).toBe('false');
  setting.checked = true;
  setting.dispatchEvent(new Event('change'));
  draw();
  media.matches = false;
  media.dispatchEvent(new Event('change'));
  expect(canvas.hidden).toBe(true);
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  draw();
  loseDevice();
  await settle();
  expect(canvas.hidden).toBe(true);
  expect(hdr.active()).toBe(false);
});

test('solid highlights preserve the projected axes and distinguish rectangles from discs', async () => {
  const { hdr, uploads } = setup();
  await settle();
  hdr.addSolid(20, 20, 8, -3, 2, 4, 1, 40, 40, 4, false);
  hdr.addSolid(20, 20, 4, -2, 1, 3, 1, 40, 40, 4, true);
  hdr.draw(40, 40, 1);
  expect(uploads.at(-1)).toEqual([0, 0, 8, 3, 2, -4, 1, 4, 1, 0, 0, 4, 2, 1, -3, 1, 4, 2]);
});
