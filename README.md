# Career Eleven 2D

Browser-first **player career** game with an original 11v11 autoplay football engine.

This repository no longer presents the product as a HaxBall manager. HaxBall remains only a historical reference for simple disc-physics ideas. The game itself is centered on one created footballer inside a full 22-player match.

## Current direction

- Create one player: name, nationality, position and build.
- The name field starts empty. No personal name is hard-coded as a default.
- Eight countries / leagues with current expanded club sets.
- Full 11v11 autoplay matches: 22 independently simulated players.
- The ball is permanently free. It has no owner, attachment, magnetic control or capture state.
- Carrying the ball emerges from repeated physical body-to-ball contacts. Passes and shots only execute on real circle contact and leave the foot in the direction the player is facing.
- Player-player contact uses effective mass, Physical, balance, momentum, lateral escape steering and body-position leverage so stronger players can win or protect a line without welding two players together.
- Goalkeepers save and deflect through physical contact rather than remote catches.
- The created player is always visually identifiable with a dedicated ring / pointer.
- Player-follow camera plus minimap.
- Live individual match rating.
- Live individual stats: goals, assists, passes, dribbles, shots, tackles, interceptions and turnovers.
- Attributes have direct engine effects: pace, shooting, passing, dribbling, defense, physical, ball control, vision, stamina and composure.
- Seven career builds and an equipable skill/perk system.
- Weekly individual training increases attributes that the match engine reads directly.
- XP, levels, skill points, fans and season statistics.
- Home-and-away league schedule and table.
- Prototype asynchronous PvP “Ghost League”: an opponent profile contributes its player/build to an opposing 11v11 team. The current build uses local ghost profiles; real user accounts/backend are the next infrastructure layer.

## Real-money tournaments

Real-money entry fees and prize payouts are **not enabled** in this build. The competitive format can be developed separately, but enabling money movement requires account infrastructure, age/identity controls, jurisdiction-specific rules, anti-fraud systems and a payment provider that supports the final product.

## Data

Bundled seed attributes and public-domain / CC0 player-name pools are used to complete larger 11v11 squads. Generated values are explicitly career-game values and are not represented as official EA/FC/FIFA ratings.

See `SOURCES.md`.

## Run

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Tests

Node 22+:

```bash
npm run check
npm test
```

The test suite validates league worlds, 11-player lineups, round-robin integrity, custom-player insertion, training, skills, asynchronous ghost lineups, kickoff recovery, permanently free-ball physics, facing-only contact kicks, strength-aware player collisions, anti-deadlock steering, physical shielding leverage and deterministic completion of a 22-player match.
