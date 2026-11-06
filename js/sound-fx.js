'use strict';
// Generated oscillator bytes are embedded so this also works through file://.
// Source: ../wasm/tone.wat. Web Audio handles playback; WASM generates each waveform.
function createSoundFX() {
  const wasmBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 125, 1, 125, 3, 2, 1, 0, 7, 10, 1, 6, 115, 97, 109, 112, 108, 101, 0, 0, 10, 52, 1, 50, 1, 1, 125, 67, 0, 0, 128, 63, 67, 0, 0, 128, 64, 32, 0, 67, 0, 0, 0, 63, 147, 139, 148, 147, 33, 1, 67, 0, 0, 192, 63, 32, 1, 148, 67, 0, 0, 0, 63, 32, 1, 32, 1, 32, 1, 148, 148, 148, 147, 11]);
  let context = null, oscillator = null, enabled = false;
  const voices = new Set();
  function stop() {
    enabled = false;
    for (const voice of voices) { try { voice.stop(); } catch {} }
    voices.clear();
  }
  async function enable() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
    // Construct and resume synchronously within the checkbox's user gesture.
    context ||= new AudioContextClass();
    const resumed = context.resume();
    oscillator ||= new WebAssembly.Instance(new WebAssembly.Module(wasmBytes)).exports;
    await resumed;
    if (context.state !== 'running') throw new Error('Audio is suspended. Click SoundFX again to retry.');
    enabled = true;
  }
  function play({frequency = 440, volume = 0.15, duration = 0.32} = {}) {
    if (!enabled || context?.state !== 'running' || voices.size >= 12) return false;
    const rate = context.sampleRate, length = Math.ceil(rate * duration);
    const buffer = context.createBuffer(1, length, rate), samples = buffer.getChannelData(0);
    let phase = 0;
    for (let i = 0; i < length; i++) {
      const time = i / rate;
      phase = (phase + frequency * (1 + 0.12 * Math.exp(-time * 25)) / rate) % 1;
      const envelope = Math.min(1, time / 0.006) * Math.exp(-time * 14) * Math.min(1, (duration-time) / 0.015);
      samples[i] = oscillator.sample(phase) * envelope;
    }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; gain.gain.value = Math.max(0, Math.min(volume, 0.2));
    source.connect(gain); gain.connect(context.destination); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
    return true;
  }
  return {enable, disable: stop, play};
}
