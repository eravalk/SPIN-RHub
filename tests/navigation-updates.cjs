const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../app/src/main/assets/navigation-updates.js', 'utf8');
const storage = new Map();
function launch() {
 const root = {scrollTop:0, scrollHeight:5000, clientHeight:800};
 const groups = new Map(), events = {}, frames = new Map(), calls = [];
 let nextFrame = 1;
 const context = {
  page:'library', category:'tracks', activeAlbum:'', activeArtist:'', downloadTab:'search',
  folderRoot050:'', folderPath050:'', search:'', history:{scrollRestoration:'auto'},
  window:{addEventListener:(name,fn)=>events[name]=fn}, toast:msg=>calls.push(['toast',msg]),
  localStorage:{getItem:key=>storage.get(key)||null, setItem:(key,value)=>storage.set(key,value)},
  document:{scrollingElement:root, querySelector:()=>null, querySelectorAll:()=>[],
   getElementById:id=>groups.get(id), addEventListener:(name,fn)=>events[name]=fn},
  N:{checkAppUpdate:()=>calls.push(['check']),downloadAppUpdate:()=>calls.push(['download']),installAppUpdate:()=>calls.push(['install']),cancelAppUpdate:()=>calls.push(['cancel']),openAppRepository:()=>calls.push(['repository'])},
  renderMain(){root.scrollTop=0;groups.clear();groups.set('main',{scrollTop:0,scrollHeight:5000,clientHeight:800,insertAdjacentHTML(){
   for(const id of ['checkUpdate','downloadUpdate','cancelUpdate','appRepository','installUpdate','updateStatus','updateProgress','updateNotes'])groups.set(id,{removeAttribute(){}});
  }});},
  requestAnimationFrame:fn=>{const id=nextFrame++;frames.set(id,fn);return id;},
  cancelAnimationFrame:id=>frames.delete(id),setTimeout:()=>1
 };
 vm.createContext(context);vm.runInContext(source,context);
 function flush(){while(frames.size){const batch=[...frames];frames.clear();for(const [,fn]of batch)fn();}}
 function go(page,category){Object.assign(context,{page,category});context.renderMain();flush();}
 function click(id){events.click({target:{closest:()=>({id})}});}
 flush();return {context,root,groups,events,calls,go,click,flush};
}
let app=launch();
app.root.scrollTop=810;app.go('library','albums');assert.equal(app.root.scrollTop,0);
app.root.scrollTop=130;app.go('settings','albums');app.click('checkUpdate');app.click('checkUpdate');
assert.equal(app.calls.filter(x=>x[0]==='check').length,1);
app.context.window.spinUpdateResult({status:'available',version:'1.2.1.0',notes:'Changes'});
assert.equal(app.groups.get('downloadUpdate').hidden,false);
assert.equal(app.calls.filter(x=>x[0]==='download').length,0,'Never download on check');
app.click('downloadUpdate');app.click('downloadUpdate');assert.equal(app.calls.filter(x=>x[0]==='download').length,1);
app.context.window.spinAppDownload({status:'downloading',version:'1.2.1.0',bytes:25,size:100});
assert.equal(app.groups.get('updateProgress').value,25);assert.equal(app.groups.get('downloadUpdate').disabled,true);
assert.equal(app.groups.get('cancelUpdate').hidden,false);
app.click('cancelUpdate');app.click('cancelUpdate');
assert.equal(app.calls.filter(x=>x[0]==='cancel').length,1);
app.context.window.spinAppDownload({status:'ready',version:'1.2.1.0'});
assert.equal(app.groups.get('installUpdate').hidden,true,'Do not offer install during cancellation');
app.context.window.spinAppDownloadCancelled(true);
assert.equal(app.groups.get('updateStatus').textContent,'Скачивание отменено');
assert.equal(app.groups.get('cancelUpdate').hidden,true);
assert.equal(app.groups.get('updateProgress').hidden,true);
assert.equal(app.groups.get('downloadUpdate').disabled,false);
app.click('appRepository');assert.equal(app.calls.at(-1)[0],'repository');
app.click('downloadUpdate');assert.equal(app.calls.filter(x=>x[0]==='download').length,2);
app.context.window.spinAppDownload({status:'downloading',version:'1.2.1.0',bytes:5,size:100,paused:true});
app.click('cancelUpdate');app.context.window.spinAppDownloadCancelled(false);
assert.equal(app.groups.get('cancelUpdate').disabled,false,'A failed cancel remains retryable');
app.context.window.spinAppDownload({status:'ready',version:'1.2.1.0'});
assert.equal(app.groups.get('cancelUpdate').hidden,true);
assert.equal(app.groups.get('installUpdate').hidden,false);app.click('installUpdate');
assert.equal(app.calls.at(-1)[0],'install');
app.go('library','tracks');assert.equal(app.root.scrollTop,810);
app.context.renderMain();app.flush();assert.equal(app.root.scrollTop,810);
app.go('library','albums');assert.equal(app.root.scrollTop,130);
app.go('downloads','albums');app.root.scrollTop=350;
app.context.downloadTab='history';app.context.renderMain();app.flush();assert.equal(app.root.scrollTop,0);
app.context.downloadTab='search';app.context.renderMain();app.flush();assert.equal(app.root.scrollTop,350);
app.go('album','albums');app.context.activeAlbum='album-a';app.context.renderMain();app.flush();app.root.scrollTop=640;
app.context.activeAlbum='album-b';app.context.renderMain();app.flush();app.root.scrollTop=90;
app.context.window.spinPersistNavigation();
app=launch();app.go('library','tracks');assert.equal(app.root.scrollTop,810,'Restored after process restart');
app.go('library','albums');assert.equal(app.root.scrollTop,130);
app.context.activeAlbum='album-a';app.go('album','albums');assert.equal(app.root.scrollTop,640);
app.context.activeAlbum='album-b';app.context.renderMain();app.flush();assert.equal(app.root.scrollTop,90);
app.go('settings','albums');app.context.window.spinAppDownload({status:'failed',message:'Network error'});
assert.equal(app.groups.get('downloadUpdate').textContent,'Повторить скачивание');
app.click('downloadUpdate');assert.equal(app.calls.at(-1)[0],'download');
storage.set('spinNavigationPositionsV2','not json');assert.doesNotThrow(launch);
console.log('PASS: persistent per-view positions, restart, independent albums, same-view redraw, explicit-only download, progress, install, retry and damaged storage');
