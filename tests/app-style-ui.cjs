const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require(process.env.SPIN_TEST_MODULES+'/jsdom');
const root=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{url:'https://spin.local/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,calls=[],ctx=dom.getInternalVMContext();
w.DOMMatrixReadOnly=class{constructor(){this.a=1;this.b=0}};
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.setInterval=()=>1;w.setTimeout=()=>1;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLElement.prototype.animate=function(){return {cancel(){},finished:Promise.resolve()}};
w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData(){return {data:new Uint8ClampedArray(400)}},createImageData(width,height){return {data:new Uint8ClampedArray(width*height*4)}},putImageData(){},save(){},restore(){},clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},createLinearGradient(){return {addColorStop(){}}}});
w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,AA==';
w.SpinNative=new Proxy({library:()=>'[]',folders:()=>'[]',vinyl:()=>'{}',lyrics:()=>'{}',equalizer:()=>'[]',equalizerEnabled:()=>false,consumeLaunch:()=>false,spectrum:()=>'[]',activationState:()=>' {"active":true,"code":"10AB"}'},{get:(o,k)=>o[k]||((...args)=>calls.push([k,...args]))});
w.localStorage.setItem('spinIntroSeen','true');
for(const match of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(path.join(root,match[1]),'utf8'),ctx,{filename:match[1]});

function run(source){return vm.runInContext(source,ctx);}
function click(selector){const el=w.document.querySelector(selector);assert(el,'Missing '+selector);el.click();}
const item=(id,album='Ночная сторона')=>({id,name:'Песня '+id,artist:'Северный свет',album,cover:'app-cover.svg',uri:'content://music/'+id,duration:240,number:id});
run('nativeLibrary('+JSON.stringify([item(101),item(102),item(103,'Другой альбом')])+')');
run('current=101;queue=[101,102,103];position=61;playing=true;renderPlayer();go("settings")');
assert.equal(w.document.querySelector('#main').firstElementChild.id,'appStyleSettings');
assert(w.document.querySelector('[data-app-style="cassette"]').disabled);
assert.equal(w.SpinAppStyle.get(),'vinyl');
const snapshot=run('JSON.stringify({current,position,playing,queue,theme})');
let callsBefore=calls.length;click('[data-app-style="liquid-glass"]');
assert.equal(w.SpinAppStyle.get(),'liquid-glass');assert.equal(w.localStorage.getItem('spinAppStyleV1'),'liquid-glass');
assert.equal(run('JSON.stringify({current,position,playing,queue,theme})'),snapshot,'Style must preserve playback and palette');
assert(!calls.slice(callsBefore).some(c=>['play','seek','command','replaceQueue'].includes(c[0])),'No audio commands on style switch');
assert(w.document.querySelector('#cdScene'));assert(w.document.querySelector('#cdLaser'));assert(!w.document.querySelector('#tonearm'));
assert.equal(w.document.querySelector('#main').firstElementChild.id,'appStyleSettings');
assert.equal(w.document.querySelector('#cdLaser').getAttribute('aria-valuenow'),'61');
run("tracks.find(t=>t.id===101).cover='custom-cover.png';renderPlayer()");assert.equal(w.document.querySelector('.cd-case-lid img').getAttribute('src'),'custom-cover.png');
const scene=w.document.querySelector('#cdScene');run('current=102;position=0;renderPlayer()');assert.equal(w.document.querySelector('#cdScene'),scene,'Same album must reuse scene');
run('current=103;position=0;renderPlayer()');assert.notEqual(w.document.querySelector('#cdScene'),scene,'Different album must replace scene');
run('position=60;updateProgress()');
let laser=w.document.querySelector('#cdLaser'),holder=w.document.querySelector('.cd-disc-holder');
holder.getBoundingClientRect=()=>({left:0,top:0,width:300,height:300});
function pointer(type,x,y){const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});laser['on'+type]?.(event);}
let seekCount=()=>calls.filter(c=>c[0]==='seek').length;
let count=seekCount();pointer('pointerdown',laser.getBoundingClientRect().left,0);assert.equal(run('position'),60,'No jump when grabbing enlarged touch target');
const radius=21+25*.75,x=150+radius*.819152*3,y=150+radius*.573576*3;
pointer('pointermove',x,y);assert(Math.abs(run('position')-180)<.01);assert.equal(seekCount(),count,'Preview must not spam native seek');
pointer('pointerup',x,y);assert.equal(seekCount(),count+1);assert(Math.abs(calls.filter(c=>c[0]==='seek').at(-1)[1]-180000)<10);
run('spinPlayback({id:103,position:60,duration:240,playing:true})');assert(Math.abs(run('position')-180)<.01,'Ignore stale callback until seek acknowledged');
run('spinPlayback({id:103,position:180,duration:240,playing:true})');
count=seekCount();pointer('pointerdown',x,y);pointer('pointermove',150,150);pointer('pointercancel',150,150);assert.equal(seekCount(),count);assert(Math.abs(run('position')-180)<.01,'Cancelled drag restores position');
laser.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));assert.equal(calls.filter(c=>c[0]==='seek').at(-1)[1],240000);
laser.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));assert.equal(calls.filter(c=>c[0]==='seek').at(-1)[1],0);
run('position=45;updateProgress()');pointer('pointerdown',x,y);run('spinPlayback({id:101,position:12,duration:240,playing:true})');assert.equal(run('position'),12);assert.equal(run('needleDragging'),false);
// Playlist cover must follow the playing queue, not merely a playlist being browsed.
run("playlists=[{id:'p1',name:'Мой плейлист',ids:[101,102]}];window.activePlaylist='p1';page='playlist';playTrack(101)");
assert(w.document.querySelector('.cd-case-title strong').textContent.includes('Мой плейлист'));
run("page='settings';window.activePlaylist='other';renderPlayer()");assert(w.document.querySelector('.cd-case-title strong').textContent.includes('Мой плейлист'));
run('queue=[101,103];renderPlayer()');assert.equal(w.document.querySelector('.cd-case-title strong').textContent,'Ночная сторона');
Object.defineProperty(w,'innerWidth',{value:1400,writable:true});w.dispatchEvent(new w.Event('resize'));
click('[data-glass-panel="lyrics"]');assert(w.document.querySelector('#glassPanelBody #persistentLyrics'));
click('[data-glass-panel="queue"]');assert(w.document.querySelector('#player #persistentLyrics'),'Keep lyric DOM when switching to queue');
click('[data-glass-panel="lyrics"]');assert(w.document.querySelector('#glassPanelBody #persistentLyrics'),'Restore lyric DOM without another search');
click('[data-glass-panel="queue"]');assert.equal(w.document.querySelector('[data-glass-panel="queue"]').getAttribute('aria-pressed'),'true');
run('renderMain()');assert.equal(w.document.querySelector('[data-glass-panel="queue"]').getAttribute('aria-pressed'),'true','Keep selected side tab');
run('go("settings")');callsBefore=calls.length;click('[data-app-style="vinyl"]');assert(w.document.querySelector('#tonearm'));assert(!w.document.querySelector('#cdScene'));assert(!w.document.querySelector('#glassSidePanel'));
assert(!calls.slice(callsBefore).some(c=>['play','seek','command'].includes(c[0])));
for(let i=0;i<12;i++){w.SpinAppStyle.set(i%2?'vinyl':'liquid-glass');assert.equal(w.document.querySelectorAll('#appStyleSettings').length,1);assert.equal(w.document.querySelectorAll('#glassSidePanel').length,i%2?0:1);}
w.SpinAppStyle.set('cassette');assert.equal(w.SpinAppStyle.get(),'vinyl','Unavailable style cannot be selected programmatically');
w.SpinAppStyle.stop();
// New document: restore saved style, and tolerate a damaged/unknown style value.
function boot(savedStyle){
 const fresh=new JSDOM(html,{url:'https://spin.local/',runScripts:'outside-only',pretendToBeVisual:true});const x=fresh.window,context=fresh.getInternalVMContext();
 x.matchMedia=w.matchMedia;x.requestAnimationFrame=()=>1;x.cancelAnimationFrame=()=>{};x.setInterval=()=>1;x.setTimeout=()=>1;
 x.DOMMatrixReadOnly=w.DOMMatrixReadOnly;x.SpinNative=w.SpinNative;
 x.HTMLCanvasElement.prototype.getContext=w.HTMLCanvasElement.prototype.getContext;x.HTMLCanvasElement.prototype.toDataURL=w.HTMLCanvasElement.prototype.toDataURL;
 x.HTMLElement.prototype.scrollIntoView=function(){};x.HTMLElement.prototype.animate=w.HTMLElement.prototype.animate;
 x.HTMLDialogElement.prototype.showModal=function(){this.open=true};x.HTMLDialogElement.prototype.close=function(){this.open=false};
 x.localStorage.setItem('spinIntroSeen','true');x.localStorage.setItem('spinAppStyleV1',savedStyle);
 for(const m of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(path.join(root,m[1]),'utf8'),context,{filename:m[1]});
 return fresh;
}
let restart=boot('liquid-glass');assert.equal(restart.window.SpinAppStyle.get(),'liquid-glass');assert(restart.window.document.querySelector('#cdScene'));restart.window.close();
restart=boot('corrupted');assert.equal(restart.window.SpinAppStyle.get(),'vinyl');assert(restart.window.document.querySelector('#tonearm'));restart.window.close();
w.close();
console.log('PASS: top settings selector, saved style, no playback interruption, CD album/playlist identity, seek preview/commit/cancel/keyboard/stale callback guard, side tabs, repeated style switching and unavailable cassette');
