'use strict';
// Generated oscillator bytes are embedded so this also works through file://.
// Source: ../wasm/tone.wat. Web Audio handles playback; WASM generates each waveform.
function createSoundFX({profile = 'ethereal'} = {}) {
  const wasmBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 125, 1, 125, 3, 2, 1, 0, 7, 10, 1, 6, 115, 97, 109, 112, 108, 101, 0, 0, 10, 52, 1, 50, 1, 1, 125, 67, 0, 0, 128, 63, 67, 0, 0, 128, 64, 32, 0, 67, 0, 0, 0, 63, 147, 139, 148, 147, 33, 1, 67, 0, 0, 192, 63, 32, 1, 148, 67, 0, 0, 0, 63, 32, 1, 32, 1, 32, 1, 148, 148, 148, 147, 11]);
  let context = null, oscillator = null, enabled = false;
  const voices = new Set();
  const sets = {
    air: {duration:1.2, decay:4, attack:.08},
    aurora: {duration:1.8, decay:3, attack:.16},
    ascent: {duration:1.9, decay:2.8, attack:.08, steps:[0,7,12,19]},
    cascade: {duration:2.2, decay:2.6, attack:.1, steps:[0,12,7,12,0]},
    choir: {duration:2.8, decay:1.7, attack:.65},
    velvet: {duration:1.8, decay:3, attack:.18},
    orbit: {duration:2, decay:2.8, attack:.14}
  };
  const alienSets = {
    air: {mod:39,index:3.4,ratio:.997,am:4.1}, aurora:{mod:53,index:5.2,ratio:1.006,am:5.3},
    ascent:{mod:61,index:2.8,ratio:.993,am:6.1}, cascade:{mod:34,index:6.1,ratio:1.009,am:3.4},
    choir:{mod:27,index:4.5,ratio:.989,am:2.8}, velvet:{mod:72,index:3.1,ratio:1.004,am:7.2},
    orbit:{mod:46,index:7.2,ratio:.996,am:4.8}
  };
  let selected = 'air';
  function resumeAudio() {
    if (enabled && context && context.state !== 'running' && context.state !== 'closed') {
      context.resume().catch(() => {});
    }
  }
  window.addEventListener('pointerdown', resumeAudio);
  window.addEventListener('keydown', resumeAudio);
  window.addEventListener('pageshow', resumeAudio);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeAudio(); });
  function setSoundSet(name) { if (sets[name]) selected = name; }
  function stop() {
    enabled = false;
    for (const voice of voices) { try { voice.stop(); } catch {} }
    voices.clear();
  }
  async function enable() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
    // Construct and resume synchronously within the checkbox's user gesture.
    if (!context || context.state === 'closed') context = new AudioContextClass();
    const resumed = context.resume();
    oscillator ||= new WebAssembly.Instance(new WebAssembly.Module(wasmBytes)).exports;
    await resumed;
    if (context.state !== 'running') throw new Error('Audio is suspended. Click SoundFX again to retry.');
    enabled = true;
  }
  function play({frequency = 440, volume = 0.15, duration, outside = false, account = '', lfoDepth = profile === 'alien' ? .24 : .12} = {}) {
    if (!enabled || voices.size >= 12) return false;
    if (context?.state !== 'running') { resumeAudio(); return false; }
    const preset = sets[selected];
    // Amount still chooses the register; a pentatonic lattice keeps unrelated
    // events harmonious. A little per-event drift avoids perfect tuning.
    const semitone = 12 * Math.log2(frequency / 196);
    const scale = [0, 2, 4, 7, 9];
    let nearest = 0, distance = Infinity;
    const octave = Math.floor(semitone / 12);
    for (let register = octave - 1; register <= octave + 1; register++) {
      for (const degree of scale) {
        const candidate = register * 12 + degree;
        if (Math.abs(candidate - semitone) < distance) {
          nearest = candidate;
          distance = Math.abs(candidate - semitone);
        }
      }
    }
    // Arpeggio roots are stable per signing account, while amount still sets
    // their register. This makes an account's events sound like one motif.
    let accountRoot = 0;
    if (preset.steps && account) {
      let hash = 2166136261;
      for (let i = 0; i < account.length; i++) hash = Math.imul(hash ^ account.charCodeAt(i), 16777619) >>> 0;
      accountRoot = scale[hash % scale.length];
    }
    frequency = 196 * 2 ** ((nearest + accountRoot) / 12) * (1 + (Math.random() * 2 - 1) * .02);
    duration ??= preset.duration;
    if (outside) duration = Math.max(.12, Math.min(3, duration));
    const rate = context.sampleRate, length = Math.ceil(rate * duration);
    const buffer = context.createBuffer(1, length, rate), samples = buffer.getChannelData(0);
    let phase = 0, swooshPhase = 0;
    let noiseSeed = 73129, smoothNoise = 0, lowNoise = 0;
    const noiseSeconds = duration;
    const noiseLength = Math.max(.12, Math.min(3, noiseSeconds));
    for (let i = 0; i < length; i++) {
      const time = i / rate;
      const pitch = selected === 'velvet' || selected === 'choir' ? frequency / 2 : frequency;
      const alien = profile === 'alien' ? alienSets[selected] : null;
      const lfo = 1 - Math.max(0, Math.min(.8, lfoDepth)) * (.5 - .5 * Math.cos(2 * Math.PI * (alien?.am || 4.5) * time));
      phase = (phase + pitch / rate) % 1;
      const attack = preset.attack;
      const envelope = Math.min(1, time / attack) * Math.exp(-time * preset.decay) * Math.min(1, (duration-time) / .03);
      const sine = ratio => Math.sin(time * pitch * Math.PI * 2 * ratio);
      let wave;
      // Restrained digital partials and detuned layers evoke period patches;
      // no pitch sweeps, heavy bass, or full-strength supersaw stacks.
      if (alien) {
        const mod = Math.sin(time * alien.mod * Math.PI * 2);
        wave = .52 * Math.sin(time * pitch * alien.ratio * Math.PI * 2 + alien.index * mod)
          + .22 * Math.sin(time * pitch * .503 * Math.PI * 2 + 1.3 * mod)
          + .12 * Math.sin(time * pitch * 2.017 * Math.PI * 2);
        if (preset.steps) {
          for (let step = 0; step < preset.steps.length; step++) {
            const age = time - step * .19;
            if (age >= 0) wave += .13 * Math.sin(age * pitch * 2 ** (preset.steps[step] / 12) * Math.PI * 2) * Math.min(1, age / .055) * Math.exp(-age * 5);
          }
        }
        wave *= lfo;
      } else switch (selected) {
        case 'aurora': wave = .32*sine(.997) + .27*sine(1.003) + .08*sine(2); break;
        case 'ascent':
        case 'cascade': {
          wave = 0;
          // Stagger soft notes with overlapping releases, rather than abruptly
          // stepping oscillator frequency. The event's amount sets the root.
          for (let step = 0; step < preset.steps.length; step++) {
            const age = time - step * .19;
            if (age < 0) continue;
            const note = pitch * 2 ** (preset.steps[step] / 12);
            const noteEnvelope = Math.min(1, age / .055) * Math.exp(-age * 5);
            wave += .32 * Math.sin(age * note * Math.PI * 2) * noteEnvelope;
          }
          break;
        }
        case 'choir': {
          noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
          smoothNoise += .035 * ((noiseSeed / 2147483648 - 1) - smoothNoise);
          const drift = Math.sin(time * Math.PI * 2 * .23) * .0018;
          const voice = ratio => Math.sin(time * pitch * (1 + drift) * Math.PI * 2 * ratio);
          // Low, softly detuned vowel-like voices with a little filtered breath.
          wave = .43*voice(1) + .31*voice(1.004) + .16*voice(.5) + .09*smoothNoise;
          break;
        }
        case 'velvet': wave = .4*sine(.998) + .18*sine(1.002) + .08*oscillator.sample(phase); break;
        case 'orbit': wave = (.4*sine(1) + .16*sine(1.004) + .07*sine(3))*(.85+.15*Math.cos(time*Math.PI*2*.7)); break;
        default: wave = .45*sine(1) + .2*sine(1.005) + .15*sine(3);
      }
      if (outside) {
        // A breath of filtered static swells in, then dissolves. It marks
        // missing source history, not an unconfirmed or incomplete transfer.
        noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
        const noise = noiseSeed / 2147483648 - 1;
        const progress = Math.min(1, time / noiseLength);
        // A clear down-sweep gives the outside receive its own airy arrival
        // gesture in every sound set. Longer flights sweep more slowly and
        // finish darker, in time with the comet's travel.
        const sweep = progress * progress * (3 - 2 * progress);
        const startCutoff = 7200 - 900 * Math.min(1, noiseLength / 3);
        const endCutoff = 520 - 180 * Math.min(1, noiseLength / 3);
        const cutoff = startCutoff * Math.pow(endCutoff / startCutoff, sweep);
        const coefficient = 1 - Math.exp(-2 * Math.PI * cutoff / rate);
        smoothNoise += coefficient * (noise - smoothNoise);
        const lowCutoff = cutoff * .52;
        lowNoise += (1 - Math.exp(-2 * Math.PI * lowCutoff / rate)) * (smoothNoise - lowNoise);
        const bandNoise = smoothNoise - lowNoise;
        const swell = Math.sin(Math.PI * progress) ** 1.35;
        const sweepHz = pitch * (2.8 * Math.pow(.28, sweep));
        swooshPhase = (swooshPhase + sweepHz / rate) % 1;
        samples[i] = .25 * wave * envelope + (.72 * bandNoise + .272 * Math.sin(swooshPhase * Math.PI * 2)) * swell * lfo;
      } else samples[i] = wave * envelope;
    }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; gain.gain.value = Math.max(0, Math.min(volume, 0.2)) / Math.sqrt(1 + voices.size);
    source.connect(gain); gain.connect(context.destination); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start();
    return true;
  }
  return {enable, disable: stop, play, setSoundSet};
}
