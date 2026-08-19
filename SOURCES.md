# Sources and attribution

## Player and roster data

### ericsanmiguel/football_elo
- Repository: https://github.com/ericsanmiguel/football_elo
- License: MIT.
- Current file used for research / refresh seed: `data/squads/2026.csv`.
- Use: verified 2026 player-to-club relationships, broad position group, age and market-value context for a limited bundled roster refresh.
- Career Eleven derives its own gameplay ratings and extended attributes. The repository is not used as a source of proprietary EA/FC/FIFA ratings.

### openfootball/players
- Repository: https://github.com/openfootball/players
- License: CC0 1.0 Universal / public domain.
- Use: public football-name/position research and fallback generation context.
- Generated squad fillers are explicitly Career Eleven gameplay-generated players.

### League participant lists
- Premier League, LaLiga, Bundesliga, Lega Serie A, Ligue 1, CBF Brasileirão, Liga Portugal and Liga Profesional public/official competition pages were used to verify competition size and current club participation for the playable league structures.
- These sources are used as factual references only. No league artwork, logos or proprietary assets are copied.

## Current limitation

The playable leagues now use complete league-sized club structures, but complete real-world 2026 player rosters are **not yet bundled for every club**. Where a verified open-data player-club relationship is available, Career Eleven can seed it. Remaining squad positions are generated and identified as gameplay data rather than presented as real-world roster facts.

## Match engine

`engine.js` and `contacts.js` are original project code.

The current engine uses a strictly free ball: there is no logical `ownerId`, no frame-by-frame interpolation of the ball toward a player and no homing pass. Ball movement comes from velocity, damping, wall/post collisions, circle contacts and player kick/touch impulses.

`contacts.js` adds strength-aware player/player collision behavior. Physical, balance and incoming momentum influence effective mass and displacement. Head-on collisions include lateral escape logic to prevent two agents from remaining locked together.

HaxBall is not the product name and no HaxBall source code, assets or stadium files are bundled. Public disc-physics ideas were only an early reference point for concepts such as damping, circle collision and kick impulse.

## Tactical research layer

`tactics.js` is original code implementing reusable football concepts: possession phases, pitch lanes, pressing triggers, third-man combinations, up-back-through patterns, overlaps, underlaps, overload-to-isolate, wide pressing traps and rest-defence structures.

## Builds and skills

Career builds and skills are original gameplay abstractions based on common football concepts. No proprietary EA Sports / FIFA / EA FC code, artwork, UI or protected gameplay data is copied.
