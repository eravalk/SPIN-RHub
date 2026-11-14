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
    scene.innerHTML=`<div class="cd-case" aria-label="Обложка ${esc(media.name)}"><div class="cd-case-spine"></div><div class="cd-case-lid"><img src="${esc(media.cover)}" alt=""><div class="cd-case-title"><strong>${esc(media.name)}</strong><small>${esc(media.artist)}</small></div></div></div><div class="cd-disc-holder"><div class="cd-disc" aria-hidden="true"><div class="cd-print"><img src="${esc(media.cover)}" alt=""></div><div class="cd-diffraction"></div></div><div class="cd-hub" aria-hidden="true"></div><div id="cdLaser" class="cd-laser" role="slider" tabindex="0" aria-label="Лазер — позиция песни" aria-valuemin="0" aria-valuemax="${duration()}" aria-valuenow="${Math.floor(position)}"><span class="cd-laser-dot"></span><output class="cd-seek-time" hidden></output></div><div class="cd-seek-guide" aria-hidden="true"></div></div>`;
    scene.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { if(!img.src.endsWith('/app-cover.svg'))img.src='app-cover.svg'; }, {once:true}));
    return scene;
  }
  function decoratePlayer(oldScene, oldIdentity, oldTrack) {
    const track=currentTrack(), media=mediaFor(track), player=$('#player'), table=$('#turntable');
    if (!player || !table) return;
    const same=oldScene && oldIdentity===media.key;
    const scene=same ? oldScene : sceneNode(media);
    if(same){
      scene.querySelector('.cd-case').setAttribute('aria-label','Обложка '+media.name);
      scene.querySelector('.cd-case-title strong').textContent=media.name;
      scene.querySelector('.cd-case-title small').textContent=media.artist;
      scene.querySelectorAll('img').forEach(img=>{if(img.getAttribute('src')!==media.cover)img.src=media.cover;});
    }
    // Reuse the physical scene for a track change in the same album/playlist.
    table.replaceWith(scene);
    player.classList.add('cd-player');
    player.querySelector('[data-styletrack]')?.remove();
    player.querySelector('.queue-card')?.remove();
    player.querySelector('.seek-help')?.remove();
    player.querySelector('#needleTime04')?.remove();
    const toggleView=document.createElement('button');toggleView.id='cdPanelToggle';toggleView.className='text-btn';toggleView.textContent='Развернуть плеер';
    player.querySelector('.player-top')?.append(toggleView);
    $('#waveSeek')?.setAttribute('aria-label','Позиция песни — альтернативное управление');
    const disc=scene.querySelector('.cd-disc');
    if(!same && oldScene && oldTrack!==track.id) { angle=0; speed=0; }
    sceneIdentity=media.key;sceneTrack=track.id;
    attachLaser(scene);
    updateLaser();
    if(!same)playTransition(scene,oldScene,!!oldScene);
    else if(oldTrack!==track.id && motionAllowed())runMotion(scene.querySelector('.cd-laser-dot'),[{opacity:.2},{opacity:1}],{duration:260});
    if(disc)disc.style.transform='rotate('+angle+'deg)';
    renderSidePanel();
    startFrame();
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
  let rightTab=lyricsEnabled?'lyrics':'queue';
  function renderSidePanel() {
    let panel=$('#glassSidePanel');
    if(!isGlass()){panel?.remove();return;}
    if(!panel){panel=document.createElement('aside');panel.id='glassSidePanel';$('#app').append(panel);}
    if(!panel.querySelector('.glass-panel-tabs'))panel.innerHTML='<div class="glass-panel-tabs"><button type="button" data-glass-panel="lyrics">Текст</button><button type="button" data-glass-panel="queue">Очередь</button></div><div id="glassPanelBody"></div>';
    panel.querySelectorAll('[data-glass-panel]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.glassPanel===rightTab));
    const host=panel.querySelector('#glassPanelBody');
    if(rightTab==='queue'){
      const keep=host.querySelector('#persistentLyrics');if(keep)$('#player').append(keep);
      host.innerHTML=queueHtml04().replace(/<button class="icon-btn" id="closeQueue04"[\s\S]*?<\/button>/,'');
    }
    else {
      const lyrics=$('#persistentLyrics');
      if(lyrics){if(lyrics.parentNode!==host)host.replaceChildren(lyrics);}
      else host.innerHTML='<div class="empty"><p>Текст текущей песни</p><button class="secondary" id="glassOpenLyrics">Показать текст</button></div>';
    }
    const wide=innerWidth>=1100 && !body.classList.contains('force-cover');
    body.classList.toggle('glass-wide',wide);
    const tools=$('#player .player-tools');if(tools)tools.classList.toggle('glass-tools-wide',wide);
  }
  const beforeLyrics=renderPersistentLyrics;
  renderPersistentLyrics=function(){
    beforeLyrics();
    if(isGlass()){
      body.classList.remove('wide-lyrics','queue-open');$('#sideQueue')?.remove();
      const lyrics=$('#persistentLyrics');
      if(lyrics && lyrics.parentNode!==$('#player'))$('#player').append(lyrics);
      renderSidePanel();
    }
  };
  function settingsSection() {
    const el=document.createElement('section');el.id='appStyleSettings';el.className='settings-card app-style-settings';
    el.setAttribute('aria-labelledby','appStyleHeading');
    el.innerHTML='<h2 id="appStyleHeading">Стиль приложения</h2><p>Выбери оформление всего плеера. Палитра настраивается отдельно.</p><div class="app-style-options" role="group" aria-label="Стиль приложения">'+
      [['vinyl','Винил','Пластинка и игла'],['liquid-glass','Liquid Glass','CD, коробка и лазер'],['cassette','Кассета','В разработке']].map(([id,name,detail])=>`<button type="button" class="app-style-choice ${style===id?'selected':''}" data-app-style="${id}" aria-pressed="${style===id}" ${id==='cassette'?'disabled':''}><span class="app-style-icon style-icon-${id}" aria-hidden="true"></span><b>${name}</b><small>${detail}</small></button>`).join('')+'</div>';
    return el;
  }
  const beforeOpenLyrics=openLyrics;openLyrics=function(id){if(isGlass())rightTab='lyrics';return beforeOpenLyrics(id);};
  const beforeQueueDraw=redrawQueue04;redrawQueue04=function(){beforeQueueDraw();if(isGlass())renderSidePanel();};
  const beforeMain=renderMain;
  renderMain=function(){beforeMain();if(page==='settings'){$('#appStyleSettings')?.remove();$('#main').prepend(settingsSection());}if(isGlass())renderSidePanel();};
  const beforePlayer=renderPlayer;
  renderPlayer=function(){
    const oldScene=$('#cdScene'), oldIdentity=sceneIdentity, oldTrack=sceneTrack;
    cancelDrag();
    if(activeSwap)activeSwap.finish();
    if(isGlass()){
      // Use the shared renderer below the vinyl-only swap adapter.
      releasePlayer();transitionTrack=current;
      decoratePlayer(oldScene,oldIdentity,oldTrack);
    }else{
      cancelMotions();sceneIdentity='';sceneTrack=null;
      beforePlayer();$('#player').classList.remove('cd-player');
    }
  };
  const beforeProgress=updateProgress;updateProgress=function(){beforeProgress();updateLaser();};
  const beforeSync=syncPlaying;syncPlaying=function(){beforeSync();if(isGlass())startFrame();};
  const beforePlayTrack=playTrack;
  playTrack=function(id){
    playlistContext=page==='playlist' ? window.activePlaylist || '' : '';
    safeSave('spinStylePlaylistContext',playlistContext);return beforePlayTrack(id);
  };
  function frame(now) {
    animationFrame=0;
    if(!isGlass() || document.hidden){lastFrame=0;return;}
    const scene=$('#cdScene'), player=$('#player');
    if(!scene || !player || !player.getClientRects().length){lastFrame=0;return;}
    const dt=Math.min(.05,Math.max(0,(now-(lastFrame||now))/1000));lastFrame=now;
    const motion=motionAllowed(), target=motion && playing ? (drag?55:960) : 0;
    speed+=(target-speed)*Math.min(1,dt*(playing?3:4));if(speed<.05)speed=0;
    if(motion)angle=(angle+speed*dt)%360;
    scene.querySelector('.cd-disc').style.transform='rotate('+angle+'deg)';
    scene.classList.toggle('cd-active',playing && motion);scene.classList.toggle('cd-paused',!playing);
    if(!motion){speed=0;cancelMotions();scene.querySelectorAll('.cd-outgoing').forEach(n=>n.remove());}
    if(motion && (playing || speed>.05 || drag))animationFrame=requestAnimationFrame(frame);
  }
  function startFrame(){if(!animationFrame && isGlass() && !document.hidden)animationFrame=requestAnimationFrame(frame);}
  function applyStyle(next) {
    if(!available.has(next))return;
    window.spinPersistNavigation?.();
    const oldMain=$('#main')?.scrollTop||0,oldWorkspace=$('.workspace')?.scrollTop||0;
    cancelDrag();cancelMotions();
    if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;lastFrame=0;
    style=next;body.dataset.appStyle=style;safeSave(KEY,style);
    body.classList.remove('wide-lyrics','queue-open','glass-expanded','glass-wide');$('#sideQueue')?.remove();queueOpen=false;
    if(!isGlass())$('#glassSidePanel')?.remove();
    renderMain();renderPlayer();
    if($('#main'))$('#main').scrollTop=oldMain;if($('.workspace'))$('.workspace').scrollTop=oldWorkspace;
    if(page==='settings')document.querySelector('[data-app-style="'+style+'"]')?.focus({preventScroll:true});
    startFrame();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.appStyle){e.preventDefault();e.stopImmediatePropagation();applyStyle(b.dataset.appStyle);return;}
    if(!isGlass())return;
    if(b.dataset.glassPanel){
      e.preventDefault();e.stopImmediatePropagation();rightTab=b.dataset.glassPanel;
      if(rightTab==='lyrics' && !lyricsEnabled && currentTrack().id!==-1){lyricsEnabled=true;safeSave('spinLyricsVisible','true');renderPersistentLyrics();}
      else renderSidePanel();return;
    }
    if(b.id==='glassOpenLyrics'){e.preventDefault();e.stopImmediatePropagation();openLyrics(current);return;}
    if(b.id==='queueBtn'){
      e.preventDefault();e.stopImmediatePropagation();
      if(innerWidth>=1100 && !body.classList.contains('force-cover')){rightTab='queue';renderSidePanel();}
      else dialog('Очередь',queueHtml04());return;
    }
    if(b.id==='cdPanelToggle'){
      e.preventDefault();e.stopImmediatePropagation();body.classList.toggle('glass-expanded');
      b.textContent=body.classList.contains('glass-expanded')?'Показать библиотеку':'Развернуть плеер';startFrame();return;
    }
    if(b.id==='openPlayer')requestAnimationFrame(startFrame);
    if(b.id==='closePlayer'){body.classList.remove('glass-expanded');requestAnimationFrame(startFrame);}
  },true);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelDrag();cancelMotions();if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;lastFrame=0;}
    else startFrame();
  });
  window.addEventListener('resize',()=>{if(isGlass()){cancelDrag();renderSidePanel();startFrame();}});
  if(typeof ResizeObserver==='function')new ResizeObserver(startFrame).observe($('#player'));
  window.SpinAppStyle={get:()=>style,set:applyStyle,mediaFor,stop:()=>{cancelDrag();cancelMotions();if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;}};
  body.dataset.appStyle=style;renderMain();renderPlayer();
})();
