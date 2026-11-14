const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.SPIN_CHROMIUM||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 const page=await browser.newPage({viewport:{width:720,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=path.resolve(__dirname,'../app/src/main/assets');
 await page.route('https://spin.local/**',route=>{let name=new URL(route.request().url()).pathname.slice(1)||'index.html';if(name.startsWith('thumb'))name='cover.jpg';const file=path.join(root,name);if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});const ext=path.extname(file),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg'};return route.fulfill({path:file,contentType:types[ext]||'application/octet-stream'});});
 await page.addInitScript(()=>{localStorage.setItem('spinIntroSeen','true');localStorage.setItem('spinShowSeekbar','true');window.testCalls=[];const tracks=[{id:100001,name:'Тихий город',artist:'Северный свет',album:'Ночная сторона',number:1,cover:'cover.jpg',uri:'content://music/1',duration:248,native:true},{id:100002,name:'Свет в окне',artist:'Северный свет',album:'Ночная сторона',number:2,cover:'cover.jpg',uri:'content://music/2',duration:190,native:true}];const data={text:'[00:00.00]Ночь укрывает тихий город\n[00:05.00]И свет плывёт в твоём окне\n[00:10.00]Мы сохраним тепло до утра\n[00:15.00]И снова встретим новый день',source:'Тест LRC',offset:0};window.SpinNative=new Proxy({library:()=>JSON.stringify(tracks),folders:()=>JSON.stringify([{uri:'content://folder',name:'Music/Test',count:2}]),vinyl:()=>'{}',lyrics:()=>JSON.stringify(data),equalizer:()=>'[]',equalizerEnabled:()=>false,consumeLaunch:()=>false,spectrum:()=>JSON.stringify(Array(128).fill(.6))}, {get:(o,k)=>o[k]||((...args)=>window.testCalls.push([k,...args]))});});
 await page.goto('https://spin.local/');await page.locator('#launchCurtain').waitFor({state:'detached'});
 assert.deepEqual(errors,[],'initial runtime errors');

 await page.evaluate(()=>go('settings'));
 assert.equal(await page.locator('[data-visual]').count(),7);
 await page.evaluate(()=>{repeat=0;renderPlayer()});
 for(const expected of [1,2,0]){
  await page.locator('#repeat').click();
  assert.equal(await page.evaluate(()=>Number(repeat)),expected);
  assert.equal(await page.evaluate(()=>testCalls.filter(x=>x[0]==='playbackMode').at(-1)[2]),expected);
 }
 await page.evaluate(()=>{localStorage.setItem('spinWave050','true');playing=true;renderPlayer();});
 await page.waitForTimeout(300);
 assert(await page.locator('#audioWave050 rect').count()>0);
 await page.evaluate(()=>{current=100002;renderPlayer()});
 await page.locator('#turntable.swapping').waitFor();
 await page.locator('#turntable.swapping').waitFor({state:'detached'});
 assert.equal(await page.locator('#turntable .record').count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS: seven styles, repeat cycle and bridge, spectrum drawing, transition cleanup, no JS errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
