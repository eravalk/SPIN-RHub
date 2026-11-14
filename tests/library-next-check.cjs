const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.SPIN_CHROMIUM||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
 const page=await browser.newPage({viewport:{width:720,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=path.resolve(__dirname,'../app/src/main/assets');
 await page.route('https://spin.local/**',route=>{let name=new URL(route.request().url()).pathname.slice(1)||'index.html';if(name.startsWith('thumb'))name='cover.jpg';const file=path.join(root,name);if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});const ext=path.extname(file),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg'};return route.fulfill({path:file,contentType:types[ext]||'application/octet-stream'});});
 await page.addInitScript(()=>{localStorage.setItem('spinIntroSeen','true');localStorage.setItem('spinShowSeekbar','true');window.testCalls=[];const tracks=[{id:100001,name:'Тихий город',artist:'Северный свет',album:'Ночная сторона',number:1,cover:'cover.jpg',uri:'content://music/1',duration:248,native:true},{id:100002,name:'Свет в окне',artist:'Северный свет',album:'Ночная сторона',number:2,cover:'cover.jpg',uri:'content://music/2',duration:190,native:true}];const data={text:'[00:00.00]Ночь укрывает тихий город\n[00:05.00]И свет плывёт в твоём окне\n[00:10.00]Мы сохраним тепло до утра\n[00:15.00]И снова встретим новый день',source:'Тест LRC',offset:0};window.SpinNative=new Proxy({library:()=>JSON.stringify(tracks),folders:()=>JSON.stringify([{uri:'content://folder',name:'Music/Test',count:2}]),vinyl:()=>'{}',lyrics:()=>JSON.stringify(data),equalizer:()=>'[]'}, {get:(o,k)=>o[k]||((...args)=>window.testCalls.push([k,...args]))});});
 await page.goto('https://spin.local/');await page.waitForTimeout(500);
 assert.deepEqual(errors,[],'initial runtime errors');
 await page.evaluate(()=>{const list=nativeItems.map(t=>({...t,year:'2024',folderRoots:['content://folder'],folderPaths:{'content://folder':'Artist/Album/'}}));list.push({id:100003,name:'Отдельная песня',artist:'Другой',album:'Без альбома',duration:120,uri:'content://music/3',cover:'cover.jpg'});nativeLibrary(list);category='albums';go('library')});
 assert.equal(await page.locator('.album-tile').count(),1);assert(!(await page.locator('#main').innerText()).includes('Мои файлы'));
 assert.deepEqual(await page.locator('.library-tabs [data-category]').allTextContents(),['Библиотека','Альбомы','Исполнители','Избранное','Плейлисты','Вся музыка']);
 await page.locator('.album-tile').click();assert((await page.locator('.album-heading050').innerText()).includes('2024'));assert((await page.locator('.album-heading050').innerText()).includes('7 мин 18 с'));
 await page.screenshot({path:'/tmp/spin050-album.png'});
 await page.evaluate(()=>{category='folders';go('library')});await page.locator('[data-root050="0"]').click();await page.locator('[data-folder050="Artist"]').click();await page.locator('[data-folder050="Album"]').click();assert.equal(await page.locator('#main .track').count(),2);await page.locator('#folderBack050').click();assert.equal(await page.locator('[data-folder050="Album"]').count(),1);
 await page.evaluate(()=>editor(100003));assert.equal(await page.locator('#coverAlbum050').count(),0);
 await page.evaluate(()=>{closeDialog();editor(100001)});await page.locator('#editYear050').fill('2025');await page.locator('#searchCover050').click();await page.locator('#runCoverSearch050').click();assert(await page.evaluate(()=>testCalls.some(c=>c[0]==='searchCovers'&&c[1]===100001)));
 await page.evaluate(()=>spinCoverResults({id:100001,request:'stale',items:[]}));assert.equal(await page.locator('.cover-grid050').count(),0);
 await page.evaluate(()=>spinCoverResults({id:100001,request:coverRequest050,items:[{name:'Альбом',artist:'Северный свет',cover:'https://i.ytimg.com/vi/abc/hqdefault.jpg'}]}));await page.locator('[data-cover050="0"]').click();await page.waitForFunction(()=>coverImage050?.naturalWidth>0);await page.locator('#cropZoom050').fill('1.5');await page.locator('#applyCrop050').click();assert((await page.locator('#editorCoverPreview').getAttribute('src')).startsWith('data:image/jpeg'));
 await page.locator('#coverAlbum050').check();await page.locator('#saveEdit').click();assert.equal(await page.locator('#confirmAlbum050').count(),1);assert.equal(await page.evaluate(()=>testCalls.filter(c=>c[0]==='saveTrack').length),0);await page.locator('#confirmAlbum050').click();assert(await page.evaluate(()=>testCalls.some(c=>c[0]==='stageCrop')));await page.evaluate(()=>spinCropReady({id:100001}));assert(await page.evaluate(()=>testCalls.some(c=>c[0]==='saveTrack'&&JSON.parse(c[1]).albumScope&&JSON.parse(c[1]).year==='2025')));
 await page.evaluate(()=>{closeDialog();editor(100003)});await page.locator('#resetCover050').click();await page.locator('#saveEdit').click();assert(await page.evaluate(()=>JSON.parse(testCalls.filter(c=>c[0]==='saveTrack').at(-1)[1]).resetCover));await page.evaluate(()=>closeDialog());
 await page.evaluate(()=>go('settings'));assert.equal(await page.locator('.settings-group050').count(),8);await page.getByText('Визуализация и виджеты',{exact:true}).click();await page.locator('#waveEnabled050').check();await page.waitForTimeout(50);assert(await page.locator('#waveEnabled050').isVisible());await page.locator('#widgetWave050').check();assert(await page.evaluate(()=>testCalls.some(c=>c[0]==='visualizer'&&c[1]&&c[2])));
 await page.evaluate(()=>{SpinNative.waveform=()=>JSON.stringify(Array(48).fill(.65));playing=true;renderPlayer()});await page.waitForTimeout(250);assert((await page.locator('#audioWave050 path').getAttribute('d')).includes('M0,'));assert(await page.evaluate(()=>waveValues050[0]>.3));await page.evaluate(()=>{playing=false});await page.waitForTimeout(500);assert(await page.evaluate(()=>waveValues050[0]<.01));
 await page.evaluate(()=>{onlineMode='online';downloadTab='search';onlineBusy=false;onlineResults=[{name:'Онлайн',artist:'Автор',url:'https://soundcloud.com/artist/test',kind:'track',duration:180,cover:''}];go('downloads')});assert.equal(await page.locator('[data-preview050]').count(),1);await page.evaluate(()=>spinDownloadsChanged([]));assert.equal(await page.locator('[data-preview050]').count(),1);await page.locator('[data-preview050]').click();assert(await page.evaluate(()=>testCalls.some(c=>c[0]==='previewOnline')));
 await page.evaluate(()=>spinPreviewReady({request:'stale',track:{id:-100500,name:'Старый'}}));assert.notEqual(await page.evaluate(()=>current),-100500);
 await page.evaluate(()=>spinPreviewReady({request:previewRequest050,track:{id:-100500,name:'Онлайн',artist:'Автор',uri:'https://media.example/audio',duration:180,online:true,cover:'cover.jpg'}}));assert.equal(await page.evaluate(()=>current),-100500);await page.evaluate(()=>spinPlayback({id:-100500,position:15,duration:180,playing:true}));assert.equal(await page.evaluate(()=>playing),true);await page.evaluate(()=>nativeLibrary(nativeItems));assert.equal(await page.evaluate(()=>current),-100500);assert.equal(await page.locator('#globalMini').evaluate(e=>e.hidden),false);assert.equal(await page.locator('.source-label').innerText(),'ОНЛАЙН');await page.evaluate(()=>toggle());assert.equal(await page.evaluate(()=>testCalls.at(-1)[0]),'command');
 for(const [width,height] of [[344,882],[720,850],[1280,800]]){await page.setViewportSize({width,height});await page.evaluate(()=>{category='albums';go('library')});await page.waitForTimeout(80);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}`)}
 await page.evaluate(()=>{lyricsEnabled=false;downloadTab='search';go('downloads')});
 const query=page.locator('#onlineQuery');
 await query.fill('Три дня');
 await page.evaluate(()=>{window.originalSearch=document.activeElement;spinDownloadsChanged([]);renderMain()});
 assert(await page.evaluate(()=>document.activeElement===originalSearch&&originalSearch.isConnected));
 await query.press('End');await query.pressSequentially(' дождя');
 assert.equal(await query.inputValue(),'Три дня дождя');
 await page.evaluate(()=>document.activeElement.blur());
 await page.evaluate(()=>{current=100001;go('downloads')});
 await page.locator('#lyricsBtn').click();
 assert(await page.locator('#persistentLyrics').isVisible());
 for(const section of ['settings','library','downloads']){
  await page.evaluate(section=>go(section),section);
  assert(await page.locator('#persistentLyrics').isVisible());
 }
 await page.locator('#closeLyrics').click();
 assert.equal(await page.locator('#persistentLyrics').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: real albums, folder hierarchy, album metadata, scoped cover search/crop/reset, stale search rejection, grouped settings, sampled waveform/pause, online preview/stale response/refresh/pause, 3 responsive sizes');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
