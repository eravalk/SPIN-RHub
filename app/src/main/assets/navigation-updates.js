(() => {
  const storageKey = 'spinNavigationPositionsV2';
  const keyForView = () => JSON.stringify([page, ...({
    library: category === 'folders' ? [category, folderRoot050, folderPath050] : [category],
    album: [activeAlbum], artist: [activeArtist], playlist: [window.activePlaylist],
    downloads: [downloadTab], search: [search]
  }[page] || [])]);
  const regions = () => ({
    document: document.scrollingElement, workspace: document.querySelector('.workspace'),
    main: document.getElementById('main'), glass: document.querySelector('.lg-browser'), player: document.getElementById('player'),
    queue: document.getElementById('sideQueue')
  });
  const positions = new Map();
  let tabsLeft = Number(localStorage.getItem('spinLibraryTabsLeft')) || 0;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) for (const [key, value] of saved.slice(-160)) {
      if (typeof key !== 'string' || key.length > 4096 || !value || typeof value !== 'object') continue;
      const offsets = {};
      for (const name of ['document', 'workspace', 'main', 'player', 'queue', 'glass']) {
        const y = value.offsets?.[name];
        if (Number.isFinite(y) && y >= 0) offsets[name] = y;
      }
      const anchor = value.anchor && typeof value.anchor.id === 'string' && Number.isFinite(value.anchor.delta) && Number.isFinite(value.anchor.width) ? value.anchor : null;
      positions.set(key, {offsets, anchor, details: Array.isArray(value.details) ? value.details.filter(x => typeof x === 'string').slice(0, 40) : []});
    }
  } catch {}
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let displayed = keyForView(), restoring = false, restoreFrame = 0, awaitingContent = false;
  const details = () => [...document.querySelectorAll('#main details')];
  const detailKey = el => el.querySelector('summary')?.textContent.trim() || '';
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify([...positions].slice(-160))); } catch {}
  }
  function albumAnchor() {
    if (displayed !== '["library","albums"]') return null;
    const bar=document.querySelector('.library-tabs');
    if (!bar?.getClientRects().length) return null;
    const top=bar.getBoundingClientRect().bottom;
    const tile=[...document.querySelectorAll('#main .album-tile[data-album]')].find(el=>el.getBoundingClientRect().bottom>top+1);
    return tile ? {id:tile.dataset.album,delta:tile.getBoundingClientRect().top-top,width:document.getElementById('main').clientWidth} : null;
  }
  function remember() {
    if (restoring || awaitingContent || document.querySelector('#glassShell[data-view=player]')) return;
    const tabs = document.querySelector('.library-tabs');
    if (tabs && tabs.scrollWidth > tabs.clientWidth && tabs.getClientRects().length) {
      tabsLeft = tabs.scrollLeft;
      try { localStorage.setItem('spinLibraryTabsLeft', String(tabsLeft)); } catch {}
    }
    const offsets = {};
    for (const [name, el] of Object.entries(regions())) if (el) offsets[name] = el.scrollTop;
    positions.delete(displayed);
    positions.set(displayed, {offsets, anchor:albumAnchor(), details: details().filter(el => el.open).map(detailKey)});
    while (positions.size > 160) positions.delete(positions.keys().next().value);
    persist();
  }
  function restore() {
    cancelAnimationFrame(restoreFrame);
    restoring = true;
    const target = positions.get(displayed);
    if (target) for (const el of details()) el.open = target.details.includes(detailKey(el));
    const apply = () => {
      awaitingContent = false;
      const tabs = document.querySelector('.library-tabs');
      if (tabs) tabs.scrollLeft = tabsLeft;
      for (const [name, el] of Object.entries(regions())) {
        if (!el) continue;
        if (el.closest?.('[hidden]') || (typeof el.getClientRects === 'function' && !el.getClientRects().length && name === 'glass')) continue;
        const cross = name === 'glass' ? target?.offsets.document : name === 'document' ? target?.offsets.glass : undefined;
        const y = target?.offsets[name] ?? cross ?? 0;
        el.scrollTop = y;
        if (y > 0 && el.scrollHeight <= el.clientHeight && page !== 'settings') awaitingContent = true;
      }
      const anchor=target?.anchor;
      const main=document.getElementById('main');
      if (anchor && main && Math.abs(main.clientWidth-anchor.width)>2){
        const tile=[...main.querySelectorAll('.album-tile[data-album]')].find(el=>el.dataset.album===anchor.id);
        const bar=main.querySelector('.library-tabs');
        const scroller=regions().glass || document.scrollingElement;
        if(tile && bar && scroller && bar.getClientRects().length){
          scroller.scrollTop+=tile.getBoundingClientRect().top-bar.getBoundingClientRect().bottom-anchor.delta;
        }
      }
    };
    apply();
    restoreFrame = requestAnimationFrame(() => {
      apply();
      restoreFrame = requestAnimationFrame(() => { restoring = false; });
    });
  }
  for (const type of ['touchstart', 'wheel', 'keydown', 'pointerdown']) {
    document.addEventListener(type, () => { awaitingContent = false; }, {passive: true, capture: true});
  }
  document.addEventListener('scroll', remember, true);
  document.addEventListener('toggle', () => { if (!restoring) remember(); }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) remember(); });
  window.addEventListener('pagehide', remember);
  window.spinPersistNavigation = remember;
  window.spinRestoreNavigation = restore;
  window.spinSuspendNavigation = () => { awaitingContent = true; };
  window.addEventListener('resize', () => {
    if (page === 'library' && category === 'albums') restore();
  });
  let status = 'idle', availableVersion = '', notes = '', manual = false, starting = false;
  let download = {status: 'idle'};
  const labels = {
    idle: '', checking: 'Проверяем…', current: 'Установлена актуальная версия',
    missing: 'Релиз с APK пока недоступен', error: 'Не удалось связаться с GitHub'
  };
  function updateControls() {
    const message = document.getElementById('updateStatus');
    if (!message) return;
    const active = download.status === 'downloading', ready = download.status === 'ready';
    let text = status === 'available' ? 'Доступна версия ' + availableVersion : labels[status];
    if (download.status === 'failed') text = download.message || 'Загрузка не удалась. Попробуй ещё раз.';
    if (active) {
      const percent = download.size > 0 ? Math.min(100, Math.floor(download.bytes * 100 / download.size)) : null;
      text = (download.paused ? 'Ожидание сети · ' : 'Скачивание · ') + (percent === null ? '' : percent + '%');
    }
    if (ready) text = 'Версия ' + download.version + ' скачана. Можно установить обновление.';
    if (starting) text = 'Подготавливаем скачивание…';
    message.textContent = text || '';
    document.getElementById('checkUpdate').disabled = status === 'checking' || starting || active;
    const button = document.getElementById('downloadUpdate');
    button.hidden = !(status === 'available' || download.status === 'failed') || ready;
    button.disabled = starting || active;
    button.textContent = download.status === 'failed' ? 'Повторить скачивание' : 'Скачать';
    document.getElementById('installUpdate').hidden = !ready;
    const progress = document.getElementById('updateProgress');
    progress.hidden = !active;
    if (download.size > 0) progress.value = Math.min(100, download.bytes * 100 / download.size);
    else progress.removeAttribute('value');
    document.getElementById('updateNotes').textContent = notes;
    document.getElementById('updateNotes').hidden = !notes;
  }
  function addControls() {
    if (page !== 'settings' || document.getElementById('checkUpdate')) return;
    const group = [...document.querySelectorAll('#main details')].find(el => detailKey(el) === 'О приложении');
    const host = group?.lastElementChild || document.getElementById('main');
    host.insertAdjacentHTML('beforeend', '<section class="settings-card"><h3>Обновления</h3><button class="secondary" id="checkUpdate">Проверить обновления</button> <button class="primary" id="downloadUpdate" hidden>Скачать</button> <button class="primary" id="installUpdate" hidden>Установить</button><p role="status" id="updateStatus"></p><progress id="updateProgress" max="100" hidden aria-label="Скачивание обновления"></progress><p id="updateNotes" style="white-space:pre-wrap" hidden></p></section>');
    updateControls();
  }
  const render = renderMain;
  renderMain = function () {
    remember();
    render();
    addControls();
    displayed = keyForView();
    restore();
  };
  function check(byUser) {
    manual ||= byUser;
    if (status === 'checking') return;
    status = 'checking';
    updateControls();
    N.checkAppUpdate();
  }
  window.spinUpdateResult = result => {
    starting = false;
    status = result.status in labels || result.status === 'available' ? result.status : 'error';
    availableVersion = result.version || '';
    notes = result.notes || '';
    updateControls();
    if (status === 'available' && !manual && download.status !== 'ready') toast('Доступна версия ' + availableVersion + ' · Настройки → О приложении');
    manual = false;
  };
  window.spinAppDownload = result => {
    if (starting && result.status === 'idle') return;
    if (download.status === 'failed' && result.status === 'idle') return;
    const becameReady = result.status === 'ready' && download.status !== 'ready';
    download = result;
    starting = false;
    updateControls();
    if (becameReady) toast('Обновление скачано · Настройки → О приложении → Установить');
  };
  document.addEventListener('click', event => {
    const id = event.target.closest('button')?.id;
    if (id === 'checkUpdate') check(true);
    if (id === 'downloadUpdate' && !starting && download.status !== 'downloading' && download.status !== 'ready'
        && (status === 'available' || download.status === 'failed')) {
      starting = true; updateControls(); N.downloadAppUpdate();
    }
    if (id === 'installUpdate' && download.status === 'ready') N.installAppUpdate();
  });
  addControls();
  restore();
  setTimeout(() => check(false), 1500);
})();
