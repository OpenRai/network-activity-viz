'use strict';
// Filters receive one group per upstream message. Only delivery to onPacket is
// delayed; connection health is updated as soon as the source reports activity.
function createImmediateEventFilter(emit) {
  return {push(packets){for(const packet of packets)emit(packet)}, stop(){}};
}

function createSomeNanoEventFilter(emit) {
  const halfWindow = 2500;
  const pending = [];
  let timer = null, stopped = false;
  const hashKey = value => typeof value === 'string' ? value.toUpperCase() : '';

  function describe(packet) {
    const message = packet.message;
    let block = message?.block;
    if (typeof block === 'string') {
      try { block = JSON.parse(block); } catch { block = null; }
    }
    const subtype = block?.subtype || message?.subtype || block?.type;
    return {
      packet, subtype, hash:hashKey(message?.hash),
      source: subtype === 'receive' || subtype === 'open' ? hashKey(block?.source || block?.link) : '',
    };
  }

  function schedule() {
    clearTimeout(timer);
    timer = pending.length ? setTimeout(deliver, Math.max(0, Math.ceil(pending[0].due-performance.now()))) : null;
  }

  function deliver() {
    const now = performance.now();
    while (!stopped && pending.length && pending[0].due <= now) emit(pending.shift().packet);
    if (!stopped) schedule();
  }

  return {
    push(packets, {batched, receivedAt}) {
      if (stopped) return;
      if (!batched) {
        for(const packet of packets) { if(stopped)break; emit(packet); }
        return;
      }
      if (!packets.length) return;
      const entries = packets.map(describe);
      const sendHashes = new Set(entries.filter(e=>e.subtype==='send' && e.hash).map(e=>e.hash));
      const pairedSends = new Set(entries.map(e=>e.source).filter(hash=>sendHashes.has(hash)));
      for (const entry of entries) {
        const pairedReceive = pairedSends.has(entry.source);
        const pairedSend = entry.subtype === 'send' && pairedSends.has(entry.hash);
        const start = pairedReceive ? halfWindow : 0;
        const span = pairedReceive || pairedSend ? halfWindow : halfWindow*2;
        const offset = start + Math.min(span-1, Math.floor(Math.random()*span));
        pending.push({packet:entry.packet,due:receivedAt+offset});
      }
      pending.sort((a,b)=>a.due-b.due);
      schedule();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      pending.length = 0;
    },
  };
}

// Nano application-level keepalive: https://docs.nano.org/integration-guides/websockets/#keepalive
// Shared by the visualizer pages. Classic scripts also support opening the HTML through file://.
// createEventFilter(emit) returns {push(packets, {batched, receivedAt}), stop()}.
function createNanoFeed(endpoint, {onPacket, onStatus, onGap, createEventFilter}) {
  const url = new URL(endpoint);
  const host = url.host;
  const repeater = url.pathname.replace(/\/$/,'')==='/repeater';
  const someNano = repeater && url.hostname==='node.somenano.com';
  const subscriptions = repeater ? [{action:'subscribe',topic:'confirmation'}] : [
    {action:'subscribe',topic:'confirmation',ack:true,id:'confirmations',options:{confirmation_type:'all',include_block:true,include_election_info:true}},
    {action:'subscribe',topic:'vote',ack:true,id:'votes'}
  ];
  let ws = null, stopped = false, retryTimer = null, attempts = 0;
  let openTimer = null, heartbeatTimer = null, pongTimer = null, subscriptionTimer = null, activityTimer = null;
  let lastConfirmation = null;
  let pingSentAt = null, heartbeat = 'awaiting heartbeat', lastEvent = null, hadGap = false;
  let topicState = {}, topicErrors = {}, endpointError = '';
  const eventFilter = (createEventFilter ?? (someNano ? createSomeNanoEventFilter : createImmediateEventFilter))(packet=>{
    if(!stopped)onPacket(packet);
  });
  function publish() {
    const confirmationIdle = lastConfirmation === null ? 0 : performance.now()-lastConfirmation;
    const topics = ['confirmation','vote'].map(topic => topic+': '+(topicErrors[topic]||(topic==='confirmation'&&confirmationIdle>=30000?'idle / '+Math.floor(confirmationIdle/1000)+'s':topicState[topic])||'pending')).join(' · ');
    const last = lastEvent === null ? 'no events yet' : 'last event '+Math.floor((performance.now()-lastEvent)/1000)+'s ago';
    onStatus(host+' · '+heartbeat+' · '+topics+' · '+last+(endpointError?' · endpoint error: '+endpointError:'')+(hadGap?' · observation gap; history may be missing':''));
  }
  function clearSocketTimers() {
    clearTimeout(openTimer);clearTimeout(heartbeatTimer);clearTimeout(pongTimer);clearTimeout(subscriptionTimer);clearTimeout(activityTimer);
    openTimer=heartbeatTimer=pongTimer=subscriptionTimer=null;pingSentAt=null;
  }
  function retireSocket() {
    clearSocketTimers();
    const old=ws;ws=null;
    if(old){old.onopen=old.onmessage=old.onerror=old.onclose=null;try{old.close()}catch{}}
  }
  function reconnect(reason) {
    if(stopped||retryTimer!==null)return;
    retireSocket();hadGap=true;onGap(reason);
    const delay=Math.min(30000,1000*2**Math.min(attempts++,5))*(.85+Math.random()*.15);
    onStatus(reason+' · reconnecting in '+(delay/1000).toFixed(1)+'s · captured history retained; possible gap');
    retryTimer=setTimeout(()=>{retryTimer=null;connect()},delay);
  }
  function send(request) {
    if(!ws||ws.readyState!==WebSocket.OPEN)return false;
    try{ws.send(JSON.stringify(request));return true}catch{reconnect('Websocket send failed');return false}
  }
  function ping() {
    if(repeater)return; // This proxy streams confirmations but does not answer Nano pings.
    if(stopped||!ws||ws.readyState!==WebSocket.OPEN||pingSentAt!==null)return;
    clearTimeout(heartbeatTimer);heartbeatTimer=null;
    pingSentAt=performance.now();
    if(!send({action:'ping'}))return;
    const current=ws;
    pongTimer=setTimeout(()=>{if(ws===current&&pingSentAt!==null)reconnect('No Nano pong received within 10s')},10000);
  }
  function handlePong(){
    if(pingSentAt===null)return;
    const rtt=Math.max(0,Math.round(performance.now()-pingSentAt));
    clearTimeout(pongTimer);pongTimer=null;pingSentAt=null;attempts=0;
    heartbeat='heartbeat OK / '+rtt+'ms';publish();
    heartbeatTimer=setTimeout(ping,15000);
  }
  function handleEndpointError(packet,topic){
    if(topic==='vote'||topic==='confirmation')topicErrors[topic]=String(packet.error);
    else {
      endpointError=String(packet.error);
      if(/Subscribe to ALL not allowed/i.test(endpointError))topicErrors.confirmation=endpointError;
    }
    publish();
  }
  function connect() {
    if(stopped)return;
    onStatus('Connecting to '+host+'…');
    topicState={confirmation:'pending',vote:repeater?'unavailable on repeater':'pending'};topicErrors={};endpointError='';lastEvent=null;lastConfirmation=null;heartbeat=repeater?'repeater / awaiting events':'awaiting heartbeat';
    let current;
    try{current=new WebSocket(endpoint);current.binaryType='arraybuffer';ws=current}catch{reconnect('Could not open websocket');return}
    openTimer=setTimeout(()=>{if(ws===current)reconnect('Connection timed out after 12s')},12000);
    current.onopen=()=>{
      if(stopped||ws!==current)return;
      clearTimeout(openTimer);openTimer=null;
      lastConfirmation=performance.now();
      function checkActivity(){
        if(stopped||ws!==current)return;
        // A pong proves socket liveness, not that the confirmation subscription still delivers.
        // Renew an idle global feed; silence alone cannot establish whether blocks were missed.
        if(!topicErrors.confirmation&&performance.now()-lastConfirmation>=45000){reconnect('Confirmation stream idle for 45s; renewing subscription');return}
        publish();activityTimer=setTimeout(checkActivity,5000);
      }
      activityTimer=setTimeout(checkActivity,5000);
      for(const request of subscriptions){if(!send(request))return}
      ping();publish();
      // An idle network isn't a failure. Check subscription ACKs separately from pongs.
      subscriptionTimer=setTimeout(()=>{
        if(ws!==current)return;
        if(topicState.confirmation==='pending'&&!topicErrors.confirmation){
          topicState.confirmation='unacknowledged';send(subscriptions[0]);
        }
        if(topicState.vote==='pending')topicState.vote='unacknowledged / possibly restricted';
        publish();
      },12000);
    };
    current.onmessage=async event=>{
      if(stopped||ws!==current)return;
      const receivedAt=performance.now();
      let packet;
      try{
        let data=event.data;
        if(typeof data!=='string')data=typeof data?.text==='function'?await data.text():new TextDecoder().decode(data);
        if(stopped||ws!==current)return;
        packet=JSON.parse(data);
      }catch{return}
      if(!packet||typeof packet!=='object')return;
      const batch=packet.block_dump||packet;
      if(repeater&&Array.isArray(batch.blocks)){
        const packets=batch.blocks.filter(block=>block&&typeof block==='object').map(block=>
          block.message?{...block,topic:'confirmation'}:{topic:'confirmation',message:block});
        receiveEvents(packets,true,receivedAt);
        return;
      }
      if(packet.ack==='pong'){handlePong();return}
      const topic=packet.id==='confirmations'?'confirmation':packet.id==='votes'?'vote':packet.topic;
      if(packet.error){handleEndpointError(packet,topic);return}
      if(packet.ack==='subscribe'){
        if(topic==='vote'||topic==='confirmation'){topicState[topic]='subscribed';delete topicErrors[topic]}
        publish();return;
      }
      if(packet.topic==='confirmation'||packet.topic==='vote'){
        receiveEvents([packet],false,receivedAt);
      }
    };
    current.onerror=()=>{if(ws===current)reconnect('Websocket connection error')};
    current.onclose=event=>{if(ws===current)reconnect('Websocket closed ('+event.code+')')};
  }
  function receiveEvents(packets,batched,receivedAt){
    if(!packets.length)return;
    const topic=packets[0].topic;
    if(topic==='confirmation')lastConfirmation=performance.now();
    if(repeater){heartbeat='repeater / events received';attempts=0}
    topicState[topic]='receiving';delete topicErrors[topic];lastEvent=performance.now();
    eventFilter.push(packets,{batched,receivedAt});publish();
  }
  function wake() {
    if(stopped)return;
    if(ws&&ws.readyState===WebSocket.OPEN){
      clearTimeout(pongTimer);pongTimer=null;pingSentAt=null;
      ping();
    }else if(retryTimer!==null){clearTimeout(retryTimer);retryTimer=null;connect()}
  }
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('online',wake);
  connect();
  return {stop(){stopped=true;eventFilter.stop();clearTimeout(retryTimer);retryTimer=null;retireSocket();document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake)}};
}

