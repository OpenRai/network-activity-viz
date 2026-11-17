import {test,expect} from 'bun:test';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const pages=['starmap','nano-atlas','eventsky','netloom'];
test('gallery navigation lists exactly the four surviving visualizations',()=>{
 const links=[...read('js/gallery-nav.js').matchAll(/href: '([^']+)'/g)].map(m=>m[1]);
 expect(links).toEqual(pages.map(p=>p+'.html'));
});
test('retired visualization routes redirect to their survivors',()=>{
 for(const [old,next]of [['constellation','nano-atlas'],['lattice','nano-atlas'],['hangtime','eventsky'],['score','eventsky']])expect(read(old+'.html')).toContain("location.replace('"+next+".html')");
});
test('all current pages reference existing local scripts and social preview images',()=>{
 for(const page of ['index',...pages]){
  const html=read(page+'.html');
  for(const [,src]of html.matchAll(/<script[^>]+src="([^"]+)"/g))expect(existsSync(new URL(src.split('?')[0],root))).toBe(true);
  const image=html.match(/property="og:image" content="https:\/\/viz.openrai.org\/([^"]+)"/)[1];
  expect(existsSync(new URL(image,root))).toBe(true);
 }
});
