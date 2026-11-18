'use strict';

(() => {
  if (new URLSearchParams(location.search).get('perf') !== '1') return;

  const limit = 4096;
  const captureMs = 14000; // Ten seconds of replay plus time for voices to end.
  let controller, run, running = false, preparing = false;
  let frameId, stopTimer, observer;
  let previousFrame, nextAudioSample;

  function record(name, value) {
    if (!running || !Number.isFinite(value)) return;
    const metric = run.metrics[name] ??= {samples:[], count:0, total:0, max:-Infinity};
    metric.samples[metric.count % limit] = value;
    metric.count++;
    metric.total += value;
    metric.max = Math.max(metric.max, value);
  }

  function event(name) {
    if (running) run.counts[name] = (run.counts[name] ?? 0) + 1;
  }

  function sampleFrame(now) {
    if (!running) return;
    if (previousFrame !== undefined) {
      const gap = now - previousFrame;
      record('frameInterval', gap);
      if (gap > 1000 / 30) event('framesOver33ms');
      if (gap >= 50) event('framesAtLeast50ms');
    }
    previousFrame = now;
    if (now >= nextAudioSample) {
      const audio = controller.state().audio;
      record('outputRms', audio.rms);
      record('outputPeak', audio.peak);
      nextAudioSample = now + 250;
    }
    frameId = requestAnimationFrame(sampleFrame);
  }

  function collectLongTasks(entries) {
    for (const entry of entries) {
      if (entry.startTime >= run.startedAt) record('longTask', entry.duration);
    }
  }

  function stop() {
    if (!running) return;
    if (observer) {
      collectLongTasks(observer.takeRecords());
      observer.disconnect();
      observer = undefined;
    }
    run.endState = controller.state();
    run.endedAt = performance.now();
    running = false;
    cancelAnimationFrame(frameId);
    clearTimeout(stopTimer);
  }

  window.starmapPerf = {
    record,
    event,
    attach(value) { controller = value; },
    async start({audio = true, outsideReceives = false, rate = 30} = {}) {
      if (running || preparing) throw new Error('A Starmap capture is already in progress.');
      if (rate !== 1 && rate !== 30) throw new Error('Capture rate must be 1 or 30.');
      preparing = true;
      try {
        await controller.prepare(audio);
        run = {
          startedAt: performance.now(), metrics:{}, counts:{},
          conditions:{...controller.conditions(), audio, outsideReceives, rate,
            viewport:[innerWidth,innerHeight], dpr:devicePixelRatio,
            userAgent:navigator.userAgent, visible:!document.hidden},
        };
        previousFrame = undefined;
        nextAudioSample = 0;
        running = true;
        run.conditions.longTasksSupported =
          globalThis.PerformanceObserver?.supportedEntryTypes?.includes('longtask') ?? false;
        if (run.conditions.longTasksSupported) {
          observer = new PerformanceObserver(list => collectLongTasks(list.getEntries()));
          observer.observe({type:'longtask'});
        }
        controller.start(outsideReceives, rate);
        frameId = requestAnimationFrame(sampleFrame);
        stopTimer = setTimeout(stop, captureMs);
      } catch (error) {
        stop();
        throw error;
      } finally {
        preparing = false;
      }
    },
    stop,
    snapshot() {
      if (!run) return null;
      const timings = {};
      for (const [name, metric] of Object.entries(run.metrics)) {
        const sorted = [...metric.samples].sort((a,b)=>a-b);
        const at = percentile => sorted[Math.ceil(sorted.length * percentile)-1];
        timings[name] = {count:metric.count, total:metric.total, max:metric.max,
          p50:at(.50), p95:at(.95), p99:at(.99)};
      }
      return {running, durationMs:(run.endedAt ?? performance.now())-run.startedAt,
        conditions:{...run.conditions}, counts:{...run.counts}, timings,
        state:run.endState ?? controller.state()};
    },
    export() { return JSON.stringify(this.snapshot(), null, 2); },
  };
})();
