// Browser validation runs in GitHub Actions against synthetic local-library fixtures.
// It uses no user's music, accounts, OAuth tokens or external service requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../app/src/main/assets');
const out=path.resolve(__dirname,'../build/glass-ui');fs.mkdirSync(out,{recursive:true});
const cover=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="sky" x2=".3" y2="1"><stop stop-color="#243a79"/><stop offset=".6" stop-color="#847bc1"/><stop offset="1" stop-color="#247eaf"/></linearGradient></defs><rect width="600" height="600" fill="url(#sky)"/><circle cx="430" cy="150" r="55" fill="#dfdcff"/><path d="M0 330 125 210 245 335 360 240 600 340V600H0Z" fill="#1d325f"/><path d="M0 365Q300 330 600 375V600H0" fill="#3a63a0"/><path d="M50 450H520M130 490H560M20 530H450" stroke="#b3d3f8" stroke-width="4" opacity=".35"/></svg>`;
const tracks=[{id:101,name:'Тихий город',artist:'Северный свет',album:'Ночная сторона',number:1,duration:228,cover:'fixture-cover.svg',uri:'content://fixture/101'},{id:102,name:'На краю ночи',artist:'Северный свет',album:'Ночная сторона',number:2,duration:240,cover:'fixture-cover.svg',uri:'content://fixture/102'},{id:103,name:'Длинное название песни для проверки переноса',artist:'Северный свет',album:'Другой альбом',number:1,duration:201,cover:'fixture-cover.svg',uri:'content://fixture/103'}];
const sizes=[['phone',390,844],['narrow-phone',320,640],['fold',690,828],['fold-screenshot',853,1024],['tablet',1280,800],['tablet-portrait',1024,1366]];
const report=[];
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [name,width,height] of sizes){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());if(url.origin!=='https://spin.local')return route.abort();
    if(url.pathname==='/fixture-cover.svg'||url.pathname==='/thumb')return route.fulfill({body:cover,contentType:'image/svg+xml'});
    const rel=url.pathname==='/'?'index.html':url.pathname.slice(1),file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
    const types={'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.html':'text/html'};
    return route.fulfill({path:file,contentType:types[path.extname(file)]||'application/octet-stream'});
   });
   await page.addInitScript(({tracks})=>{
    localStorage.setItem('spinAppStyleV1','liquid-glass');localStorage.setItem('spinIntroSeen','true');localStorage.setItem('spinMotion','false');
    window.fixtureCalls=[];
    const methods={library:()=>JSON.stringify(tracks),folders:()=>'[]',vinyl:()=>'{}',lyrics:()=>JSON.stringify({text:'[00:00.00]Город дышит тишиной\n[00:20.00]Свет скользит над водой\n[01:10.00]Ночь останется со мной',source:'Тестовый LRC'}),lyricsQuery:()=>'{}',equalizer:()=>'[]',equalizerEnabled:()=>false,consumeLaunch:()=>false,spectrum:()=>'[]',waveform:()=>'[]',activationState:()=>' {"active":true,"code":"TEST"}'};
    window.SpinNative=new Proxy(methods,{get:(o,k)=>o[k]||((...args)=>window.fixtureCalls.push([k,...args]))});
   },{tracks});
   await page.goto('https://spin.local/');
   await page.waitForFunction(()=>document.querySelector('#glassShell'));
   await page.evaluate(()=>{window.spinPlayback({id:101,position:84,duration:228,playing:true});go('settings');});
   await page.waitForFunction(()=>!document.querySelector('#launchCurtain'));
   assert.equal(await page.locator('#main').evaluate(e=>e.firstElementChild.id),'appStyleSettings');
   assert.equal(await page.locator('#app').isVisible(),false);
   assert.equal(await page.locator('#downloadUpdate').isVisible(),false);
   assert.equal(await page.locator('#installUpdate').isVisible(),false);
   const main=await page.locator('.lg-browser').boundingBox();assert(main.width>width*.65,'Browser must occupy the available width on '+name);
   await page.screenshot({path:path.join(out,name+'-settings.png')});
   await page.evaluate(()=>{category='albums';go('library')});
   await page.screenshot({path:path.join(out,name+'-library.png')});
   await page.locator('#lgOpenPlayer').click();
   assert.equal(await page.locator('#glassShell').getAttribute('data-view'),'player');
   const scene=await page.locator('#cdScene').boundingBox(),disc=await page.locator('.cd-disc-holder').boundingBox(),box=await page.locator('.cd-case').boundingBox();
   assert(scene&&disc&&box,'CD geometry exists');
   assert(disc.x>=scene.x-1 && disc.x+disc.width<=scene.x+scene.width+1,'CD contained on '+name);
   assert(box.x>=scene.x-1 && box.x+box.width<=scene.x+scene.width+1,'Case contained on '+name);
   assert(box.width/box.height>1 && box.width/box.height<1.2,'Square CD case, not DVD');
   await page.screenshot({path:path.join(out,name+'-player.png')});
   // This click is the device regression: a visible control must reveal a visible text panel.
   const lyricsControl=width>=1100?page.locator('[data-glass-panel="lyrics"]'):page.locator('#lgLyricsBtn');
   await lyricsControl.click();
   assert(await page.locator('#glassSidePanel').isVisible(),'Lyrics panel visible on '+name);
   assert(await page.locator('#lyricLines').isVisible(),'Lyrics content visible on '+name);
   assert((await page.locator('#lyricLines').innerText()).includes('Город дышит тишиной'));
   await page.screenshot({path:path.join(out,name+'-lyrics.png')});
   await page.locator('[data-glass-panel="queue"]').click();assert(await page.locator('#glassPanelBody .queue-row').first().isVisible());
   await page.locator('[data-glass-panel="lyrics"]').click();assert(await page.locator('#lyricLines').isVisible());
   await page.evaluate(()=>window.spinBack());assert.equal(await page.locator('#glassShell').getAttribute('data-view'),'browser');
   await page.evaluate(()=>go('settings'));
   const before=await page.evaluate(()=>({current,position,queue:queue.slice(),playing,theme}));
   const offset=await page.evaluate(()=>window.fixtureCalls.length);
   await page.locator('[data-app-style="vinyl"]').click();
   assert.equal(await page.locator('#glassShell').count(),0);assert(await page.locator('#app').isVisible());
   await page.locator('[data-app-style="liquid-glass"]').click();
   const after=await page.evaluate(()=>({current,position,queue:queue.slice(),playing,theme}));assert.deepEqual(after,before);
   const audioCalls=await page.evaluate(offset=>window.fixtureCalls.slice(offset).filter(c=>['play','command','seek','replaceQueue'].includes(c[0])),offset);assert.equal(audioCalls.length,0,'Style switch must not touch audio');
   // No visible root or direct player controls may extend beyond the viewport horizontally.
   const bounds=await page.evaluate(()=>[...document.querySelectorAll('#glassShell,.lg-header,.lg-mini,.lg-bottom,.lg-rail')].filter(e=>e.getClientRects().length).map(e=>({name:e.id||e.className,x:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})));
   assert(bounds.every(b=>b.x>=-.5&&b.right<=width+.5),'No horizontal shell overflow: '+JSON.stringify(bounds));
   assert.deepEqual(errors,[],'JavaScript errors on '+name);
   report.push({name,width,height,pass:true,scene,disc,case:box});await page.close();
  }
 }finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 console.log('PASS: actual Chromium layout, visible lyrics/queue, contained CD/case, settings and style switching across '+report.length+' viewports');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
