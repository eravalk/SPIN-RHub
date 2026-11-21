/* Presentation adapters share the existing playback/queue/download commands. */
(() => {
  'use strict';
  const KEY = 'spinAppStyleV1';
  const available = new Set(['vinyl', 'liquid-glass']);
  let selected;
  try { selected = localStorage.getItem(KEY); } catch {}
  let style = available.has(selected) ? selected : 'vinyl';
  let drag = null, animationFrame = 0, lastFrame = 0, angle = 0, speed = 0;
  let sceneIdentity = '', sceneTrack = null, motions = [];
  let playlistContext = '';
  try { playlistContext = localStorage.getItem('spinStylePlaylistContext') || ''; } catch {}
  const body = document.body;
  const isGlass = () => style === 'liquid-glass';
  const motionAllowed = () => !reducedMotion() && localStorage.getItem('spinMotion') !== 'false';
  const safeSave = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const duration = () => Math.max(0, Number(currentTrack().duration) || 0);
  const fraction = () => clamp(position / (duration() || 1));
  const labels = {vinyl:'Винил', 'liquid-glass':'Liquid Glass'};

  function mediaFor(track) {
    const list = playlists.find(p => p.id === playlistContext);
    if (list && list.ids.includes(track.id) && queue.every(id => list.ids.includes(id))) {
      const first = tracks.find(t => t.id === list.ids[0]);
      return {key:'playlist:' + list.id, name:list.name, artist:'Плейлист · ' + list.ids.length + ' треков', cover:list.cover || first?.cover || track.cover};
    }
    const album = track.album && !['Без альбома','Скачанное','Скачано','Мои файлы'].includes(track.album);
    return {key:album ? 'album:' + (track.albumArtist || track.artist) + '\n' + track.album : 'track:' + track.id,
      name:album ? track.album : track.name, artist:track.albumArtist || track.artist, cover:track.cover || 'app-cover.svg'};
  }
  function cancelMotions() {
    motions.forEach(a => { a.onfinish = null; a.cancel(); }); motions = [];
    document.querySelectorAll('.cd-outgoing').forEach(n=>n.remove());
  }
  function runMotion(node, frames, options) {
    if (!node || typeof node.animate !== 'function') return null;
    const a = node.animate(frames, options); motions.push(a);
    a.onfinish = () => { a.cancel(); motions = motions.filter(item => item !== a); };
    return a;
  }
  function caseOffset(scene){
    const disc=scene.querySelector('.cd-disc-holder').getBoundingClientRect(),box=scene.querySelector('.cd-case').getBoundingClientRect();
    if(!disc.width)return {translate:'-35% -12%',scale:'.65'};
    return {translate:(box.left+box.width/2-disc.left-disc.width/2)+'px '+(box.top+box.height/2-disc.top-disc.height/2)+'px',scale:String(Math.min(.9,box.width*.9/disc.width))};
  }
  function playTransition(scene, oldScene, changedAlbum) {
    cancelMotions();
    if (!motionAllowed() || !recordAnimation || document.hidden) return;
    if (!oldScene || changedAlbum) {
      const total = oldScene ? 1150 : 780;
      const delay = oldScene ? 400 : 0;
      if (oldScene) {
        oldScene.classList.add('cd-outgoing'); oldScene.removeAttribute('id');
        oldScene.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        scene.append(oldScene);
        const oldDisc = oldScene.querySelector('.cd-disc-holder');
        runMotion(oldDisc, [{translate:'0 0',opacity:1},{...caseOffset(oldScene),opacity:0}], {duration:380,easing:'ease-in',fill:'both'});
        const fade = runMotion(oldScene,[{opacity:1},{opacity:0}],{duration:420,fill:'both'});
        if(fade) fade.onfinish=()=>{oldScene.remove();fade.cancel();motions=motions.filter(a=>a!==fade);};
      }
      runMotion(scene.querySelector('.cd-case-lid'),[
        {transform:'perspective(700px) rotateY(0deg)',offset:0},
        {transform:'perspective(700px) rotateY(-45deg)',offset:.35},
        {transform:'perspective(700px) rotateY(-45deg)',offset:.68},
        {transform:'perspective(700px) rotateY(0deg)',offset:1}
      ],{duration:total-delay,delay,easing:'ease-in-out'});
      runMotion(scene.querySelector('.cd-disc-holder'),[
        {...caseOffset(scene),opacity:0},
        {...caseOffset(scene),opacity:0,offset:.16},
        {translate:'0 0',scale:'1',opacity:1}
      ],{duration:total-delay,delay,easing:'cubic-bezier(.2,.7,.2,1)'});
    }
  }
  function sceneNode(media) {
    const scene = document.createElement('div'); scene.id='cdScene'; scene.className='cd-scene';
    scene.innerHTML=`<div class="cd-case" aria-label="Обложка ${esc(media.name)}"><div class="cd-case-spine"><strong>${esc(media.name)}</strong></div><div class="cd-case-lid"><img src="${esc(media.cover)}" alt=""></div></div><div class="cd-disc-holder"><div class="cd-disc" aria-hidden="true"><div class="cd-print"><img src="${esc(media.cover)}" alt=""></div><div class="cd-diffraction"></div></div><div class="cd-hub" aria-hidden="true"></div><div id="cdLaser" class="cd-laser" role="slider" tabindex="0" aria-label="Лазер — позиция песни" aria-valuemin="0" aria-valuemax="${duration()}" aria-valuenow="${Math.floor(position)}"><span class="cd-laser-dot"></span><output class="cd-seek-time" hidden></output></div><div class="cd-seek-guide" aria-hidden="true"></div></div>`;
    scene.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { if(!img.src.endsWith('/app-cover.svg'))img.src='app-cover.svg'; }, {once:true}));
    return scene;
  }
  function updateLaser() {
    if(!isGlass())return;
    const laser=$('#cdLaser');if(!laser)return;
    const p=fraction(), radius=21+25*p;
    // Fixed 35-degree axis: only the radial distance changes with song progress.
    laser.style.left=(50+radius*.819152)+'%';laser.style.top=(50+radius*.573576)+'%';
    laser.setAttribute('aria-valuemax',duration());laser.setAttribute('aria-valuenow',Math.floor(position));
    laser.setAttribute('aria-valuetext',fmt(position)+' из '+fmt(duration()));
    const out=laser.querySelector('output');if(out)out.textContent=fmt(position)+' / '+fmt(duration());
    $('#cdScene')?.style.setProperty('--cd-laser-progress',p);
  }
  function cancelDrag(restore=true) {
    if(!drag)return;
    const previous=drag;drag=null;needleDragging=false;seekDragging=false;
    previous.scene.classList.remove('cd-seeking');
    const output=previous.laser.querySelector('output');if(output)output.hidden=true;
    if(restore && previous.track===current){position=previous.start;updateProgress();}
  }
  function attachLaser(scene) {
    const laser=scene.querySelector('#cdLaser');if(!laser)return;
    const preview=e=>{
      if(!drag || drag.track!==current)return;
      const box=scene.querySelector('.cd-disc-holder').getBoundingClientRect();if(!box.width)return;
      const x=(e.clientX-box.left-box.width/2)/box.width*100,y=(e.clientY-box.top-box.height/2)/box.height*100;
      // Project onto the fixed laser axis, so moving sideways does not cause backwards jumps.
      position=clamp((x*.819152+y*.573576-21)/25)*duration();
      lastPlaybackSample=performance.now();updateProgress();
    };
    laser.onpointerdown=e=>{
      if(e.button!==0 || !duration() || currentTrack().id===-1)return;
      e.preventDefault();cancelDrag();drag={start:position,track:current,laser,scene};
      needleTrack=current;needleDragging=true;seekDragging=true;
      scene.classList.add('cd-seeking');laser.querySelector('output').hidden=false;
      try{laser.setPointerCapture(e.pointerId);}catch{}
      // No seek on pointerdown: catching the large touch target must not jump playback.
    };
    laser.onpointermove=e=>{if(drag){e.preventDefault();preview(e);}};
    laser.onpointerup=e=>{
      if(!drag)return;
      if(drag.track!==current){cancelDrag(false);return;}
      preview(e);const target=position;cancelDrag(false);
      needlePending=target;needleGuardUntil=performance.now()+1500;seek(target);
    };
    laser.onpointercancel=()=>cancelDrag();laser.onlostpointercapture=()=>cancelDrag();
    laser.onkeydown=e=>{
      if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
      e.preventDefault();const target=e.key==='Home'?0:e.key==='End'?duration():position+(['ArrowRight','ArrowUp'].includes(e.key)?5:-5);
      needleTrack=current;needlePending=Math.max(0,Math.min(duration(),target));needleGuardUntil=performance.now()+1500;seek(needlePending);
    };
  }
  let rightTab=lyricsEnabled?'lyrics':'queue', view='browser', panelOpen=lyricsEnabled;
  const basePlayerClass=$('#player').className;
  const gearIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4l.7 2.6 2 .9L19 4.2l2.8 2.8-1.3 2.3.9 2L24 12v4l-2.6.7-.9 2 1.3 2.3-2.8 2.8-2.3-1.3-2 .9L14 26h-4l-.7-2.6-2-.9L5 23.8 2.2 21l1.3-2.3-.9-2L0 16v-4l2.6-.7.9-2L2.2 7 5 4.2l2.3 1.3 2-.9Z" transform="translate(2 0) scale(.83)"/><circle cx="12" cy="11.6" r="3"/></svg>';
  function routes(){
    return [['library','music','Библиотека'],['online','search','Поиск'],['create','plus','Плейлист'],['downloads','download','Загрузки'],['settings','settings','Настройки']].map(([id,i,title])=>`<button type="button" data-lg-route="${id}" aria-label="${id==='create'?'Создать плейлист':title}">${i==='settings'?gearIcon:icon(i)}<span>${title}</span></button>`).join('');
  }
  function ensureShell(){
    let shell=$('#glassShell');if(shell)return shell;
    shell=document.createElement('div');shell.id='glassShell';shell.dataset.view=view;
    shell.innerHTML=`<img class="lg-backdrop" id="lgBackdrop" src="app-cover.svg" alt="" aria-hidden="true"><div class="lg-ambient" aria-hidden="true"></div><section class="lg-browser"><header class="lg-header"><div><small>SPIN RHub</small><h1 id="lgPageTitle">Библиотека</h1></div><button type="button" class="lg-icon" id="lgPalette" aria-label="Сменить палитру">◐</button></header><div id="glassMainDock"></div></section><section id="glassPlayerDock"></section><aside id="glassSidePanel" class="lg-side"><div class="glass-panel-tabs" role="group" aria-label="Панель плеера"><button type="button" data-glass-panel="lyrics">Текст</button><button type="button" data-glass-panel="queue">Очередь</button><button type="button" id="lgClosePanel" aria-label="Скрыть панель">${icon('close')}</button></div><div id="glassPanelBody"></div></aside><div id="lgLyricStash" hidden></div><div class="lg-mini" id="lgMini"></div><nav class="lg-bottom" aria-label="Главная навигация"><i class="lg-indicator" aria-hidden="true"></i>${routes()}</nav>`;
    body.append(shell);
    const main=$('#main'),player=$('#player');
    shell.querySelector('#glassMainDock').append(main);
    shell.querySelector('#glassPlayerDock').append(player);player.className='lg-player';
    body.classList.remove('wide-lyrics','queue-open','glass-expanded','glass-wide','cover-playing');$('#sideQueue')?.remove();queueOpen=false;
    return shell;
  }
  function removeShell(){
    const shell=$('#glassShell');if(!shell)return;
    const lyrics=$('#persistentLyrics');if(lyrics)$('#player').append(lyrics);
    $('.workspace').append($('#main'));$('#app').insertBefore($('#player'),$('#bottomNav'));
    $('#player').className=basePlayerClass;shell.remove();
  }
  function setView(next){
    view=next;ensureShell().dataset.view=view;
    if(view==='player')$('#glassPlayerDock').scrollTop=0;
    else window.spinRestoreNavigation?.();
    updateMini();renderSidePanel();startFrame();
  }
  function updateNav(){
    const active=page==='downloads'?(downloadTab==='search'?'online':'downloads'):page==='settings'?'settings':'library';
    $$('#glassShell [data-lg-route]').forEach(b=>{b.classList.toggle('active',b.dataset.lgRoute===active);if(b.closest('nav'))b.setAttribute('aria-current',b.dataset.lgRoute===active?'page':'false');});
    $('#glassShell .lg-bottom').style.setProperty('--slot', ['library','online','create','downloads','settings'].indexOf(active));
    const title=$('#lgPageTitle');if(title)title.textContent=page==='downloads'&&downloadTab==='search'?'Поиск':$('#pageTitle')?.textContent||'Библиотека';
  }
  function updateMini(){
    const mini=$('#lgMini');if(!mini)return;
    const t=currentTrack();mini.hidden=t.id===-1;
    mini.innerHTML=`<button id="lgOpenPlayer" aria-label="Открыть плеер"><img src="${esc(t.cover||'app-cover.svg')}" alt=""><span><b>${esc(t.name)}</b><small>${esc(t.artist)}</small></span></button><button id="lgMiniPlay" class="lg-icon" aria-label="${playing?'Пауза':'Воспроизведение'}">${icon(playing?'pause':'play')}</button><button id="lgMiniNext" class="lg-icon" aria-label="Следующая песня">${icon('next')}</button>`;
  }
  function updatePlayerControls(){
    const t=currentTrack(),name=$('#lgTrackName'),artist=$('#lgTrackArtist');
    if(name)name.textContent=t.name;if(artist)artist.textContent=t.artist;
    const play=$('#play');if(play){play.innerHTML=icon(playing?'pause':'play');play.setAttribute('aria-label',playing?'Пауза':'Воспроизведение');}
    const fav=$('#lgFav');if(fav){fav.dataset.fav=t.id;fav.classList.toggle('liked',favorites.has(t.id));fav.disabled=t.id===-1;}
    const menu=$('#lgTrackMenu');if(menu){menu.dataset.menu=t.id;menu.disabled=t.id===-1;}
    const repeatButton=$('#repeat');if(repeatButton){repeatButton.classList.toggle('on',Number(repeat)>0);repeatButton.setAttribute('aria-label',['Повтор выключен','Повтор очереди','Повтор трека'][Number(repeat)]);repeatButton.innerHTML=icon('repeat')+(Number(repeat)===2?'<small>1</small>':'');}
    $('#shuffle')?.classList.toggle('on',shuffle);
    $('#shuffle')?.setAttribute('aria-pressed',String(shuffle));
    repeatButton?.setAttribute('aria-pressed',String(Number(repeat)>0));
    if($('#totalTime'))$('#totalTime').textContent=fmt(t.duration);
    updateLaser();updateMini();
  }
  function renderGlassPlayer(){
    ensureShell();
    const t=currentTrack(),media=mediaFor(t),player=$('#player');
    let oldScene=$('#cdScene'),oldIdentity=sceneIdentity,oldTrack=sceneTrack;
    if(!player.querySelector('.lg-stage')){
      if($('#glassSidePanel')?.closest('#player'))ensureShell().append($('#glassSidePanel'));
      player.innerHTML=`<header class="lg-player-top"><button class="lg-icon" id="lgClosePlayer" aria-label="Вернуться к библиотеке">${icon('back')}</button><span>СЕЙЧАС ИГРАЕТ</span><button class="lg-icon" id="lgTrackMenu" data-menu="${t.id}" aria-label="Меню песни">${icon('more')}</button></header><div class="lg-media-area"><div class="lg-stage" id="lgStage"></div></div><div class="lg-now"><div><h2 id="lgTrackName"></h2><p id="lgTrackArtist"></p></div><button class="lg-icon" id="lgFav" data-fav="${t.id}" aria-label="В избранное">${icon('heart')}</button></div><div class="lg-time"><span id="elapsed">${fmt(position)}</span><span id="totalTime">${fmt(t.duration)}</span></div><div class="lg-transport"><button class="lg-icon" id="shuffle" aria-label="Случайный порядок">${icon('shuffle')}</button><button class="lg-icon" id="prev" aria-label="Предыдущая песня">${icon('prev')}</button><button class="lg-play" id="play" aria-label="Воспроизведение">${icon('play')}</button><button class="lg-icon" id="next" aria-label="Следующая песня">${icon('next')}</button><button class="lg-icon" id="repeat" aria-label="Повтор выключен">${icon('repeat')}</button></div><label class="lg-volume"><span>Звук</span><input id="volume" aria-label="Громкость" type="range" min="0" max="1" step=".01" value="${volume}"></label><div class="lg-player-tools"><button class="lg-pill" id="lgLyricsBtn">${icon('music')} Текст</button><button class="lg-pill" id="lgQueueBtn">${icon('queue')} Очередь</button><button class="lg-pill" data-timer>Таймер</button></div>`;
      oldScene=null;
    }
    const same=oldScene&&oldIdentity===media.key;
    const scene=same?oldScene:sceneNode(media);
    scene.querySelector('.cd-case').setAttribute('aria-label','Обложка '+media.name);
    scene.querySelector('.cd-case-spine strong').textContent=media.name;
    scene.querySelectorAll('img').forEach(img=>{if(img.getAttribute('src')!==media.cover)img.src=media.cover;});
    if(!same){$('#lgStage').replaceChildren(scene);angle=0;speed=0;attachLaser(scene);playTransition(scene,oldScene,!!oldScene);}
    sceneIdentity=media.key;sceneTrack=t.id;
    const backdrop=$('#lgBackdrop');if(backdrop.getAttribute('src')!==media.cover)backdrop.src=media.cover;
    scene.querySelector('.cd-disc').style.transform='rotate('+angle+'deg)';
    updatePlayerControls();renderSidePanel();startFrame();
  }
  function togglePanel(tab){
    panelOpen=rightTab!==tab || !panelOpen;
    rightTab=tab;
    renderSidePanel();
  }
  function renderSidePanel(){
    if(!isGlass())return;
    const shell=ensureShell(),panel=$('#glassSidePanel'),host=$('#glassPanelBody');
    const stage=$('#lgStage');
    if(stage && panel.parentNode!==stage.parentNode)stage.after(panel);
    shell.dataset.panel=panelOpen?rightTab:'closed';
    panel.hidden=!panelOpen;
    panel.querySelectorAll('[data-glass-panel]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.glassPanel===rightTab));
    $('#lgLyricsBtn')?.setAttribute('aria-pressed',panelOpen&&rightTab==='lyrics');
    $('#lgQueueBtn')?.setAttribute('aria-pressed',panelOpen&&rightTab==='queue');
    if(!panelOpen)return;
    if(rightTab==='queue'){
      const keep=host.querySelector('#persistentLyrics');if(keep)$('#lgLyricStash').append(keep);
      host.innerHTML=queueHtml04().replace(/<button class="icon-btn" id="closeQueue04"[\s\S]*?<\/button>/,'');
    }else{
      const lyrics=$('#persistentLyrics');
      if(lyrics){if(lyrics.parentNode!==host)host.replaceChildren(lyrics);}
      else host.innerHTML='<div class="lg-empty"><p>Текст пока не найден</p><button class="lg-pill" id="glassOpenLyrics">Найти или добавить текст</button></div>';
    }
  }
  const beforeLyrics=renderPersistentLyrics;
  renderPersistentLyrics=function(){
    if(!isGlass()){
      beforeLyrics();
      if(page==='settings'){body.classList.remove('lyrics-enabled','wide-lyrics');const host=$('#persistentLyrics');if(host)$('#player').append(host);}
      return;
    }
    ensureShell();
    body.classList.remove('wide-lyrics','queue-open','lyrics-enabled');
    if(!lyricsEnabled||currentTrack().id===-1){$('#persistentLyrics')?.remove();renderSidePanel();return;}
    if(lyricLoadedId!==current)loadLyricTrack(current);
    let host=$('#persistentLyrics');
    if(!host){host=document.createElement('section');host.id='persistentLyrics';host.className='persistent-lyrics lg-lyrics';$('#lgLyricStash').append(host);}
    host.innerHTML=lyricHtml();
    $('#lyricLines').addEventListener('wheel',()=>{lyricManualUntil=Date.now()+10000;},{passive:true});
    $('#lyricLines').addEventListener('touchstart',()=>{lyricManualUntil=Date.now()+10000;},{passive:true});
    lyricActive=-2;updateLyrics();renderSidePanel();
  };
  const beforeOpenLyrics=openLyrics,beforeCloseLyrics=closeLyrics;
  openLyrics=function(id){
    if(!isGlass())return beforeOpenLyrics(id);
    if(id!==current||id===-1)return toast('Сначала включи песню');
    rightTab='lyrics';panelOpen=true;lyricsEnabled=true;safeSave('spinLyricsVisible','true');
    setView('player');renderPersistentLyrics();

  };
  closeLyrics=function(){
    if(!isGlass())return beforeCloseLyrics();
    lyricsEnabled=false;safeSave('spinLyricsVisible','false');$('#persistentLyrics')?.remove();panelOpen=false;renderSidePanel();
  };
  function settingsSection(){
    const el=document.createElement('section');el.id='appStyleSettings';el.className='settings-card app-style-settings';el.setAttribute('aria-labelledby','appStyleHeading');
    el.innerHTML='<h2 id="appStyleHeading">Стиль приложения</h2><p>Оформление всего плеера. Палитра настраивается отдельно.</p><div class="app-style-options" role="group" aria-label="Стиль приложения">'+[['vinyl','Винил','Пластинка и игла'],['liquid-glass','Liquid Glass','CD, коробка и лазер'],['cassette','Кассета','В разработке']].map(([id,name,detail])=>`<button type="button" class="app-style-choice ${style===id?'selected':''}" data-app-style="${id}" aria-pressed="${style===id}" ${id==='cassette'?'disabled':''}><span class="app-style-icon style-icon-${id}" aria-hidden="true"></span><b>${name}</b><small>${detail}</small></button>`).join('')+'</div>';
    return el;
  }
  const beforeMain=renderMain;
  renderMain=function(){
    if(isGlass())ensureShell();
    beforeMain();
    if(page==='settings'){$('#appStyleSettings')?.remove();$('#main').prepend(settingsSection());}
    if(isGlass()){updateNav();updateMini();renderSidePanel();}
  };
  const beforePlayer=renderPlayer;
  renderPlayer=function(){
    cancelDrag();if(activeSwap)activeSwap.finish();
    if(isGlass()){renderGlassPlayer();transitionTrack=current;}
    else{cancelMotions();sceneIdentity='';sceneTrack=null;beforePlayer();}
  };
  const beforeProgress=updateProgress;
  updateProgress=function(){beforeProgress();updateLaser();};
  const beforeSync=syncPlaying;
  syncPlaying=function(){
    if(!isGlass())return beforeSync();
    updatePlayerControls();startFrame();
  };
  const beforeQueueDraw=redrawQueue04;
  redrawQueue04=function(){beforeQueueDraw();if(isGlass())renderSidePanel();};
  const beforePlayTrack=playTrack;
  playTrack=function(id){playlistContext=page==='playlist'?window.activePlaylist||'':'';safeSave('spinStylePlaylistContext',playlistContext);return beforePlayTrack(id);};
  const beforeBack=window.spinBack;
  window.spinBack=function(){
    if(isGlass()&&!$('#dialog').open&&view==='player'){setView('browser');return;}
    return beforeBack();
  };
  function frame(now){
    animationFrame=0;
    if(!isGlass()||document.hidden){lastFrame=0;return;}
    const scene=$('#cdScene'),player=$('#player');if(!scene||!player.getClientRects().length){lastFrame=0;return;}
    const dt=Math.min(.05,Math.max(0,(now-(lastFrame||now))/1000));lastFrame=now;
    const motion=motionAllowed(),target=motion&&playing?(drag?55:960):0;
    speed+=(target-speed)*Math.min(1,dt*(playing?3:4));if(speed<.05)speed=0;
    if(motion)angle=(angle+speed*dt)%360;
    scene.querySelector('.cd-disc').style.transform='rotate('+angle+'deg)';
    scene.classList.toggle('cd-active',playing&&motion);scene.classList.toggle('cd-paused',!playing);
    if(!motion){speed=0;cancelMotions();}
    if(motion&&(playing||speed>.05||drag))animationFrame=requestAnimationFrame(frame);
  }
  function startFrame(){if(!animationFrame&&isGlass()&&!document.hidden)animationFrame=requestAnimationFrame(frame);}
  function applyStyle(next){
    if(!available.has(next))return;
    window.spinPersistNavigation?.();
    window.spinSuspendNavigation?.();
    cancelDrag();cancelMotions();if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;lastFrame=0;
    if(activeSwap)activeSwap.finish();
    window.SpinStyleColors?.save();
    style=next;body.dataset.appStyle=style;safeSave(KEY,style);
    window.SpinStyleColors?.load();
    body.classList.remove('wide-lyrics','queue-open','glass-expanded','glass-wide','cover-playing');$('#sideQueue')?.remove();queueOpen=false;
    if(isGlass())ensureShell();else removeShell();
    renderMain();renderPlayer();
    if(page==='settings')$('[data-app-style="'+style+'"]')?.focus({preventScroll:true});
    startFrame();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.appStyle){e.preventDefault();e.stopImmediatePropagation();applyStyle(b.dataset.appStyle);return;}
    if(!isGlass())return;
    const consume=()=>{e.preventDefault();e.stopImmediatePropagation();};
    if(b.dataset.lgRoute){
      consume();
      if(b.dataset.lgRoute==='create'){openPlaylistDialog();return;}
      window.spinPersistNavigation?.();
      view='browser';ensureShell().dataset.view=view;
      if(b.dataset.lgRoute==='online'){downloadTab='search';go('downloads');}
      else if(b.dataset.lgRoute==='downloads'){downloadTab='active';go('downloads');}
      else go(b.dataset.lgRoute);return;
    }
    if(b.id==='lgPalette'){consume();setTheme(['dark','light','black'][(['dark','light','black'].indexOf(theme)+1)%3]);return;}
    if(b.id==='lgOpenPlayer'){consume();window.spinPersistNavigation?.();setView('player');return;}
    if(b.id==='lgClosePlayer'){consume();setView('browser');return;}
    if(b.id==='lgMiniPlay'){consume();toggle();return;}
    if(b.id==='lgMiniNext'){consume();next();return;}
    if(b.id==='lgLyricsBtn'||b.id==='glassOpenLyrics'){consume();if(b.id==='lgLyricsBtn'&&panelOpen&&rightTab==='lyrics')closeLyrics();else openLyrics(current);return;}
    if(b.id==='lgQueueBtn'){consume();togglePanel('queue');return;}
    if(b.id==='lgClosePanel'){consume();if(rightTab==='lyrics')closeLyrics();else togglePanel('queue');return;}
    if(b.dataset.glassPanel){consume();if(b.dataset.glassPanel==='lyrics')openLyrics(current);else{rightTab='queue';panelOpen=true;renderSidePanel();}return;}
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();cancelMotions();if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;lastFrame=0;}else startFrame();});
  window.addEventListener('resize',()=>{if(isGlass()){cancelDrag();renderSidePanel();startFrame();}});
  if(typeof ResizeObserver==='function')new ResizeObserver(startFrame).observe($('#player'));
  window.SpinAppStyle={get:()=>style,set:applyStyle,mediaFor,view:()=>view,showPlayer:()=>setView('player'),showLibrary:()=>{if(isGlass())setView('browser');},stop:()=>{cancelDrag();cancelMotions();if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;}};
  body.dataset.appStyle=style;if(isGlass())ensureShell();renderMain();renderPlayer();
})();
