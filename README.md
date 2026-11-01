# Hero Wars Arena Tools

Two offline, single-file browser tools for **Hero Wars: Alliance** arena:

| Tool | What it does | Open |
|---|---|---|
| [Arena Matchup Analyzer](#arena-matchup-analyzer) | Log your arena fights, estimate your win chance against an enemy team, and get the best team from the heroes you own. | `arena-analyzer.html` |
| [Arena Battle Simulator](#arena-battle-simulator) | Simulate a 5v5 fight hero by hero, watch it play out, or run it hundreds of times to get a win rate. | `arena-sim/index.html` |

No install, no server, no account. Open the HTML file in any modern browser (desktop or phone). All your data stays in that browser's local storage.

> Fan-made tools. Not affiliated with or endorsed by Nexters. Hero data and counter rules come from community guides and may be out of date after balance patches.

---

## Arena Matchup Analyzer

`arena-analyzer.html`: a single HTML file with no dependencies.

### Features

- **My heroes:** enter the heroes you own and their power. Powers you type when logging a fight update this list automatically.
- **Analyze:** enter the enemy team (and optionally their power) to get:
  - **Suggested teams from My heroes:** your top 5 line-ups ranked by predicted win chance, with the counter rules working for (✓) and against (✗) each one. **Use** fills the team in.
  - **Predicted win chance** for a team you enter, with a full breakdown of how it was calculated.
  - **Heroes that counter this enemy** according to the guide rules (heroes you own are tagged *yours*).
  - **Your best logged teams** against this enemy, from your fight history.
- **Log battle:** record your team, the enemy team, powers and the result (win/loss).
- **History** and **Hero stats:** overall win rate, the enemy heroes that beat you most, and your win rate per hero.
- **Counters:** about 175 built-in "hero A counters hero B" rules (hard / normal / soft), mostly from the [AllClash counter list](https://www.allclash.com/hero-wars-counters-best-counter-hero-to-each-hero/) (Oct 2026). Leonel, Eva and Kendle rules come from AlexandreGames, OMG.ROCKS and Hero Wars Olympus. Add, delete or filter rules; your own rules survive updates.
- **Hero list:** edit the drop-down list when new heroes are released.
- **Backup:** export / import everything as JSON.

### How the win chance is calculated

It is a weighted average that starts from 50% and adds each signal that has data:

| Signal | Weight |
|---|---|
| Exact same matchup in your history | 3 per fight |
| Similar matchups (3+ same heroes on each side) | 1.5 per weighted fight |
| Your heroes vs their heroes (pair records) | up to 5 |
| Team power ratio (only if every hero on both sides has a power) | 2 |
| Guide counter rules (hard = 3, normal = 2, soft = 1) | up to 4 |

Team suggestions shortlist up to 14 of your heroes (best counters plus strongest), then score every 5-hero combination with the same formula. Line-up positions (front/back) are not checked.

---

## Arena Battle Simulator

`arena-sim/index.html`: a mobile-friendly single page with the engine and the data for 77 heroes bundled in.

### Features

- **Teams:** pick 5 attackers and 5 defenders, set level (1–120) and stars (1–6★) per hero, override any stat, and save / load team presets.
- **Battle:** watch a fight play out with HP, energy, shields and crowd-control effects, at 1×, 2× or 4× speed or skipped to the end.
- **Simulate:** run the same matchup many times (crits, dodges and targeting are random) and get the attacker's win rate.
- **Heroes:** browse every hero's skills and modelling notes, or add a **custom hero**.

### How it works

Each hero's kit is described as data: skills, cooldowns, triggers and effects (damage, DoT, heal, shield, CC, energy, revive, summon, and more). Effect values are formulas such as `pct% of stat + flat`. The engine (`src/engine.js`) runs these in real time. Base stats come from role templates at Lv120 / 6★, scaled by each hero's level and stars.

The simulation is an approximation. Some mechanics are simplified, and each hero's `notes` say what was approximated.

### Project layout

```
arena-sim/
├── index.html              # built output: open this
├── research/g1.js … g7.js  # researched hero kits (sources listed at the top of each file)
└── src/
    ├── template.html       # page markup + styles
    ├── app.js              # UI
    ├── engine.js           # battle engine (also usable from Node)
    ├── overrides.js        # manual fixes applied on top of the research data
    ├── heroes.generated.js # merged hero data (generated)
    ├── build.js            # merges data, validates it, bundles index.html
    └── test.js             # headless battles + smoke test
```

### Building and testing

Requires [Node.js](https://nodejs.org/). There are no npm packages.

```bash
cd arena-sim
node src/build.js      # rebuild index.html after changing research/, src/ or overrides.js
node src/test.js       # sample matchups + 3,000 random battles as a smoke test
node src/test.js log   # print a full turn-by-turn log of one battle
```

To add or fix a hero, edit the right `research/g*.js` file (or `src/overrides.js`), then run `build.js`. Any data errors are listed as validation issues.

---

## Data and privacy

Both tools save everything only in your browser's `localStorage`. Nothing is uploaded. Clearing your browser data removes it, so use **Backup → Export JSON** in the analyzer regularly.

Exported backups (`arena-battles-*.json`) contain your personal fight history and are excluded from the repo by `.gitignore`.
