/* Shared event replay, controls, and live data for Nano Atlas and Eventsky. */
'use strict';
let feedClient = null;
const state = { mode:'live', time:0, windowMs:globalThis.gallerySettings?.memoryMs||30*60000, playing:true, blocks:[], votes:[], recording:[], seen:new Set(), selected:null, selectedAccount:null, accountOrder:new Map(), status:'', started:0, demoIndex:0 };
// Retained history owns data; frame-local animation must not mutate cached indexes.
/** @typedef {{hash:string, account:string, at:number, raw:string, subtype:string}} NormalizedBlock */
let dataRevision=0, cachedModel=null;
const demo = [];
const names = ['Atlas','Birch','Cedar','Delta','Ember','Fern','Grove','Harbor','Iris','Juniper','Kite','Lumen'];
for (let i=0; i<1200; i++) {
  const from='Demo '+names[i%12], to='Demo '+names[(i%12+1+i%9)%12];
  const at=i*1250, hash='demo-send-'+i, raw=String(BigInt(1+i%9)*10n**BigInt(25+i%8));
  demo.push({topic:'confirmation',at,message:{hash,account:from,amount:raw,confirmation_type:'active_quorum',block:{subtype:'send',link_as_account:to}}});
  if (i%6!==0) {
    const delay=[700,1400,2700,6500,18000,34000][i%6];
    const receiveHash='demo-receive-'+i;
    demo.push({topic:'confirmation',at:at+delay,message:{hash:receiveHash,account:to,amount:raw,confirmation_type:'active_quorum',block:{subtype:'receive',link:hash}}});
    for(let r=0;r<3;r++) demo.push({topic:'vote',at:at+delay-180+r*40,message:{account:'Demo rep '+(r+1),blocks:[receiveHash]}});
  }
  for(let r=0;r<4;r++) demo.push({topic:'vote',at:Math.max(0,at-240+r*45),message:{account:'Demo rep '+(r+1),blocks:[hash]}});
  if(i%15===10)demo.push({topic:'confirmation',at:at+500,message:{hash:'demo-change-'+i,account:from,amount:'0',confirmation_type:'active_quorum',block:{subtype:'change'}}});
}
demo.sort((a,b)=>a.at-b.at);
const heads=new Map();
for(const event of demo) {
  if(event.topic!=='confirmation')continue;
  const m=event.message;
  m.block.previous=heads.get(m.account);
  heads.set(m.account,m.hash);
}
function accountKey(account) { return typeof account==='string'?account.replace(/^xrb_/,'nano_'):''; }
function rememberAccount(account) {
  if(account&&!state.accountOrder.has(account))state.accountOrder.set(account,state.accountOrder.size);
}
function ingest(event, at, lastSeenAt = Date.now(), persist = false) {
  dataRevision++;
  appendBounded(state.recording,{observedAt:at,topic:event.topic,message:event.message},10000);
  const m=event.message||{};
  if(event.topic==='vote'&&typeof m.account==='string') {
    appendBounded(state.votes,{at,rep:accountKey(m.account),hashes:Array.isArray(m.blocks)?m.blocks.map(hash=>String(hash).toUpperCase()):[]},5000);
    return;
  }
  if(event.topic!=='confirmation')return;
  const cached=persist?globalThis.nanoEventCache?.record(event,lastSeenAt):null;
  if(typeof m.hash!=='string'||typeof m.account!=='string')return;
  const hash=m.hash.toUpperCase();
  if(state.seen.has(hash)){
    const existing=state.blocks.find(block=>block.hash===hash);
    if(existing)existing.lastSeenAt=cached?.event.lastSeenAt||lastSeenAt;
    return;
  }
  const b=parseNanoBlock(m.block)||{};
  const subtype=b.subtype||m.subtype||b.type||'unknown';
  const block={hash,account:accountKey(m.account),at,lastSeenAt:cached?.event.lastSeenAt||lastSeenAt,raw:m.amount,subtype,previous:typeof b.previous==='string'?b.previous.toUpperCase():b.previous,source:typeof (b.link||b.source)==='string'?(b.link||b.source).toUpperCase():b.link||b.source,destination:accountKey(b.link_as_account||b.destination),confirmation:m.confirmation_type||'reported by node'};
  rememberBlock(block);
}
function rememberBlock(block){
  dataRevision++;
  state.seen.add(block.hash);state.blocks.push(block);rememberAccount(block.account);
  if(block.subtype==='send')rememberAccount(block.destination);
  if(state.blocks.length>3000)state.seen.delete(state.blocks.shift().hash);
  // Account placement only needs accounts represented in retained history.
  if(state.accountOrder.size>6000){const retained=new Set(state.blocks.flatMap(b=>[b.account,b.destination]).filter(Boolean));state.accountOrder=new Map([...state.accountOrder].filter(([a])=>retained.has(a)));}
}
function advanceDemo(){if(!['demo','stress'].includes(state.mode))return;while(state.demoIndex<demo.length&&demo[state.demoIndex].at<=state.time){const event=demo[state.demoIndex++];ingest(event,event.at)}}
function clearRecording(){dataRevision++;cachedModel=null;viewOptions.reset?.();visualItems.clear();state.blocks=[];state.votes=[];state.recording=[];state.seen.clear();state.accountOrder.clear();state.selected=null;state.selectedAccount=null;state.demoIndex=0;state.time=0;}
function disconnect(){feedClient?.stop();feedClient=null}
function startDemo(stress=false){disconnect();clearRecording();state.mode=stress?'stress':'demo';state.time=stress?0:VIEW==='eventsky'?25*60*1000:14000;state.playing=true;state.status=stress?'Stress test · fictional activity':'Simulated data';advanceDemo();render();}
function connectSelected(){
  const selected=$('feed').value;
  if(selected==='demo'||selected==='stress'){startDemo(selected==='stress');return}
  let url;try{url=new URL(selected);if(!['ws:','wss:'].includes(url.protocol))throw Error('protocol')}catch{state.status='Choose a valid Nano websocket.';render();return}
  disconnect();clearRecording();state.mode='live';state.playing=true;state.started=performance.now();state.status='Connecting to '+url.host+'…';
  for(const event of globalThis.nanoEventCache?.restore()||[])ingest({topic:'confirmation',message:event.message},-event.elapsedMs,event.lastSeenAt);
  feedClient=createNanoFeed(url.href,{
    onPacket:packet=>ingest(packet,performance.now()-state.started,Date.now(),true),
    onStatus:status=>{state.status=status},
    onGap:reason=>{
      appendBounded(state.recording,{topic:'observer_gap',observedAt:performance.now()-state.started,reason},10000);
    }
  });
  render();
}
if(globalThis.gallerySettings){gallerySettings.onNodeChange(connectSelected);gallerySettings.onMemoryChange(()=>{state.windowMs=gallerySettings.memoryMs;render()});}
const short = shortAccount;
const amount = formatNanoAmount;
function logAmount(raw){try{const s=BigInt(raw).toString();if(s==='0')return -8;return s.length-1-30+Math.log10(Number(s.slice(0,12))/10**(Math.min(s.length,12)-1))}catch{return -8}}
function seconds(ms){return (ms/1000).toFixed(ms<10000?1:0)+'s'}
function model(){
 const reusable=cachedModel&&cachedModel.revision===dataRevision&&cachedModel.windowMs===state.windowMs&&state.time>=cachedModel.time&&state.time<cachedModel.nextChange;
 if(!reusable){
  const blocks=state.blocks.filter(b=>b.at<=state.time&&b.at>=state.time-state.windowMs),byHash=new Map(blocks.map(b=>[b.hash,b]));
  const receives=new Map(blocks.filter(b=>['receive','open'].includes(b.subtype)).map(b=>[b.source,b]));
  const transfers=blocks.filter(b=>b.subtype==='send').map(send=>({send,receive:receives.get(send.hash)}));
  let nextChange=Infinity;
  for(const b of state.blocks){if(b.at>state.time)nextChange=Math.min(nextChange,b.at);else if(b.at+state.windowMs>=state.time)nextChange=Math.min(nextChange,b.at+state.windowMs)}
  cachedModel={revision:dataRevision,windowMs:state.windowMs,time:state.time,nextChange,blocks,byHash,receives,transfers};
 }
 const {blocks,byHash,receives,transfers}=cachedModel;
 const votes=state.votes.filter(v=>v.at<=state.time&&v.at>=state.time-state.windowMs),recent=blocks.filter(b=>b.at>=state.time-60000),votePulses=new Map();
 for(const vote of votes)if(vote.at>state.time-900)for(const hash of vote.hashes)votePulses.set(hash,Math.max(votePulses.get(hash)||0,vote.at));
 return {blocks,byHash,receives,transfers,votes,recent,votePulses};
}
function inspect(block){state.selected=block.hash;state.selectedAccount=null;render()}
function inspectAccount(account){state.selected=null;state.selectedAccount=account;render()}
function updatePanels(m){
 $('mode').textContent=state.mode==='live'?'LIVE / OBSERVER DATA':state.mode==='stress'?'STRESS TEST / FICTIONAL DATA':'SIMULATED DATA';
 $('connection').textContent=state.status;
 $('sends').textContent=m.transfers.length;$('receives').textContent=m.blocks.filter(b=>['receive','open'].includes(b.subtype)).length;$('pending').textContent=m.blocks.length;
 updateConsensusPanel(m);
 updateBlockDetails(m);
 updateRecentBlocks(m);
 updateVotePulse(m);
}
function updateConsensusPanel(m){
 const recentVotes=m.votes.filter(v=>v.at>state.time-10000);
 if($('voteState'))$('voteState').textContent=state.mode!=='live'?'SIMULATED VOTES · '+(state.mode==='stress'?'STRESS TEST':'DEMO'):m.votes.length?'VOTE MESSAGES OBSERVED':'VOTE STREAM UNOBSERVED';
 if($('orvSummary'))$('orvSummary').textContent=state.mode==='live'&&!m.votes.length?'No vote messages received yet.':recentVotes.length+(state.mode==='live'?' vote messages received by this node':' simulated vote messages')+' in the last 10s.';
}
function updateBlockDetails(m){
 if(state.selectedAccount){
  const account=state.selectedAccount,accountBlocks=m.blocks.filter(b=>b.account===account),outgoing=m.transfers.filter(t=>t.send.account===account),incoming=m.transfers.filter(t=>t.send.destination===account),latest=accountBlocks.at(-1);
  const lines=['ACCOUNT · OBSERVED','Account: '+account,'Blocks in selected time window: '+accountBlocks.length,'Outgoing sends: '+outgoing.length,'Incoming linked sends: '+incoming.length];
  if(latest)lines.push('Latest block: '+latest.subtype.toUpperCase()+' · '+amount(latest.raw));
  const output=$('detail');if(output){output.hidden=false;output.textContent=lines.join('\n')}return;
 }
 const selected=m.byHash.get(state.selected);
 let detail='Select a mark or a recent block to inspect the confirmed block.';
 if(selected){
  const send=selected.subtype==='send'?selected:m.byHash.get(selected.source),receive=selected.subtype==='send'?m.receives.get(selected.hash):selected;
  const lines=[selected.subtype.toUpperCase()+' · CONFIRMED',amount(selected.raw),'Account: '+selected.account,'Hash: '+selected.hash,state.mode==='live'&&selected.lastSeenAt?'Seen by this node: '+seconds(Math.max(0,Date.now()-selected.lastSeenAt))+' ago':'Observer time: '+seconds(selected.at)];
  if(send&&receive)lines.push('Observer receipt interval (not settlement latency): '+seconds(receive.at-send.at));
  else if(selected.subtype==='send')lines.push('Send is final. No receive referencing it is present in this recording.');
  else if(['receive','open'].includes(selected.subtype))lines.push('Source send predates or is missing from this recording.');
  lines.push('Confirmation: '+selected.confirmation);
  const endorsers=new Set(m.votes.filter(v=>v.hashes.includes(selected.hash.toUpperCase())).map(v=>v.rep));
  lines.push('Representatives this node observed voting for this block: '+endorsers.size);
  detail=lines.join('\n');
 }
 const output=$('detail');if(output){output.hidden=!selected;output.textContent=detail;}
}
function updateRecentBlocks(m){
 if(!$('recent'))return;
 const recentKey=m.blocks.slice(-4).map(b=>b.hash).join('|');
 if($('recent').dataset.key!==recentKey){
 $('recent').dataset.key=recentKey;$('recent').replaceChildren();for(const b of m.blocks.slice(-4).reverse()){
  const button=document.createElement('button');button.className='recent-button';button.textContent=(b.subtype==='send'?'↗ ':b.subtype==='change'?'◇ ':'↘ ')+short(b.account)+' · '+b.subtype;button.onclick=()=>inspect(b);$('recent').append(button);
 }
 }
}
function updateVotePulse(m){
 const strip=$('pulse');if(strip){strip.replaceChildren();for(let i=29;i>=0;i--){const end=state.time-i*1000,count=m.votes.filter(v=>v.at>end-1000&&v.at<=end).length;const bar=document.createElement('i');bar.style.height=Math.min(28,2+count*1.8)+'px';bar.title=count+' vote messages';strip.append(bar)}}
 const count=m.votes.filter(v=>v.at>state.time-30000).length;if($('voteCount'))$('voteCount').textContent=count+(state.mode==='live'?' votes / 30s':' simulated votes / 30s');
}
