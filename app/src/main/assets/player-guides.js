(() => {
  const guides = {
    vinyl: ['Виниловый проигрыватель', 'Возьми иглу за кончик и перетащи её по пластинке. Отпусти иглу на нужном месте, чтобы перейти к нему.'],
    'liquid-glass': ['CD-проигрыватель', 'Возьми светящуюся точку на диске и перетащи её ближе к центру диска или к краю. На корешке коробки указано название альбома или плейлиста.']
  };

  function showGuide(style, manual = false) {
    const guide = guides[style];
    if (!guide) return;
    const key = 'spinPlayerGuideSeen:' + style;
    if (!manual && (localStorage.getItem(key) === 'true' || document.querySelector('dialog[open]') || document.getElementById('activation04'))) return;
    localStorage.setItem(key, 'true');
    dialog(guide[0], '<p>' + guide[1] + '</p><p>Обычную полоску перемотки можно включить в настройках управления плеером.</p>',
      '<button type="button" class="primary" data-close>Готово</button>');
  }

  window.spinShowPlayerGuide = showGuide;
  const render = renderMain;
  renderMain = function() {
    render();
    if (page === 'settings' && !document.getElementById('playerGuideSettings')) {
      document.getElementById('main').insertAdjacentHTML('beforeend',
        '<details class="settings-card" id="playerGuideSettings"><summary>Подсказки</summary>' +
        '<button type="button" class="secondary" id="showIntro041">Знакомство с приложением</button> ' +
        '<button type="button" class="secondary" data-player-guide="vinyl">Виниловый проигрыватель</button> ' +
        '<button type="button" class="secondary" data-player-guide="liquid-glass">CD-проигрыватель</button></details>');
    }
  };

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-player-guide],#openPlayer');
    if (!target) return;
    if (target.dataset.playerGuide) showGuide(target.dataset.playerGuide, true);
    else if (document.body.dataset.appStyle === 'vinyl') showGuide('vinyl');
  });
})();
