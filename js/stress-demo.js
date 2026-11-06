'use strict';
function seededRandom(seed) {
  return () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296);
}
function createStressDemo({seed=20261105,accounts=100,transfers=1000,duration=300000}={}) {
  const random=seededRandom(seed);
  const normal=()=>Math.sqrt(-2*Math.log(1-random()))*Math.cos(2*Math.PI*random());
  const names=Array.from({length:accounts},(_,i)=>'nano_stress_'+String(i).padStart(3,'0'));
  const weights=names.map((_,i)=>1/Math.pow(i+1,1.2));
  const total=weights.reduce((a,b)=>a+b,0);
  const pick=()=>{let r=random()*total;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<=0)return names[i]}return names.at(-1)};
  const hash=i=>i.toString(16).padStart(64,'0').toUpperCase();
  const events=[];
  for(let i=0;i<transfers;i++){
    const source=i<accounts?names[i]:pick();
    let destination=pick();while(destination===source)destination=pick();
    // Gaussian log amounts cover several orders of magnitude without negatives.
    const amount=Math.pow(10,Math.max(-5,Math.min(5,-.5+normal()*1.4)));
    const raw=String(BigInt(Math.max(1,Math.round(amount*1e6)))*10n**24n);
    const at=(i+random()*.8)/transfers*(duration-8000),sendHash=hash(i*2+1);
    events.push({at,message:{hash:sendHash,account:source,amount:raw,block:{subtype:'send',account:source,link_as_account:destination}}});
    if(random()<.8){
      const delay=Math.max(500,Math.min(8000,4000+normal()*1600));
      events.push({at:at+delay,message:{hash:hash(i*2+2),account:destination,amount:raw,block:{subtype:'receive',account:destination,link:sendHash}}});
    }
  }
  events.sort((a,b)=>a.at-b.at);
  return {events,duration,accounts,transfers,seed};
}
