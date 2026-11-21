const visualStyles=[['wave','Волна'],['spectrum','Спектр'],['double','Двойная волна'],['dots','Точки'],['ribbon','Двусторонняя лента'],['area','Односторонняя лента'],['mirror','Двусторонний спектр']];
let visualStyle=localStorage.getItem('visualStyle')||'spectrum';
let visualDensity=Number(localStorage.getItem('visualDensity'))||32;
let visualHeight=Number(localStorage.getItem('visualHeight'))||64;
let recordAnimation=localStorage.getItem('recordAnimation')!=='false';
let transitionDirection=1,transitionTrack=current,activeSwap=null;
function visualMarkup(values,style,count){
 const samples=Array.from({length:count},(_,i)=>values[Math.floor(i*values.length/count)]||0);
 const step=480/count;
 if(style==='spectrum'||style==='mirror')return samples.map((v,i)=>{const h=Math.max(1,v*(style==='mirror'?30:60));return '<rect x="'+(i*step)+'" y="'+(style==='mirror'?32-h:64-h)+'" width="'+Math.max(1,step*.72)+'" height="'+(style==='mirror'?h*2:h)+'" rx="1"/>';}).join('');
 if(style==='dots')return samples.map((v,i)=>'<circle cx="'+(i*step+step/2)+'" cy="'+(32-v*25)+'" r="'+(2+v*3)+'"/>').join('');
 const points=samples.map((v,i)=>[i*480/(count-1),(style==='area'?64:32)-v*(style==='area'?60:28)]);
 if(style==='wave')points.forEach((p,i)=>p[1]=32+(i%2?1:-1)*samples[i]*28);
 const top='M'+points.map(p=>p.join(',')).join(' L');
 const bottom='M'+points.map(p=>[p[0],64-p[1]].join(',')).join(' L');
 if(style==='wave'||style==='double')return '<path fill="none" stroke="currentColor" stroke-width="2" d="'+top+(style==='double'?' '+bottom:'')+'"/>';
 const lower=style==='area'?' L480,64 L0,64': ' L'+points.slice().reverse().map(p=>[p[0],64-p[1]].join(',')).join(' L');
 return '<path d="'+top+lower+' Z"/>';
}
waveFrame050=function(){
 const enabled=localStorage.getItem('spinWave050')==='true';
 let el=$('#audioWave050');
 if(enabled&&!el&&$('#turntable')){$('#turntable').insertAdjacentHTML('afterend','<svg id="audioWave050" viewBox="0 0 480 64" aria-label="Визуализатор музыки"></svg>');el=$('#audioWave050');}
 if(el){el.style.display=enabled?'block':'none';el.style.height=visualHeight+'px';if(enabled){waveValues050=waveValues050.map((v,i)=>v+((playing?waveTarget050[i]:0)-v)*.25);el.innerHTML=visualMarkup(waveValues050,visualStyle,visualDensity);}}
 if(page==='settings')document.querySelectorAll('[data-visual-preview]').forEach(el=>{const t=performance.now()/500;const data=Array.from({length:48},(_,i)=>(Math.sin(i*.7+t)+1)*.25+.1);el.style.height=visualHeight+'px';el.innerHTML=visualMarkup(data,el.dataset.visualPreview,visualDensity);});
 requestAnimationFrame(waveFrame050);
};
const releaseMain=renderMain;
renderMain=function(){
 releaseMain();
 if(page!=='settings')return;
 const groups=[...document.querySelectorAll('#main details')];
 const group=name=>groups.find(x=>x.querySelector('summary')?.textContent===name)?.lastElementChild;
 const about=group('О приложении');
 if(about){
  about.querySelectorAll('h3').forEach(h=>{if(h.textContent.includes('SPIN')){h.textContent='SPIN RHub · '+window.SPIN_VERSION;h.parentElement.querySelectorAll('p').forEach(p=>p.remove());}});
  const demo=about.querySelector('#demoSwitch')?.closest('.setting-row');
  if(demo)(group('Музыка и загрузки')||about).append(demo);
  const report=[...about.querySelectorAll('.settings-card')].find(el=>el.querySelector('h3')?.textContent==='Отчёт об ошибках');
  if(report){const details=document.createElement('details');details.className='settings-group050';details.innerHTML='<summary>Диагностика</summary><div></div>';details.lastElementChild.append(report);$('#main').append(details);}
  const crest=about.querySelector('.rhub-crest');if(crest)crest.src='app-cover.svg';
 }
 const target=group('Визуализация и виджеты')||$('#main');
 target.insertAdjacentHTML('beforeend','<div class="settings-card"><h3>Визуализатор</h3><div class="visual-options">'+visualStyles.map(([id,label])=>'<button class="visual-option '+(id===visualStyle?'selected':'')+'" data-visual="'+id+'"><svg viewBox="0 0 480 64" data-visual-preview="'+id+'"></svg>'+label+'</button>').join('')+'</div><label class="setting-row">Плотность<input id="visualDensity" type="range" min="8" max="96" value="'+visualDensity+'"></label><label class="setting-row">Высота<input id="visualHeight" type="range" min="24" max="120" value="'+visualHeight+'"></label><label class="setting-row">Анимация смены пластинки<input class="switch04" id="recordAnimation" type="checkbox" '+(recordAnimation?'checked':'')+'></label></div>');
 const sound=group('Звук')||$('#main');
 sound.querySelectorAll('[data-eq]').forEach(b=>{const row=b.closest('.setting-row');if(row){const text=[...row.childNodes].find(n=>n.nodeType===3);if(text)text.textContent='Эквалайзер для всех песен';}});

 sound.insertAdjacentHTML('beforeend','<label class="setting-row">Эквалайзер<input id="releaseEq" class="switch04" type="checkbox" '+(N.equalizerEnabled()?'checked':'')+'></label>');
};
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-visual]');
 if(button){visualStyle=button.dataset.visual;localStorage.setItem('visualStyle',visualStyle);N.visualStyle(visualStyle,visualDensity);renderMain();}
});
document.addEventListener('input',event=>{
 if(event.target.id==='visualDensity'){visualDensity=Number(event.target.value);localStorage.setItem('visualDensity',visualDensity);N.visualStyle(visualStyle,visualDensity);}
 if(event.target.id==='visualHeight'){visualHeight=Number(event.target.value);localStorage.setItem('visualHeight',visualHeight);}
});
document.addEventListener('change',event=>{
 if(event.target.id==='releaseEq')N.enableEqualizer(event.target.checked);
 if(event.target.id==='recordAnimation'){recordAnimation=event.target.checked;localStorage.setItem('recordAnimation',recordAnimation);}
});
const releaseNext=next;
next=function(dir=1){transitionDirection=dir;releaseNext(dir);};
const releasePlayer=renderPlayer;
const curtain=document.getElementById('launchCurtain');
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('motion-off');

function updateQueueCard(){
 const card=$('.queue-card');
 if(!card || !currentTrack().native)return;
 const index=queue.indexOf(current);
 const nextId=Number(repeat)===2 ? current : shuffle ? null :
   queue[index+1] ?? (Number(repeat)===1 ? queue[0] : null);
 const nextItem=tracks.find(track=>track.id===nextId);
 const row=card.querySelector('.track');
 if(!row)return;
 if(!nextItem || index<0){
  row.textContent=shuffle ? 'Случайный порядок' : 'Конец очереди';
  return;
 }
 row.querySelector('b').textContent=nextItem.name;
 row.querySelector('small').textContent=nextItem.artist;
 row.querySelector('img').src=nextItem.cover;
 row.querySelectorAll('[data-play]').forEach(button=>button.dataset.play=nextItem.id);
}

function animateSwap(table,old,startAngle,direction){
 const disc=table.querySelector('#record');
 const arm=table.querySelector('#armTravel');
 const target=needleAngle(position/(currentTrack().duration||1));
 const clip=document.createElement('div');
 clip.className='disc-window';
 disc.before(clip);
 old.removeAttribute('id');
 old.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
 clip.append(old,disc);
 table.classList.add('swapping');
 const park=-3;
 const frame=(angle,lift,offset)=>({transform:'rotate('+angle+'deg) scaleY('+lift+')',offset,easing:'ease-in-out'});
 const duration=880;
 const motion=arm.animate([frame(startAngle,1,0),frame(startAngle,.94,.13),
  frame(park,.94,.31),frame(park,.94,.69),frame(target,.94,.87),
  frame(target,1,1)],{duration,fill:'both'});
 const slide=(node,from,to)=>node.animate([
  {translate:from+'% 0',offset:0},{translate:from+'% 0',offset:.31,easing:'ease-in-out'},
  {translate:to+'% 0',offset:.69},{translate:to+'% 0',offset:1}],
  {duration,fill:'both'});
 const slides=[slide(old,0,116*direction),slide(disc,-116*direction,0)];
 const finish=()=>{
  motion.onfinish=null;
  for(const animation of [motion,...slides])animation.cancel();
  clip.replaceWith(disc);
  table.classList.remove('swapping');
  activeSwap=null;
 };
 activeSwap={table,finish};
 motion.onfinish=finish;
}

renderPlayer=function(){
 const changed=transitionTrack!==current;
 const previous=$('#turntable');
 const old=changed&&previous?.querySelector('#record')?.cloneNode(true);
 const arm=activeSwap ? $('#armTravel') : $('#tonearm');
 let startAngle=0;
 if(changed && arm){
  const transform=getComputedStyle(arm).transform;
  if(transform!=='none'){
   const matrix=new DOMMatrixReadOnly(transform);
   startAngle=Math.atan2(matrix.b,matrix.a)*180/Math.PI;
  }
 }
 if(changed&&activeSwap)activeSwap.finish();
 releasePlayer();
 const table=$('#turntable');
 if(!changed&&activeSwap&&table)table.replaceWith(activeSwap.table);
 const button=$('#repeat');
 if(button){button.classList.toggle('on',Number(repeat)>0);button.setAttribute('aria-label',['Повтор выключен','Повтор очереди','Повтор трека'][Number(repeat)]);if(Number(repeat)===2)button.insertAdjacentHTML('beforeend','<small class="repeat-one">1</small>');}
 updateQueueCard();
 if(changed&&old&&table?.clientWidth&&recordAnimation&&!reducedMotion()&&!curtain.isConnected){
  animateSwap(table,old,startAngle,transitionDirection);
  if(!localStorage.getItem('recordAnimationHint')){toast('Смену пластинок можно отключить в настройках.');localStorage.setItem('recordAnimationHint','true');}
 }
 transitionTrack=current;transitionDirection=1;
};
renderMain();renderPlayer();
// The document survives resume and Fold size changes. Only a new document runs this sequence.
function revealPlayer(){
 if(!curtain.isConnected||curtain.classList.contains('reveal'))return;
 if(reducedMotion()){curtain.remove();return;}
 curtain.classList.add('reveal');
 curtain.addEventListener('animationend',event=>{if(event.target===curtain)curtain.remove();});
 setTimeout(()=>curtain.remove(),350);
}
const launchStart=performance.now();
let receivedPlayback=false;
function completeLaunch(){
 if(!curtain.isConnected || document.hidden)return;
 const elapsed=performance.now()-launchStart;
 if((reducedMotion()||elapsed>=750) && (receivedPlayback||elapsed>=1100))revealPlayer();
 else setTimeout(completeLaunch,60);
}
requestAnimationFrame(completeLaunch);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)completeLaunch();});

readWave050=function(){
 if(document.hidden||localStorage.getItem('spinWave050')!=='true'){waveTarget050.fill(0);return;}
 try{const bins=JSON.parse(visualStyle==='spectrum'||visualStyle==='mirror'?N.spectrum():N.waveform());waveTarget050=Array.from({length:128},(_,i)=>Math.min(1,Math.max(0,Number(bins[Math.floor(i*bins.length/128)])||0)));if(waveValues050.length!==128)waveValues050=Array(128).fill(0);}catch{waveTarget050.fill(0);}
};

const releasePlayback=window.spinPlayback;
window.spinPlayback=function(state){
 const repeatBeforeState=repeat,shuffleBeforeState=shuffle;
 if(state.repeatMode!==undefined)repeat=state.repeatMode;
 if(state.shuffle!==undefined)shuffle=state.shuffle;
 if(state.id!==current)transitionDirection=state.direction||1;
 const previousId=current;
 releasePlayback(state);
 receivedPlayback=true;
 if(previousId===current&&(repeatBeforeState!==repeat||shuffleBeforeState!==shuffle))renderPlayer();
};

document.addEventListener('click',event=>{
 if(!event.target.closest('#play,#miniPlay,[data-play],[data-play-album050]'))return;
 if(localStorage.getItem('spinWave050')===null){localStorage.setItem('spinWave050','true');N.visualizer(true,false);}
});

N.visualStyle(visualStyle,visualDensity);
