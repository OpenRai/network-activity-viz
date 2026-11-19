'use strict';

function createHdrHighlights(before, settingRow, storageKey) {
  const limit = 48;
  const floatsPerMark = 9;
  const range = matchMedia('(dynamic-range: high)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const supported = isSecureContext && !!navigator.gpu;
  const canvas = document.createElement('canvas');
  canvas.className = 'hdr-highlights';
  canvas.hidden = true;
  canvas.setAttribute('aria-hidden', 'true');
  before.before(canvas);

  settingRow.innerHTML = '<span>Enable HDR highlights</span><input type="checkbox">';
  const setting = settingRow.querySelector('input');
  setting.checked = true;
  try { setting.checked = localStorage.getItem(storageKey) !== 'false'; } catch {}
  const data = new Float32Array(limit * floatsPerMark);
  let context, device, pipeline, buffer, dimensions, bindings;
  let lastWidth, lastHeight;
  let pending = false, failed = false, count = 0;
  const eligible = () => supported && setting.checked && range.matches &&
    !motion.matches && !document.hidden && !failed;

  function disable() {
    canvas.hidden = true;
    count = 0;
  }

  async function reconcile() {
    settingRow.hidden = !range.matches;
    if (!eligible()) { disable(); return; }
    if (pipeline || pending) return;
    pending = true;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No WebGPU adapter');
      device = await adapter.requestDevice();
      device.lost.then(() => {
        failed = true;
        disable();
        context?.unconfigure();
        reconcile();
      });
      context = canvas.getContext('webgpu');
      device.pushErrorScope('validation');
      try {
        context.configure({
          device, format: 'rgba16float', alphaMode: 'premultiplied',
          colorSpace: 'display-p3', toneMapping: { mode: 'extended' },
        });
        if (context.getConfiguration && context.getConfiguration()?.toneMapping?.mode !== 'extended') {
          throw new Error('Extended canvas tone mapping unavailable');
        }
        const module = device.createShaderModule({ code: `
          @group(0) @binding(0) var<uniform> radii: vec2f;
          struct Vertex {
            @builtin(position) position: vec4f,
            @location(0) uv: vec2f,
            @location(1) opacity: f32,
            @location(2) peak: f32,
            @location(3) shape: f32,
          }
          @vertex fn vertex(@builtin(vertex_index) i: u32, @location(0) center: vec2f,
                            @location(1) axes: vec4f, @location(2) style: vec3f) -> Vertex {
            let corners = array(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),
                                vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
            let uv = corners[i];
            let offset = axes.xy * uv.x + axes.zw * uv.y;
            return Vertex(vec4f(center + offset * radii, 0, 1), uv, style.x, style.y, style.z);
          }
          @fragment fn fragment(v: Vertex) -> @location(0) vec4f {
            let distance = length(v.uv);
            let edge = max(fwidth(distance), 0.001);
            if (v.shape > 0.5) {
              var alpha = v.opacity;
              if (v.shape > 1.5) {
                alpha *= 1.0 - smoothstep(1.0 - edge, 1.0, distance);
              }
              return vec4f(vec3f(0.97, 0.99, 1.0) * v.peak * alpha, alpha);
            }
            let alpha = (1.0 - smoothstep(0.05, 1.0, distance)) * v.opacity;
            let white = mix(1.0, v.peak, 1.0 - smoothstep(0.15, 0.82, distance));
            return vec4f(vec3f(0.97, 0.99, 1.0) * white * alpha, alpha);
          }
        ` });
        pipeline = await device.createRenderPipelineAsync({
          layout: 'auto',
          vertex: { module, entryPoint: 'vertex', buffers: [{
            arrayStride: floatsPerMark * 4, stepMode: 'instance',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x4' },
              { shaderLocation: 2, offset: 24, format: 'float32x3' },
            ],
          }] },
          fragment: { module, entryPoint: 'fragment', targets: [{
            format: 'rgba16float',
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          }] },
        });
        buffer = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        dimensions = device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        bindings = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: dimensions } },
        ] });
      } finally {
        if (await device.popErrorScope()) throw new Error('HDR canvas validation failed');
      }
    } catch (error) {
      console.warn('HDR highlights unavailable:', error);
      failed = true;
      disable();
      context?.unconfigure();
      device?.destroy();
    } finally {
      pending = false;

    }
  }

  const active = () => !pending && !!pipeline && eligible();
  setting.addEventListener('change', () => {
    try { localStorage.setItem(storageKey, String(setting.checked)); } catch {}
    reconcile();
  });
  range.addEventListener('change', reconcile);
  motion.addEventListener('change', reconcile);
  document.addEventListener('visibilitychange', reconcile);
  reconcile();

  function addMark(x, y, ax, ay, bx, by, opacity, width, height, peak, shape) {
    const extentX = Math.abs(ax) + Math.abs(bx);
    const extentY = Math.abs(ay) + Math.abs(by);
    if (count === limit || x < -extentX || y < -extentY || x > width + extentX || y > height + extentY) return false;
    data.set([2 * x / width - 1, 1 - 2 * y / height, ax, -ay, bx, -by, opacity, peak, shape], count++ * floatsPerMark);
    return true;
  }

  return {
    active,
    add(x, y, radius, opacity, width, height, peak) {
      return addMark(x, y, radius, 0, 0, radius, opacity, width, height, peak, 0);
    },
    addSolid(x, y, ax, ay, bx, by, opacity, width, height, peak, round) {
      return addMark(x, y, ax, ay, bx, by, opacity, width, height, peak, round ? 2 : 1);
    },
    draw(width, height, dpr) {
      if (!active() || !count) { disable(); return; }
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (width !== lastWidth || height !== lastHeight) {
        lastWidth = width;
        lastHeight = height;
        device.queue.writeBuffer(dimensions, 0, new Float32Array([2 / width, 2 / height]));
      }
      device.queue.writeBuffer(buffer, 0, data, 0, count * floatsPerMark);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0],
      }] });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindings);
      pass.setVertexBuffer(0, buffer);
      pass.draw(6, count);
      pass.end();
      device.queue.submit([encoder.finish()]);
      canvas.hidden = false;
      count = 0;
    },
  };
}
