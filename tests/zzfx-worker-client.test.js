import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/zzfx-worker-client.js',import.meta.url),'utf8');
function harness(){
 const workers=[];
 class Worker {
  constructor(url){this.url=url;this.messages=[];workers.push(this)}
  postMessage(message){this.messages.push(message)}
  terminate(){this.terminated=true}
  complete(index=0){const {id}=this.messages[index];this.onmessage?.({data:{id,samples:new Float32Array([.1,.2]),duration:12}})}
 }
 const c=vm.createContext({URL,Worker,document:{currentScript:{src:'http://localhost/js/zzfx-worker-client.js'}},setTimeout,clearTimeout});
 vm.runInContext(source,c);
 return {client:c.createZzfxWorkerClient(),workers};
}
test('worker requests transfer sample parameters and resolve only matching jobs',async()=>{
 const {client,workers}=harness();const a=client.generate(48000,[1,0,440]),b=client.generate(48000,[1,0,220]);
 expect(client.pending).toBe(2);expect(workers).toHaveLength(1);expect(workers[0].messages[0].sampleRate).toBe(48000);
 workers[0].complete(1);expect((await b).samples.length).toBe(2);expect(client.pending).toBe(1);
 workers[0].complete(0);expect((await a).duration).toBe(12);expect(client.pending).toBe(0);client.cancelAll();
});
test('cancel terminates the worker and rejects pending jobs; late replies are ignored',async()=>{
 const {client,workers}=harness();const a=client.generate(44100,[1,0,440]);const lateError=workers[0].onerror;const rejected=a.catch(error=>error);
 client.cancelAll();expect((await rejected).message).toContain('cancelled');expect(workers[0].terminated).toBe(true);expect(client.pending).toBe(0);
 workers[0].complete();const b=client.generate(44100,[1,0,220]);expect(workers).toHaveLength(2);lateError({message:'stale error'});expect(client.pending).toBe(1);workers[1].complete();await b;client.cancelAll();
});
test('worker queue is bounded and failure releases all pending requests',async()=>{
 const {client,workers}=harness();const requests=Array.from({length:16},()=>client.generate(44100,[1,0,440]));
 const settled=Promise.allSettled(requests);await expect(client.generate(44100,[1,0,220])).rejects.toThrow('queue full');
 workers[0].onerror();expect((await settled).every(r=>r.status==='rejected')).toBe(true);expect(client.pending).toBe(0);expect(workers[0].terminated).toBe(true);
});
