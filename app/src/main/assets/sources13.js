// Catalog metadata and the actual audio source remain separate throughout the flow.
const musicSources13 = ['YouTube', 'YouTube Music', 'Spotify', 'Яндекс Музыка', 'SoundCloud'];
let musicConnections13 = {yandex:false,spotify:false};
let spotifyCandidates13 = [], spotifyTrack13 = null, chosenSpotify13 = null;
const spotifyUrl13 = value => /^https:\/\/open\.spotify\.com\//i.test(value);
const collectionUrl13 = value => /\/(album|playlist|playlists)\//.test(value) || /[?&]list=|\/sets\//.test(value);
function requestSpotifyMatches13(url) {
  onlineToken=uid();onlineBusy=true;onlineError='';chosenSpotify13=null;
  N.spotifyMatches(onlineToken,url);renderMain();
}
requestOnline = function () {
  onlineQuery=$('#onlineQuery')?.value.trim()||onlineQuery;
  if(onlineQuery.length<2)return toast('Введи название или ссылку');
  chosenSpotify13=null;onlineToken=uid();onlineBusy=true;onlineError='';
  if(/^https:\/\//i.test(onlineQuery)) {
    if(collectionUrl13(onlineQuery))N.onlinePlaylist(onlineToken,onlineQuery);
    else if(spotifyUrl13(onlineQuery))N.spotifyMatches(onlineToken,onlineQuery);
    else N.onlineResolve(onlineToken,onlineQuery);
  } else {
    if(albumSearchMode&&onlineService==='SoundCloud'){onlineBusy=false;return toast('Подборку SoundCloud можно открыть по ссылке');}
    const source=albumSearchMode?(onlineService==='Spotify'||onlineService==='Яндекс Музыка'?onlineService+':albums':'albums'):onlineService;
    N.onlineSearch(onlineToken,onlineQuery,source);
  }
  renderMain();
};
onlineHtml04 = function () {
  const hint=onlineService==='Spotify'?'Поиск Spotify без входа. Полное аудио подбирается через spotDL на YouTube Music; перед скачиванием можно проверить запись.':onlineService==='Яндекс Музыка'?'Для прослушивания и скачивания подключи Яндекс. Доступность поиска и аудио зависит от сервиса и аккаунта.':onlineService==='SoundCloud'?'Экспериментальный источник':'Поиск публичных записей';
  return `<label class="form-label" for="source04">Источник</label><select class="field" id="source04">${musicSources13.map(name=>`<option ${name===onlineService?'selected':''}>${name}</option>`).join('')}</select><p class="muted">${hint}</p>${onlineService==='Яндекс Музыка'?'<button class="secondary" data-connect13="yandex">Подключить Яндекс</button>':''}<div class="searchbox">${icon('search')}<input id="onlineQuery" placeholder="Песня, альбом или HTTPS-ссылка" value="${esc(onlineQuery)}"><button class="icon-btn" id="onlineSearch" aria-label="Найти">${icon('search')}</button></div><div class="chips"><button class="chip ${!albumSearchMode?'active':''}" data-search-kind="songs">Песни</button><button class="chip ${albumSearchMode?'active':''}" data-search-kind="albums" ${onlineService==='SoundCloud'?'disabled':''}>Альбомы${onlineService==='YouTube'?' YouTube Music':''}</button></div>${sourceState04()}${!onlineBusy&&!onlineError?onlineResults.map((t,i)=>`<div class="track"><img src="${esc(onlineImage(t.cover))}" alt=""><div class="track-info"><b>${esc(t.name)}</b><small>${esc(t.artist||'')} · ${esc(t.service||onlineService)}${t.kind==='playlist'?' · Альбом / подборка':''}</small></div><button class="icon-btn" data-online-item="${i}" aria-label="${t.kind==='playlist'?'Открыть альбом':'Выбрать запись'}">${icon(t.kind==='playlist'?'queue':'download')}</button></div>`).join(''):''}`;
};
function connectionsCard13(){return `<div class="settings-card" id="connections13"><h3>Музыкальные сервисы</h3><div class="setting-row"><span>Яндекс Музыка<small style="display:block">${musicConnections13.yandex?'Подключено':'Не подключено'}</small></span><button class="secondary" ${musicConnections13.yandex?'data-disconnect13="yandex"':'data-connect13="yandex"'}>${musicConnections13.yandex?'Отключить':'Подключить'}</button></div><p>Spotify: публичный каталог без входа. Аудио подбирается через spotDL на YouTube Music.</p><details><summary>Резервное подключение Spotify</summary><p>Можно использовать собственное приложение Spotify Developer, если публичный каталог временно недоступен.</p><button class="secondary" ${musicConnections13.spotify?'data-disconnect13="spotify"':'data-connect13="spotify"'}>${musicConnections13.spotify?'Отключить Developer':'Настроить Developer'}</button></details><p>Подключения Яндекса и резервного API хранятся защищённо на этом телефоне.</p></div>`;}
const renderSourcesBase13=renderMain;
renderMain=function(){
  renderSourcesBase13();
  if(page==='settings'&&!$('#connections13'))$('#main').insertAdjacentHTML('beforeend',connectionsCard13());
  if(page==='search'&&onlineMode==='online')$('#main').innerHTML=onlineHtml04();
};
window.spinMusicConnections = state => {
  musicConnections13=state;
  if(page==='settings'){
    const old=$('#connections13');if(old)old.outerHTML=connectionsCard13();else renderMain();
  }
};
window.spinSpotifyMatches = result => {
  if(result.requestId!==onlineToken)return;
  onlineBusy=false;spotifyCandidates13=result.items||[];spotifyTrack13=result.track;renderMain();
  dialog('Выбрать аудио для Spotify',`<h3>${esc(spotifyTrack13.name)}</h3><p>${esc(spotifyTrack13.artist)} · ${fmt(spotifyTrack13.duration)}</p><p class="muted">Ниже записи YouTube Music. Проверь исполнителя, длительность и версию. Оригинальный аудиофайл Spotify не скачивается.</p>${spotifyCandidates13.map((candidate,index)=>`<div class="settings-card"><b>${esc(candidate.name)}</b><p>${esc(candidate.artist)} · ${fmt(candidate.duration)} · YouTube Music</p><p>${candidate.matchScore>=.9?'Близкое совпадение':'Требует проверки'} · ${esc(candidate.matcher||'YouTube Music')}</p><button class="secondary" data-match-preview13="${index}">Послушать</button> <button class="primary" data-match-choose13="${index}">Выбрать и скачать</button></div>`).join('')||'<p>Подходящие записи не найдены. Попробуй поиск YouTube Music вручную.</p>'}`);
};
const resolvedSourcesBase13=window.spinOnlineResolved;
window.spinOnlineResolved = result => {
  if(result.requestId!==onlineToken)return;
  if(chosenSpotify13){
    const original=chosenSpotify13.track,audio=result.item;
    result={...result,item:{...audio,name:original.name,artist:original.artist,album:original.album||'Скачанное',number:original.number||0,year:original.year||'',cover:original.cover||audio.cover,catalogUrl:original.url,audioSourceUrl:audio.url,service:'Spotify → YouTube Music'}};
    chosenSpotify13=null;
  }
  resolvedSourcesBase13(result);
};
const playlistSourcesBase13=window.spinOnlinePlaylist;
window.spinOnlinePlaylist = result => {
  playlistSourcesBase13(result);
  if(result.requestId!==onlineToken)return;
  const collection=result.playlist,spotify=collection.service==='Spotify',yandex=collection.service==='Яндекс Музыка';
  if(!spotify&&!yandex)return;
  const note=$('#dialogBody h3')?.nextElementSibling;
  if(note?.tagName==='P')note.textContent=collection.note||(yandex?'Доступные записи скачиваются с Яндекс Музыки в MP3. Для загрузки требуется подключённый аккаунт.':'');
  if(yandex&&$('#albumQuality'))$('#albumQuality').innerHTML='<option value="best">Лучший доступный MP3</option>';
  if(spotify){
    const checks=$('#dialogBody .checks');checks?.insertAdjacentHTML('beforebegin','<p class="muted">При загрузке альбома неуверенные совпадения будут пропущены с ошибкой. Кнопка «Послушать» позволяет подобрать отдельную песню вручную.</p>');
  }
};
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;let handled=true;
  if(button.dataset.connect13)N.connectMusicService(button.dataset.connect13);
  else if(button.dataset.disconnect13){dialog('Отключить сервис?','<p>Сохранённый доступ будет удалён с телефона. Скачанная музыка останется.</p>','<button class="secondary" data-close>Отмена</button><button class="primary" id="confirmDisconnect13">Отключить</button>');const service=button.dataset.disconnect13;$('#confirmDisconnect13').onclick=()=>{N.disconnectMusicService(service);closeDialog();};}
  else if(button.dataset.onlineItem!==undefined&&spotifyUrl13(onlineResults[Number(button.dataset.onlineItem)]?.url||'')){
    const item=onlineResults[Number(button.dataset.onlineItem)];if(item.kind==='playlist'){onlineToken=uid();onlineBusy=true;N.onlinePlaylist(onlineToken,item.url);renderMain();}else requestSpotifyMatches13(item.url);
  }
  else if(button.dataset.matchPreview13!==undefined){const item=spotifyCandidates13[Number(button.dataset.matchPreview13)];previewRequest050=uid();N.previewOnline(previewRequest050,item.url);toast('Подключаю запись YouTube Music…');}
  else if(button.dataset.matchChoose13!==undefined){const item=spotifyCandidates13[Number(button.dataset.matchChoose13)];chosenSpotify13={track:spotifyTrack13,candidate:item};onlineToken=uid();onlineBusy=true;N.onlineResolve(onlineToken,item.url);toast('Проверяю доступные форматы…');}
  else if(button.id==='onlineDownload'&&(onlineResolved?.catalogUrl||onlineResolved?.service==='Яндекс Музыка')){const format=onlineResolved.formats[Number($('#onlineFormat').value)];N.download(JSON.stringify({...onlineResolved,formatKey:format.key,album:onlineResolved.album||'Скачанное'}));closeDialog();go('downloads');toast('Запись добавляется в очередь…');}
  else handled=false;
  if(handled){event.preventDefault();event.stopImmediatePropagation();}
},true);
N.musicConnectionStatus();
