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
    shell.style.setProperty('--lg-glass', 'color-mix(in srgb,var(--surface) '+(100-transparency)+'%,transparent)');
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
  let editor, editedId, draft;
  function preview(value) {
    if (!valid041(value)) return;
    draft = value;
    editor.querySelector('.color-preview').style.setProperty('--sample',value);
    editor.querySelectorAll('[data-channel]').forEach((input,i) => { input.value=rgb041(value)[i]; });
    if(editedId==='accentColor') setAccentColor(value);
    else applyGlass({...profiles[styleKey()],spinCustomBackground:'true',spinBackgroundColor:value});
  }
  function openColor(id) {
    editedId=id;
    const initial=document.getElementById(id)?.value;
    draft=valid041(initial)?initial:'#8ab4f8';
    editor=document.createElement('dialog');
    editor.id='spinColorEditor';
    editor.setAttribute('aria-labelledby','spinColorTitle');
    editor.innerHTML=`<form>
      <h2 id="spinColorTitle">${id==='accentColor'?'Цвет акцента':'Цвет фона'}</h2>
      <div class="color-presets">${['#8ab4f8','#83ddcc','#f2adc9','#c7afff','#ffd9a0','#121622','#000000','#f4f3ff'].map(color=>`<button type="button" data-color="${color}" aria-label="${color}" style="--sample:${color}"></button>`).join('')}</div>
      <div class="color-fields">${['Красный','Зелёный','Синий'].map((name,i)=>`<label>${name}<input type="range" min="0" max="255" data-channel="${i}"></label>`).join('')}</div>
      <label>HEX <input name="hex" value="${draft}" size="9" required maxlength="7" pattern="#[a-fA-F0-9]{6}"></label>
      <div class="color-preview">Предпросмотр цвета</div>
      <div class="actions"><button class="secondary" type="button" data-cancel-color>Отмена</button><button class="primary">Применить</button></div>
    </form>`;
    const input=editor.querySelector('input[name=hex]');
    editor.addEventListener('click', event => {
      const button=event.target.closest('button');
      if(button?.dataset.color){ input.value=button.dataset.color;preview(input.value); }
      if(button?.hasAttribute('data-cancel-color')) editor.close();
    });
    editor.addEventListener('input', event => {
      if(event.target.hasAttribute('data-channel')){
        input.value=hex041([...editor.querySelectorAll('[data-channel]')].map(node=>Number(node.value)));
      }
      preview(input.value);
    });
    editor.addEventListener('submit', event => {
      event.preventDefault();
      if(!valid041(input.value))return;
      const control=document.getElementById(id);
      if(control){control.value=input.value;control.dispatchEvent(new Event('input',{bubbles:true}));}
      save();
      editor.close();
      renderMain();
    });
    editor.addEventListener('close', () => {
      editor.remove();
      editor=null;
      applyAccent();
      applyGlass(profiles[styleKey()]||defaults(styleKey()));
    },{once:true});
    document.body.append(editor);
    editor.showModal();
    preview(draft);
  }
  const render = renderMain;
  renderMain = function() {
    render();
    applyGlass(profiles[styleKey()] || defaults(styleKey()));
    if(page!=='settings')return;
    for(const id of ['accentColor','backgroundColor041']){
      const control=document.getElementById(id);
      if(!control || control.type==='hidden')continue;
      const color=valid041(control.value)?control.value:'#000000';
      control.type='hidden';
      const button=document.createElement('button');
      button.type='button';
      button.className='secondary spin-color-swatch';
      button.setAttribute('aria-label',id==='accentColor'?'Изменить цвет акцента':'Изменить цвет фона');
      button.innerHTML=`<i style="--sample:${color}"></i>`;
      button.addEventListener('click',()=>openColor(id));
      control.after(button);
    }
    const group=$('#accentMode')?.closest('.settings-card');
    if(group) group.querySelector('h3').textContent='Цвета · '+(styleKey()==='vinyl'?'Винил':'Liquid Glass');
    if(group && styleKey()==='liquid-glass' && !group.querySelector('#glassTransparency')){
      const value=profiles[styleKey()]?.transparency ?? defaults(styleKey()).transparency;
      group.insertAdjacentHTML('beforeend',`<label class="setting-row">Прозрачность стекла
        <input id="glassTransparency" type="range" min="0" max="85" value="${value}" aria-label="Прозрачность стекла"></label>`);
    }
  };
  const back=window.spinBack;
  window.spinBack=function(){if(editor?.open){editor.close();return;}return back();};
  document.addEventListener('input', e=>{
    if (['accentColor','backgroundColor041'].includes(e.target.id)) { save();applyGlass(profiles[styleKey()]); }
    if (e.target.id==='glassTransparency'){
      profiles[styleKey()].transparency=Number(e.target.value);save();applyGlass(profiles[styleKey()]);
    }
  });
  document.addEventListener('change', e=>{
    if (['accentMode','customBackground041'].includes(e.target.id)) {save();applyGlass(profiles[styleKey()]);}
  });
  document.addEventListener('click', e=>{
    if(e.target.closest('#resetColors041')){
      profiles[styleKey()]=defaults(styleKey());
      load();save();renderMain();
    }
  });
  renderMain();
})();
