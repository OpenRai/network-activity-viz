/* Shared data, simulation, controls, and panels for the four canvas candidates. */
'use strict';
let feedClient = null;
const state = { mode:'demo', time:VIEW==='score'?60000:14000, playing:true, blocks:[], votes:[], recording:[], seen:new Set(), selected:null, accountOrder:new Map(), status:'Illustrative demo · fictional accounts and representatives', started:0, demoIndex:0 };
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
function ingest(event, at) {
  appendBounded(state.recording,{observedAt:at,topic:event.topic,message:event.message},10000);
  const m=event.message||{};
  if(event.topic==='vote'&&typeof m.account==='string') {
    appendBounded(state.votes,{at,rep:accountKey(m.account),hashes:Array.isArray(m.blocks)?m.blocks:[]},5000);
    return;
  }
  if(event.topic!=='confirmation'||typeof m.hash!=='string'||typeof m.account!=='string'||state.seen.has(m.hash))return;
  const b=parseNanoBlock(m.block)||{};
  const subtype=b.subtype||m.subtype||b.type||'unknown';
  const block={hash:m.hash,account:accountKey(m.account),at,raw:m.amount,subtype,previous:b.previous,source:b.link||b.source,destination:accountKey(b.link_as_account||b.destination),confirmation:m.confirmation_type||'reported by node'};
  rememberBlock(block);
}
function rememberBlock(block){
  state.seen.add(block.hash);state.blocks.push(block);rememberAccount(block.account);
  if(block.subtype==='send')rememberAccount(block.destination);
  if(state.blocks.length>3000)state.seen.delete(state.blocks.shift().hash);
  // Account placement only needs accounts represented in retained history.
  if(state.accountOrder.size>6000){const retained=new Set(state.blocks.flatMap(b=>[b.account,b.destination]).filter(Boolean));state.accountOrder=new Map([...state.accountOrder].filter(([a])=>retained.has(a)));}
}
function advanceDemo(){while(state.demoIndex<demo.length&&demo[state.demoIndex].at<=state.time){const event=demo[state.demoIndex++];ingest(event,event.at)}}
function clearRecording(){viewOptions.reset?.();visualItems.clear();state.blocks=[];state.votes=[];state.recording=[];state.seen.clear();state.accountOrder.clear();state.selected=null;state.demoIndex=0;state.time=0;}
function disconnect(){feedClient?.stop();feedClient=null}
function startDemo(){disconnect();clearRecording();state.mode='demo';state.time=VIEW==='score'?60000:14000;state.playing=true;state.status='Illustrative demo · '+(state.time/1000)+'-second recorded lead-in · fictional accounts and votes';$('feed').value='demo';$('pause').textContent='Pause';advanceDemo();render();}
$('reset').onclick=startDemo;
$('pause').onclick=()=>{state.playing=!state.playing;$('pause').textContent=state.playing?'Pause':'Resume';render()};
$('feed').onchange=()=>{$('endpoint').disabled=$('feed').value==='demo'};
$('connect').onclick=()=>{
  if($('feed').value==='demo'){startDemo();return}
  let url;try{url=new URL($('endpoint').value);if(!['ws:','wss:'].includes(url.protocol))throw Error('protocol')}catch{state.status='Enter a valid ws:// or wss:// endpoint.';render();return}
  disconnect();clearRecording();state.mode='live';state.playing=true;$('pause').textContent='Pause';state.started=performance.now();state.status='Connecting to '+url.host+'…';
  feedClient=createNanoFeed(url.href,{
    onPacket:packet=>ingest(packet,performance.now()-state.started),
    onStatus:status=>{state.status=status},
    onGap:reason=>{
      appendBounded(state.recording,{topic:'observer_gap',observedAt:performance.now()-state.started,reason},10000);
    }
  });
  render();
};
$('export').onclick=()=>{
 downloadJSON({schema:3,mode:state.mode,observerTime:'milliseconds since session start',events:state.recording},'nano-'+VIEW+'-events.json');
};
const short = shortAccount;
const amount = formatNanoAmount;
function logAmount(raw){try{const s=BigInt(raw).toString();if(s==='0')return -8;return s.length-1-30+Math.log10(Number(s.slice(0,12))/10**(Math.min(s.length,12)-1))}catch{return -8}}
function seconds(ms){return (ms/1000).toFixed(ms<10000?1:0)+'s'}
function model(){
 const blocks=state.blocks.filter(b=>b.at<=state.time),byHash=new Map(blocks.map(b=>[b.hash,b]));
 const receives=new Map(blocks.filter(b=>['receive','open'].includes(b.subtype)).map(b=>[b.source,b]));
 const transfers=blocks.filter(b=>b.subtype==='send').map(send=>({send,receive:receives.get(send.hash)}));
 const votes=state.votes.filter(v=>v.at<=state.time),recent=blocks.filter(b=>b.at>=state.time-60000);
 return {blocks,byHash,receives,transfers,votes,recent};
}
function inspect(block){state.selected=block.hash;render()}
function updatePanels(m){
 $('mode').textContent=state.mode==='demo'?'DEMO / FICTIONAL DATA':'LIVE / OBSERVER DATA';
 $('connection').textContent=state.status+(state.playing?'':' · VIEW PAUSED'+(state.mode==='live'?' / capture continues':''));
 $('sends').textContent=m.transfers.length;$('receives').textContent=m.blocks.filter(b=>['receive','open'].includes(b.subtype)).length;$('pending').textContent=m.blocks.length;
 updateConsensusPanel(m);
 updateBlockDetails(m);
 updateRecentBlocks(m);
 updateVotePulse(m);
}
function updateConsensusPanel(m){
 const recentVotes=m.votes.filter(v=>v.at>state.time-10000),repCounts=new Map();
 recentVotes.forEach(v=>repCounts.set(v.rep,(repCounts.get(v.rep)||0)+1));
 $('voteState').textContent=state.mode==='demo'?'SIMULATED ORV':m.votes.length?'VOTE MESSAGES OBSERVED':'VOTE STREAM UNOBSERVED';
 $('orvSummary').textContent=state.mode==='live'&&!m.votes.length?'No vote messages received. This endpoint may expose confirmations only.':recentVotes.length+' vote messages / last 10s · '+repCounts.size+' representatives';
 $('reps').replaceChildren();
 for(const [rep,count]of [...repCounts].sort((a,b)=>b[1]-a[1]).slice(0,4)){
  const row=document.createElement('div');row.className='rep';const name=document.createElement('span');name.textContent=short(rep);const val=document.createElement('span');val.textContent=count+' votes';row.append(name,val);$('reps').append(row);
 }
}
function updateBlockDetails(m){
 const selected=m.byHash.get(state.selected);
 let detail='Select a mark or a recent block to inspect the confirmed block.';
 if(selected){
  const send=selected.subtype==='send'?selected:m.byHash.get(selected.source),receive=selected.subtype==='send'?m.receives.get(selected.hash):selected;
  const lines=[selected.subtype.toUpperCase()+' · CONFIRMED',amount(selected.raw),'Account: '+selected.account,'Hash: '+selected.hash,'Observer time: '+seconds(selected.at)];
  if(send&&receive)lines.push('Observer receipt interval (not settlement latency): '+seconds(receive.at-send.at));
  else if(selected.subtype==='send')lines.push('Send is final. No receive referencing it is present in this recording.');
  else if(['receive','open'].includes(selected.subtype))lines.push('Source send predates or is missing from this recording.');
  lines.push('Confirmation: '+selected.confirmation);
  const endorsers=new Set(m.votes.filter(v=>v.hashes.includes(selected.hash)).map(v=>v.rep));
  lines.push('Observed voting reps for this hash: '+endorsers.size);
  detail=lines.join('\n');
 }
 $('detail').textContent=detail;
}
function updateRecentBlocks(m){
 const recentKey=m.blocks.slice(-4).map(b=>b.hash).join('|');
 if($('recent').dataset.key!==recentKey){
 $('recent').dataset.key=recentKey;$('recent').replaceChildren();for(const b of m.blocks.slice(-4).reverse()){
  const button=document.createElement('button');button.className='recent-button';button.textContent=(b.subtype==='send'?'↗ ':b.subtype==='change'?'◇ ':'↘ ')+short(b.account)+' · '+b.subtype;button.onclick=()=>inspect(b);$('recent').append(button);
 }
 }
}
function updateVotePulse(m){
 const strip=$('pulse');strip.replaceChildren();for(let i=29;i>=0;i--){const end=state.time-i*1000,count=m.votes.filter(v=>v.at>end-1000&&v.at<=end).length;const bar=document.createElement('i');bar.style.height=Math.min(28,2+count*1.8)+'px';bar.title=count+' vote messages';strip.append(bar)}
 $('voteCount').textContent=m.votes.filter(v=>v.at>state.time-30000).length+' messages / 30s';
}
