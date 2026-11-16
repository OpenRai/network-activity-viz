'use strict';
// Generated oscillator bytes are embedded so this also works through file://.
// Source: ../wasm/tone.wat. Web Audio handles playback; WASM generates each waveform.
function createSoundFX({profile = 'ethereal', onStatus = () => {}} = {}) {
  const wasmBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 125, 1, 125, 3, 2, 1, 0, 7, 10, 1, 6, 115, 97, 109, 112, 108, 101, 0, 0, 10, 52, 1, 50, 1, 1, 125, 67, 0, 0, 128, 63, 67, 0, 0, 128, 64, 32, 0, 67, 0, 0, 0, 63, 147, 139, 148, 147, 33, 1, 67, 0, 0, 192, 63, 32, 1, 148, 67, 0, 0, 0, 63, 32, 1, 32, 1, 32, 1, 148, 148, 148, 147, 11]);
  let context = null, oscillator = null, enabled = false;
  const voices = new Set();
  const scheduledVoices = new Set();
  let impulseContext=null, impulseBuffer=null;
  const sets = {
    air: {duration:1.2, decay:4, attack:.08},
    aurora: {duration:1.8, decay:3, attack:.16},
    ascent: {duration:1.9, decay:2.8, attack:.08, steps:[0,7,12,19]},
    cascade: {duration:2.2, decay:2.6, attack:.1, steps:[0,12,7,12,0]},
    choir: {duration:2.8, decay:1.7, attack:.65},
    velvet: {duration:1.8, decay:3, attack:.18},
    orbit: {duration:2, decay:2.8, attack:.14}
    ,circuitWeave:{duration:1.05,decay:4.8,attack:.012}
    ,signalLoom:{duration:1.7,decay:2.7,attack:.08}
    ,neonPulse:{duration:.72,decay:5.2,attack:.006}
    ,handsetSolace:{duration:3.5,decay:1.8,attack:.12}
  };
  const alienSets = {
    air: {mod:39,index:3.4,ratio:.997,am:4.1}, aurora:{mod:53,index:5.2,ratio:1.006,am:5.3},
    ascent:{mod:61,index:2.8,ratio:.993,am:6.1}, cascade:{mod:34,index:6.1,ratio:1.009,am:3.4},
    choir:{mod:27,index:4.5,ratio:.989,am:2.8}, velvet:{mod:72,index:3.1,ratio:1.004,am:7.2},
    orbit:{mod:46,index:7.2,ratio:.996,am:4.8}
  };
  let selected = 'air', backend = profile === 'cyber' ? 'zzfx' : 'legacy', volumeMultiplier = 1;
  let pending = null, queued = null, disposed = false;
  let masterGain = null, masterLimiter = null, masterShaper = null;
  let isHidden = typeof document !== 'undefined' ? document.hidden : false;
  function clearVoices() {
    for(const timer of scheduledVoices)clearTimeout(timer);scheduledVoices.clear();
    for (const voice of [...voices]) {
      try { voice.stop(); } catch {}
      voice.onended?.();
    }
  }
  function release() {
    queued = null;
    pending?.cancel();
    pending = null;
    clearVoices();
    const old = context;
    context = null;
    impulseContext = null; impulseBuffer = null; masterGain = null; masterLimiter = null; masterShaper = null;
    if (old) {
      old.onstatechange = null;
      if (old.state !== 'closed') old.close().catch(() => {});
    }
  }
  function ready() {
    if (disposed || !enabled) return Promise.resolve();
    if (pending) return pending.promise;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return Promise.reject(new Error('Web Audio is unavailable in this browser.'));
    if (!context || context.state === 'closed') {
      try { context = new AudioContextClass(); }
      catch (error) { return Promise.reject(error); }
      masterGain = context.createGain();
      masterGain.gain.value = volumeMultiplier;
      masterGain.connect(context.destination);
      context.onstatechange = () => {
        if (enabled && context?.state === 'running') {
          onStatus('Sound enabled · pitch follows amount.');
        } else if (enabled && ['suspended', 'interrupted'].includes(context?.state)) {
          recover();
        }
      };
    }
    oscillator ||= new WebAssembly.Instance(new WebAssembly.Module(wasmBytes)).exports;
    const target = context;
    if (target.state === 'running') return Promise.resolve();

    let cancel, timer;
    const cancelled = new Promise((_, reject) => { cancel = () => reject(new Error('Audio recovery cancelled.')); });
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Audio recovery timed out.')), 3000);
    });
    let resumed;
    try {
      resumed = target.resume();
    } catch (error) { resumed = Promise.reject(error); }

    const operation = {cancel, promise:null};
    pending = operation;
    operation.promise = Promise.race([resumed, cancelled, timeout]).then(() => {
      if (!enabled || context !== target) return;
      if (target.state !== 'running') throw new Error('Audio is still suspended.');
      onStatus('Sound enabled · pitch follows amount.');
      const cue = queued;
      queued = null;
      if (cue && Date.now() - cue.at < 2000) play(cue.options);
    }).catch(error => {
      // Do NOT destroy the AudioContext on background timeout; keep it alive to resume on return
      if (!document.hidden && context === target && context.state === 'closed') {
        release();
      }
    }).finally(() => {
      clearTimeout(timer);
      if (pending === operation) pending = null;
    });
    return operation.promise;
  }
  function recover() {
    if (enabled && !disposed) {
      if (context && (context.state === 'suspended' || context.state === 'interrupted')) {
        context.resume().catch(() => {});
      } else {
        ready().catch(() => {});
      }
    }
  }
  function visibility() {
    isHidden = document.hidden;
    if (!isHidden && enabled) recover();
  }
  const listeners = [
    [window, 'pointerdown', recover],
    [window, 'touchstart', recover],
    [window, 'keydown', recover],
    [window, 'focus', recover],
    [window, 'pageshow', recover],
    [document, 'visibilitychange', visibility]
  ];
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener);
  function setSoundSet(name) {
    if (!sets[name] || name === selected) return;
    clearVoices();
    queued = null;
    selected = name;
  }
  function stop() { enabled = false; release(); onStatus(''); }
  function enable() {
    if (disposed) return Promise.reject(new Error('Audio has been disposed.'));
    enabled = true;
    return ready();
  }
  function dispose() {
    stop();
    disposed = true;
    for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
  }
  function setVolumeMultiplier(value) {
    volumeMultiplier = Math.max(.5, Math.min(1.5, Number(value) || 1));
    if (context && masterGain) masterGain.gain.setTargetAtTime(volumeMultiplier, context.currentTime, .015);
  }
  function play({frequency = 440, volume = 0.15, duration, outside = false, account = '', amount = 0.001, subtype = 'send', at = Date.now(), hash = '', lfoDepth = profile === 'alien' ? .24 : .12} = {}) {
    if (!enabled || disposed) return false;
    if (context?.state !== 'running') {
      queued = {options: {frequency, volume, duration, outside, account, amount, subtype, at, hash, lfoDepth}, at: Date.now()};
      recover();
      return false;
    }
    if (voices.size >= (profile === 'cyber' && backend === 'zzfx' ? 28 : 12)) return false;
    const preset = sets[selected];
    const magnitude = Math.max(0, Math.min(1, (Math.log10(Math.max(1e-30, amount)) + 5) / 10));
    const eventTone = subtype === 'send' ? 1 : subtype === 'open' ? 1.12 : .92;
    let eventSeed = 2166136261;
    for (const char of account + hash) eventSeed = Math.imul(eventSeed ^ char.charCodeAt(0), 16777619) >>> 0;
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
    if (profile === 'cyber' && backend === 'zzfx') {
      const buildSamplesFn = globalThis.zzfxBuildSamples || (globalThis.ZZFX && globalThis.ZZFX.buildSamples);
      if (!buildSamplesFn) { onStatus('ZzFX could not load. Reload the page to retry.'); return false; }
      if (globalThis.ZZFX) globalThis.ZZFX.sampleRate = context.sampleRate;
      const T = Object.assign({
        // ── preset base volumes ──────────────────────────────────
        vol_circuitWeave: 1.2, vol_signalLoom: 1.2, vol_neonPulse: 1.3,
        // ── ADSR envelope (overrides if set) ─────────────────────
        adsr_attack: null, adsr_decay: null,
        adsr_sustain: null, adsr_sustainVol: null, adsr_release: null,
        // ── filter ───────────────────────────────────────────────
        filterType: selected === 'circuitWeave' ? 'bandpass' : 'lowpass',
        filterCutoff: selected === 'circuitWeave' ? 1650 : 450,
        filterQ: selected === 'circuitWeave' ? .2 : 1.2,
        // ── layer synthesis ──────────────────────────────────────
        layerVolBase: 1.0, layerVolStep: .15, gainMul: 5.5,
        // ── reverb (convolver) ──────────────────────────────────
        reverbSec: 3.75, reverbDecayPow: .5, reverbEarlyBoost: .4, reverbEarlyRate: 1.25,
        // ── delay / feedback ────────────────────────────────────
        delayBase: .20, delayStep: .04,
        feedbackBase: .22, feedbackMagScale: .02,
        // ── wet / dry mix ────────────────────────────────────────
        dryGain: .85, wetGain: .32,
        // ── compressor ──────────────────────────────────────────
        cmpThreshold: -8, cmpKnee: 12, cmpRatio: 3.0,
        cmpAttack: .008, cmpRelease: .22,
      }, globalThis.NETLOOM_TWEAKS || {});
      frequency = Math.max(1, frequency * T.inputFrequencyMul);
      volume = Math.max(0, volume * T.inputVolumeMul);
      amount = Math.max(1e-30, amount * T.inputAmountMul);
      const pitch = frequency * eventTone;
      // Acoustically re-tuned presets: crisp attack "HO"/"PA", lower decay volume "-ooo-", raised singing sustain & release "-OT"/"-oaAo"
      const presetDefs = {
        circuitWeave:    { vol: T.vol_circuitWeave,    attack: .008, decay: .12, sustain: .36, sustainVol: .18, release: 2.2, shape: 1, mod: .005 },
        signalLoom:      { vol: T.vol_signalLoom,      attack: .012, decay: .14, sustain: .45, sustainVol: .22, release: 2.6, shape: 0, mod: .008 },
        neonPulse:       { vol: T.vol_neonPulse,       attack: .006, decay: .10, sustain: .38, sustainVol: .20, release: 2.4, shape: 2, mod: .004 },
        handsetSolace:         { vol: 5, attack: 0, decay: .4, sustain: .07, sustainVol: .51, release: .008, shape: 0, mod: 0 }
      }[selected] || { vol: 1.2, attack: .01, decay: .14, sustain: .42, sustainVol: .22, release: 2.8, shape: 0, mod: 0 };

      const att = T.adsr_attack ?? presetDefs.attack;
      const dec = T.adsr_decay ?? presetDefs.decay;
      const sus = T.adsr_sustain ?? presetDefs.sustain;
      const sVol = T.adsr_sustainVol ?? presetDefs.sustainVol;
      const rel = T.adsr_release ?? presetDefs.release;

      // ZZFX parameter array: clean musical parameters with NO toy pitch slides or stutter repeats
      const z = selected === 'handsetSolace'
        ? [5,.05,pitch,0,.07,.008,0,3.1,0,0,0,0,0,.1,0,0,0,.51,.4,0,769]
        : [
          presetDefs.vol, 0, pitch,
          att, sus, rel,
          presetDefs.shape, 1, 0, 0, 0, 0, 0, 0,
          presetDefs.mod, 0, 0,
          sVol, dec, 0, 0
        ];

      const patterns = {
        circuitWeave: [-12, 0, 7, 12],
        signalLoom: [-7, 0, 5, 12],
        neonPulse: [0, 7, 12],
        handsetSolace: [0],
      };
      const allLayers = patterns[selected] || [0];
      const layers = allLayers;
      const filterMagnitude = selected === 'handsetSolace' ? 0.5 : magnitude;
      const owner = context;
      const launchLayer = index => {
        const degree = layers[index], layer = [...z], direction = subtype === 'receive' ? -1 : 1;
        // Fundamental is loudest; higher harmonics support naturally without tinny squeaks
        const layerVol = (index === 0 ? 1.0 : 0.65 / Math.sqrt(index)) * T.layerVolBase;
        if (selected !== 'handsetSolace') layer[0] = layerVol;
        // Musical micro-drift per layer
        layer[2] = pitch * 2 ** (degree * direction / 12) * (selected === 'handsetSolace' ? 1 : 1 + (eventSeed % 11 - 5) * 0.0003);
        layer[6] = selected === 'circuitWeave' ? (index % 2 ? 1 : 0) :
                   selected === 'neonPulse' ? (index === 0 ? 2 : 1) :
                   selected === 'signalLoom' ? (index % 2 ? 1 : 0) : 0;
        if (selected !== 'handsetSolace') layer[14] = z[14] * (0.8 + (index % 3) * 0.2);

        // Synthesize samples directly into a clean buffer
        const rawSamples = buildSamplesFn(...layer);
        const buffer = context.createBuffer(1, rawSamples.length, context.sampleRate);
        buffer.getChannelData(0).set(rawSamples);
        const source = context.createBufferSource();
        source.buffer = buffer;
        const gain = context.createGain();
        source.gainNode = gain;

        const filter = context.createBiquadFilter(), dry = context.createGain();
        const delay = context.createDelay(4), feedback = context.createGain(), wet = context.createGain();
        const convolver = context.createConvolver(), compressor = context.createDynamicsCompressor();

        // Resonant filter contour: "HO-oooOT" / "PA-wwwoaAo"
        filter.type = T.filterType || 'lowpass';
        filter.Q.value = T.filterQ;
        const baseCutoff = T.filterCutoff || 450;
        const now = context.currentTime;
        const startCutoff = Math.min(16000, Math.max(300, baseCutoff * (2.4 + filterMagnitude * 0.6)));
        const valleyCutoff = Math.min(12000, Math.max(120, baseCutoff * (0.85 + filterMagnitude * 0.15)));
        const sustainCutoff = Math.min(14000, Math.max(160, baseCutoff * (1.10 + filterMagnitude * 0.25)));
        const releaseCutoff = Math.min(10000, Math.max(100, baseCutoff * 0.75));

        if (selected === 'handsetSolace') {
          filter.frequency.setValueAtTime(baseCutoff, now);
        } else {
          filter.frequency.setValueAtTime(startCutoff, now);
          filter.frequency.exponentialRampToValueAtTime(valleyCutoff, now + Math.max(0.01, att + dec));
          filter.frequency.exponentialRampToValueAtTime(sustainCutoff, now + Math.max(0.02, att + dec + sus));
          filter.frequency.exponentialRampToValueAtTime(releaseCutoff, now + att + dec + sus + Math.min(3.0, rel));
        }

        if (impulseContext !== context || globalThis._nlReverbDirty) {
          globalThis._nlReverbDirty = false;
          const sec = T.reverbSec, len = Math.floor(context.sampleRate * sec);
          impulseBuffer = context.createBuffer(2, len, context.sampleRate);
          for (let ch = 0; ch < 2; ch++) {
            const d = impulseBuffer.getChannelData(ch);
            for (let i = 0; i < len; i++) {
              const t = i / len;
              d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, T.reverbDecayPow) * (1 + T.reverbEarlyBoost * Math.exp(-t * T.reverbEarlyRate));
            }
          }
          impulseContext = context;
        }

        convolver.buffer = impulseBuffer;
        delay.delayTime.value = T.delayBase + (eventSeed % 7) * T.delayStep;
        feedback.gain.value = T.feedbackBase + filterMagnitude * T.feedbackMagScale;
        dry.gain.value = T.dryGain;
        wet.gain.value = T.wetGain;

        compressor.threshold.value = T.cmpThreshold;
        compressor.knee.value = T.cmpKnee;
        compressor.ratio.value = T.cmpRatio;
        compressor.attack.value = T.cmpAttack;
        compressor.release.value = T.cmpRelease;

        if (!masterLimiter || masterLimiter.context !== context) {
          masterLimiter = context.createDynamicsCompressor();
          masterLimiter.threshold.setValueAtTime(-1.0, context.currentTime);
          masterLimiter.knee.setValueAtTime(4.0, context.currentTime);
          masterLimiter.ratio.setValueAtTime(20.0, context.currentTime);
          masterLimiter.attack.setValueAtTime(0.001, context.currentTime);
          masterLimiter.release.setValueAtTime(0.12, context.currentTime);

          // Soft-knee waveshaper prevents digital DAC clipping
          masterShaper = context.createWaveShaper();
          const n = 4096, curve = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            curve[i] = Math.tanh(x * 1.2) / Math.tanh(1.2);
          }
          masterShaper.curve = curve;
          masterShaper.oversample = '2x';

          masterLimiter.connect(masterShaper);
          masterShaper.connect(masterGain);
        }

        // Strict audio graph routing: signal ONLY flows through filter, delay/reverb, compressor, limiter & soft-shaper
        source.connect(gain);
        gain.connect(filter);
        filter.connect(dry);
        dry.connect(compressor);
        filter.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(convolver);
        convolver.connect(wet);
        wet.connect(compressor);
        compressor.connect(masterLimiter);

        const fade = selected === 'signalLoom' ? 1 - index * 0.12 : 1;
        const layerNorm = 1 / Math.sqrt(layers.length);
        const targetGain = (T.gainMul * 0.22) * Math.max(0.35, Math.min(1.5, volume / 0.10)) * fade * layerNorm;

        // Zero-click 5ms linear onset ramp from absolute 0 eliminates clicks at start
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), now + 0.005);
        source.start(now);
        voices.add(source);

        // Allow full note release + reverb tail + delay feedback to ring out completely
        const totalNoteDuration = att + dec + sus + rel;
        const fullRingOut = totalNoteDuration + T.reverbSec + (T.feedbackBase > 0 ? 3.5 : 1.5);
        const expiry = setTimeout(() => {
          try { source.stop(); } catch {}
          source.onended?.();
        }, fullRingOut * 1000);

        source.onended = () => {
          clearTimeout(expiry);
          voices.delete(source);
          source.onended = null;
          source.disconnect();
          setTimeout(() => {
            for (const node of [gain, filter, dry, delay, feedback, wet, convolver, compressor]) {
              try { node.disconnect(); } catch {}
            }
          }, Math.max(1500, T.reverbSec * 1000 + 2000));
          source.buffer = null;
        };
      };
      for (let index = 0; index < layers.length; index++) {
        const delay = selected === 'signalLoom' ? index * 0.19 : 0;
        if (delay) {
          const timer = setTimeout(() => {
            scheduledVoices.delete(timer);
            if (context === owner && enabled) launchLayer(index);
          }, delay * 1000);
          scheduledVoices.add(timer);
        } else launchLayer(index);
      }
      return true;
    }
    const rate = context.sampleRate, length = Math.ceil(rate * duration);
    const buffer = context.createBuffer(1, length, rate), samples = buffer.getChannelData(0);
    let phase = 0, swooshPhase = 0;
    let noiseSeed = 73129, smoothNoise = 0, lowNoise = 0;
    const noiseSeconds = duration;
    const noiseLength = Math.max(.12, Math.min(3, noiseSeconds));
    for (let i = 0; i < length; i++) {
      const time = i / rate;
      const pitch = (selected === 'velvet' || selected === 'choir' || selected === 'nodeChoir' ? frequency / 2 : frequency) * eventTone;
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
        case 'circuitWeave': wave = .34*sine(1) + (.12+.16*magnitude)*sine(2.01) + .14*sine(3.98+eventTone*.01) + .08*sine(7.02+(eventSeed%9)*.002); break;
        case 'signalLoom': { const pulse=.5+.5*Math.sin(time*Math.PI*2*(2.2+magnitude*2.4)+(eventSeed%100)/100); wave=(.36*sine(1)+.2*sine(1.5)+.12*sine(2.5))*(.58+.42*pulse); break; }
        case 'neonPulse': { const pulse=Math.exp(-time*(7+magnitude*7))*(1+.35*Math.sin(time*Math.PI*2*(13+magnitude*11))); wave=(.38*sine(1)+(.08+.12*magnitude)*sine(2.03))*pulse; break; }
        case 'threadResonance': { const detune=.001+(magnitude*.003); wave=.34*sine(1-detune)+.31*sine(1+detune)+.13*sine(2.006)+.06*sine(3.01); break; }
        case 'nodeChoir': {
          wave=0;
          for(let step=0;step<preset.steps.length;step++){const order=subtype==='receive'?preset.steps.length-1-step:step,age=time-step*(.18+magnitude*.1);if(age>=0)wave+=(.2+.1*magnitude)*Math.sin(age*pitch*2**(preset.steps[order]/12)*Math.PI*2)*Math.min(1,age/.08)*Math.exp(-age*2.8)}
          break;
        }
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
        const swooshOctave = selected === 'velvet' ? .5 : 1;
        const startCutoff = (7200 - 900 * Math.min(1, noiseLength / 3)) * swooshOctave;
        const endCutoff = (520 - 180 * Math.min(1, noiseLength / 3)) * swooshOctave;
        const cutoff = startCutoff * Math.pow(endCutoff / startCutoff, sweep);
        const coefficient = 1 - Math.exp(-2 * Math.PI * cutoff / rate);
        smoothNoise += coefficient * (noise - smoothNoise);
        const lowCutoff = cutoff * .52;
        lowNoise += (1 - Math.exp(-2 * Math.PI * lowCutoff / rate)) * (smoothNoise - lowNoise);
        const bandNoise = smoothNoise - lowNoise;
        const swell = Math.sin(Math.PI * progress) ** 1.35;
        const sweepHz = pitch * swooshOctave * (2.8 * Math.pow(.28, sweep));
        swooshPhase = (swooshPhase + sweepHz / rate) % 1;
        samples[i] = .25 * wave * envelope + (.72 * bandNoise + .272 * Math.sin(swooshPhase * Math.PI * 2)) * swell * lfo;
      } else samples[i] = wave * envelope;
    }
    const source = context.createBufferSource(), gain = context.createGain();
    // Lift tonal cues across every preset without changing outside-receive swooshes.
    const level = outside ? 1 : 3;
    source.buffer = buffer; gain.gain.value = level * Math.max(0, Math.min(volume, 0.2)) / Math.sqrt(1 + voices.size);
    source.connect(gain); gain.connect(masterGain); voices.add(source);
    const owner = context, startedAt = owner.currentTime;
    // A frozen audio clock may never deliver ended, even while state says running.
    const expiry = setTimeout(() => {
      try { source.stop(); } catch {}
      source.onended?.();
      if (context === owner && Number.isFinite(startedAt) && owner.currentTime === startedAt) {
        release();
        onStatus('Audio paused · waiting for the next sound or user interaction.');
      }
    }, duration * 1000 + 1000);
    source.onended = () => {
      clearTimeout(expiry);
      voices.delete(source); source.onended = null;
      source.disconnect(); gain.disconnect(); source.buffer = null;
    };
    source.start();
    return true;
  }
  return {enable, disable: stop, play, setSoundSet, setVolumeMultiplier, dispose};
}
