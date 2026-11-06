import {WsEndpointPool} from '@openrai/nano-core/transport/ws';
import {WebSocketClient} from 'nano-sdk/web-socket';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const start=Date.now(), rows=[];
for(const endpoint of ['wss://nanoslo.0x.no/websocket','wss://rainstorm.city/websocket'])for(const kind of ['shared','core','sdk']){
 const row={kind,endpoint,count:0,unique:new Set(),last:null,pongs:0,errors:[],socket:null};rows.push(row);
 const receive=p=>{if(p.ack==='pong')row.pongs++;if(p.error)row.errors.push(p);if(p.topic==='confirmation'){row.count++;row.unique.add(p.message?.hash);row.last=Date.now()}};
 if(kind==='shared'){
 const document=new EventTarget();document.hidden=false;const window=new EventTarget();
 const context=vm.createContext({URL,WebSocket,document,window,performance,setTimeout,clearTimeout,Math});vm.runInContext(readFileSync(new URL('../js/nano-feed.js',import.meta.url),'utf8'),context);
 row.client=context.createNanoFeed(endpoint,{onPacket:receive,onStatus:s=>row.status=s,onGap:s=>row.errors.push(s)});continue;
 }
 const opened=s=>{row.socket=s;s.addEventListener('message',e=>{try{receive(JSON.parse(e.data))}catch{}});s.send(JSON.stringify({action:'subscribe',topic:'confirmation',ack:true,id:'confirmations',options:{include_block:true,include_election_info:true}}));s.send(JSON.stringify({action:'subscribe',topic:'vote',ack:true,id:'votes'}));s.send('{"action":"ping"}');row.ping=setInterval(()=>{if(s.readyState===1)s.send('{"action":"ping"}')},15000)};
 if(kind==='core'){new WsEndpointPool({urls:[endpoint],defaults:[],warn:()=>{}}).connect().then(opened).catch(e=>row.errors.push(String(e)))}
 else{const s=new WebSocketClient(endpoint);s.onopen=()=>opened(s);s.onerror=e=>row.errors.push(String(e.message))}
}
const report=()=>console.log(JSON.stringify({elapsed:Math.round((Date.now()-start)/1000),rows:rows.map(({kind,endpoint,count,unique,last,pongs,errors,status})=>({kind,endpoint,count,unique:unique.size,idle:last?Math.round((Date.now()-last)/1000):null,pongs,errors,status}))}));
const timer=setInterval(report,15000);setTimeout(()=>{report();clearInterval(timer);for(const r of rows){r.client?.stop();clearInterval(r.ping);r.socket?.close()}process.exit()},180000);
