// Headless checks: node src/test.js   (run after build.js)
const path = require('path');
const E = require('./engine.js');
global.window = {};
const src = require('fs').readFileSync(path.join(__dirname, 'heroes.generated.js'), 'utf8');
const HERO_DATA = new Function(src + '; return HERO_DATA;')();
E.setHeroes(E.prepareHeroes(HERO_DATA));
const H = E.getHeroes();
const mk = k => ({key:k, level:120, stars:6, ovr:null});
const team = ks => ks.filter(k => H[k] || console.log('  (missing hero ' + k + ')')).map(mk);

function run(A, B, N = 500, opts = {}){
  let w = 0, t = 0, to = 0; const first = {};
  for (let i = 0; i < N; i++) {
    const b = new E.Battle(team(A), team(B), {limit:90, ...opts});
    let f = null;
    while (!b.over) { b.step(0.1); if (!f) { const d = b.units.find(u => u.side === 'B' && !u.alive && !u.summon); if (d) f = d.name; } }
    if (b.winner === 'A') w++; t += b.t; if (b.timeout) to++;
    first[f] = (first[f] || 0) + 1;
  }
  console.log(`${A.join(',')}  vs  ${B.join(',')}\n   attack win ${(w/N*100).toFixed(0)}%  avg ${(t/N).toFixed(0)}s  timeouts ${to}  first defender to die: ` +
    Object.entries(first).sort((a,b) => b[1]-a[1]).slice(0,3).map(([k,v]) => `${k} ${(v/N*100)|0}%`).join(', '));
  return w/N;
}
function logOne(A, B){
  const b = new E.Battle(team(A), team(B), {limit:90, vis:true}).runToEnd(0.05);
  console.log(b.log.map(l => `[${l.t.toFixed(1)}] ${l.msg}`).join('\n'));
}
module.exports = {run, logOne, H, E, mk};
if (require.main === module) {
  const arg = process.argv[2];
  const K = ['julius','kayla','keira','aidan','orion'], S = ['julius','folio','somna','iris','maya'];
  if (arg === 'log') logOne(K, S);
  else {
    console.log(Object.keys(H).length + ' heroes loaded');
    run(K, S); run(S, K);
    run(K, ['julius','galahad','keira','celeste','orion']);
    // smoke: random teams must not crash
    const keys = Object.keys(H); let n = 0;
    for (let i = 0; i < 3000; i++) { const s = E.shuffle([...keys]); new E.Battle(team(s.slice(0,5)), team(s.slice(5,10)), {limit:90}).runToEnd(0.1); n++; }
    console.log(`smoke: ${n} random battles OK`);
  }
}
