// Group 7: heroes added after the first research pass.
window.HW_G7 = {
  oya: {
    name: 'Oya', exists: true, role: 'warrior', faction: 'Way of Nature', line: 'front', pos: 26, dmgType: 'phys', basic: 'front',
    vsShield: 2,
    skills: [
      { name: 'Shieldbreaker', kind: 'ult', relic: false,
        fx: [
          { t: 'dmg', target: 'front', f: { pct: 500, stat: 'patk', flat: 2400 } },
          { t: 'dmg', target: 'shielded', n: 5, f: { pct: 375, stat: 'patk', flat: 1800 } }
        ],
        desc: 'Hits the nearest enemy for 500% PA + 2,400 and splashes 30% to marked enemies. Shielded enemies take +100% damage from all of Oya\'s skills. Legendary: 75% of the damage also hits every shielded enemy. +700 energy on kill.' },
      { name: 'Hunting', kind: 'active', cd: 25, icd: 10, relic: false,
        fx: [
          { t: 'energy', target: 'lowest', n: 1, amount: -250 },
          { t: 'mod', target: 'lowest', n: 1, stat: 'dmgTaken', pct: 15, dur: 5 },
          { t: 'mod', target: 'ally_all', stat: 'crit', pct: 8, dur: 5 }
        ],
        desc: 'Marks the lowest-HP enemy for 5 s and pulls it closer; attacks on it burn energy. Allies healed by Oya gain crit (7.5% PA + 600, doubled for Nature).' },
      { name: 'Overwhelming', kind: 'active', cd: 15, icd: 6, relic: false,
        fx: [
          { t: 'dmg', target: 'front', f: { pct: 75, stat: 'patk', flat: 9600 } },
          { t: 'dmg', target: 'same', f: { pct: 100, stat: 'patk', flat: 19200 } },
          { t: 'dmg', target: 'same', f: { pct: 125, stat: 'patk', flat: 28800 } },
          { t: 'energy', target: 'shielded', n: 5, amount: -600 }
        ],
        desc: '3 hits, each one +25% PA + 9,600 stronger than the last; shielded enemies behind the target take 50% of the growth. Legendary: each hit burns 200 energy from every shielded enemy.' },
      { name: 'Brutal Onslaught', kind: 'passive', trigger: { on: 'every', cd: 3 }, relic: false,
        fx: [ { t: 'heal', target: 'ally_lowest', n: 1, f: { pct: 2.5, stat: 'hp', flat: 600 } } ],
        desc: 'When an ally crits or breaks an enemy shield, heals that ally for 2.5% HP + 600 (doubled for Nature heroes).' },
      { name: 'Predator Bite', kind: 'passive', trigger: { on: 'every', cd: 10 }, relic: true,
        fx: [
          { t: 'dmg', target: 'front', f: { pct: 100, stat: 'patk', flat: 0 } },
          { t: 'dmg', target: 'shielded', n: 5, f: { pct: 50, stat: 'patk', flat: 0 } }
        ],
        desc: 'Every 10 s: 100% PA to the nearest enemy and 50% PA to every shielded enemy.' },
      { name: 'Huntress Fury', kind: 'passive', trigger: { on: 'battle_start' }, relic: true,
        fx: [ { t: 'mod', target: 'self', stat: 'dmgDealt', pct: 10, dur: 999 } ],
        desc: 'Each time an enemy hero gets a shield, Oya gains +20% damage for 12 s (once per enemy hero).' }
    ],
    counters: ['astaroth', 'iris', 'satori'],
    notes: 'Source: alexandregames (mobile). Shieldbreaker is her ultimate. Overwhelming\'s first-hit value is not published: hits modelled as 75/100/125% PA + 9,600/19,200/28,800. Hunting\'s energy burn is not quantified: 250 estimated, the mark is modelled as +15% damage taken; the pull is not modelled. Brutal Onslaught (triggers on ally crits/shield breaks) is approximated as a heal on the lowest ally every 3 s. Huntress Fury (+20% per shielded enemy hero) is approximated as a flat +10% damage. Stats: warrior template.'
  }
};
