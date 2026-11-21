/* Keep the existing appearance settings as the active profile for widgets and legacy controls. */
(() => {
  const storageKey = 'spinStyleColorProfiles';
  const styleKey = () => document.body.dataset.appStyle || 'vinyl';
  const keys = ['spinAccentMode', 'spinAccent', 'spinCustomBackground', 'spinBackgroundColor'];
  const defaults = style => ({
    theme: 'dark',
    spinAccentMode: 'manual',
    spinAccent: style === 'liquid-glass' ? '#a6c8ff' : '#8ab4f8',
    spinCustomBackground: 'false',
    spinBackgroundColor: null,
    transparency: 65
  });
  let profiles;
  try { profiles = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; }
  catch { profiles = {}; }
  function save() {
    const style = styleKey(), previous = profiles[style] || defaults(style);
    const values = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
    profiles[style] = {...previous, ...values, theme};
    localStorage.setItem(storageKey, JSON.stringify(profiles));
  }
  function applyGlass(profile) {
    const shell = $('#glassShell');
    if (!shell) return;
    const bg = profile.spinCustomBackground === 'true' && valid041(profile.spinBackgroundColor) ? profile.spinBackgroundColor : null;
    const transparency = Math.max(0, Math.min(85, Number(profile.transparency) || 0));
    shell.style.setProperty('--lg-glass', 'color-mix(in srgb,color-mix(in srgb,var(--surface) 87%,var(--accent)) '+(100-transparency)+'%,transparent)');
    for (const [key,value] of Object.entries({
      '--lg-base': bg,
      '--lg-cover-opacity': bg ? '0' : null,
      '--lg-ambient-opacity': bg ? '.25' : null,
      '--lg-ink': bg ? (luminance041(rgb041(bg)) > .179 ? '#121a2b' : '#f4f7ff') : null,
      '--lg-muted': bg ? (luminance041(rgb041(bg)) > .179 ? '#243049' : '#bdcde3') : null
    })) {
      if(value) shell.style.setProperty(key,value);
      else shell.style.removeProperty(key);
    }
  }
  function load() {
    const profile = {...defaults(styleKey()), ...profiles[styleKey()]};
    for (const key of keys) {
      if (profile[key] == null) localStorage.removeItem(key);
      else localStorage.setItem(key, profile[key]);
    }
    theme = ['light','dark','black'].includes(profile.theme) ? profile.theme : 'dark';
    document.body.dataset.theme = theme;
    accentMode = profile.spinAccentMode === 'album' ? 'album' : 'manual';
    accentColor = valid041(profile.spinAccent) ? profile.spinAccent : defaults(styleKey()).spinAccent;
    applyAppearance041();
    applyAccent();
    applyGlass(profile);
    if (typeof N.widgetStyle === 'function') N.widgetStyle(accentColor,widgetOpacity);
    persist();
  }
  window.SpinStyleColors = {save,load};
  if(!profiles[styleKey()]) save();
  load();

  const updateTheme = setTheme;
  setTheme = function(next) { updateTheme(next); save(); };
  const paletteKey = 'spinSavedPlayerPalettes';
  let savedPalettes;
  try { savedPalettes = JSON.parse(localStorage.getItem(paletteKey) || '{}') || {}; }
  catch { savedPalettes = {}; }

  function preset(name, style) {
    const glass = style === 'liquid-glass';
    const colors = {
      dark: ['#23252b', glass ? '#b9c6eb' : '#83c8bf', 'dark', 55],
      black: ['#000000', '#b1c3e1', 'black', 35],
      light: ['#eef2fa', glass ? '#4269a3' : '#386e64', 'light', 30],
      blue: ['#182842', '#a6c8ff', 'dark', 65]
    };
    const [background, accent, nextTheme, transparency] = colors[name];
    return {theme: nextTheme, spinAccentMode: 'manual', spinAccent: accent,
      spinCustomBackground: name === 'blue' && glass ? 'false' : 'true',
      spinBackgroundColor: background, transparency};
  }

  function renderEditor(group) {
    const style = styleKey(), glass = style === 'liquid-glass';
    const initial = {...defaults(style), ...profiles[style]};
    let draft = {...initial};
    const list = Array.isArray(savedPalettes[style]) ? savedPalettes[style] : [];
    group.innerHTML = '<h3>Цвета проигрывателя</h3><div class="spin-palette-layout"><div class="spin-palette-controls">' +
      '<div class="spin-preset-row"><button type="button" class="secondary" data-preset="dark">Тёмная</button>' +
      '<button type="button" class="secondary" data-preset="black">Чёрная</button>' +
      '<button type="button" class="secondary" data-preset="light">Светлая</button>' +
      '<button type="button" class="secondary" data-preset="blue">Синеватая</button></div>' +
      '<details><summary>Свой цвет</summary><label class="setting-row">' + (glass ? 'Оттенок стекла' : 'Акцент') +
      '<input type="color" aria-label="Выбрать цвет"><input class="field spin-palette-hex" type="text" aria-label="Акцент HEX" maxlength="7"></label>' +
      (glass ? '<label class="setting-row">Фон от обложки <input type="checkbox" data-cover-background></label><label class="setting-row">Прозрачность стекла <input data-glass-opacity type="range" min="0" max="85"></label>' :
        '<label class="setting-row">Акцент от обложки <input type="checkbox" data-cover-accent></label>') +
      '<label class="setting-row">Свой фон<input type="color" data-background aria-label="Цвет фона"><input class="field spin-palette-hex" data-background-hex type="text" aria-label="Фон HEX" maxlength="7"></label>' +
      '<button type="button" class="text-btn" data-default-background>Стандартный фон</button></details>' +
      '<div class="spin-saved-palettes"></div><form class="spin-palette-save"><input class="field" name="name" aria-label="Имя палитры" placeholder="Имя палитры" required maxlength="48">' +
      '<button class="secondary">Сохранить как палитру</button></form>' +
      '<div class="spin-preset-row"><button type="button" class="secondary" data-cancel-palette>Отмена</button><button type="button" class="primary" data-apply-palette>Применить</button></div></div>' +
      '<div class="spin-palette-preview"><small>Предпросмотр</small><div class="spin-preview-surface"><b>Сейчас играет</b><div class="spin-preview-media" aria-hidden="true"></div>' +
      '<span class="spin-preview-play" aria-hidden="true">▶</span><div class="spin-preview-tab">Библиотека</div></div></div></div>';
    const accent = group.querySelector('input[type=color]'), hex = group.querySelector('input[aria-label="Акцент HEX"]');
    const background = group.querySelector('[data-background]'), backgroundHex = group.querySelector('[data-background-hex]');
    const cover = group.querySelector('[data-cover-background]'), coverAccent = group.querySelector('[data-cover-accent]');
    const opacity = group.querySelector('[data-glass-opacity]');
    const preview = group.querySelector('.spin-palette-preview');
    if (glass) preview.classList.add('spin-preview-cd');
    function draw(sync = true) {
      const a = valid041(draft.spinAccent) ? draft.spinAccent : defaults(style).spinAccent;
      const custom = draft.spinCustomBackground === 'true';
      const bg = custom && valid041(draft.spinBackgroundColor) ? draft.spinBackgroundColor :
        draft.theme==='light'?'#eef2fa':draft.theme==='black'?'#000000':glass?'#182842':'#23252b';
      if (sync) {
        accent.value = hex.value = a;
        background.value = backgroundHex.value = bg;
        if (cover) cover.checked = !custom;
        if (coverAccent) coverAccent.checked = draft.spinAccentMode === 'album';
        if (opacity) opacity.value = draft.transparency;
      }
      preview.style.setProperty('--preview-bg', bg);
      preview.style.setProperty('--preview-accent', a);
      preview.style.setProperty('--preview-glass', (100 - draft.transparency) + '%');
      preview.style.setProperty('--preview-ink', luminance041(rgb041(bg)) > .179 ? '#131824' : '#f5f6fb');
      preview.style.setProperty('--preview-onaccent', luminance041(rgb041(a)) > .179 ? '#131824' : '#f5f6fb');
    }
    function persistPalettes() {
      savedPalettes[style] = list;
      localStorage.setItem(paletteKey, JSON.stringify(savedPalettes));
    }
    function drawSaved() {
      const host = group.querySelector('.spin-saved-palettes');
      host.replaceChildren();
      if (!list.length) return;
      const title = document.createElement('b');
      title.textContent = 'Мои палитры';
      host.append(title);
      list.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'spin-preset-row';
        for (const [action,label] of [['load',item.name],['rename','Переименовать'],['delete','Удалить']]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary';
          button.dataset.paletteAction = action;
          button.dataset.paletteIndex = index;
          button.textContent = label;
          row.append(button);
        }
        host.append(row);
      });
    }
    group.addEventListener('input', e => {
      const control = e.target;
      if (control === accent || control === hex) {
        if (!valid041(control.value)) return;
        draft.spinAccent = control.value;
        draft.spinAccentMode = 'manual';
        accent.value = hex.value = control.value;
        if (coverAccent) coverAccent.checked = false;
      } else if (control === background || control === backgroundHex) {
        if (!valid041(control.value)) return;
        draft.spinCustomBackground = 'true';
        draft.spinBackgroundColor = control.value;
        background.value = backgroundHex.value = control.value;
        if (cover) cover.checked = false;
      } else if (control === cover) {
        draft.spinCustomBackground = cover.checked ? 'false' : 'true';
        if (!cover.checked && !valid041(draft.spinBackgroundColor)) draft.spinBackgroundColor = background.value;
      } else if (control === coverAccent) draft.spinAccentMode = coverAccent.checked ? 'album' : 'manual';
      else if (control === opacity) draft.transparency = Number(control.value);
      draw(false);
    });
    group.addEventListener('click', e => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.dataset.preset) { draft = preset(button.dataset.preset,style); draw(); }
      if (button.hasAttribute('data-default-background')) { draft.spinCustomBackground = 'false'; draw(); }
      if (button.hasAttribute('data-cancel-palette')) { draft = {...initial}; draw(); }
      if (button.hasAttribute('data-apply-palette')) {
        profiles[style] = {...draft};
        localStorage.setItem(storageKey, JSON.stringify(profiles));
        load();
        renderMain();
      }
      const action = button.dataset.paletteAction, index = Number(button.dataset.paletteIndex);
      const item = list[index];
      if (!action || !item) return;
      if (action === 'load') { draft = {...defaults(style),...item.profile}; draw(); return; }
      if (action === 'delete' && window.confirm('Удалить палитру «' + item.name + '»?')) list.splice(index,1);
      if (action === 'rename') {
        const value = window.prompt('Имя палитры', item.name);
        if (value?.trim()) item.name = value.trim().slice(0,48);
      }
      persistPalettes();
      drawSaved();
    });
    group.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const input = e.currentTarget.elements.name;
      const name = input.value.trim().slice(0,48);
      if (!name) return;
      list.push({name,profile:{...draft}});
      input.value = '';
      persistPalettes();
      drawSaved();
    });
    drawSaved();
    draw();
  }

  const render = renderMain;
  renderMain = function() {
    render();
    applyGlass(profiles[styleKey()] || defaults(styleKey()));
    if(page!=='settings')return;
    const group = $('#accentMode')?.closest('.settings-card');
    if (group) renderEditor(group);
  };
  renderMain();
})();
