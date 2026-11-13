import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/sound-fx.js',import.meta.url),'utf8');
function harness(fail=false){
 const contexts=[],buffers=[],voices=[],gains=[];
 let now=Date.now();class Clock extends Date {static now(){return now}}
 class AudioContext {
  constructor(){contexts.push(this);this.state='suspended';this.sampleRate=48000;this.destination={}}
  async resume(){this.resumes=(this.resumes||0)+1;if(this.resumeHook)return this.resumeHook();if(fail)throw Error('Audio blocked');this.state='running'}
  async close(){this.state='closed';this.closed=true}
  createBuffer(channels,length){const samples=new Float32Array(length);buffers.push(samples);return{getChannelData:()=>samples}}
  createBufferSource(){const voice={connect(){},disconnect(){this.disconnected=true},start(){this.started=true},stop(){this.stopped=true;this.onended?.()}};voices.push(voice);return voice}
  createGain(){const gain={gain:{value:0},connect(){},disconnect(){this.disconnected=true}};gains.push(gain);return gain}
 }
 const window=new EventTarget(),document=new EventTarget();window.AudioContext=AudioContext;
 const context=vm.createContext({window,document,WebAssembly,Uint8Array,setTimeout,clearTimeout,Date:Clock});
 vm.runInContext(source,context);
 return{fx:context.createSoundFX(),contexts,buffers,voices,gains,window,document,elapse:ms=>{now+=ms}};
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
  h.fx.play({volume:.1});expect(h.gains.at(-1).gain.value).toBeCloseTo(.25);
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
