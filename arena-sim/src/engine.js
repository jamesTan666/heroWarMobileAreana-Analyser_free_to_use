'use strict';
/* =====================================================================
   Arena battle engine. Executes hero kits described in the data format
   (see heroes.js): formulas "pct% stat + flat", CC, stacks, triggers,
   summons, executes, revives, dives.
   ===================================================================== */

// Endgame-ish stat templates per role (Lv120 / 6★ reference — max level in Alliance). Hero data scales these.
const ROLE_T = {
  tank:     {hp:1600000, patk:90000,  matk:90000,  armor:90000, mdef:80000, apen:0,     mpen:0,     crit:5,  dodge:5,  aspd:1.9},
  warrior:  {hp:1100000, patk:170000, matk:30000,  armor:60000, mdef:50000, apen:40000, mpen:0,     crit:20, dodge:10, aspd:1.5},
  mage:     {hp:800000,  patk:20000,  matk:200000, armor:40000, mdef:50000, apen:0,     mpen:40000, crit:0,  dodge:5,  aspd:1.8},
  marksman: {hp:700000,  patk:180000, matk:20000,  armor:40000, mdef:40000, apen:40000, mpen:0,     crit:30, dodge:10, aspd:1.4},
  healer:   {hp:850000,  patk:20000,  matk:160000, armor:45000, mdef:60000, apen:0,     mpen:20000, crit:0,  dodge:5,  aspd:1.9},
  support:  {hp:900000,  patk:60000,  matk:150000, armor:50000, mdef:60000, apen:0,     mpen:20000, crit:5,  dodge:5,  aspd:1.8},
  control:  {hp:800000,  patk:60000,  matk:180000, armor:40000, mdef:50000, apen:0,     mpen:30000, crit:5,  dodge:8,  aspd:1.8},
};
const STATS = ['hp','patk','matk','armor','mdef','apen','mpen','crit','dodge','aspd'];
const DEF_K = 50000;                 // = official 3000 constant scaled to Alliance stat sizes (~16x browser)
const HP_SCALE = 3;                  // guide stats exclude artifact/skin/glyph HP; calibrated so median arena fight ≈ 30s
const HARD_CC = ['stun','sleep','sheep','freeze','charm','fear'];
const ENEMY_SINGLE = new Set(['middle','front','back','lowest','highest','random','highestPatk','highestMatk','highestAtk','nearby']);
const rnd = Math.random;
function shuffle(a){ for (let i = a.length-1; i > 0; i--) { const j = rnd()*(i+1)|0; [a[i],a[j]] = [a[j],a[i]]; } return a; }
function fmtT(t){ t = Math.max(0, Math.ceil(t)); return `${t/60|0}:${String(t%60).padStart(2,'0')}`; }

let HEROES = {};
// Turn raw hero data into engine-ready heroes (skips heroes not in the mobile game).
function prepareHeroes(raw, icons){
  const out = {};
  for (const [key, d] of Object.entries(raw)) {
    if (!d || d.exists === false || !ROLE_T[d.role]) continue;
    const skills = (d.skills || []).map((s, i) => ({...s, idx:i, fx:s.fx || []}));
    out[key] = {...d, key, skills,
      icon: d.icon || (icons && icons[key]) || ({tank:'🛡️',warrior:'⚔️',mage:'🔮',marksman:'🏹',healer:'💚',support:'✨',control:'🌀'})[d.role],
      pos: d.pos ?? 50, dmgType: d.dmgType || (ROLE_T[d.role].patk > ROLE_T[d.role].matk ? 'phys' : 'mag'),
      ult: skills.find(s => s.kind === 'ult'),
      actives: skills.filter(s => s.kind === 'active'),
      passives: skills.filter(s => s.kind === 'passive')};
  }
  return out;
}

// Final stats for a team slot: role template × multipliers, absolute overrides, level/star scaling, user overrides.
function scaledStats(c){
  const h = HEROES[c.key], t = ROLE_T[h.role], s = {};
  for (const k of STATS) s[k] = t[k] * ((h.stats && h.stats[k]) ?? 1);
  if (h.statsAbs) for (const k in h.statsAbs) if (STATS.includes(k)) s[k] = h.statsAbs[k];
  const m = (0.25 + 0.75*Math.min(120, c.level ?? 120)/120) * (0.55 + 0.075*(c.stars ?? 6));
  for (const k of ['hp','patk','matk','armor','mdef','apen','mpen']) s[k] = Math.round(s[k]*m);
  s.hp = Math.round(s.hp*HP_SCALE);
  if (c.ovr) for (const k in c.ovr) { const v = c.ovr[k]; if (v !== '' && v != null && !isNaN(v)) s[k] = +v; }
  s.aspd = Math.max(0.3, s.aspd);
  return s;
}
function power(team){
  let p = 0;
  for (const c of team) if (c && HEROES[c.key]) { const s = scaledStats(c); p += s.hp/10 + (s.patk+s.matk)*1.2 + (s.armor+s.mdef)*0.6 + (s.apen+s.mpen)*0.5; }
  return Math.round(p/100);
}

class Battle {
  constructor(teamA, teamB, o = {}){
    this.t = 0; this.limit = o.limit || 90; this.timeoutDef = o.timeoutDef !== false;
    this.counter = o.counter || 0;   // counter rules: % bonus a hero gets against heroes it is listed as countering
    this.spread = o.spread || 0;     // power spread %, see vary()
    this.vis = !!o.vis; this.log = []; this.events = []; this.pending = []; this.depth = 0;
    this.over = false; this.winner = null; this.timeout = false;
    this.units = []; this.nextId = 0;
    for (const [side, team] of [['A', teamA], ['B', teamB]])
      team.forEach((c, slot) => { if (c && HEROES[c.key]) this.units.push(this.mkUnit(HEROES[c.key], this.vary(scaledStats(c), c), side, slot)); });
    for (const u of this.units) this.fire(u, 'battle_start', {});
  }
  // Power spread: real heroes differ in gear, artifacts, skins and glyphs, so each battle rolls every hero's
  // survivability and damage independently within ±spread% (heroes with user-entered stats are left alone).
  vary(s, c){
    if (!this.spread || (c.ovr && Object.values(c.ovr).some(v => v !== '' && v != null))) return s;
    const r = () => 1 + (rnd()*2 - 1)*this.spread/100, def = r(), atk = r();
    return {...s, hp:s.hp*def, armor:s.armor*def, mdef:s.mdef*def, patk:s.patk*atk, matk:s.matk*atk};
  }
  mkUnit(h, s, side, slot, summon){
    return {id:this.nextId++, slot, key:h.key, h, name:h.name, side, pos:h.pos, base:s, hp:s.hp, maxHp:s.hp,
      energy:0, shields:[], alive:true, cc:{}, immune:0, stealth:0, taunt:0, block:{ult:0, skills:0},
      mods:[], dots:[], hots:[], burn:null, busy:0, atkT:0.4 + rnd()*0.6,
      cds:h.actives.map(sk => sk.icd ?? sk.cd*0.5), tcd:{}, used:{}, noRevive:false,
      diving:false, diveLock:0, summon:summon || null, dmg:0, heal:0, taken:0};
  }

  /* ---------- helpers ---------- */
  L(msg, cls){ if (this.vis) this.log.push({t:this.t, msg, cls}); }
  ev(e){ if (this.vis) this.events.push(e); }
  label(u){ return u.summon ? `${u.name} (${u.summon.owner.name})` : u.name; }
  stat(u, k){
    let add = 0, pct = 0;
    for (const m of u.mods) if (m.stat === k) { if (m.amt != null) add += m.amt; else pct += m.pct; }
    if (k === 'dmgDealt' || k === 'dmgTaken' || k === 'healRecv' || k === 'vamp') return pct + (k === 'vamp' ? (u.base.vamp || 0) : 0);
    const v = ((u.base[k] || 0) + add) * (1 + pct/100);
    return k === 'aspd' ? Math.max(0.3, v) : Math.max(0, v);
  }
  // Formula value. HP-based terms use guide-level HP (HP_SCALE is extra buffer from gear the guides leave out);
  // buffs (base=true) scale off the caster's unbuffed stats so they can't compound.
  F(f, src, tgt, base){
    if (!f) return 0;
    if (typeof f === 'number') return f;
    let sv = 0;
    switch (f.stat) {
      case 'hp': sv = src.maxHp/HP_SCALE; break;
      case 'thp': sv = tgt ? tgt.maxHp/HP_SCALE : 0; break;
      case 'tcur': sv = tgt ? tgt.hp/HP_SCALE : 0; break;
      case 'lost': sv = (src.maxHp - src.hp)/HP_SCALE; break;
      case undefined: case null: sv = 0; break;
      default: sv = base ? (src.base[f.stat] || 0) : this.stat(src, f.stat);
    }
    return (f.pct || 0)/100 * sv + (f.flat || 0);
  }
  heroesAlive(side){ return this.units.some(u => u.alive && u.side === side && !u.summon); }
  hardCC(u){ return HARD_CC.some(s => u.cc[s] > 0); }
  stacks(u, name){ let n = 0; for (const m of u.mods) if (m.stack === name) n++; return n; }
  gain(u, n){ if (u.alive) u.energy = Math.min(1000, Math.max(0, u.energy + n)); }
  foes(u){
    const all = this.units.filter(x => x.alive && x.side !== u.side), vis = all.filter(x => x.stealth <= 0);
    return (vis.length ? vis : all).sort((a,b) => a.pos - b.pos);
  }
  friends(u){ return this.units.filter(x => x.alive && x.side === u.side).sort((a,b) => a.pos - b.pos); }

  pick(u, sel, n, ctx = {}){
    n = n || 1;
    const E = this.foes(u), A = this.friends(u), pct = x => x.hp/x.maxHp;
    if (ENEMY_SINGLE.has(sel)) { const tz = E.find(x => x.taunt > 0); if (tz) return [tz]; }
    switch (sel) {
      case 'front': {
        // a hero who dived into our formation (Kayla) is the nearest enemy for everyone
        const dv = E.filter(x => x.diving);
        return dv.length ? dv.concat(E.filter(x => !x.diving)).slice(0, n) : E.slice(0, n);
      }
      case 'nearby': { const c = u.diving ? E.length >> 1 : 0, k = Math.max(n, 2); const from = Math.max(0, Math.min(c - (k >> 1), E.length - k)); return E.slice(from, from + k); }
      case 'middle': return E.slice(E.length >> 1, (E.length >> 1) + n);
      case 'back': return E.slice(-n).reverse();
      case 'lowest': return E.sort((a,b) => pct(a)-pct(b)).slice(0, n);
      case 'highest': return E.sort((a,b) => b.hp-a.hp).slice(0, n);
      case 'random': return shuffle(E).slice(0, n);
      case 'all': return E;
      case 'shielded': return E.filter(x => x.shields.length).slice(0, n);
      case 'highestPatk': return E.sort((a,b) => this.stat(b,'patk')-this.stat(a,'patk')).slice(0, n);
      case 'highestMatk': return E.sort((a,b) => this.stat(b,'matk')-this.stat(a,'matk')).slice(0, n);
      case 'highestAtk': { const a = x => Math.max(this.stat(x,'patk'), this.stat(x,'matk')); return E.sort((x,y) => a(y)-a(x)).slice(0, n); }
      case 'attacker': return ctx.attacker && ctx.attacker.alive ? [ctx.attacker] : [];
      case 'self': return u.alive ? [u] : [];
      case 'ally_all': return A;
      case 'ally_lowest': return A.sort((a,b) => pct(a)-pct(b)).slice(0, n);
      case 'ally_front': return A.filter(x => x !== u).slice(0, n).concat(A.length === 1 ? [u] : []).slice(0, n);
      case 'ally_back': return A.slice(-n).reverse();
      case 'ally_highestAtk': { const a = x => Math.max(x.base.patk, x.base.matk), o = A.filter(x => x !== u && !x.summon); return (o.length ? o : A).sort((x,y) => a(y)-a(x)).slice(0, n); }
      case 'ally_critical': return A.filter(x => !x.summon && x.hp/x.maxHp < 0.3);
      case 'ally_random': return shuffle(A).slice(0, n);
      case 'ally_dead': return this.units.filter(x => !x.alive && x.side === u.side && !x.summon && !x.noRevive && (!ctx.who || x.key === ctx.who));
    }
    return [];
  }

  /* ---------- damage / healing ---------- */
  damage(src, t, type, v, o = {}){
    if (!t || !t.alive || v <= 0) return 0;
    const guard = this.units.find(x => x.alive && x.summon && x.summon.absorbFor === t);
    if (guard) t = guard;
    let crit = false;
    if (type === 'phys' && !o.dot) {
      if (o.basic && src.cc.blind > 0) { this.ev({k:'txt', id:t.id, txt:'Miss', c:'s'}); return 0; }
      if (rnd()*100 < this.stat(t,'dodge')) { this.ev({k:'txt', id:t.id, txt:'Dodge', c:'s'}); return 0; }
      if (!o.noCrit && rnd()*100 < this.stat(src,'crit')) { v *= 2; crit = true; }
    }
    if (src.h && src.h.vsShield && t.shields.length) v *= src.h.vsShield;   // e.g. Oya: +100% vs shielded
    if (this.counter && t.h && src.h) {
      if ((t.h.counters || []).includes(src.key)) v *= 1 + this.counter/100;        // src counters t
      else if ((src.h.counters || []).includes(t.key)) v *= 1 - this.counter/200;   // src is countered by t
    }
    v *= Math.max(0, 1 + this.stat(src,'dmgDealt')/100) * Math.max(0, 1 + this.stat(t,'dmgTaken')/100);
    if (type !== 'pure') {
      const def = type === 'phys' ? this.stat(t,'armor') - this.stat(src,'apen') : this.stat(t,'mdef') - this.stat(src,'mpen');
      v *= DEF_K / (DEF_K + Math.max(0, def));
    }
    if (t.summon && t.summon.hits != null) {
      if (--t.summon.hits <= 0) { t.alive = false; this.L(`${this.label(t)} is exhausted`, t.side); this.ev({k:'die', id:t.id}); }
      else this.ev({k:'txt', id:t.id, txt:'Blocked', c:'s'});
      return 0;
    }
    if (t.link && t.link.to.alive && t.link.to !== t && (!t.link.type || t.link.type === type) && !o.linked) {
      const part = v*t.link.pct/100; v -= part;
      this.damage(src, t.link.to, 'pure', part*(1 - (t.link.reduce || 0)/100), {...o, linked:true, dot:true});
    }
    let d = Math.round(v);
    for (const s of t.shields) { const a = Math.min(s.v, d); s.v -= a; d -= a; if (!d) break; }
    t.shields = t.shields.filter(s => s.v > 0);
    // ward (Fafnir's Runic Shield): turns into a shield below 25% HP and prevents that lethal hit
    if (t.ward && t.hp - d < t.maxHp*0.25) {
      const w = Math.min(t.ward, d); d -= w; t.shields.push({v:t.ward - w, left:10}); t.ward = 0;
      if (t.hp - d <= 0) d = t.hp - 1;
      this.ev({k:'txt', id:t.id, txt:'Runic Shield', c:'s'});
    }
    const total = Math.round(v);
    t.hp -= d; src.dmg += total; t.taken += total;
    this.gain(t, Math.min(250, d/(t.maxHp/HP_SCALE)*500));   // energy from damage taken uses guide-level HP
    if (t.summon && t.summon.onHitAllyEnergy) for (const a of this.friends(t)) if (a !== t) this.gain(a, t.summon.onHitAllyEnergy);
    this.ev({k:'dmg', id:t.id, v:total, crit});
    if (!o.dot) { const vp = this.stat(src, 'vamp'); if (vp > 0) this.healU(src, src, total*vp/100); }
    if (!o.dot && t.cc.sleep > 0) { t.cc.sleep = 0; this.fire(t, 'wake', {attacker:src}); }
    if (t.hp <= 0) { this.kill(t, src); return total; }
    if (!o.dot) {
      this.fire(t, 'attacked', {attacker:src});
      if (crit) this.fire(src, 'crit', {target:t});
    }
    this.checkHpTriggers(t);
    return total;
  }
  kill(t, src, noRevive){
    if (!t.alive) return;
    t.hp = 0; t.alive = false; t.shields = []; t.ward = 0; t.cc = {}; t.dots = []; t.hots = []; t.mods = []; t.diving = false;
    if (noRevive) t.noRevive = true;
    this.L(`💀 ${this.label(t)} is defeated${src ? ' by ' + this.label(src) : ''}${noRevive ? ' (cannot be revived)' : ''}`, t.side);
    this.ev({k:'die', id:t.id});
    if (src) this.fire(src, 'kill', {target:t});
    this.fire(t, 'death', {attacker:src}, true);
    for (const a of this.units) if (a.alive && a.side === t.side && a !== t) this.fire(a, 'ally_death', {target:t, attacker:src});
  }
  healU(src, t, amt){
    if (!t || !t.alive || amt <= 0) return 0;
    amt *= Math.max(0, 1 + this.stat(t,'healRecv')/100);
    const a = Math.round(Math.min(amt, t.maxHp - t.hp));
    if (a <= 0) return 0;
    t.hp += a; src.heal += a;
    this.ev({k:'heal', id:t.id, v:a});
    return a;
  }
  isDebuff(f){
    if (f.t === 'cc' || f.t === 'dot' || f.t === 'block') return true;
    if (f.t === 'mod') { const s = f.pct ?? ((f.f && (f.f.pct || 0)) + (f.f && (f.f.flat || 0))); return s < 0 ? f.stat !== 'dmgTaken' : f.stat === 'dmgTaken'; }
    return f.t === 'energy' && f.amount < 0;
  }

  /* ---------- skills ---------- */
  cast(u, sk, ctx = {}){
    if (!u.alive && !ctx.onDeath) return;
    if (sk.delay && !ctx.delayed) {
      this.pending.push({u, sk, ctx:{...ctx, delayed:true}, left:sk.delay, total:sk.delay});
      this.L(`⏳ ${this.label(u)} starts ${sk.name}`, u.side);
      this.ev({k:'cast', id:u.id, name:sk.name, ult:sk.kind === 'ult'});
      return;
    }
    if (!ctx.quiet) {
      this.L(`${sk.kind === 'ult' ? '⭐' : sk.kind === 'passive' ? '◦' : '•'} ${this.label(u)} — ${sk.name}`, u.side);
      this.ev({k:'cast', id:u.id, name:sk.name, ult:sk.kind === 'ult'});
    }
    const P = ctx.power ?? 1;
    let last = ctx.target ? [ctx.target] : [];
    for (const f of sk.fx) {
      let tg;
      if (f.target === 'same') tg = last.filter(x => x.alive || f.t === 'revive');
      else tg = this.pick(u, f.target || (f.t === 'heal' || f.t === 'shield' ? 'self' : 'front'), f.n, {...ctx, who:f.who});
      if (f.target !== 'same' && tg.length) last = tg;
      for (const t of tg) {
        if (f.perTargetCd) {   // e.g. Aidan's Flame Shield: once per ally every N s
          const k = u.id + sk.name; t.ptc = t.ptc || {};
          if ((t.ptc[k] ?? -1e9) > this.t) continue;
          t.ptc[k] = this.t + f.perTargetCd;
        }
        this.apply(u, t, f, P, ctx);
      }
    }
  }
  apply(u, t, f, P, ctx){
    const enemy = t.side !== u.side;
    if (enemy && this.isDebuff(f)) {
      if (t.immune > 0) { this.ev({k:'txt', id:t.id, txt:'Immune', c:'s'}); return; }
      if (this.depth < 3) { this.depth++; for (const a of this.friends(t)) this.fire(a, 'ally_debuffed', {attacker:u, target:t}); this.depth--; }
    }
    switch (f.t) {
      case 'dmg': {
        let v = this.F(f.f, u, t) * P;
        if (f.perStack) v += this.stacks(t, f.perStack.stack) * this.F(f.perStack.f, u, t) * P;
        const d = this.damage(u, t, f.type || u.h.dmgType, v, {noCrit:f.noCrit});
        if (f.ls) this.healU(u, u, d*f.ls);
        if (f.execute && t.alive && t.hp/HP_SCALE < this.F(f.execute.f, u, t)) {   // thresholds are guide-level HP
          this.ev({k:'txt', id:t.id, txt:'EXECUTED', c:'k'});
          this.kill(t, u, f.execute.noRevive);
        }
        break;
      }
      case 'dot': if (t.alive) t.dots.push({src:u, type:f.type || 'mag', dps:this.F(f.f, u, t)*P, left:f.dur || 5, acc:0}); break;
      case 'heal': this.healU(u, t, this.F(f.f, u, t)*P); break;
      case 'hot': if (t.alive) t.hots.push({src:u, hps:this.F(f.f, u, t)*P, left:f.dur || 5, acc:0}); break;
      case 'ward': if (t.alive) t.ward = Math.min((t.ward || 0) + this.F(f.f, u, t)*P, f.max ? this.F(f.max, u, t) : Infinity); break;
      case 'shield': if (t.alive) { t.shields.push({v:this.F(f.f, u, t)*P, left:f.dur || 999}); this.ev({k:'txt', id:t.id, txt:'Shield', c:'s'}); } break;
      case 'cc': {
        if (!t.alive || (f.chance != null && rnd()*100 >= f.chance)) break;
        if (f.s === 'knockback') { t.diving = false; t.diveLock = Math.max(t.diveLock, f.dur || 5); this.ev({k:'txt', id:t.id, txt:'Knocked back', c:'k'}); break; }
        t.cc[f.s] = Math.max(t.cc[f.s] || 0, f.dur || 1);
        if (f.s === 'root') { t.diving = false; t.diveLock = Math.max(t.diveLock, f.dur || 1); }
        this.ev({k:'txt', id:t.id, txt:({stun:'Stunned', sleep:'Asleep', sheep:'Sheep!', silence:'Silenced', blind:'Blinded', freeze:'Frozen', charm:'Charmed', fear:'Feared', root:'Rooted'})[f.s] || f.s, c:'k'});
        break;
      }
      case 'mod': {
        if (!t.alive) break;
        const m = {stat:f.stat, left:f.dur || 999, src:u};
        if (f.f) m.amt = this.F(f.f, u, t, true)*P; else m.pct = f.pct || 0;
        if (f.stack) {
          m.stack = f.stack.name;
          const same = t.mods.filter(x => x.stack === m.stack && x.stat === m.stat);
          for (const x of same) x.left = m.left;
          if (same.length >= (f.stack.max || 3)) break;
        }
        t.mods.push(m);
        break;
      }
      case 'energy': this.gain(t, f.amount * (f.amount > 0 ? 1 : 1)); break;
      case 'revive':
        if (!t.alive && !t.noRevive) {
          Object.assign(t, {alive:true, hp:Math.round(t.maxHp*(f.hpFromCaster ? Math.max(0.05, u.hp/u.maxHp) : (f.hpPct || 50)/100)), energy:0, shields:[], cc:{}, mods:[], dots:[], hots:[]});
          this.L(`✨ ${this.label(u)} revives ${t.name}`, u.side); this.ev({k:'txt', id:t.id, txt:'Revived!', c:'k'});
        }
        break;
      case 'summon': this.summon(u, f); break;
      case 'cleanse': t.mods = t.mods.filter(m => (m.amt ?? m.pct) >= 0 || m.stat === 'dmgTaken'); t.cc = {}; t.dots = []; break;
      case 'dispel': t.mods = t.mods.filter(m => (m.amt ?? m.pct) < 0); t.shields = []; break;
      case 'immune': t.immune = Math.max(t.immune, f.dur || 5); break;
      case 'stealth': t.stealth = Math.max(t.stealth, f.dur || 2); this.ev({k:'txt', id:t.id, txt:'Stealth', c:'s'}); break;
      case 'taunt': t.taunt = Math.max(t.taunt, f.dur || 3); this.ev({k:'txt', id:t.id, txt:'Taunt', c:'s'}); break;
      case 'block': t.block[f.what === 'ult' ? 'ult' : 'skills'] = Math.max(t.block[f.what === 'ult' ? 'ult' : 'skills'], f.dur || 3); break;
      case 'link': {
        // default: damage dealt to t is partly taken by the caster (Astaroth). f.to: redirected to another of t's allies (Jorgen's Leper)
        const to = f.to ? this.pick(t, f.to, 1)[0] : u;
        if (t.alive && to && t !== to) t.link = {to, pct:f.pct || 30, reduce:f.reduce || 0, type:f.type || null, left:f.dur || 999};
        break;
      }
      case 'hpcost': u.burn = {pct:f.pctPerSec || 1, left:f.dur || 999}; break;
    }
  }
  summon(u, f){
    const pct = (f.atkPct ?? 100)/100, s = {...u.base};
    s.hp = u.maxHp * (f.hpPct ?? 50)/100;
    for (const k of ['patk','matk','apen','mpen']) s[k] = u.base[k]*pct;
    s.armor = f.armor ?? u.base.armor*pct; s.mdef = f.mdef ?? u.base.mdef*pct;
    const h = {key:u.key + '_summon', name:f.name || 'Summon', role:u.h.role, icon:f.icon || '👥', pos:f.pos ?? u.pos - 1,
      dmgType:u.h.dmgType, basic:'front', skills:[], actives:[], passives:[], ult:null};
    const c = this.mkUnit(h, s, u.side, -1, {owner:u, left:f.dur || 999, hits:f.hits ?? null, onHitAllyEnergy:f.onHitAllyEnergy || 0, absorbFor:f.absorbFor === 'self' ? u : null});
    if (f.taunt) c.taunt = f.dur || 999;
    this.units.push(c);
    this.L(`👥 ${u.name} summons ${h.name}`, u.side);
    this.ev({k:'summon', id:c.id});
  }

  /* ---------- triggers ---------- */
  fire(u, on, ctx, onDeath){
    if ((!u.alive && !onDeath) || this.over) return;
    for (const sk of u.h.passives) {
      const tr = sk.trigger; if (!tr || tr.on !== on) continue;
      if (tr.once && u.used[sk.idx]) continue;
      if ((u.tcd[sk.idx] || 0) > 0) continue;
      const hp = u.hp/u.maxHp*100;
      if (tr.hpBelow != null && on !== 'hp_below' && hp >= tr.hpBelow) continue;
      if (tr.hpAbove != null && hp <= tr.hpAbove) continue;
      if (on !== 'battle_start' && on !== 'death' && this.hardCC(u) && !tr.always) continue;
      u.used[sk.idx] = true; u.tcd[sk.idx] = tr.cd || 0;
      this.cast(u, sk, {...ctx, quiet:on === 'battle_start' || on === 'attacked' || on === 'hit', onDeath});
    }
  }
  checkHpTriggers(u){
    for (const sk of u.h.passives) {
      const tr = sk.trigger;
      if (tr && tr.on === 'hp_below' && !u.used[sk.idx] && u.alive && u.hp/u.maxHp*100 < (tr.hpBelow ?? 30)) {
        u.used[sk.idx] = true; this.cast(u, sk, {});
      }
    }
  }

  /* ---------- turn loop ---------- */
  tick(u, dt){
    for (const k in u.cc) if (u.cc[k] > 0) u.cc[k] -= dt;
    for (const k of ['immune','stealth','taunt','diveLock']) if (u[k] > 0) u[k] -= dt;
    if (u.block.ult > 0) u.block.ult -= dt;
    if (u.block.skills > 0) u.block.skills -= dt;
    if (u.busy > 0) u.busy -= dt;
    if (u.link) { u.link.left -= dt; if (u.link.left <= 0 || !u.link.to.alive) u.link = null; }
    for (const k in u.tcd) if (u.tcd[k] > 0) u.tcd[k] -= dt;
    if (u.mods.length) { for (const m of u.mods) m.left -= dt; u.mods = u.mods.filter(m => m.left > 0); }
    if (u.shields.length) { for (const s of u.shields) s.left -= dt; u.shields = u.shields.filter(s => s.left > 0 && s.v > 0); }
    if (u.summon) { u.summon.left -= dt; if (u.summon.left <= 0) { u.alive = false; this.L(`${this.label(u)} fades`, u.side); this.ev({k:'die', id:u.id}); return; } }
    for (const d of u.dots) { d.left -= dt; d.acc += dt; if (d.acc >= 1) { d.acc -= 1; this.damage(d.src, u, d.type, d.dps, {dot:true}); if (!u.alive) return; } }
    if (u.dots.length) u.dots = u.dots.filter(d => d.left > 0);
    for (const h of u.hots) { h.left -= dt; h.acc += dt; if (h.acc >= 1) { h.acc -= 1; this.healU(h.src, u, h.hps); } }
    if (u.hots.length) u.hots = u.hots.filter(h => h.left > 0);
    if (u.burn) { u.burn.left -= dt; u.hp -= u.maxHp*u.burn.pct/100*dt; if (u.burn.left <= 0) u.burn = null; if (u.hp <= 0) { this.kill(u, null); return; } }
    // periodic passives
    for (const sk of u.h.passives) if (sk.trigger && sk.trigger.on === 'every') {
      u.tcd['e' + sk.idx] = (u.tcd['e' + sk.idx] ?? (sk.trigger.icd ?? sk.trigger.cd ?? 10)) - dt;
      if (u.tcd['e' + sk.idx] <= 0 && !this.hardCC(u)) {
        u.tcd['e' + sk.idx] = sk.trigger.cd || 10;
        const hp = u.hp/u.maxHp*100, tr = sk.trigger;
        if ((tr.hpAbove == null || hp > tr.hpAbove) && (tr.hpBelow == null || hp < tr.hpBelow) && (!tr.whileDiving || u.diving)) this.cast(u, sk, {quiet:tr.cd < 2});
      }
    }
    this.diveTick(u, dt);
  }
  diveTick(u, dt){
    const dv = u.h.dive; if (!dv) return;
    const hp = u.hp/u.maxHp*100;
    if (!u.diving && hp > (dv.above ?? 60) && u.diveLock <= 0 && !this.hardCC(u)) {
      u.diving = true; this.L(`🔥 ${u.name} leaps into the enemy formation`, u.side); this.ev({k:'txt', id:u.id, txt:'Dive!', c:'k'});
    }
    if (u.diving) {
      u.hp -= u.maxHp*(dv.burn ?? 2)/100*dt;
      if (u.hp/u.maxHp*100 < (dv.below ?? 30)) {
        u.diving = false; this.L(`${u.name} leaps back to the team`, u.side);
        this.fire(u, 'dive_end', {});
      }
    }
  }
  act(u, dt){
    this.tick(u, dt);
    if (!u.alive || this.hardCC(u) || u.busy > 0) return;
    const silenced = u.cc.silence > 0;
    if (u.h.ult && u.energy >= 1000 && !silenced && u.block.ult <= 0) {
      u.energy = 0; u.busy = 0.8; this.cast(u, u.h.ult, {}); this.fire(u, 'ult', {}); return;
    }
    for (let i = 0; i < u.h.actives.length; i++) {
      u.cds[i] -= dt;
      if (u.cds[i] <= 0 && !silenced && u.block.skills <= 0) { u.cds[i] = u.h.actives[i].cd || 10; u.busy = 0.5; this.cast(u, u.h.actives[i], {}); return; }
    }
    u.atkT -= dt;
    if (u.atkT <= 0) {
      u.atkT = this.stat(u, 'aspd');
      const t = this.pick(u, u.diving ? (u.h.dive.target || 'back') : (u.h.basic || 'front'), 1)[0];
      if (t) {
        const type = u.h.dmgType, v = this.stat(u, type === 'mag' ? 'matk' : 'patk') * (u.h.basicMult ?? 1);
        this.damage(u, t, type, v, {basic:true});
        this.gain(u, 100);
        if (t.alive || true) this.fire(u, 'hit', {target:t, attacker:t});
      }
    }
  }
  step(dt){
    if (this.over) return;
    this.t += dt;
    for (const p of this.pending) {
      p.left -= dt;
      const interrupted = !p.u.alive || this.hardCC(p.u);
      if (p.left <= 0 || interrupted) {
        p.done = true;
        const power = p.left <= 0 ? 1 : Math.max(p.sk.minPower ?? 0.4, 1 - p.left/p.total);
        if (p.u.alive || !interrupted) this.cast(p.u, p.sk, {...p.ctx, power});
      }
    }
    this.pending = this.pending.filter(p => !p.done);
    for (const u of [...this.units]) {
      if (!u.alive) continue;
      this.act(u, dt);
      if (this.checkEnd()) return;
    }
    this.checkEnd();
  }
  checkEnd(){
    const a = this.heroesAlive('A'), b = this.heroesAlive('B');
    if (!a || !b) { this.over = true; this.winner = a ? 'A' : 'B'; }
    else if (this.t >= this.limit) {
      this.over = true; this.timeout = true;
      if (this.timeoutDef) this.winner = 'B';
      else {
        const hp = s => { const us = this.units.filter(u => u.side === s && !u.summon); return us.reduce((p,u) => p + u.hp/u.maxHp, 0)/us.length; };
        this.winner = hp('A') > hp('B') ? 'A' : 'B';
      }
    }
    if (this.over) this.L(`🏁 ${this.winner === 'A' ? 'Attack' : 'Defense'} wins${this.timeout ? ' (time out)' : ''} at ${fmtT(this.t)}`, 'sys');
    return this.over;
  }
  runToEnd(dt = 0.05){ while (!this.over) this.step(dt); return this; }
}

if (typeof module !== 'undefined') module.exports = {ROLE_T, STATS, Battle, prepareHeroes, scaledStats, power, shuffle, fmtT,
  setHeroes: h => { HEROES = h; }, getHeroes: () => HEROES};
