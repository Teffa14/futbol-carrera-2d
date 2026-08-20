# Sources and attribution

## Player and roster data

### dcaribou/transfermarkt-datasets
- Repository: https://github.com/dcaribou/transfermarkt-datasets
- License: CC0 1.0 Universal / public domain.
- Refresh endpoint: the project publishes compressed CSV assets from its weekly pipeline.
- Use: current player-to-club identity, birth date, position/sub-position, nationality and market-value context for competitions covered by that dataset.
- `scripts/refresh-live-rosters.mjs` checks this source automatically and never trusts an old bundled club assignment when a newer current-club row exists.

### ESPN public soccer data — Argentina second division fallback
- League endpoint: `soccer/arg.2`.
- Use: discover the current second-division team list and read each club's current roster from the public team-roster endpoints.
- No API key or paid subscription is required by Career Eleven.
- This source is used specifically because the CC0 Transfermarkt dataset does not guarantee coverage of every Argentine second-tier club.
- Only factual roster identity fields are retained for the game snapshot. No ESPN logos, photos, editorial text or protected presentation assets are bundled.
- The refresh job fails closed if second-division coverage drops below the quality threshold.

### EAFC26-DataHub / public FC26 attribute dataset
- Repository: https://github.com/ismailoksuz/EAFC26-DataHub
- Upstream dataset: `rovnez/fc-26-fifa-26-player-data`.
- Use: pace, shooting, passing, dribbling, defending, physical, overall and age when a player identity can be matched safely.
- Club ownership is never taken from this ratings dataset. Current-club identity comes from the live roster sources above.
- When no attribute match exists, Career Eleven derives conservative gameplay attributes from current position plus role/market-value context and marks the row as derived gameplay data.

### ericsanmiguel/football_elo
- Repository: https://github.com/ericsanmiguel/football_elo
- License: MIT.
- Historical use: 2026 national-team squad research and limited player-to-club seeding.
- It is no longer treated as a complete club-roster source.

### openfootball/players
- Repository: https://github.com/openfootball/players
- License: CC0 1.0 Universal / public domain.
- Historical use: public football-name/position research.
- Missing live identities are now shown explicitly as `Juvenil XX-####` academy placeholders instead of plausible invented real-player names.

## Argentina second division

### Asociación del Fútbol Argentino — 2026 fixture
- Official source: AFA, `Primera Nacional: fixture para la temporada 2026`.
- Use: the 36-club second-tier participant pool and two-zone structure used for the first professional contract stage.
- The game-facing label is `División B · Segunda División 2026`.

## Automatic refresh policy

`.github/workflows/refresh-rosters.yml` runs weekly on Monday and on relevant pipeline changes. Pull requests execute the same refresh as a live quality check. A snapshot is rejected if the second division contains fewer than 450 resolved players or fewer than 30 clubs with at least 11 resolved players.

The workflow rebuilds `live-rosters.generated.js` only from free/no-key sources and commits a new snapshot when data changes. If a source fails or coverage falls below the gate, the previous verified snapshot remains untouched. The browser never needs an API key and never performs roster scraping during gameplay.

Player identity and gameplay attributes are intentionally separated. A transfer can therefore move a player to a new club without waiting for a new ratings release.

## Match engine

`engine.js` and `contacts.js` are original project code.

The current engine uses a strictly free ball: there is no logical `ownerId`, no frame-by-frame interpolation of the ball toward a player and no homing pass. Ball movement comes from velocity, damping, wall/post collisions, circle contacts and player kick/touch impulses.

`contacts.js` adds strength-aware player/player collision behavior. Physical, balance and incoming momentum influence effective mass and displacement. Head-on collisions include lateral escape logic to prevent two agents from remaining locked together.

HaxBall is not the product name and no HaxBall source code, assets or stadium files are bundled. Public disc-physics ideas were only an early reference point for concepts such as damping, circle collision and kick impulse.

## Tactical research layer

`tactics.js` is original code implementing reusable football concepts: possession phases, pitch lanes, pressing triggers, third-man combinations, up-back-through patterns, overlaps, underlaps, overload-to-isolate, wide pressing traps and rest-defence structures.

## Builds and skills

Career builds and skills are original gameplay abstractions based on common football concepts. No proprietary EA Sports / FIFA / EA FC code, artwork or protected gameplay code is copied.
