# Career Eleven 2D

Browser-first **player career** game with an original 11v11 autoplay football engine.

This repository no longer presents the product as a HaxBall manager. HaxBall remains only a historical reference for simple disc-physics ideas. The game itself is now centered on one created footballer inside a full 22-player match.

## Current direction

- Create one player: name, nationality, position and build.
- The name field starts empty. No personal name is hard-coded as a default.
- Eight countries / leagues with six clubs each.
- Full 11v11 autoplay matches: 22 independently simulated players.
- Ball possession is a real engine state. A player can control and carry the ball instead of every touch becoming an immediate pass/kick.
- Dribbling, first touch, shielding, physical duels, tackles, interceptions, passes, shots, goalkeeper saves and stamina.
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

Bundled Premier League seed attributes come from `Yusufhan30/FC26-premier-league-dataset` under CC0-1.0. Public-domain / CC0 player-name pools from `openfootball/players` are used to complete larger 11v11 squads outside the bundled data pack. Generated values are explicitly career-game values, not represented as official EA/FC/FIFA ratings.

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

The test suite validates all eight league worlds, 11-player lineups, round-robin integrity, custom-player insertion, training, skills, asynchronous ghost lineups, kickoff recovery, ball control and deterministic completion of a 22-player physical match.
