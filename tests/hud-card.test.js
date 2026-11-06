import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/hud-card.js',import.meta.url),'utf8');
for(const mobile of [true,false])test(mobile?'mobile card starts collapsed':'desktop card starts expanded',()=>{
 const card={open:false};
 const context={matchMedia:()=>({matches:mobile}),document:{getElementById:()=>card,createElement:()=>({}),head:{append(){}}}};
 vm.runInNewContext(source,context);
 expect(card.open).toBe(!mobile);
});
