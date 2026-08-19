# HaxBall Career — Manager Mode 2D

Browser football career game that combines a manager simulation, a fast narrative career loop and an original HaxBall-inspired 5v5 autoplay physics engine.

Production: https://futbol-carrera-2d.vercel.app

## What the game does

A career starts with manager identity, nationality, country and club selection. The player then controls the complete sporting loop instead of receiving random scorelines from a menu.

- Country and club selection across England, Argentina, Spain, Italy, Germany, France, Brazil and Portugal.
- Persistent browser career with manager reputation, board confidence, dressing-room state, media profile, legacy and trophy history.
- Weekly narrative decisions with persistent consequences, inspired by the short-form career pacing of games such as Copero and El Ídolo. No code, prose, event text or assets from those games are copied.
- Proper home-and-away round-robin league scheduling. A club cannot play twice in the same league round.
- Persistent squads for every AI club. AI clubs train players and make market moves between rounds.
- Contracts, wages, morale, fitness, form, injuries, player values and listing players for sale.
- Incoming transfer offers with accept/reject flow.
- Transfer market with scouting reports, hidden potential ranges and club/player negotiation thresholds.
- Preseason/global draft with limited picks and AI removal of prospects from the board.
- Six staff roles: Head Coach, Assistant Coach, Scout, Physio, Data Analyst and Youth Coach.
- Weekly training focus and intensity with development, fatigue and injury risk.
- Tactical system for 5v5: 1-2-1, 2-1-1 and 1-1-2 shapes; defensive/balanced/attacking mentality; pressing; tempo; width; short/balanced/direct passing.
- Sponsor selection with guaranteed income, weekly income and season objectives.
- Domestic cup progression, league prizes, sponsor bonuses and multi-season progression.
- Manager job offers and club changes after the season.
- Career verdict/legacy loop for a faster, more replayable manager story.

## 2D autoplay match engine

League matches are played by the browser simulation. The engine does not roll a final score and then animate it.

Each player is an independently simulated disc with position, velocity, collisions, fatigue and attribute-driven acceleration. The ball has its own velocity, damping, wall/post collisions and kick impulses. The AI uses the selected shape and tactical settings to decide pressing, covering, marking, movement off the ball, passes, dribbles and shots.

The engine currently models:

- Player/player and player/ball collisions.
- Goal posts as collision bodies.
- Ball damping and rebounds.
- Attribute-driven movement speed and kick quality.
- Tactical pressing, width, tempo and mentality.
- Goalkeeper positioning and saves.
- Passing-lane evaluation and forward-progress scoring.
- Shot angle/distance evaluation and finishing error.
- Tackles/ball recoveries through physical contests.
- Possession, shots, shots on target, saves, passes and recoveries.
- Deterministic seeded simulation for repeatable tests.

The implementation is original. Public HaxBall stadium/editor concepts were used only as a high-level reference for disc-physics calibration.

## Player data

The game uses openly licensed GitHub data rather than scraping commercial game sites at runtime.

- `Yusufhan30/FC26-premier-league-dataset` — CC0-1.0. Real Premier League player names, clubs and bundled gameplay attributes.
- `openfootball/players` — CC0-1.0/public domain. Player-name and positional pools used to build additional squads/prospects when a complete rating pack is not bundled.
- `dcaribou/transfermarkt-datasets` — CC0-1.0. Reference for football data architecture/market modelling.
- `footballcsv/cache.footballsquads` — CC0-1.0. Reference for public squad structures and naming.

Generated ratings outside the bundled Premier League pack are explicitly tagged in-game. They are career gameplay values, not represented as official FC/FIFA ratings.

See `SOURCES.md` for attribution details.

## Run locally

No application server or database is required.

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Tests

Node 22+:

```bash
npm test
npm run check
```

The test suite checks round-robin scheduling, world squad creation, round advancement, draft, training, market isolation, app module smoke rendering and deterministic completion of the 2D physics match engine.

## Architecture

- `index.html` — static entry point.
- `styles.css` — responsive manager UI and matchday layout.
- `data.js` — clubs, open player data, formations, staff, sponsors and narrative event templates.
- `career.js` — career/world simulation, contracts, transfer market, staff, training, scheduling, sponsors, cup and progression.
- `engine.js` — 2D disc physics and football AI.
- `app.js` — browser UI and match loop.
- `tests/` — deterministic Node tests.

Career saves use browser `localStorage`. No account or backend is required.
