import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function harness(){
 const c=vm.createContext({VIEW:'eventsky',$:()=>({}),shortAccount:x=>x,formatNanoAmount:x=>x,viewOptions:{},visualItems:new Map()});
 for(const file of ['event-utils','visualizer-core'])vm.runInContext(readFileSync(new URL('../js/'+file+'.js',import.meta.url),'utf8'),c);
 vm.runInContext('clearRecording();state.time=100;',c);
 return c;
}
test('confirmation retention remembers both send accounts and deduplicates hashes',()=>{
 const c=harness(),send={topic:'confirmation',message:{hash:'SEND',account:'xrb_source',amount:'100',block:{subtype:'send',link_as_account:'nano_destination'}}};
 c.ingest(send,10);c.ingest(send,11);
 expect(c.model().blocks.length).toBe(1);
 expect(vm.runInContext('[...state.accountOrder.keys()]',c)).toEqual(['nano_source','nano_destination']);
});
test('receives from outside the recording survive parsing and remain visible',()=>{
 const c=harness();c.ingest({topic:'confirmation',message:{hash:'RECEIVE',account:'nano_destination',amount:'100',block:JSON.stringify({subtype:'receive',link:'OLD_SEND'})}},20);
 const m=c.model();expect(m.blocks.length).toBe(1);expect(m.transfers.length).toBe(0);expect(m.receives.get('OLD_SEND').hash).toBe('RECEIVE');
});
test('live startup never advances the synthetic event stream',()=>{
 const c=harness();vm.runInContext('state.time=60000;advanceDemo()',c);
 expect(vm.runInContext('state.mode',c)).toBe('live');
 expect(c.model().blocks).toHaveLength(0);
 expect(c.model().votes).toHaveLength(0);
});
test('stress vote messages are explicitly labeled simulated',()=>{
 const c=harness(),elements=new Map();
 c.$=id=>{if(!elements.has(id))elements.set(id,{replaceChildren(){}});return elements.get(id)};
 vm.runInContext("state.mode='stress'",c);
 c.updateConsensusPanel({votes:[]});
 expect(elements.get('voteState').textContent).toContain('SIMULATED');
 expect(elements.get('orvSummary').textContent).toContain('simulated vote messages');
});
test('the core excludes expired and future blocks from replay-window models',()=>{
 const c=harness();
 for(const [hash,at]of [['OLD',0],['RECENT',55000],['FUTURE',61000]])c.ingest({topic:'confirmation',message:{hash,account:'nano_test',amount:'1',block:{subtype:'send',link_as_account:'nano_other'}}},at);
 vm.runInContext('state.time=60000;state.windowMs=10000',c);
 expect(c.model().blocks.map(b=>b.hash)).toEqual(['RECENT']);
});
