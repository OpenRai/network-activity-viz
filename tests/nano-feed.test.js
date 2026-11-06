import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const pages=['index','constellation','dispatch','hangtime','score','starmap'];
const source=readFileSync(root+'js/nano-feed.js','utf8');
function harness(endpoint='wss://test.example/ws'){
 let now=0,id=0;const timers=new Map(),sockets=[],statuses=[],packets=[],gaps=[];
 const document=new EventTarget();document.hidden=false;const window=new EventTarget();
 class Socket{
  static OPEN=1;static CONNECTING=0;
  constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this)}
  send(data){this.sent.push(JSON.parse(data))}
  open(){this.readyState=1;this.onopen?.()}
  message(p){this.onmessage?.({data:JSON.stringify(p)})}
  close(){this.readyState=3;this.onclose?.({code:1000})}
 }
 const math=Object.create(Math);math.random=()=>1;
 const context=vm.createContext({URL,TextDecoder,WebSocket:Socket,document,window,Math:math,performance:{now:()=>now},setTimeout:(fn,delay)=>{const token=++id;timers.set(token,{at:now+delay,fn});return token},clearTimeout:token=>timers.delete(token)});
 vm.runInContext(source,context);
 const client=context.createNanoFeed(endpoint,{onPacket:p=>packets.push(p),onStatus:s=>statuses.push(s),onGap:g=>gaps.push(g)});
 function advance(ms){const target=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn()}now=target}
 return {client,sockets,statuses,packets,gaps,timers,advance,document,window};
}
test('all six pages load the shared transport exactly once',()=>{for(const name of pages){const html=readFileSync(root+name+'.html','utf8');expect(html.match(/src="js\/nano-feed\.js"/g)?.length).toBe(1);expect(html).not.toContain('function createNanoFeed(')}});
test('ongoing confirmations keep one connection alive beyond three minutes',()=>{
 const h=harness(),s=h.sockets[0];s.open();s.message({ack:'pong'});
 for(let i=0;i<13;i++){h.advance(15000);s.message({ack:'pong'});s.message({topic:'confirmation',message:{hash:String(i)}})}
 expect(h.sockets.length).toBe(1);expect(h.packets.length).toBe(13);expect(h.gaps.length).toBe(0);h.client.stop();expect(h.timers.size).toBe(0);
});
test('endpoint rejection remains visible after a healthy pong',()=>{
 const h=harness(),s=h.sockets[0];s.open();s.message({error:'Subscribe to ALL not allowed'});s.message({ack:'pong'});
 for(let i=0;i<4;i++){h.advance(15000);s.message({ack:'pong'})}
 expect(h.statuses.at(-1)).toContain('Subscribe to ALL not allowed');expect(h.sockets.length).toBe(1);h.client.stop();
});
test('confirmation silence renews the connection even when pongs and votes continue',()=>{
 const h=harness(),s=h.sockets[0];s.open();expect(s.sent.map(p=>p.action)).toEqual(['subscribe','subscribe','ping']);
 s.message({ack:'subscribe',id:'confirmations'});s.message({ack:'subscribe',id:'votes'});s.message({ack:'pong'});
 for(let i=0;i<2;i++){h.advance(15000);s.message({ack:'pong'});s.message({topic:'vote',message:{}})}
 h.advance(15000);expect(h.gaps.length).toBe(1);expect(h.gaps[0]).toContain('idle for 45s');
 h.advance(1000);expect(h.sockets.length).toBe(2);h.sockets[1].open();expect(h.sockets[1].sent[0].topic).toBe('confirmation');h.client.stop();expect(h.timers.size).toBe(0);
});
test('missing pong reconnects, resubscribes, and ignores stale socket callbacks',()=>{
 const h=harness(),old=h.sockets[0];old.open();const stale=old.onmessage;h.advance(10000);expect(h.gaps.length).toBe(1);h.advance(1000);expect(h.sockets.length).toBe(2);
 const current=h.sockets[1];current.open();expect(current.sent.filter(p=>p.action==='subscribe').map(p=>p.topic)).toEqual(['confirmation','vote']);
 stale({data:JSON.stringify({topic:'confirmation',message:{hash:'STALE'}})});expect(h.packets.length).toBe(0);
 current.message({ack:'pong'});current.message({topic:'confirmation',message:{hash:'CURRENT'}});expect(h.packets.length).toBe(1);expect(h.statuses.at(-1)).toContain('history may be missing');h.client.stop();
});
test('vote rejection stays visible while confirmations and heartbeat continue',()=>{
 const h=harness(),s=h.sockets[0];s.open();s.message({error:'restricted',id:'votes'});s.message({ack:'subscribe',id:'confirmations'});s.message({ack:'pong'});s.message({topic:'confirmation',message:{hash:'SEND'}});
 expect(h.statuses.at(-1)).toContain('vote: restricted');expect(h.statuses.at(-1)).toContain('confirmation: receiving');expect(h.packets.length).toBe(1);expect(h.gaps.length).toBe(0);h.client.stop();
});
test('unacknowledged confirmation subscription is retried without treating silence as failure',()=>{
 const h=harness(),s=h.sockets[0];s.open();s.message({ack:'pong'});h.advance(12000);expect(s.sent.filter(p=>p.id==='confirmations').length).toBe(2);expect(h.statuses.at(-1)).toContain('unacknowledged');expect(h.sockets.length).toBe(1);h.client.stop();
});
test('stop cancels retry and timers; reopening visible tab probes immediately',()=>{
 const h=harness(),s=h.sockets[0];s.open();s.message({ack:'pong'});h.document.dispatchEvent(new Event('visibilitychange'));expect(s.sent.filter(p=>p.action==='ping').length).toBe(2);
 h.advance(10000);h.client.stop();h.advance(60000);expect(h.sockets.length).toBe(1);expect(h.timers.size).toBe(0);
});
test('connection timeout uses increasing reconnect delays',()=>{
 const h=harness();h.advance(12000);expect(h.gaps.length).toBe(1);h.advance(1000);expect(h.sockets.length).toBe(2);h.advance(12000);h.advance(1999);expect(h.sockets.length).toBe(2);h.advance(1);expect(h.sockets.length).toBe(3);h.client.stop();
});
test('repeater uses event liveness and accepts native and batched confirmations',()=>{
 const h=harness('wss://node.somenano.com/repeater'),s=h.sockets[0];s.open();
 expect(s.sent).toEqual([{action:'subscribe',topic:'confirmation'}]);
 h.advance(15000);expect(h.sockets.length).toBe(1);expect(h.gaps.length).toBe(0);
 s.message({topic:'confirmation',message:{hash:'A'}});
 s.message({block_dump:{blocks:[{hash:'B'},{topic:'confirmation',message:{hash:'C'}}]}});
 s.message({topic:'confirmation',blocks:[{hash:'D'}],duration:5000});
 expect(h.packets.map(p=>p.message.hash)).toEqual(['A','B','C','D']);
 expect(h.statuses.at(-1)).toContain('unavailable on repeater');
 h.advance(45000);expect(h.gaps.length).toBe(1);h.client.stop();expect(h.timers.size).toBe(0);
});
test('binary JSON confirmations and Blob pongs are decoded in the browser',async()=>{
 const h=harness(),s=h.sockets[0];s.open();expect(s.binaryType).toBe('arraybuffer');
 await s.onmessage({data:new TextEncoder().encode(JSON.stringify({topic:'confirmation',message:{hash:'BINARY'}})).buffer});
 await s.onmessage({data:new Blob([JSON.stringify({ack:'pong'})])});
 expect(h.packets[0].message.hash).toBe('BINARY');expect(h.statuses.at(-1)).toContain('heartbeat OK');h.client.stop();
});
test('late Blob decoding cannot deliver from a retired connection',async()=>{
 const h=harness(),s=h.sockets[0];s.open();let finish;
 const pending=s.onmessage({data:{text:()=>new Promise(resolve=>{finish=resolve})}});
 h.client.stop();finish(JSON.stringify({topic:'confirmation',message:{hash:'STALE'}}));await pending;
 expect(h.packets.length).toBe(0);
});
