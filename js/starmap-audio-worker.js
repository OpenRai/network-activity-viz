'use strict';

importScripts('sound-fx.js?v=starmap-worker-1');

self.onmessage = ({data:{id, cue}}) => {
  const started = performance.now();
  try {
    const samples = buildLegacySoundSamples(cue);
    self.postMessage({
      id, samples, startedAt:performance.timeOrigin + started,
      computeMs:performance.now() - started,
    }, [samples.buffer]);
  } catch (error) {
    self.postMessage({id, error:String(error)});
  }
};
