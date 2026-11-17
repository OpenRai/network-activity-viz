'use strict';
// One bounded, cancellable sample-generation worker per NetLoom sound engine.
const zzfxWorkerURL = new URL('zzfx-worker.js', document.currentScript.src);
function createZzfxWorkerClient() {
  let worker = null, nextId = 0, idleTimer = null;
  const jobs = new Map();
  function cancelAll(reason = new Error('Synthesis cancelled')) {
    clearTimeout(idleTimer); idleTimer = null;
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); } worker = null;
    for (const job of jobs.values()) { clearTimeout(job.timer); job.reject(reason); }
    jobs.clear();
  }
  function ensureWorker() {
    if (worker) return;
    const target = new Worker(zzfxWorkerURL);
    worker = target;
    target.onmessage = ({data}) => {
      if (worker !== target) return;
      const job = jobs.get(data.id);
      if (!job) return;
      clearTimeout(job.timer); jobs.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve({samples:data.samples,duration:data.duration});
      if (!jobs.size) idleTimer = setTimeout(() => { worker?.terminate(); worker = null; }, 5000);
    };
    target.onerror = event => { if (worker === target) cancelAll(new Error('Synthesis worker failed: '+(event?.message||'unknown error'))); };
  }
  return {
    generate(sampleRate, parameters) {
      if (jobs.size >= 16) return Promise.reject(new Error('Synthesis queue full'));
      return new Promise((resolve, reject) => {
        try {
          clearTimeout(idleTimer); ensureWorker();
          const id = ++nextId;
          const timer = setTimeout(() => cancelAll(new Error('Synthesis timed out')), 2000);
          jobs.set(id,{resolve,reject,timer}); worker.postMessage({id,sampleRate,parameters});
        } catch (error) { cancelAll(error); reject(error); }
      });
    },
    cancelAll,
    get pending() { return jobs.size; },
    get active() { return worker !== null; }
  };
}
