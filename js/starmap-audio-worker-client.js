'use strict';

const starmapAudioWorkerURL = new URL('starmap-audio-worker.js', document.currentScript.src);

function createStarmapAudioWorker() {
  const maxAge = 250;
  const queue = [];
  let worker, active, timer, nextId = 0;

  function stopWorker() {
    clearTimeout(timer);
    if (!worker) return;
    worker.onmessage = worker.onerror = worker.onmessageerror = null;
    worker.terminate();
    worker = undefined;
  }

  function cancelAll(error = new Error('Synthesis cancelled')) {
    stopWorker();
    active?.reject(error);
    active = undefined;
    for (const job of queue.splice(0)) job.reject(error);
  }

  function finish(result) {
    clearTimeout(timer);
    const job = active;
    active = undefined;
    job.resolve(result);
    dispatch();
  }

  function dispatch() {
    clearTimeout(timer);
    while (queue.length && queue[0].deadline <= performance.now()) {
      queue.shift().resolve({expired:true});
    }
    if (!queue.length) {
      if (worker) timer = setTimeout(stopWorker, 5000);
      return;
    }

    active = queue.shift();
    try {
      if (!worker) {
        worker = new Worker(starmapAudioWorkerURL);
        const target = worker;
        target.onmessage = ({data}) => {
          if (worker !== target || data.id !== active?.id) return;
          if (data.error) {
            cancelAll(new Error(data.error));
            return;
          }
          finish({...data, deadline:active.deadline,
            queueMs:Math.max(0, data.startedAt - performance.timeOrigin - active.enqueuedAt)});
        };
        target.onerror = target.onmessageerror = () => {
          if (worker === target) cancelAll(new Error('Starmap audio worker failed'));
        };
      }
      worker.postMessage({id:active.id, cue:active.cue});
      timer = setTimeout(() => {
        stopWorker();
        finish({expired:true});
      }, Math.max(0, active.deadline - performance.now()));
    } catch (error) {
      cancelAll(error);
    }
  }

  return {
    generate(cue) {
      return new Promise((resolve, reject) => {
        const enqueuedAt = performance.now();
        queue.push({id:++nextId, cue, enqueuedAt, deadline:enqueuedAt + maxAge, resolve, reject});
        if (!active) dispatch();
      });
    },
    cancelAll,
    get pending() { return queue.length + Number(Boolean(active)); },
    get active() { return Boolean(worker); },
  };
}
