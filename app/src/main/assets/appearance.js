// Appearance preferences; independent from album artwork and vinyl texture.
function rgb041(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function hex041(rgb){return '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('')}
function valid041(v){return /^#[0-9a-f]{6}$/i.test(v||'')}
function luminance041(rgb){return rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
function applyAppearance041(){
 document.body.classList.toggle('show-seekbar',localStorage.getItem('spinShowSeekbar')==='true');
 const props=['--bg','--surface','--surface2','--surface3','--text','--muted','--line'];
 props.forEach(p=>document.body.style.removeProperty(p));
 const bg=localStorage.getItem('spinBackgroundColor');
 if(localStorage.getItem('spinCustomBackground')==='true'&&valid041(bg)){
  const rgb=rgb041(bg),light=luminance041(rgb)>.179,ink=light?'#17181c':'#f4f5f7',mix=light?0:255;
  document.body.style.setProperty('--bg',bg);
  [0.05,0.09,0.14].forEach((n,i)=>document.body.style.setProperty(['--surface','--surface2','--surface3'][i],hex041(rgb.map(v=>v*(1-n)+mix*n))));
  document.body.style.setProperty('--text',ink);document.body.style.setProperty('--muted',light?'#45464c':'#bec2ca');document.body.style.setProperty('--line',light?'#00000020':'#ffffff20');
 }
}
const accent041=setAccentColor;setAccentColor=function(color){accent041(color);const c=getComputedStyle(document.body).getPropertyValue('--accent').trim();const probe=document.createElement('span');probe.style.color=c;document.body.append(probe);const rgb=getComputedStyle(probe).color.match(/[\d.]+/g)?.slice(0,3).map(Number);probe.remove();if(rgb)for(const el of [document.body,document.documentElement])el.style.setProperty('--onaccent',luminance041(rgb)>.179?'#101116':'#ffffff')};
const theme041=setTheme;setTheme=function(t){theme041(t);applyAppearance041()};
const main041=renderMain;renderMain=function(){main041();if(page==='settings'){
 const card=$('#accentMode')?.closest('.settings-card');if(card){card.querySelector('h3').textContent='Цвета интерфейса';card.querySelectorAll('p').forEach(el=>el.remove());$('#main').prepend(card);
 card.insertAdjacentHTML('beforeend',`<label class="setting-row">Свой цвет фона<input type="checkbox" role="switch" class="switch04" id="customBackground041" ${localStorage.getItem('spinCustomBackground')==='true'?'checked':''}></label><label class="setting-row">Фон<input type="color" id="backgroundColor041" value="${valid041(localStorage.getItem('spinBackgroundColor'))?localStorage.getItem('spinBackgroundColor'):'#17181c'}"></label><button class="text-btn" id="resetColors041">Сбросить цвета</button>`)}
 $('#main').insertAdjacentHTML('afterbegin',`<div class="settings-card"><h3>Управление плеером</h3><label class="setting-row">Полоса перемотки<input type="checkbox" role="switch" class="switch04" id="showSeekbar041" ${localStorage.getItem('spinShowSeekbar')==='true'?'checked':''}></label><button class="text-btn" id="showIntro041">Знакомство с приложением</button></div>`);
 // Keep error messages, storage deletion details and service availability information.
 $$('.settings-card p').filter(el=>/Экран выключается|Цвет кнопок виджетов/.test(el.textContent)).forEach(el=>el.remove());
 }applyAppearance041()};
document.addEventListener('change',e=>{if(e.target.id==='showSeekbar041'){localStorage.setItem('spinShowSeekbar',e.target.checked);applyAppearance041()}if(e.target.id==='customBackground041'){localStorage.setItem('spinCustomBackground',e.target.checked);applyAppearance041()}});
document.addEventListener('input',e=>{if(e.target.id==='backgroundColor041'&&valid041(e.target.value)){localStorage.setItem('spinBackgroundColor',e.target.value);localStorage.setItem('spinCustomBackground','true');$('#customBackground041').checked=true;applyAppearance041()}if(e.target.id==='accentColor'&&accentMode!=='manual'){accentMode='manual';localStorage.setItem('spinAccentMode','manual');$('#accentMode').value='manual';applyAccent()}});
const introPages041=[['Твоя музыка','Добавь музыкальную папку в библиотеку. Поиск в библиотеке ищет твои файлы, а поиск в «Загрузках» — музыку в интернете.','folder'],['Перемотка иглой','Захвати кончик иглы и перемести его. Пока держишь иглу, звук на паузе. Обычную полосу перемотки можно включить в настройках.','music'],['Текст и очередь','Кнопка «Текст» открывает слова песни. Свой TXT или LRC можно добавить в параметрах текста. В очереди меняй порядок треков за ручку.','queue'],['Твой внешний вид','Выбери тему, цвет акцента, свой фон и плотность интерфейса в настройках. Это знакомство можно открыть там повторно.','settings']];
let introStep041=0;
function drawIntro041(){const [title,body,glyph]=introPages041[introStep041];let el=$('#intro041');if(!el){el=document.createElement('dialog');el.id='intro041';document.body.append(el)}el.innerHTML=`<div class="intro-glyph">${icon(glyph)}</div><small>${introStep041+1} / ${introPages041.length}</small><h2>${title}</h2><p>${body}</p><div class="intro-actions"><button id="skipIntro041" class="text-btn">Пропустить</button>${introStep041?'<button id="backIntro041" class="secondary">Назад</button>':''}<button id="nextIntro041" class="primary">${introStep041===introPages041.length-1?'Готово':'Далее'}</button></div>`;el.oncancel=e=>{e.preventDefault();finishIntro041()};if(!el.open)el.showModal()}
function finishIntro041(){localStorage.setItem('spinIntroSeen','true');$('#intro041')?.close();$('#intro041')?.remove()}
window.startIntro=()=>{if(!$('#activation04')&&localStorage.getItem('spinIntroSeen')!=='true'){introStep041=0;drawIntro041()}};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='resetColors041'){localStorage.removeItem('spinCustomBackground');localStorage.removeItem('spinBackgroundColor');accentMode='manual';accentColor='#8ab4f8';localStorage.setItem('spinAccentMode',accentMode);localStorage.setItem('spinAccent',accentColor);applyAccent();N.widgetStyle(accentColor,widgetOpacity);renderMain()}if(b.id==='showIntro041'){introStep041=0;drawIntro041()}if(b.id==='skipIntro041')finishIntro041();if(b.id==='backIntro041'){introStep041--;drawIntro041()}if(b.id==='nextIntro041'){if(introStep041===introPages041.length-1)finishIntro041();else{introStep041++;drawIntro041()}}});
applyAppearance041();applyAccent();renderMain();window.startIntro();
