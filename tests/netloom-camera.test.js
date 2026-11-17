import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({});vm.runInContext(readFileSync(new URL('../js/netloom-camera.js',import.meta.url),'utf8'),c);
test('camera easing has the same response over equal time at 30, 60 and 120 Hz',()=>{
 const remaining=hz=>{let x=1;for(let i=0;i<hz;i++)x*=1-c.netloomCameraEase(1000/hz);return x};
 expect(remaining(30)).toBeCloseTo(remaining(60),10);expect(remaining(120)).toBeCloseTo(remaining(60),10);expect(c.netloomCameraEase(1000/60)).toBeCloseTo(.12,8);
});
