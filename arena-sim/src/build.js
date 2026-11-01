// Builds ../index.html (single offline file) from template + engine + hero data + app.
// Usage: node src/build.js
const fs = require('fs'), path = require('path');
const dir = __dirname, root = path.join(dir, '..');

// 1. merge researched hero data (research/g*.js) and apply manual corrections (overrides.js)
global.window = {};
const data = {};
for (const f of fs.readdirSync(path.join(root, 'research')).filter(f => /^g\d+\.js$/.test(f)).sort()) {
  require(path.join(root, 'research', f));
}
for (const k of Object.keys(window).sort()) Object.assign(data, window[k]);
require(path.join(dir, 'overrides.js'))(data);

// 2. validate
const FX = new Set(['dmg','dot','heal','hot','shield','cc','mod','energy','revive','summon','cleanse','dispel','immune','stealth','taunt','block','hpcost','link','ward']);
const TG = new Set(['middle','shielded','front','back','lowest','highest','random','all','highestPatk','highestMatk','highestAtk','nearby','same','attacker','self',
  'ally_all','ally_lowest','ally_front','ally_back','ally_highestAtk','ally_dead','ally_random','ally_critical', undefined]);
const ON = new Set(['battle_start','attacked','hit','crit','ult','kill','ally_death','death','hp_below','ally_debuffed','every','wake','dive_end']);
const CC = new Set(['stun','sleep','sheep','silence','blind','freeze','charm','fear','root','knockback']);
const problems = [];
let live = 0;
for (const [k, h] of Object.entries(data)) {
  if (h.exists === false) continue;
  live++;
  if (!h.skills || !h.skills.some(s => s.kind === 'ult')) problems.push(`${k}: no ult`);
  for (const s of h.skills || []) {
    if (s.kind === 'passive' && s.trigger && !ON.has(s.trigger.on)) problems.push(`${k}/${s.name}: trigger ${s.trigger.on}`);
    if (s.kind === 'passive' && !s.trigger) problems.push(`${k}/${s.name}: passive without trigger`);
    for (const f of s.fx || []) {
      if (!FX.has(f.t)) problems.push(`${k}/${s.name}: fx ${f.t}`);
      if (!TG.has(f.target)) problems.push(`${k}/${s.name}: target ${f.target}`);
      if (f.t === 'cc' && !CC.has(f.s)) problems.push(`${k}/${s.name}: cc ${f.s}`);
    }
  }
}
if (problems.length) console.log('VALIDATION:\n  ' + problems.join('\n  '));

// 3. bundle
const heroesJs = 'const HERO_DATA = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(path.join(dir, 'heroes.generated.js'), heroesJs);
const engine = fs.readFileSync(path.join(dir, 'engine.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(dir, 'template.html'), 'utf8')
  .replace('/*BUNDLE*/', () => engine + '\n' + heroesJs + '\n' + app);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`built index.html — ${live} heroes, ${problems.length} validation issues, ${(html.length/1024).toFixed(0)} KB`);
