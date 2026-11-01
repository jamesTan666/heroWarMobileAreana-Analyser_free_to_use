// Manual corrections applied on top of the researched data (research/g*.js).
// Each entry fixes a mechanic the research flagged as "not representable" once the engine supports it.
module.exports = function (D) {
  const sk = (hero, name) => D[hero] && D[hero].skills.find(s => s.name === name);

  // Kayla (mobile rework): Acrobatics leaps into the CENTRE of the enemy team above 40% HP and returns below 25%.
  // Inner Flame only burns while she is in there.
  if (D.kayla) {
    D.kayla.dive = {above:40, below:25, burn:0, target:'middle'};
    D.kayla.basic = 'front';
    const flame = sk('kayla', 'Inner Flame');
    if (flame) flame.trigger = {on:'every', cd:1, whileDiving:true};
    const acro = sk('kayla', 'Acrobatics');
    if (acro) acro.trigger = {on:'dive_end'};
  }

  // Fafnir: each basic attack forges a Runic Shield for an ally (Agility heroes first). It stays dormant until
  // that ally drops below 25% HP, then becomes a real shield and stops the lethal hit. His ult hands every
  // ally the shield he was forging.
  const runic = sk('fafnir', 'Runic Shield');
  if (runic) runic.fx = [{t:'ward', target:'ally_highestAtk', n:1, f:{pct:60, stat:'patk', flat:6500}}];
  const smith = sk('fafnir', 'Blacksmith Mastery');
  if (smith) smith.fx = smith.fx.map(f => f.t === 'shield' ? {t:'ward', target:'ally_all', f:{pct:240, stat:'patk', flat:26000}} : f);
  if (D.fafnir) D.fafnir.notes = D.fafnir.notes.replace(/Runic Shield modeled[^.]*\.[^.]*\./, 'Runic Shield: a reserve shield that grows by 60% PA + 6,500 per forge, activates below 25% HP and prevents that lethal hit. Ult gives every ally a reserve shield (value estimated at about 4 forges).');

  // Cleaver: Putrefaction ticks 5% HP every 0.5 s on HIMSELF and nearby enemies (the guide's full value), so the
  // self-cost is the same tick (10% guide HP/s = 3.3% of simulated HP/s). The cloud reaches the enemy front two, not the centre.
  const putr = sk('cleaver', 'Putrefaction');
  if (putr) for (const f of putr.fx) { if (f.t === 'dot') f.n = 2; if (f.t === 'hpcost') f.pctPerSec = 3.3; }

  // Jorgen: Leper — for 10 s all physical damage the enemy team takes is redirected to their farthest hero.
  const leper = sk('jorgen', 'Leper');
  if (leper) leper.fx = [{t:'link', target:'all', to:'ally_back', pct:100, type:'phys', dur:10}];
  if (D.jorgen) D.jorgen.notes = D.jorgen.notes.replace(/Leper damage redirection.*?\)\./, 'Leper: all physical damage the enemy team takes is redirected to their farthest hero for 10 s.');

  // Aidan is a healer in Alliance.
  if (D.aidan) D.aidan.role = 'healer';
  // Flame Shield (omg.rocks + alexandregames agree): any ally that drops below 30% HP gets a strong shield,
  // at most once per ally per 15 s. Strength "depends on the team's total max health": estimated at 30% of the ally's HP.
  const fshield = sk('aidan', 'Flame Shield');
  if (fshield) { fshield.trigger = {on:'every', cd:0.5}; fshield.fx = [{t:'shield', target:'ally_critical', n:5, f:{pct:30, stat:'thp', flat:0}, dur:6, perTargetCd:15}]; }
  // Kayla's ult revives Aidan with the same HP share Kayla has (omg.rocks).
  const fury = sk('kayla', "Phoenix's Fury");
  if (fury) for (const f of fury.fx) if (f.t === 'revive') { delete f.hpPct; f.hpFromCaster = true; }
  if (D.aidan) D.aidan.notes = D.aidan.notes.replace(/Flame Shield trigger[^.]*./, 'Flame Shield: shields any ally below 30% HP, once per ally per 15 s (value estimated).');

  // Nebula: Equilibrium — her basic attacks deal no damage (they buff an ally instead).
  if (D.nebula) D.nebula.basicMult = 0;
  // Fafnir does not basic-attack enemies.
  if (D.fafnir) D.fafnir.basicMult = 0;

  // Dorian: Blood Seal vampirism aura. The guide lists "+105% Vampirism" (a rating, not a literal 105%);
  // modelled as 15% of damage dealt healed for every ally.
  const seal = sk('dorian', 'Blood Seal');
  if (seal) seal.fx = [{t:'mod', target:'ally_all', stat:'vamp', pct:15, dur:999}];

  // Astrid & Lucas: rage form loses 7% rage per hit instead of HP -> ends after ~14 hits.
  const lucas = sk('astrid', 'Go for it, Lucas!');
  if (lucas) for (const f of lucas.fx) if (f.t === 'summon') { f.hits = 14; f.hpPct = 100; f.dur = 20; }

  // Astaroth: Demon's Allegiance links him to the lowest-HP ally; he takes 48% of the PHYSICAL damage
  // dealt to that ally, reduced by 34.5% (research encoded it as a free -48% damage reduction).
  const ally = sk('astaroth', "Demon's Allegiance");
  if (ally) ally.fx = [{t:'link', target:'ally_lowest', n:1, pct:48, reduce:34.5, type:'phys', dur:1.1}];
};
