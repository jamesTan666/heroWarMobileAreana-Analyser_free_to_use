/* ============================ APP (UI) ============================ */
const ROLES = {tank:'#4f8cff', warrior:'#ff6b4a', mage:'#b86bff', marksman:'#ffb020', healer:'#3ddc97', support:'#3dd6dc', control:'#ff5fa2'};
const ICONS = {astaroth:'🛡️', galahad:'⚔️', lars:'🔨', chabba:'🐸', ziri:'🌀', cleaver:'🪓', aurora:'🌙', keira:'🗡️', dante:'🔥', qingmao:'🐉',
  sebastian:'🎺', dorian:'🦇', nebula:'✨', phobos:'👁️', celeste:'🕊️', martha:'🌿', lian:'🦊', jorgen:'💀', judge:'⚖️', faceless:'🎭', orion:'🏹',
  krista:'❄️', isaac:'🎯', leonel:'🌗', julius:'🏛️', rufus:'🐺', thea:'🌸', guus:'🪨', mushy:'🍄', corvus:'🦅', ishmael:'⛓️', heidi:'🧊',
  abaddon:'🪱', luther:'🛡️', karkh:'🦂', yasmine:'🐍', kai:'🌊', alvanor:'🍃', andvari:'⚒️', augustus:'⚡', tristan:'🎻', fafnir:'🐲', oya:'🐆',
  satori:'🧘', maya:'🌺', jet:'💨', lilith:'🕸️', mojo:'🪇', amira:'☀️', arachne:'🕷️', somna:'🐑', morrigan:'🪦', xesha:'🔮', iris:'🌈',
  cornelius:'📜', lyria:'🎶', astrid:'🐻', polaris:'⭐', helios:'🌞', kayla:'🔥', ginger:'🔫', crow:'🐦‍⬛', peppy:'🎪', darkstar:'🌑',
  laracroft:'🔦', elmir:'🗝️', jhu:'🐼', fox:'🦊', artemis:'🌠', folio:'📖', soleil:'🌅', aidan:'🙏', electra:'⚡', byrna:'🌳',
  markus:'🛡️', octavia:'🪶', tempus:'⏳', miu:'🐱'};
HEROES = prepareHeroes(HERO_DATA, ICONS);
const PRESETS = Object.fromEntries(Object.entries({
  'Kayla Dive':['julius','kayla','keira','aidan','orion'],
  'Somna Control':['julius','folio','somna','iris','maya'],
  'Leonel Crit':['julius','leonel','qingmao','sebastian','isaac'],
  'Tank & Heal':['astaroth','galahad','keira','celeste','orion'],
  'Control':['lars','aurora','phobos','lian','judge'],
}).map(([n, t]) => [n, t.filter(k => HEROES[k])]).filter(([, t]) => t.length));
const STAT_KEYS = [['hp','HP'],['patk','Phys. attack'],['matk','Magic attack'],['armor','Armor'],['mdef','Magic defense'],
  ['apen','Armor pen.'],['mpen','Magic pen.'],['crit','Crit %'],['dodge','Dodge %'],['aspd','Attack interval (s)']];

/* ============================ STATE ============================ */
const LS = 'arenaSim.v1';
const mk = key => ({key, level:120, stars:6, ovr:null});
const fromPreset = name => { const t = (PRESETS[name] || []).map(mk); while (t.length < 5) t.push(null); return t; };
const presetNames = Object.keys(PRESETS);
let S = {A:fromPreset(presetNames[0]), B:fromPreset(presetNames[1] || presetNames[0]), saved:{}, limit:90, timeoutDef:true, counter:30, spread:20};
try { const d = JSON.parse(localStorage.getItem(LS)); if (d && d.A && d.B) S = Object.assign(S, d); } catch (e) {}
S.custom = S.custom || {};
function registerCustom(key, d){
  const src = HEROES[d.copy] && !HEROES[d.copy].custom ? HEROES[d.copy] : Object.values(HEROES).find(h => !h.custom);
  const clean = s => String(s || '').replace(/[<>&"'`]/g, '');   // names/icons go into innerHTML
  const statsAbs = {}; for (const k of STATS) if (d[k] != null && !isNaN(d[k])) statsAbs[k] = +d[k];
  HEROES[key] = {...src, key, name:clean(d.name) || 'Custom', icon:clean(d.icon) || '🦸', role:ROLE_T[d.role] ? d.role : src.role,
    pos:d.pos, stats:null, statsAbs, custom:true, notes:`Custom hero using ${src.name}'s skills.`, counters:[]};
}
for (const k in S.custom) registerCustom(k, S.custom[k]);
for (const s of ['A','B']) S[s] = S[s].map(c => c && HEROES[c.key] ? {...c, level:Math.min(120, c.level || 120)} : null);
function save(){ try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }

const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString();
const sortTeam = t => { const h = t.filter(c => c && HEROES[c.key]).sort((a,b) => HEROES[a.key].pos - HEROES[b.key].pos); while (h.length < 5) h.push(null); return h; };

/* ============================ TEXT ============================ */
const STAT_NAME = {vamp:'vampirism', aspd:'attack interval', patk:'phys. attack', matk:'magic attack', hp:'max HP', armor:'armor', mdef:'magic defense', thp:"target's max HP", tcur:"target's current HP", lost:'missing HP'};
function fText(f){
  if (!f) return '?';
  if (typeof f === 'number') return fmt(f);
  const p = f.pct ? `${Math.abs(f.pct)}% ${STAT_NAME[f.stat] || f.stat}` : '', fl = f.flat ? fmt(Math.abs(f.flat)) : '';
  return [p, fl].filter(Boolean).join(' + ') || '0';
}
function tgtText(f){
  const n = f.n || 1, pl = (one, many) => n > 1 ? `${n} ${many}` : one;
  return ({front:pl('nearest enemy','nearest enemies'), back:pl('farthest enemy','farthest enemies'), lowest:pl('lowest-HP enemy','lowest-HP enemies'),
    highest:'highest-HP enemy', middle:'enemy in the centre', ally_critical:'each ally below 30% HP', shielded:'every shielded enemy', random:pl('a random enemy','random enemies'), all:'all enemies', highestPatk:'enemy with highest phys. attack',
    highestMatk:'enemy with highest magic attack', highestAtk:'strongest enemy', nearby:'nearby enemies', same:'them', attacker:'the attacker', self:'self',
    ally_all:'all allies', ally_lowest:pl('weakest ally','weakest allies'), ally_front:'front ally', ally_back:'rear ally', ally_highestAtk:'strongest ally',
    ally_random:'a random ally', ally_dead:'a fallen ally'})[f.target] || f.target || 'target';
}
function fxText(f){
  const T = tgtText(f), dt = f.type === 'phys' ? 'physical' : f.type === 'pure' ? 'pure' : 'magic';
  switch (f.t) {
    case 'dmg': return `${fText(f.f)} ${dt} dmg to ${T}${f.perStack ? ` (+${fText(f.perStack.f)} per ${f.perStack.stack} stack)` : ''}${f.ls ? `, ${f.ls*100}% lifesteal` : ''}${f.execute ? `; executes below ${fText(f.execute.f)} HP${f.execute.noRevive ? ' (no revive)' : ''}` : ''}`;
    case 'dot': return `${fText(f.f)} ${dt} dmg/s to ${T} for ${f.dur}s`;
    case 'heal': return `heals ${T} for ${fText(f.f)}`;
    case 'hot': return `heals ${T} ${fText(f.f)}/s for ${f.dur}s`;
    case 'shield': return `shield ${fText(f.f)} on ${T}${f.perTargetCd ? ` (once per ally every ${f.perTargetCd}s)` : ''}`;
    case 'ward': return `charges a reserve shield (+${fText(f.f)}) on ${T}: activates below 25% HP and prevents one lethal hit`;
    case 'cc': return `${f.s} ${T}${f.dur ? ` for ${f.dur}s` : ''}${f.chance != null ? ` (${f.chance}% chance)` : ''}`;
    case 'mod': { const neg = f.pct != null ? f.pct < 0 : (f.f && ((f.f.pct || 0) < 0 || (f.f.flat || 0) < 0));
      return `${neg ? '−' : '+'}${f.pct != null ? Math.abs(f.pct) + '%' : fText(f.f)} ${STAT_NAME[f.stat] || f.stat} on ${T}${f.dur && f.dur < 999 ? ` for ${f.dur}s` : ''}${f.stack ? ` (stacks ×${f.stack.max})` : ''}`; }
    case 'energy': return `${f.amount > 0 ? '+' : '−'}${Math.abs(f.amount)} energy to ${T}`;
    case 'revive': return `revives ${f.who && HEROES[f.who] ? HEROES[f.who].name : 'a fallen ally'} at ${f.hpFromCaster ? 'the same HP % as the caster' : (f.hpPct || 50) + '% HP'}`;
    case 'summon': return `summons ${f.name} (${f.hpPct ?? 50}% HP${f.taunt ? ', taunts' : ''}${f.absorbFor ? ', absorbs damage for caster' : ''})`;
    case 'cleanse': return `cleanses ${T}`;
    case 'dispel': return `removes buffs from ${T}`;
    case 'immune': return `${T} immune to debuffs${f.dur >= 999 ? ' permanently' : ` for ${f.dur}s`}`;
    case 'stealth': return `untargetable for ${f.dur}s`;
    case 'taunt': return `taunts enemies for ${f.dur}s`;
    case 'block': return `${T} can't use ${f.what === 'ult' ? 'ultimate' : 'skills'} for ${f.dur}s`;
    case 'hpcost': return `loses ${f.pctPerSec}% HP/s`;
    case 'link': return `takes ${f.pct}% of ${f.type === 'phys' ? 'physical ' : ''}damage dealt to ${T}${f.reduce ? ` (reduced by ${f.reduce}%)` : ''}`;
  }
  return f.t;
}
function skillTag(sk){
  if (sk.kind === 'ult') return 'ULTIMATE · 1000 energy';
  if (sk.kind === 'active') return `every ${sk.cd}s${sk.icd != null ? ` (first at ${sk.icd}s)` : ''}`;
  const tr = sk.trigger || {};
  return 'PASSIVE' + (tr.on ? ` · ${({battle_start:'always', attacked:'when hit', hit:'on basic hit', every:`every ${tr.cd}s`, hp_below:`below ${tr.hpBelow}% HP`, ally_debuffed:'when an ally is debuffed', dive_end:'after dive'})[tr.on] || tr.on}` : '');
}
const skillHtml = sk => `<div class="skill"><b>${sk.name}</b><span class="tag">${skillTag(sk)}${sk.relic ? ' · relic' : ''}</span>
  ${sk.desc ? `<br>${sk.desc}` : ''}<div class="sim">Simulated: ${sk.fx.map(fxText).join('; ') || '—'}${sk.delay ? `; resolves after ${sk.delay}s (interrupted by CC)` : ''}.</div></div>`;
function heroSkillsHtml(h){
  let s = '';
  if (h.dive) s += `<div class="skill"><b>Dive</b><span class="tag">MECHANIC</span><br>while HP &gt; ${h.dive.above}% leaps behind the farthest enemy and attacks the back line, burning ${h.dive.burn}% max HP/s; returns below ${h.dive.below}% HP.</div>`;
  else if (h.basic && h.basic !== 'front') s += `<div class="skill"><b>Diver</b><span class="tag">BASIC ATTACK</span><br>basic attacks target the ${tgtText({target:h.basic})}.</div>`;
  return s + h.skills.map(skillHtml).join('');
}

/* ============================ TEAMS UI ============================ */
function renderTeams(){
  for (const side of ['A','B']) {
    $('#team'+side).innerHTML = S[side].map((c, i) => {
      if (!c) return `<button class="slot empty" data-act="pick" data-side="${side}" data-i="${i}">＋ Add hero</button>`;
      const h = HEROES[c.key];
      return `<div class="slot" style="--rc:${ROLES[h.role]}">
        <button class="s-ico" data-act="pick" data-side="${side}" data-i="${i}">${h.icon}</button>
        <div class="s-main"><div class="s-name">${h.name}<span class="role">${h.role}</span>${c.ovr ? ' <span class="muted">(custom)</span>' : ''}</div>
          <div class="s-ctl">Lv <input type="number" min="1" max="120" value="${c.level}" data-act="lv" data-side="${side}" data-i="${i}">
          <select data-act="st" data-side="${side}" data-i="${i}">${[1,2,3,4,5,6].map(s => `<option value="${s}"${s===c.stars?' selected':''}>${s}★</option>`).join('')}</select></div></div>
        <button class="ibtn" data-act="edit" data-side="${side}" data-i="${i}" title="Edit stats">⚙</button>
        <button class="ibtn" data-act="rm" data-side="${side}" data-i="${i}" title="Remove">✕</button></div>`;
    }).join('');
    $('#pw'+side).textContent = '⚡ ' + fmt(power(S[side]));
  }
  const sel = $('#savedSel'), names = Object.keys(S.saved);
  sel.innerHTML = '';
  if (!names.length) sel.add(new Option('— none saved —', ''));
  for (const n of names) sel.add(new Option(n, n));
}
function onTeamsClick(e){
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
  const side = b.dataset.side, i = +b.dataset.i;
  if (b.dataset.act === 'pick') openPicker(side, i);
  else if (b.dataset.act === 'rm') { S[side][i] = null; S[side] = sortTeam(S[side]); commit(); }
  else if (b.dataset.act === 'edit') openEditor(side, i);
}
function onTeamsChange(e){
  const el = e.target, c = S[el.dataset.side]?.[+el.dataset.i]; if (!c) return;
  if (el.dataset.act === 'lv') c.level = Math.min(120, Math.max(1, +el.value || 1));
  if (el.dataset.act === 'st') c.stars = +el.value;
  commit();
}
function commit(){ save(); renderTeams(); resetBattleView(); }

for (const id of ['#teamA','#teamB']) { $(id).addEventListener('click', onTeamsClick); $(id).addEventListener('change', onTeamsChange); }
document.querySelectorAll('[data-do]').forEach(b => b.onclick = () => {
  const side = b.dataset.team;
  if (b.dataset.do === 'clear') S[side] = [null,null,null,null,null];
  else S[side] = sortTeam(shuffle(Object.keys(HEROES)).slice(0,5).map(mk));
  commit();
});
document.querySelectorAll('.preset').forEach(sel => {
  sel.add(new Option('Preset…', ''));
  for (const n in PRESETS) sel.add(new Option(n, n));
  sel.onchange = () => { if (sel.value) { S[sel.dataset.team] = sortTeam(fromPreset(sel.value)); sel.value = ''; commit(); } };
});
$('#swap').onclick = () => { [S.A, S.B] = [S.B, S.A]; commit(); };
$('#saveCur').onclick = () => {
  const name = (prompt('Name this matchup:') || '').trim(); if (!name) return;
  S.saved[name] = JSON.parse(JSON.stringify({A:S.A, B:S.B})); commit(); $('#savedSel').value = name;
};
$('#loadSaved').onclick = () => { const d = S.saved[$('#savedSel').value]; if (d) { S.A = sortTeam(JSON.parse(JSON.stringify(d.A))); S.B = sortTeam(JSON.parse(JSON.stringify(d.B))); commit(); } };
$('#delSaved').onclick = () => { const n = $('#savedSel').value; if (n && confirm(`Delete "${n}"?`)) { delete S.saved[n]; commit(); } };

/* ---- picker ---- */
let pickCtx = null, pickRole = 'all';
function roleChips(el, cur, cb){
  el.innerHTML = ['all', ...Object.keys(ROLES)].map(r => `<button data-r="${r}" class="${r===cur?'on':''}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('[data-r]'); if (b) cb(b.dataset.r); };
}
const heroMatch = (h, role, q) => (role === 'all' || h.role === role) && (!q || h.name.toLowerCase().includes(q) || (h.alias || '').includes(q));
const byName = ([,a], [,b]) => a.name.localeCompare(b.name);
function openPicker(side, i){ pickCtx = {side, i}; $('#pickSearch').value = ''; renderPicker(); $('#picker').classList.add('on'); }
$('#pickSearch').oninput = () => renderPicker();
function renderPicker(){
  roleChips($('#pickChips'), pickRole, r => { pickRole = r; renderPicker(); });
  const used = new Set(S[pickCtx.side].filter(Boolean).map(c => c.key)), q = $('#pickSearch').value.trim().toLowerCase();
  $('#pickGrid').innerHTML = Object.entries(HEROES).filter(([,h]) => heroMatch(h, pickRole, q)).sort(byName).map(([k,h]) =>
    `<button class="hb" style="--rc:${ROLES[h.role]}" data-k="${k}" ${used.has(k)?'disabled':''}><span class="i">${h.icon}</span><span class="n">${h.name}</span><span class="r">${h.role}</span></button>`).join('');
}
$('#pickGrid').onclick = e => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  const old = S[pickCtx.side][pickCtx.i], c = mk(b.dataset.k);
  if (old) { c.level = old.level; c.stars = old.stars; }
  S[pickCtx.side][pickCtx.i] = c; S[pickCtx.side] = sortTeam(S[pickCtx.side]);
  $('#picker').classList.remove('on'); commit();
};

/* ---- editor ---- */
let edCtx = null;
function openEditor(side, i){
  edCtx = {side, i}; const c = S[side][i], h = HEROES[c.key];
  const auto = scaledStats({...c, ovr:null});
  $('#edTitle').textContent = `${h.icon} ${h.name} — Lv${c.level} ${c.stars}★`;
  $('#edForm').innerHTML = STAT_KEYS.map(([k,l]) => `<label>${l}<input type="number" step="any" data-k="${k}" placeholder="${Math.round(auto[k]*100)/100}" value="${c.ovr && c.ovr[k] != null ? c.ovr[k] : ''}"></label>`).join('');
  $('#edSkills').innerHTML = heroSkillsHtml(h);
  $('#editor').classList.add('on');
}
$('#edSave').onclick = () => {
  const o = {}; let any = false;
  $('#edForm').querySelectorAll('input').forEach(inp => { if (inp.value !== '') { o[inp.dataset.k] = +inp.value; any = true; } });
  S[edCtx.side][edCtx.i].ovr = any ? o : null; $('#editor').classList.remove('on'); commit();
};
$('#edReset').onclick = () => { S[edCtx.side][edCtx.i].ovr = null; $('#editor').classList.remove('on'); commit(); };
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('on'); }));

/* ============================ BATTLE UI ============================ */
let B = null, running = false, speed = 1, lastTs = 0, acc = 0, cards = {}, logShown = 0;
const hasTeams = () => S.A.some(Boolean) && S.B.some(Boolean);

function addCard(u){
  const el = document.createElement('div');
  el.className = 'unit' + (u.summon ? ' summon' : '');
  el.innerHTML = `<div class="u-top"><span class="u-ico">${u.h.icon}</span><span>${u.name}</span><span class="u-st"></span></div>
    <div class="bar hp"><i></i><b></b></div><div class="bar en"><i></i></div><div class="u-hp"></div>`;
  $('#col' + u.side).appendChild(el);
  cards[u.id] = {el, hp:el.querySelector('.hp i'), sh:el.querySelector('.hp b'), en:el.querySelector('.en i'), enBar:el.querySelector('.en'), txt:el.querySelector('.u-hp'), st:el.querySelector('.u-st')};
}
function buildField(){
  cards = {}; $('#colA').innerHTML = ''; $('#colB').innerHTML = '';
  for (const u of B.units) addCard(u);
}
function floater(el, txt, cls){
  if (el.querySelectorAll('.fl').length > 4) return;
  const f = document.createElement('span');
  f.className = 'fl ' + cls; f.textContent = txt;
  f.style.marginLeft = (rnd()*40-20) + 'px';
  el.appendChild(f); setTimeout(() => f.remove(), 1000);
}
function flash(el, cls, ms){ el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }
const CC_ICON = {stun:'💫', sleep:'💤', sheep:'🐑', silence:'🤐', blind:'🙈', freeze:'🧊', charm:'💘', fear:'😱', root:'🌿'};
function renderField(fx = true){
  for (const u of B.units) {
    if (!cards[u.id]) addCard(u);
    const c = cards[u.id];
    const sh = u.shields.reduce((p, s) => p + s.v, 0);
    c.hp.style.width = (u.hp/u.maxHp*100) + '%';
    c.sh.style.width = Math.min(100, sh/u.maxHp*100) + '%';
    c.en.style.width = (u.energy/10) + '%';
    c.enBar.classList.toggle('full', u.energy >= 1000);
    c.txt.textContent = `${fmt(u.hp)} / ${fmt(u.maxHp)}`;
    let st = '';
    for (const k in CC_ICON) if (u.cc[k] > 0) st += CC_ICON[k];
    if (u.diving) st += '🔥';
    if (u.stealth > 0) st += '👻';
    if (u.immune > 0) st += '🛡';
    if (u.taunt > 0) st += '🎯';
    if (u.mods.some(m => (m.amt ?? m.pct) > 0)) st += '⬆';
    if (u.mods.some(m => (m.amt ?? m.pct) < 0)) st += '⬇';
    if (u.dots.length) st += '🩸';
    c.st.textContent = st;
    c.el.classList.toggle('dead', !u.alive);
  }
  if (fx) for (const e of B.events) {
    const c = cards[e.id]; if (!c) continue;
    if (e.k === 'dmg') { floater(c.el, (e.crit ? '💥' : '-') + fmt(e.v), e.crit ? 'c' : 'd'); flash(c.el, 'hit', 200); }
    else if (e.k === 'heal') floater(c.el, '+' + fmt(e.v), 'h');
    else if (e.k === 'txt') floater(c.el, e.txt, e.c);
    else if (e.k === 'cast') { floater(c.el, e.name, 'k'); if (e.ult) flash(c.el, 'cast', 400); }
  }
  B.events.length = 0;
  $('#timer').textContent = fmtT(B.limit - B.t);
  const logEl = $('#log');
  if (B.log.length > logShown) {
    const frag = document.createDocumentFragment();
    for (let i = logShown; i < B.log.length; i++) {
      const l = B.log[i], d = document.createElement('div');
      d.className = l.cls; d.textContent = `[${fmtT(l.t)}] ${l.msg}`; frag.appendChild(d);
    }
    logShown = B.log.length; logEl.appendChild(frag); logEl.scrollTop = logEl.scrollHeight;
  }
}
function resetBattleView(){
  running = false;
  if (!hasTeams()) { $('#colA').innerHTML = $('#colB').innerHTML = '<p class="muted">Pick both teams first.</p>'; return; }
  B = new Battle(S.A, S.B, {vis:true, limit:S.limit, timeoutDef:S.timeoutDef, counter:S.counter ?? 30, spread:S.spread ?? 20});
  logShown = 0; $('#log').innerHTML = ''; $('#banner').className = 'banner'; $('#dmgCard').style.display = 'none';
  buildField(); renderField(false);
  $('#bStart').textContent = '▶ Fight'; $('#bPause').disabled = $('#bSkip').disabled = true;
}
function frame(ts){
  if (!running) return;
  acc += Math.min(0.1, (ts - lastTs)/1000) * speed; lastTs = ts;
  while (acc >= 0.05 && !B.over) { B.step(0.05); acc -= 0.05; }
  renderField();
  if (B.over) finish(); else requestAnimationFrame(frame);
}
function finish(){
  running = false;
  const win = B.winner === 'A';
  const bn = $('#banner'); bn.className = 'banner on ' + (win ? 'win' : 'lose');
  bn.textContent = win ? `🏆 VICTORY — Attack wins in ${fmtT(B.t)}` : `🛡 DEFEAT — Defense holds${B.timeout ? ' (time out)' : ''}`;
  $('#bStart').textContent = '↻ Rematch'; $('#bPause').disabled = $('#bSkip').disabled = true;
  $('#dmgCard').style.display = '';
  $('#dmgTable').innerHTML = `<table><tr><th>Hero</th><th>Damage</th><th>Healing</th><th>Taken</th></tr>${
    B.units.map(u => `<tr class="${u.side}"><td>${u.h.icon} ${B.label(u)}${u.alive ? '' : ' 💀'}</td><td>${fmt(u.dmg)}</td><td>${fmt(u.heal)}</td><td>${fmt(u.taken)}</td></tr>`).join('')}</table>`;
}
$('#bStart').onclick = () => {
  if (!hasTeams()) return alert('Both teams need at least one hero.');
  if (B && (B.over || B.t > 0)) resetBattleView();
  running = true; lastTs = performance.now(); acc = 0;
  $('#bStart').textContent = '▶ Fighting…'; $('#bPause').disabled = $('#bSkip').disabled = false; $('#bPause').textContent = '⏸';
  requestAnimationFrame(frame);
};
$('#bPause').onclick = () => {
  if (B.over) return;
  running = !running; $('#bPause').textContent = running ? '⏸' : '▶';
  if (running) { lastTs = performance.now(); requestAnimationFrame(frame); }
};
$('#bSkip').onclick = () => { running = false; B.runToEnd(); B.events.length = 0; renderField(false); finish(); };
$('#speed').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; speed = +b.dataset.s; $('#speed').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
$('#limit').value = S.limit; $('#toDef').checked = S.timeoutDef;
$('#spread').value = S.spread ?? 20;
$('#spread').onchange = () => { S.spread = +$('#spread').value; save(); resetBattleView(); };
$('#counter').value = S.counter ?? 30;
$('#counter').onchange = () => { S.counter = +$('#counter').value; save(); resetBattleView(); };
$('#limit').onchange = () => { S.limit = +$('#limit').value; save(); resetBattleView(); };
$('#toDef').onchange = () => { S.timeoutDef = $('#toDef').checked; save(); resetBattleView(); };

/* ============================ SIMULATION ============================ */
let simBusy = false;
$('#simRun').onclick = () => {
  if (simBusy) return;
  if (!hasTeams()) return alert('Both teams need at least one hero.');
  simBusy = true; $('#simRun').disabled = true;
  const N = +$('#simN').value, A = JSON.parse(JSON.stringify(S.A)), Bt = JSON.parse(JSON.stringify(S.B));
  const agg = {winA:0, to:0, time:0, units:null};
  let done = 0;
  (function chunk(){
    const end = Math.min(N, done + 100);
    for (; done < end; done++) {
      const b = new Battle(A, Bt, {limit:S.limit, timeoutDef:S.timeoutDef, counter:S.counter ?? 30, spread:S.spread ?? 20}).runToEnd(0.1);
      const heroes = b.units.filter(u => !u.summon);
      if (!agg.units) agg.units = heroes.map(u => ({side:u.side, name:u.name, icon:u.h.icon, dmg:0, heal:0, alive:0}));
      heroes.forEach((u, i) => { const a = agg.units[i]; a.dmg += u.dmg; a.heal += u.heal; a.alive += u.alive ? 1 : 0; });
      if (b.winner === 'A') agg.winA++;
      if (b.timeout) agg.to++;
      agg.time += b.t;
    }
    $('#simProg').style.width = (done/N*100) + '%';
    if (done < N) setTimeout(chunk, 0); else { showSim(agg, N); simBusy = false; $('#simRun').disabled = false; }
  })();
};
function showSim(a, N){
  const pa = a.winA/N*100, pb = 100 - pa;
  $('#simOut').innerHTML = `
    <div class="wbar"><div class="a" style="width:${pa}%">${pa >= 12 ? pa.toFixed(1)+'%' : ''}</div><div class="b" style="width:${pb}%">${pb >= 12 ? pb.toFixed(1)+'%' : ''}</div></div>
    <div class="row muted" style="justify-content:space-between"><span>🗡 Attack wins: ${fmt(a.winA)}</span><span>🛡 Defense wins: ${fmt(N - a.winA)}</span></div>
    <div class="stats">
      <div><b>${pa.toFixed(1)}%</b><span>Attack win rate</span></div>
      <div><b>${fmtT(a.time/N)}</b><span>Avg. battle time</span></div>
      <div><b>${(a.to/N*100).toFixed(1)}%</b><span>Time-outs</span></div>
    </div>
    <table><tr><th>Hero</th><th>Avg dmg</th><th>Avg heal</th><th>Survives</th></tr>${
      a.units.map(u => `<tr class="${u.side}"><td>${u.icon} ${u.name}</td><td>${fmt(u.dmg/N)}</td><td>${fmt(u.heal/N)}</td><td>${(u.alive/N*100).toFixed(0)}%</td></tr>`).join('')}</table>
    <p class="muted">${N.toLocaleString()} battles · time limit ${fmtT(S.limit)} · ${S.timeoutDef ? 'time-out counts as defense win' : 'time-out decided by remaining HP'} · power spread ±${S.spread ?? 20}% · counter rules ${({0:'off',15:'light',30:'normal',50:'strong'})[S.counter ?? 30]}</p>`;
}

/* ============================ HEROES TAB ============================ */
let listRole = 'all';
function renderHeroes(){
  roleChips($('#heroChips'), listRole, r => { listRole = r; renderHeroes(); });
  const q = $('#heroSearch').value.trim().toLowerCase();
  const list = Object.entries(HEROES).filter(([,h]) => heroMatch(h, listRole, q)).sort(byName);
  $('#heroList').innerHTML = `<p class="muted">${list.length} of ${Object.keys(HEROES).length} heroes</p>` + list.map(([k,h]) => {
    const s = scaledStats(mk(k));
    const counters = (h.counters || []).filter(c => HEROES[c]).map(c => HEROES[c].name);
    return `<div class="card" style="border-left:4px solid ${ROLES[h.role]}"><div class="hrow"><span class="i">${h.icon}</span><div style="flex:1;min-width:0">
      <b>${h.name}</b><span class="role" style="--rc:${ROLES[h.role]}">${h.role}</span>${h.line ? ` <span class="muted">· ${h.line} line</span>` : ''}${h.custom ? ` <button class="btn sm" data-edit="${k}">Edit custom</button>` : ''}
      <div class="kv"><span>HP <b>${fmt(s.hp)}</b></span><span>P.Atk <b>${fmt(s.patk)}</b></span><span>M.Atk <b>${fmt(s.matk)}</b></span><span>Armor <b>${fmt(s.armor)}</b></span><span>M.Def <b>${fmt(s.mdef)}</b></span><span>Crit <b>${s.crit}%</b></span><span>Dodge <b>${s.dodge}%</b></span></div>
      ${heroSkillsHtml(h)}
      ${counters.length ? `<p class="muted" style="margin:6px 0 0">Countered by: ${counters.join(', ')}</p>` : ''}
      ${h.notes ? `<details class="muted"><summary>Data notes</summary>${String(h.notes).replace(/[<>&]/g, '')}</details>` : ''}</div></div></div>`;
  }).join('');
}
$('#heroSearch').oninput = () => renderHeroes();
$('#heroList').onclick = e => { const b = e.target.closest('[data-edit]'); if (b) openCreator(b.dataset.edit); };

/* ---- custom hero creator ---- */
let crKey = null;
function crFillStats(d){
  $('#crStats').innerHTML = STAT_KEYS.map(([k,l]) => `<label>${l}<input type="number" step="any" data-k="${k}" value="${d[k] ?? 0}"></label>`).join('');
}
function crShowSkills(){ const h = HEROES[$('#crCopy').value]; $('#crSkills').innerHTML = h ? heroSkillsHtml(h) : ''; }
function openCreator(key){
  crKey = key || null;
  const d = key ? S.custom[key] : {name:'', icon:'🦸', role:'warrior', pos:50, copy:Object.keys(HEROES)[0], ...ROLE_T.warrior};
  $('#crTitle').textContent = key ? 'Edit custom hero' : 'New custom hero';
  $('#crName').value = d.name; $('#crIcon').value = d.icon; $('#crPos').value = d.pos;
  $('#crRole').innerHTML = Object.keys(ROLES).map(r => `<option value="${r}"${r===d.role?' selected':''}>${r}</option>`).join('');
  $('#crCopy').innerHTML = Object.entries(HEROES).filter(([,h]) => !h.custom).sort(byName).map(([k,h]) => `<option value="${k}"${k===d.copy?' selected':''}>${h.name}${h.ult ? ' — ' + h.ult.name : ''}</option>`).join('');
  crFillStats(d); crShowSkills();
  $('#crDel').style.display = key ? '' : 'none';
  $('#creator').classList.add('on');
}
$('#newHero').onclick = () => openCreator();
$('#crCopy').onchange = crShowSkills;
$('#crRole').onchange = () => { if (!crKey) crFillStats(ROLE_T[$('#crRole').value]); };
$('#crSave').onclick = () => {
  const name = $('#crName').value.trim(); if (!name) return alert('Give the hero a name.');
  const d = {name, icon:$('#crIcon').value.trim() || '🦸', role:$('#crRole').value, pos:Math.min(99, Math.max(1, +$('#crPos').value || 50)), copy:$('#crCopy').value};
  $('#crStats').querySelectorAll('input').forEach(inp => d[inp.dataset.k] = +inp.value || 0);
  d.aspd = Math.max(0.3, d.aspd);
  const key = crKey || 'c_' + Date.now().toString(36);
  S.custom[key] = d; registerCustom(key, d);
  $('#creator').classList.remove('on'); renderHeroes(); commit();
};
$('#crDel').onclick = () => {
  if (!crKey || !confirm(`Delete ${S.custom[crKey].name}? It will be removed from all teams.`)) return;
  const k = crKey, strip = t => sortTeam(t.map(c => c && c.key === k ? null : c));
  delete S.custom[k]; delete HEROES[k];
  S.A = strip(S.A); S.B = strip(S.B);
  for (const n in S.saved) { S.saved[n].A = strip(S.saved[n].A); S.saved[n].B = strip(S.saved[n].B); }
  $('#creator').classList.remove('on'); renderHeroes(); commit();
};

/* ============================ TABS / INIT ============================ */
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + b.dataset.tab));
  window.scrollTo(0, 0);
});
renderTeams(); resetBattleView(); renderHeroes();
