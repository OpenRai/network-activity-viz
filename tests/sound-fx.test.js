import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/sound-fx.js',import.meta.url),'utf8');
function harness(fail=false){
 const contexts=[],buffers=[],voices=[],gains=[];
 class AudioContext {
  constructor(){contexts.push(this);this.state='suspended';this.sampleRate=48000;this.destination={}}
  async resume(){if(fail)throw Error('Audio blocked');this.state='running'}
  createBuffer(channels,length){const samples=new Float32Array(length);buffers.push(samples);return{getChannelData:()=>samples}}
  createBufferSource(){const voice={connect(){},disconnect(){},start(){this.started=true},stop(){this.stopped=true;this.onended?.()}};voices.push(voice);return voice}
  createGain(){const gain={gain:{value:0},connect(){},disconnect(){}};gains.push(gain);return gain}
 }
 const context=vm.createContext({window:{AudioContext,addEventListener(){}},document:{addEventListener(){}},WebAssembly,Uint8Array});
 vm.runInContext(source,context);
 return{fx:context.createSoundFX(),contexts,buffers,voices,gains};
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
