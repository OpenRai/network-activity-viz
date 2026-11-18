'use strict';
// Generated oscillator bytes are embedded so this also works through file://.
// Source: ../wasm/tone.wat. Web Audio handles playback; WASM generates each waveform.
function createSoundFX({profile = 'ethereal', onStatus = () => {}, perf} = {}) {
  const wasmBytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 6, 1, 96, 1, 125, 1, 125, 3, 2, 1, 0, 7, 10, 1, 6, 115, 97, 109, 112, 108, 101, 0, 0, 10, 52, 1, 50, 1, 1, 125, 67, 0, 0, 128, 63, 67, 0, 0, 128, 64, 32, 0, 67, 0, 0, 0, 63, 147, 139, 148, 147, 33, 1, 67, 0, 0, 192, 63, 32, 1, 148, 67, 0, 0, 0, 63, 32, 1, 32, 1, 32, 1, 148, 148, 148, 147, 11]);
  let context = null, oscillator = null, enabled = false;
  const voices = new Set();
  const voiceDetails = new Map(), retiringVoices = new Set();
  const adaptivePolyphony = profile === 'cyber' && !(globalThis.netloomPerf && new URLSearchParams(location.search).get('voicePolicy') === '0');
  function voiceSlot(priority) {
    if (voices.size + preparingVoices < 28) return true;
    if (!adaptivePolyphony || retiringVoices.size >= 4) return false;
    const now = context.currentTime;
    const candidates = [...voiceDetails.entries()].filter(([voice,detail]) => voices.has(voice) && (detail.priority < priority || now-detail.started > .25));
    candidates.sort((a,b) => a[1].priority-b[1].priority || a[1].started-b[1].started);
    const candidate=candidates[0];
    if (!candidate || candidate[1].priority>priority) return false;
    const [voice,detail]=candidate;
    try {
      if(detail.gain.gain.cancelAndHoldAtTime)detail.gain.gain.cancelAndHoldAtTime(now);
      else { detail.gain.gain.cancelScheduledValues?.(now);detail.gain.gain.setValueAtTime(detail.gain.gain.value,now); }
      detail.gain.gain.linearRampToValueAtTime(0,now+.02);voice.stop(now+.02);
      voices.delete(voice);retiringVoices.add(voice);
      globalThis.netloomPerf?.event('voiceStolen');return voices.size+preparingVoices<28;
    } catch {return false;}
  }
  const sampleCache = new Map();
  let sampleCacheBytes = 0;
  const useSampleCache = !(globalThis.netloomPerf && new URLSearchParams(location.search).get('sampleCache') === '0');
  const scheduledVoices = new Set();
  const workerSynthesis = profile === 'cyber' && typeof Worker !== 'undefined' && globalThis.location?.protocol !== 'file:' && typeof createZzfxWorkerClient === 'function'
    && !(globalThis.netloomPerf && new URLSearchParams(location.search).get('workerSynthesis') === '0');
  const synthesisWorker = workerSynthesis ? createZzfxWorkerClient() : null;
  const pendingSamples = new Map();
  let synthesisGeneration = 0, preparingVoices = 0, workerFailed = false;
  const nativeSustain = !(globalThis.netloomPerf && new URLSearchParams(location.search).get('nativeSustain') === '0');
  const audioClockSchedule = !(globalThis.netloomPerf && new URLSearchParams(location.search).get('audioClock') === '0');
  const useSharedEffects = !(globalThis.netloomPerf && new URLSearchParams(location.search).get('sharedEffects') === '0');
  let sharedEffects = null, sharedTailTimer = null;
  const effectTails = new Map();
  function disconnectNodes(nodes) { for (const node of nodes) try { node.disconnect(); } catch {} }
  function clearSharedEffects() {
    clearTimeout(sharedTailTimer); sharedTailTimer = null;
    if (sharedEffects) disconnectNodes(sharedEffects.nodes);
    sharedEffects = null;
  }
  function scheduleSharedTail() {
    if (!sharedEffects || voices.size || scheduledVoices.size || preparingVoices) return;
    clearTimeout(sharedTailTimer);
    sharedTailTimer = setTimeout(() => {
      if (!voices.size && !scheduledVoices.size && !preparingVoices) clearSharedEffects();
    }, sharedEffects.tailSeconds * 1000);
  }
  function sharedBus(T) {
    clearTimeout(sharedTailTimer); sharedTailTimer = null;
    const key = JSON.stringify([T.delayBase,T.delayStep,T.feedbackBase,T.feedbackMagScale,T.dryGain,T.wetGain,T.cmpThreshold,T.cmpKnee,T.cmpRatio,T.cmpAttack,T.cmpRelease]);
    if (!sharedEffects) {
      const dry=context.createGain(),delay=context.createDelay(4),feedback=context.createGain(),wet=context.createGain(),convolver=context.createConvolver(),compressor=context.createDynamicsCompressor();
      dry.connect(compressor);delay.connect(feedback);feedback.connect(delay);delay.connect(convolver);convolver.connect(wet);wet.connect(compressor);
      // The shared output feeds the existing master safety stage.
      compressor.connect(masterLimiter);
      sharedEffects={dry,delay,feedback,wet,convolver,compressor,nodes:[dry,delay,feedback,wet,convolver,compressor]};
      globalThis.netloomPerf?.event('effectsBusCreated');
    }
    const bus=sharedEffects,now=context.currentTime;
    if (bus.impulse !== impulseBuffer) { bus.convolver.buffer=impulseBuffer;bus.impulse=impulseBuffer; }
    if (bus.key !== key) {
      bus.key=key;
      bus.delay.delayTime.setTargetAtTime(Math.max(.01,Math.min(3,T.delayBase+3*T.delayStep)),now,.03);
      bus.feedback.gain.setTargetAtTime(Math.max(0,Math.min(.6,T.feedbackBase+.5*T.feedbackMagScale)),now,.03);
      bus.dry.gain.setTargetAtTime(T.dryGain,now,.03);bus.wet.gain.setTargetAtTime(T.wetGain,now,.03);
      for (const [param,value] of [['threshold',T.cmpThreshold],['knee',T.cmpKnee],['ratio',T.cmpRatio],['attack',T.cmpAttack],['release',T.cmpRelease]])bus.compressor[param].value=value;
    }
    bus.tailSeconds=Math.min(20,T.reverbSec+5);
    return bus;
  }
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
  let masterGain = null, masterLimiter = null, masterShaper = null, outputProbe = null;
  let isHidden = typeof document !== 'undefined' ? document.hidden : false;
  function clearVoices() {
    synthesisGeneration++; preparingVoices = 0;
    synthesisWorker?.cancelAll(); pendingSamples.clear();
    for(const timer of scheduledVoices)clearTimeout(timer);scheduledVoices.clear();
    for (const voice of new Set([...voices,...retiringVoices])) {
      try { voice.stop(); } catch {}
      voice.onended?.();
    }
  }
  function release() {
    queued = null;
    pending?.cancel();
    pending = null;
    clearVoices();
    clearSharedEffects();
    for (const [timer,nodes] of effectTails) { clearTimeout(timer); disconnectNodes(nodes); }
    effectTails.clear();
    outputProbe?.disconnect();outputProbe=null;
    masterGain?.disconnect();
    sampleCache.clear(); sampleCacheBytes = 0;
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
      if ((profile==='cyber' && globalThis.netloomPerf) || perf) {
        outputProbe=context.createAnalyser();outputProbe.fftSize=256;masterGain.connect(outputProbe);outputProbe.connect(context.destination);
      } else masterGain.connect(context.destination);
      context.onstatechange = () => {
        if (enabled && context?.state === 'running') {
          onStatus('');
        } else if (enabled && ['suspended', 'interrupted'].includes(context?.state)) {
          recover();
        }
      };
    }
    oscillator ||= new WebAssembly.Instance(new WebAssembly.Module(wasmBytes)).exports;
    const target = context;
    if (target.state === 'running') return Promise.resolve();
    clearVoices();

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
      onStatus('');
      const cue = queued;
      queued = null;
      if (cue && Date.now() - cue.at < 2000) play(cue.options);
    }).catch(error => {
      // Hidden tabs may have browser-managed suspension; retain their context.
      if (!document.hidden && context === target) release();
      throw error;
    }).finally(() => {
      clearTimeout(timer);
      if (pending === operation) pending = null;
    });
    return operation.promise;
  }
  function recover() {
    if (enabled && !disposed) ready().catch(() => {});
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
    [window, 'pagehide', release],
    [document, 'freeze', release],
    [document, 'visibilitychange', visibility]
  ];
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener);
  function setSoundSet(name) {
    if (!sets[name] || name === selected) return;
    clearVoices();
    queued = null;
    clearSharedEffects();
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
    const multiplier = Number(value);
    const bounded = Number.isFinite(multiplier) ? Math.max(0, Math.min(2, multiplier)) : 1;
    const perceivedLoudness = Math.pow(bounded, 1.65);
    const calibration = profile === 'cyber' ? .52 : 2.0;
    volumeMultiplier = calibration * perceivedLoudness;
    if (context && masterGain) masterGain.gain.setTargetAtTime(volumeMultiplier, context.currentTime, .015);
  }
  function play({frequency = 440, volume = 0.15, duration, outside = false, account = '', amount = 0.001, subtype = 'send', at = Date.now(), hash = '', lfoDepth = profile === 'alien' ? .24 : .12} = {}) {
    globalThis.netloomPerf?.event('soundRequested');
    perf?.event('soundRequested');
    if (!enabled || disposed) {
      perf?.event('soundSkippedDisabled');
      return false;
    }
    if (context?.state !== 'running') {
      perf?.event('soundDeferred');
      queued = {options: {frequency, volume, duration, outside, account, amount, subtype, at, hash, lfoDepth}, at: Date.now()};
      recover();
      return false;
    }
    if (!adaptivePolyphony && voices.size >= (profile === 'cyber' && backend === 'zzfx' ? 28 : 12)) {globalThis.netloomPerf?.event('soundRejected',{reason:'capacity',voices:voices.size});perf?.event('soundRejectedCapacity');return false;}
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
        inputFrequencyMul: 1, inputVolumeMul: 1, inputAmountMul: 1,
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
      const pressure=voices.size+preparingVoices;
      const layers = adaptivePolyphony ? allLayers.slice(0,pressure>=24?1:pressure>=18?2:allLayers.length) : allLayers;
      if(layers.length<allLayers.length)globalThis.netloomPerf?.event('harmonicsReduced',{count:allLayers.length-layers.length});
      const nativeVoice=nativeSustain&&selected==='signalLoom'&&typeof context.createOscillator==='function';
      const filterMagnitude = selected === 'handsetSolace' ? 0.5 : magnitude;
      const owner = context, generation = synthesisGeneration;
      const sequenceStart=owner.currentTime+(audioClockSchedule?.12:0);
      const launchLayer = index => {
        if (context !== owner || generation !== synthesisGeneration || !enabled) return;
        if (!voiceSlot(index===0?2:1)) { globalThis.netloomPerf?.event('layerRejected',{reason:'capacity'}); return; }
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

        // Cache musical notes; retain the event's fine pitch variation at playback.
        const noteFrequency = 196 * 2 ** (Math.round(12 * Math.log2(layer[2] / 196)) / 12);
        const playbackRate = useSampleCache ? layer[2] / noteFrequency : 1;
        const parameters = [...layer];
        if (useSampleCache) parameters[2] = noteFrequency;
        const cacheKey = JSON.stringify([context.sampleRate, ...parameters]);
        const remember = rawSamples => {
          globalThis.netloomPerf?.event('samples',{bytes:rawSamples.byteLength});
          const result = owner.createBuffer(1, rawSamples.length, owner.sampleRate);
          result.getChannelData(0).set(rawSamples);
          const bytes = result.length * 4;
          if (useSampleCache && bytes <= 32 * 1024 * 1024) {
            while (sampleCache.size && (sampleCacheBytes + bytes > 32 * 1024 * 1024 || sampleCache.size >= 128)) {
              const oldest = sampleCache.keys().next().value;
              sampleCacheBytes -= sampleCache.get(oldest).length * 4; sampleCache.delete(oldest);
            }
            sampleCache.set(cacheKey, result); sampleCacheBytes += bytes;
          }
          return result;
        };
        let cached = useSampleCache ? sampleCache.get(cacheKey) : null;
        if (cached) {
          sampleCache.delete(cacheKey); sampleCache.set(cacheKey, cached);
          globalThis.netloomPerf?.event('sampleCacheHit');
        }
        const startVoice = buffer => {
          if (context !== owner || generation !== synthesisGeneration || !enabled || owner.state !== 'running') return;
          const source = nativeVoice ? context.createOscillator() : context.createBufferSource();
          if(nativeVoice){
            const real=new Float32Array(5),imag=new Float32Array([0,1,.18+magnitude*.12,.12,.05]);
            source.setPeriodicWave(context.createPeriodicWave(real,imag));source.frequency.value=layer[2];
            globalThis.netloomPerf?.event('nativeVoice');
          }else{source.buffer=buffer;source.playbackRate.value=playbackRate}
          const gain = context.createGain();
          source.gainNode = gain;

          const filter = context.createBiquadFilter();

          // Resonant filter contour: "HO-oooOT" / "PA-wwwoaAo"
          filter.type = T.filterType || 'lowpass';
          filter.Q.value = T.filterQ;
          const baseCutoff = T.filterCutoff || 450;
          const planned=selected==='signalLoom'?sequenceStart+index*.19:context.currentTime;
          const now=audioClockSchedule?Math.max(context.currentTime+.005,planned):context.currentTime+.005;
          if(selected==='signalLoom')globalThis.netloomPerf?.record('arpeggioLatenessMs',Math.max(0,now-planned)*1000);
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

          let layerEffects=[];
          source.connect(gain);gain.connect(filter);
          if (useSharedEffects) {
            const bus=sharedBus(T);
            filter.connect(bus.dry);filter.connect(bus.delay);
          } else {
            const dry=context.createGain(),delay=context.createDelay(4),feedback=context.createGain(),wet=context.createGain(),convolver=context.createConvolver(),compressor=context.createDynamicsCompressor();
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

            filter.connect(dry);dry.connect(compressor);filter.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(convolver);convolver.connect(wet);wet.connect(compressor);compressor.connect(masterLimiter);
            layerEffects=[dry,delay,feedback,wet,convolver,compressor];
          }

          const fade = selected === 'signalLoom' ? 1 - index * 0.12 : 1;
          const layerNorm = 1 / Math.sqrt(allLayers.length);
          const targetGain = (T.gainMul * 0.22) * Math.max(0.35, Math.min(1.5, volume / 0.10)) * fade * layerNorm;

          // Zero-click 5ms linear onset ramp from absolute 0 eliminates clicks at start
          gain.gain.setValueAtTime(0, now);
          if(nativeVoice){
            const peak=targetGain*layer[0];
            gain.gain.linearRampToValueAtTime(peak,now+Math.max(.005,att));
            gain.gain.linearRampToValueAtTime(peak*sVol,now+att+dec);
            gain.gain.setValueAtTime(peak*sVol,now+att+dec+sus);
            gain.gain.linearRampToValueAtTime(0,now+att+dec+sus+rel);
          }else gain.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), now + 0.005);
          source.start(now);if(nativeVoice)source.stop(now+att+dec+sus+rel+.005);globalThis.netloomPerf?.event('voiceStarted',{voices:voices.size});
          voices.add(source);voiceDetails.set(source,{priority:index===0?2:1,started:now,gain});
          if(index===0)globalThis.netloomPerf?.event('eventVoiced');

          // Allow full note release + reverb tail + delay feedback to ring out completely
          const totalNoteDuration = att + dec + sus + rel;
          const fullRingOut = totalNoteDuration + T.reverbSec + (T.feedbackBase > 0 ? 3.5 : 1.5);
          const expiry = setTimeout(() => {
            try { source.stop(); } catch {}
            source.onended?.();
          }, (fullRingOut+Math.max(0,now-context.currentTime)) * 1000);

          source.onended = () => {
            clearTimeout(expiry);
            voices.delete(source);retiringVoices.delete(source);voiceDetails.delete(source);globalThis.netloomPerf?.event('voiceEnded',{voices:voices.size});
            source.onended = null;
            source.disconnect();
            if (useSharedEffects) {
              disconnectNodes([gain,filter]);scheduleSharedTail();
            } else {
              const nodes=[gain,filter,...layerEffects];
              const timer=setTimeout(()=>{disconnectNodes(nodes);effectTails.delete(timer)},Math.max(1500,T.reverbSec*1000+2000));
              effectTails.set(timer,nodes);
            }
            source.buffer = null;
          };
        };
        if(nativeVoice){startVoice(null);return}
        if (cached) { startVoice(cached); return; }
        globalThis.netloomPerf?.event('sampleCacheMiss');
        if (!synthesisWorker || workerFailed) {
          const samples = globalThis.netloomPerf ? netloomPerf.measure('synthesis',()=>buildSamplesFn(...parameters)) : buildSamplesFn(...parameters);
          startVoice(remember(samples)); return;
        }
        const requested = performance.now();
        let request = pendingSamples.get(cacheKey);
        if (!request) {
          request = synthesisWorker.generate(owner.sampleRate, parameters).then(({samples,duration}) => {
            if (context !== owner || generation !== synthesisGeneration) return null;
            globalThis.netloomPerf?.record('workerSynthesis',duration);
            return remember(samples);
          });
          pendingSamples.set(cacheKey, request);
          request.finally(() => { if (pendingSamples.get(cacheKey) === request) pendingSamples.delete(cacheKey); }).catch(()=>{});
        } else globalThis.netloomPerf?.event('synthesisCoalesced');
        preparingVoices++;
        request.then(buffer => {
          if (!buffer || context !== owner || generation !== synthesisGeneration || !enabled) return;
          const latency = performance.now()-requested;
          globalThis.netloomPerf?.record('synthesisLatency',latency);
          if (latency > 1500) { globalThis.netloomPerf?.event('layerRejected',{reason:'stale'}); return; }
          startVoice(buffer);
        }).catch(error => {
          if (generation === synthesisGeneration) {
            globalThis.netloomPerf?.event('workerError',{message:String(error)});
            if (error.message !== 'Synthesis queue full') workerFailed = true;
          }
        }).finally(() => { if (generation === synthesisGeneration) { preparingVoices--; scheduleSharedTail(); } });
      };
      for (let index = 0; index < layers.length; index++) {
        const delay = selected === 'signalLoom' && !audioClockSchedule ? index * 0.19 : 0;
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
    const synthStarted = perf ? performance.now() : 0;
    const rate = context.sampleRate, length = Math.ceil(rate * duration);
    const buffer = context.createBuffer(1, length, rate), samples = buffer.getChannelData(0);
    let phase = 0, swooshPhase = 0;
    let noiseSeed = 73129, smoothNoise = 0, lowNoise = 0;
    const pitch = (selected === 'velvet' || selected === 'choir' || selected === 'nodeChoir' ? frequency / 2 : frequency) * eventTone;
    const alien = profile === 'alien' ? alienSets[selected] : null;
    const usesLfo = outside || alien;
    const lfoAmount = Math.max(0, Math.min(.8, lfoDepth));
    const lfoRate = alien?.am || 4.5;
    const attack = preset.attack;
    const decay = preset.decay;
    const phaseStep = pitch / rate;
    const noteRatios = preset.steps?.map(step => 2 ** (step / 12));
    const notePitches = noteRatios?.map(ratio => pitch * ratio);
    const noiseLength = Math.max(.12, Math.min(3, duration));
    const swooshOctave = selected === 'velvet' ? .5 : 1;
    const sweepLength = Math.min(1, noiseLength / 3);
    const startCutoff = (7200 - 900 * sweepLength) * swooshOctave;
    const endCutoff = (520 - 180 * sweepLength) * swooshOctave;
    const cutoffRatio = endCutoff / startCutoff;
    for (let i = 0; i < length; i++) {
      const time = i / rate;
      const lfo = usesLfo ? 1 - lfoAmount * (.5 - .5 * Math.cos(2 * Math.PI * lfoRate * time)) : 1;
      const envelope = Math.min(1, time / attack) * Math.exp(-time * decay) * Math.min(1, (duration-time) / .03);
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
            if (age >= 0) wave += .13 * Math.sin(age * pitch * noteRatios[step] * Math.PI * 2) * Math.min(1, age / .055) * Math.exp(-age * 5);
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
            const note = notePitches[step];
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
        case 'velvet': phase = (phase + phaseStep) % 1; wave = .4*sine(.998) + .18*sine(1.002) + .08*oscillator.sample(phase); break;
        case 'orbit': wave = (.4*sine(1) + .16*sine(1.004) + .07*sine(3))*(.85+.15*Math.cos(time*Math.PI*2*.7)); break;
        case 'circuitWeave': wave = .34*sine(1) + (.12+.16*magnitude)*sine(2.01) + .14*sine(3.98+eventTone*.01) + .08*sine(7.02+(eventSeed%9)*.002); break;
        case 'signalLoom': { const pulse=.5+.5*Math.sin(time*Math.PI*2*(2.2+magnitude*2.4)+(eventSeed%100)/100); wave=(.36*sine(1)+.2*sine(1.5)+.12*sine(2.5))*(.58+.42*pulse); break; }
        case 'neonPulse': { const pulse=Math.exp(-time*(7+magnitude*7))*(1+.35*Math.sin(time*Math.PI*2*(13+magnitude*11))); wave=(.38*sine(1)+(.08+.12*magnitude)*sine(2.03))*pulse; break; }
        case 'threadResonance': { const detune=.001+(magnitude*.003); wave=.34*sine(1-detune)+.31*sine(1+detune)+.13*sine(2.006)+.06*sine(3.01); break; }
        case 'nodeChoir': {
          wave=0;
          for(let step=0;step<preset.steps.length;step++){const order=subtype==='receive'?preset.steps.length-1-step:step,age=time-step*(.18+magnitude*.1);if(age>=0)wave+=(.2+.1*magnitude)*Math.sin(age*pitch*noteRatios[order]*Math.PI*2)*Math.min(1,age/.08)*Math.exp(-age*2.8)}
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
        const cutoff = startCutoff * Math.pow(cutoffRatio, sweep);
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
    if (perf) {
      const elapsed = performance.now() - synthStarted;
      perf.record('synthesis', elapsed);
      perf.record(outside ? 'outsideReceiveSynthesis' : 'toneSynthesis', elapsed);
      perf.record('generatedBufferBytes', length * Float32Array.BYTES_PER_ELEMENT);
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
      voices.delete(source);globalThis.netloomPerf?.event('voiceEnded',{voices:voices.size}); source.onended = null;
      perf?.event('voiceEnded');
      source.disconnect(); gain.disconnect(); source.buffer = null;
    };
    source.start();
    perf?.event('voiceStarted');
    perf?.record('activeVoices', voices.size);
    return true;
  }
  return {enable, disable: stop, play, setSoundSet, setVolumeMultiplier, dispose, diagnostics:()=>{let rms=null,peak=null;if(outputProbe){const samples=new Float32Array(outputProbe.fftSize);outputProbe.getFloatTimeDomainData(samples);rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);peak=samples.reduce((peak,x)=>Math.max(peak,Math.abs(x)),0)}return {rms,peak,state:context?.state,currentTime:context?.currentTime,voices:voices.size,scheduled:scheduledVoices.size,retiring:retiringVoices.size,preparing:preparingVoices,workerJobs:synthesisWorker?.pending||0,workerEnabled:!!synthesisWorker&&!workerFailed,workerActive:synthesisWorker?.active||false,effectsBuses:sharedEffects?1:0,effectTails:effectTails.size,cacheEntries:sampleCache.size,cacheBytes:sampleCacheBytes}}};
}
