const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assets = path.join(__dirname, '../app/src/main/assets');
const source = fs.readFileSync(path.join(assets, 'release.js'), 'utf8');
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
assert(html.indexOf('id="launchCurtain"') > 0);
assert(html.indexOf('id="launchCurtain"') < html.indexOf('id="app"'));

function element() {
  const animations = [];
  const classes = new Set();
  return {
    animations,
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name)
    },
    animate(frames) {
      const animation = { frames, cancel() { this.cancelled = true; } };
      animations.push(animation);
      return animation;
    },
    append() {}, before() {}, replaceWith() {}, removeAttribute() {},
    querySelectorAll() { return []; }
  };
}
const row = element();
const fields = { b: {}, small: {}, img: {} };
row.querySelector = name => fields[name];
const ctx = vm.createContext({
  current: 3, queue: [1, 2, 3], tracks: [1,2,3].map(id => ({id, name: 'Track ' + id})),
  shuffle: false, repeat: 0, currentTrack: () => ({native: true, duration: 90}),
  $: () => ({querySelector: () => row}), position: 0, needleAngle: () => 9,
  document: { createElement: element }, activeSwap: null,
});
vm.runInContext(source.slice(source.indexOf('function updateQueueCard'), source.indexOf('renderPlayer=function(){',source.indexOf('function animateSwap'))), ctx);
ctx.updateQueueCard();
assert.equal(row.textContent,'Конец очереди');
ctx.repeat = 1;
ctx.updateQueueCard();
assert.equal(fields.b.textContent, 'Track 1');
ctx.shuffle = true;
ctx.updateQueueCard();
assert.equal(row.textContent, 'Случайный порядок');
ctx.repeat = 2;
ctx.updateQueueCard();
assert.equal(fields.b.textContent, 'Track 3');

for (const direction of [-1,1]) {
  const table = element(), disc = element(), arm = element(), old = element();
  table.querySelector = selector => selector === '#record' ? disc : arm;
  ctx.animateSwap(table, old, 31, direction);
  const frames = arm.animations[0].frames;
  assert.deepEqual(Array.from(frames, frame => frame.offset), [0,.13,.31,.69,.87,1]);
  assert.equal(frames[0].transform, 'rotate(31deg) scaleY(1)');
  assert.equal(frames[1].transform, 'rotate(31deg) scaleY(0.94)');
  assert.equal(frames[2].transform, frames[3].transform);
  assert.equal(frames[5].transform, 'rotate(9deg) scaleY(1)');
  assert.equal(disc.animations[0].frames[0].translate, -116 * direction + '% 0');
  assert.equal(old.animations[0].frames[3].translate, 116 * direction + '% 0');
  arm.animations[0].onfinish();
  assert.equal(ctx.activeSwap, null);
  assert.equal(table.classList.contains('swapping'),false);
  assert(disc.animations[0].cancelled && old.animations[0].cancelled);
}
console.log('PASS: launch layer order, queue modes, lift and park, both slide directions, transition cleanup');
