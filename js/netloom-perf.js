// Local, bounded lab diagnostics. Enabled only with ?perf=1.
(()=>{
if(new URLSearchParams(location.search).get('perf')!=='1')return;
const timings={},counts={},log=[];let last=0,controller,startedAt=performance.now();
const record=(name,value)=>{const a=timings[name]||=([]);if(a.length===4096)a.shift();a.push(value)};
const event=(name,detail={})=>{counts[name]=(counts[name]||0)+1;log.push({at:performance.now(),name,...detail});if(log.length>500)log.shift()};
const frame=now=>{if(last)record('frameInterval',now-last);last=now;requestAnimationFrame(frame)};requestAnimationFrame(frame);
try{new PerformanceObserver(list=>{for(const x of list.getEntries())record('longTask',x.duration)}).observe({type:'longtask',buffered:true})}catch{}
window.netloomPerf={record,event,attach(c){controller=c},measure(name,fn){const start=performance.now();try{return fn()}finally{record(name,performance.now()-start)}},snapshot(){const summary={};for(const [key,a]of Object.entries(timings)){const s=[...a].sort((a,b)=>a-b);summary[key]={count:a.length,total:a.reduce((sum,x)=>sum+x,0),p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1)}}return {durationMs:performance.now()-startedAt,conditions:{preset:document.querySelector('#soundSet')?.value,hidden:document.hidden,url:location.href,userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,tweaks:globalThis.NETLOOM_TWEAKS},counts:{...counts},timings:summary,log:[...log],state:controller?.state()}},reset(){for(const key of Object.keys(timings))delete timings[key];for(const key of Object.keys(counts))delete counts[key];log.length=0;last=0;startedAt=performance.now()},start(options={}){this.reset();event('scenario',options);controller.start(options)},export(){return JSON.stringify(this.snapshot(),null,2)}};
})();
