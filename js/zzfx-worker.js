'use strict';
importScripts('zzfx-parameters.js');
self.onmessage = ({data}) => {
  const {id, sampleRate, parameters} = data;
  try {
    ZZFX.sampleRate = sampleRate;
    const started = performance.now();
    const samples = zzfxBuildSamples(...parameters);
    self.postMessage({id, samples, duration:performance.now()-started}, [samples.buffer]);
  } catch (error) {
    self.postMessage({id, error:String(error)});
  }
};
