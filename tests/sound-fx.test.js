import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/sound-fx.js',import.meta.url),'utf8');
function harness(fail=false,profile='ethereal',workerMode=false){
 const contexts=[],buffers=[],voices=[],gains=[],convolvers=[];
 let now=Date.now();class Clock extends Date {static now(){return now}}
 class AudioContext {
  constructor(){contexts.push(this);this.currentTime=1;this.state='suspended';this.sampleRate=48000;this.destination={}}
  async resume(){this.resumes=(this.resumes||0)+1;if(this.resumeHook)return this.resumeHook();if(fail)throw Error('Audio blocked');this.state='running'}
  async close(){this.state='closed';this.closed=true}
  createBuffer(channels,length){const samples=new Float32Array(length);buffers.push(samples);return{length,sampleRate:48000,getChannelData:()=>samples}}
  createBufferSource(){const voice={playbackRate:{value:1},connect(){},disconnect(){this.disconnected=true},start(){this.started=true},stop(){this.stopped=true;this.onended?.()}};voices.push(voice);return voice}
  createBiquadFilter(){return this.effect(['frequency','Q'])}
  createDelay(){return this.effect(['delayTime'])}
  createConvolver(){const node=this.effect([]);convolvers.push(node);return node}
  createDynamicsCompressor(){return this.effect(['threshold','knee','ratio','attack','release'])}
  createWaveShaper(){return this.effect([])}
  effect(keys){const node={context:this,connect(){},disconnect(){this.disconnected=true}};for(const key of keys)node[key]={value:0,setValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v}};return node}
  createGain(){const param={value:0,setTargetAtTime(v){this.value=v},setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v}};const gain={gain:param,connect(){},disconnect(){this.disconnected=true}};gains.push(gain);return gain}
 }
 const asyncJobs=[];
 const workerClient={generate(sampleRate,parameters){return new Promise((resolve,reject)=>asyncJobs.push({parameters,resolve,reject,sampleRate}))},cancelAll(){},get pending(){return asyncJobs.length}};
 const window=new EventTarget(),document=new EventTarget();window.AudioContext=AudioContext;
 const context=vm.createContext({window,document,WebAssembly,Uint8Array,setTimeout,clearTimeout,Date:Clock,performance,Worker:workerMode?function(){}:undefined,createZzfxWorkerClient:()=>workerClient});
 vm.runInContext(readFileSync(new URL('../js/zzfx-parameters.js',import.meta.url),'utf8'),context);
 vm.runInContext(source,context);
 return{fx:context.createSoundFX({profile}),asyncJobs,completeJobs(){for(const job of asyncJobs.splice(0))job.resolve({samples:context.zzfxBuildSamples(...job.parameters),duration:1})},convolvers,contexts,buffers,voices,gains,window,document,elapse:ms=>{now+=ms}};
}
test('sound requires opt-in and WASM generates a finite, nonzero waveform',async()=>{
 const h=harness();expect(h.fx.play()).toBe(false);expect(h.contexts.length).toBe(0);
 await h.fx.enable();expect(h.fx.play()).toBe(true);
 expect(h.buffers[0].every(Number.isFinite)).toBe(true);
 expect(h.buffers[0].some(x=>Math.abs(x)>.1)).toBe(true);
 expect(h.voices[0].started).toBe(true);
 h.fx.disable();expect(h.voices[0].stopped).toBe(true);expect(h.fx.play()).toBe(false);
});
test('audio enable failures are exposed to the checkbox handler',async()=>{
 const h=harness(true);await expect(h.fx.enable()).rejects.toThrow('Audio blocked');expect(h.fx.play()).toBe(false);
});
test('bursts have bounded polyphony',async()=>{
 const h=harness();await h.fx.enable();for(let i=0;i<12;i++)expect(h.fx.play()).toBe(true);
 expect(h.fx.play()).toBe(false);h.fx.disable();
});
test('every preset boosts tonal cues while preserving swoosh gain',async()=>{
 for(const preset of ['air','aurora','ascent','cascade','choir','velvet','orbit']){
  const h=harness();await h.fx.enable();h.fx.setSoundSet(preset);
  h.fx.play({volume:.1});expect(h.gains.at(-1).gain.value).toBeCloseTo(.3);
  h.fx.disable();await h.fx.enable();
  h.fx.play({volume:.1,outside:true});expect(h.gains.at(-1).gain.value).toBeCloseTo(.1);
 }
});

test('disable closes the context and disconnects every voice without waiting for ended',async()=>{
 const h=harness();await h.fx.enable();h.fx.play();h.voices[0].stop=()=>{};
 h.fx.disable();expect(h.contexts[0].closed).toBe(true);
 expect(h.voices[0].disconnected).toBe(true);expect(h.gains[0].disconnected).toBe(true);
 expect(h.voices[0].buffer).toBe(null);await h.fx.enable();expect(h.contexts.length).toBe(2);
});
test('disable wins over an in-flight enable',async()=>{
 const h=harness();const enabling=h.fx.enable();h.fx.disable();await enabling.catch(()=>{});
 expect(h.fx.play()).toBe(false);expect(h.contexts[0].closed).toBe(true);
});
test('interruption coalesces recovery and retains only one fresh cue from a burst',async()=>{
 const h=harness();await h.fx.enable();h.fx.play();const ctx=h.contexts[0];ctx.state='interrupted';
 let complete;ctx.resumeHook=()=>new Promise(resolve=>{complete=()=>{ctx.state='running';resolve()}});
 for(let i=0;i<30;i++)h.fx.play({duration:.01});
 expect(ctx.resumes).toBe(2);expect(h.voices[0].disconnected).toBe(true);
 complete();await new Promise(resolve=>setTimeout(resolve,0));expect(h.voices.length).toBe(2);
 h.fx.dispose();
});
test('page suspension releases resources; pageshow recreates only after opt-in',async()=>{
 const h=harness();h.window.dispatchEvent(new Event('pageshow'));expect(h.contexts.length).toBe(0);
 await h.fx.enable();h.fx.play();h.window.dispatchEvent(new Event('pagehide'));
 expect(h.contexts[0].closed).toBe(true);h.window.dispatchEvent(new Event('pageshow'));
 await new Promise(resolve=>setTimeout(resolve,0));expect(h.contexts.length).toBe(2);expect(h.fx.play()).toBe(true);
 h.fx.dispose();h.window.dispatchEvent(new Event('pageshow'));expect(h.contexts.length).toBe(2);
});
test('a failed resume can recreate audio on the next gesture',async()=>{
 const h=harness();await h.fx.enable();h.contexts[0].state='suspended';
 h.contexts[0].resumeHook=()=>Promise.reject(Error('Lost device'));
 await expect(h.fx.enable()).rejects.toThrow('Lost device');expect(h.contexts[0].closed).toBe(true);
 h.window.dispatchEvent(new Event('pointerdown'));await new Promise(resolve=>setTimeout(resolve,0));
 expect(h.contexts.length).toBe(2);expect(h.fx.play()).toBe(true);h.fx.dispose();
});

test('a resume that never settles times out and closes the failed context',async()=>{
 const h=harness();await h.fx.enable();const ctx=h.contexts[0];ctx.state='suspended';ctx.resumeHook=()=>new Promise(()=>{});
 await expect(h.fx.enable()).rejects.toThrow('timed out');expect(ctx.closed).toBe(true);h.fx.dispose();
},6000);
test('ended voices release slots across long quiet periods and repeated bursts',async()=>{
 const h=harness();await h.fx.enable();
 for(let cycle=0;cycle<10;cycle++){
  for(let i=0;i<12;i++)expect(h.fx.play({duration:.001})).toBe(true);
  for(const voice of h.voices)voice.onended?.();
  h.elapse(60000);
 }
 expect(h.contexts.length).toBe(1);expect(h.voices.every(v=>v.buffer===null)).toBe(true);
 h.fx.dispose();
});

test('a stalled running audio clock cannot leak voices or permanently fill polyphony',async()=>{
 const h=harness();await h.fx.enable();h.contexts[0].currentTime=10;
 h.fx.play({duration:.001});await new Promise(resolve=>setTimeout(resolve,1100));
 expect(h.contexts[0].closed).toBe(true);expect(h.voices[0].buffer).toBe(null);
 await h.fx.enable();expect(h.fx.play({duration:.001})).toBe(true);h.fx.dispose();
});

test('master volume remains independent of the original Starmap waveform',async()=>{
 const h=harness();h.fx.setVolumeMultiplier(.5);await h.fx.enable();
 expect(h.gains[0].gain.value).toBeCloseTo(2*Math.pow(.5,1.65));
 h.fx.setVolumeMultiplier(1.5);expect(h.gains[0].gain.value).toBeCloseTo(2*Math.pow(1.5,1.65));h.fx.dispose();
});
test('NetLoom presets synthesize finite pitched buffers through ZzFX',async()=>{
 for(const preset of ['circuitWeave','signalLoom','neonPulse','handsetSolace']){
  const h=harness(false,'cyber');await h.fx.enable();h.fx.setSoundSet(preset);
  expect(h.fx.play({frequency:440,amount:1,account:'nano_test',hash:'A',subtype:'send'})).toBe(true);
  expect(h.voices.length).toBeGreaterThan(0);
  for(const voice of h.voices){const data=voice.buffer.getChannelData(0);expect(data.every(Number.isFinite)).toBe(true);expect(data.some(x=>Math.abs(x)>.01)).toBe(true)}
  h.fx.dispose();expect(h.voices.every(v=>v.buffer===null)).toBe(true);expect(h.fx.diagnostics().scheduled).toBe(0);
 }
});
test('ordinary background visibility preserves the audio context',async()=>{
 const h=harness();await h.fx.enable();h.document.hidden=true;h.document.dispatchEvent(new Event('visibilitychange'));
 expect(h.contexts[0].closed).toBeUndefined();h.document.hidden=false;h.document.dispatchEvent(new Event('visibilitychange'));
 expect(h.contexts).toHaveLength(1);h.fx.dispose();
});

test('NetLoom reuses buffers while retaining fine event pitch at playback',async()=>{
 const h=harness(false,'cyber');await h.fx.enable();h.fx.setSoundSet('neonPulse');
 h.fx.play({frequency:440,amount:1,account:'same',hash:'A'});
 const first=h.voices[0].buffer,cache=h.fx.diagnostics();
 for(const voice of h.voices)voice.onended?.();
 h.fx.play({frequency:440,amount:1,account:'same',hash:'A'});
 expect(h.voices[3].buffer).toBe(first);
 expect(h.fx.diagnostics().cacheEntries).toBe(cache.cacheEntries);
 expect(h.fx.diagnostics().cacheBytes).toBeLessThanOrEqual(32*1024*1024);
 expect(h.voices[3].playbackRate.value).toBeGreaterThan(.9);
 h.fx.disable();expect(h.fx.diagnostics().cacheBytes).toBe(0);
});

test('NetLoom shares one convolver across repeated voices and cleans the bus on disable',async()=>{
 const h=harness(false,'cyber');await h.fx.enable();h.fx.setSoundSet('neonPulse');
 for(let i=0;i<8;i++){
  h.fx.play({frequency:440,amount:1,account:'same',hash:'A'});
  for(const voice of h.voices)voice.onended?.();
 }
 expect(h.convolvers).toHaveLength(1);
 expect(h.fx.diagnostics().effectsBuses).toBe(1);
 expect(h.fx.diagnostics().effectTails).toBe(0);
 h.fx.disable();expect(h.fx.diagnostics().effectsBuses).toBe(0);
 expect(h.convolvers[0].disconnected).toBe(true);
});

test('worker synthesis coalesces simultaneous note requests and starts voices asynchronously',async()=>{
 const h=harness(false,'cyber',true);await h.fx.enable();h.fx.setSoundSet('neonPulse');
 const cue={frequency:440,amount:1,account:'same',hash:'A'};
 h.fx.play(cue);h.fx.play(cue);
 expect(h.voices).toHaveLength(0);expect(h.asyncJobs).toHaveLength(3);expect(h.fx.diagnostics().preparing).toBe(6);
 h.completeJobs();await new Promise(resolve=>setTimeout(resolve,0));
 expect(h.voices).toHaveLength(6);expect(h.voices[0].buffer).toBe(h.voices[1].buffer);expect(h.fx.diagnostics().preparing).toBe(0);
 h.fx.dispose();
});
test('late worker results cannot play or refill caches after preset changes or disable',async()=>{
 const h=harness(false,'cyber',true);await h.fx.enable();h.fx.setSoundSet('neonPulse');h.fx.play({frequency:440});
 h.fx.setSoundSet('circuitWeave');h.completeJobs();await new Promise(resolve=>setTimeout(resolve,0));
 expect(h.voices).toHaveLength(0);expect(h.fx.diagnostics().preparing).toBe(0);expect(h.fx.diagnostics().cacheEntries).toBe(0);
 h.fx.play({frequency:440});h.fx.disable();h.completeJobs();await new Promise(resolve=>setTimeout(resolve,0));
 expect(h.voices).toHaveLength(0);expect(h.fx.diagnostics().cacheEntries).toBe(0);expect(h.fx.diagnostics().effectsBuses).toBe(0);
});

test('a worker failure allows the existing foreground generator to recover on the next cue',async()=>{
 const h=harness(false,'cyber',true);await h.fx.enable();h.fx.setSoundSet('neonPulse');h.fx.play({frequency:440});
 for(const job of h.asyncJobs.splice(0))job.reject(new Error('Worker failed'));
 await new Promise(resolve=>setTimeout(resolve,0));expect(h.fx.diagnostics().preparing).toBe(0);
 expect(h.fx.play({frequency:440})).toBe(true);expect(h.voices).toHaveLength(3);expect(h.asyncJobs).toHaveLength(0);h.fx.dispose();
});
