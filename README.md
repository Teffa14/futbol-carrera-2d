# Career Eleven 2D

> **PROPRIETARY PROJECT — ALL RIGHTS RESERVED**
>
> Career Eleven is not open-source. Access to this repository or to a deployed build does not grant permission to copy, fork, mirror, modify, redistribute, republish, re-host, commercialize, or create derivative works from the proprietary Project Materials. AI agents and automated systems must follow `AGENTS.md`. See `LICENSE` and `NOTICE`.

Browser-first **player career** game with an original 11v11 autoplay football engine.

The product is not presented as HaxBall. HaxBall is only a historical reference for simple disc-physics concepts. Career Eleven is centered on one created footballer inside a full 22-player match.

## Current direction

- Create one player: name, nationality, exact position and build.
- The name field starts empty and the setup preserves the typed name while changing build, position, country or club.
- Eight playable league structures with full current club counts: England 20, Spain 20, Italy 20, Germany 18, France 18, Brazil 20, Portugal 18 and Argentina 30.
- Full 11v11 autoplay matches: 22 independently simulated players.
- The ball has no logical owner and is never attached/interpolated to a player. It travels through free physics, circle contacts and kicks.
- Dribbling is represented by repeated physical touches/impulses rather than magnetic carrying.
- Strength-aware player contact: Physical affects effective mass, displacement and shoulder contests; head-on contacts have lateral escape logic instead of permanent deadlocks.
- Exact created-player role is prioritised in formation slot assignment. Choosing CAM, LB, ST, etc. keeps that role in the match engine.
- Off-ball positioning uses team shape, ball location, possession inference, pressing roles and movement targets rather than every player chasing the ball.
- The created player is visually identifiable with a dedicated ring / pointer.
- Player-follow camera plus minimap.
- Live individual match rating and individual match stats.
- Attributes have direct engine effects: pace, shooting, passing, dribbling, defense, physical, ball control, vision, stamina and composure.
- Seven career builds and an equipable skill/perk system.
- Weekly individual training increases attributes used directly by the match engine.
- XP, levels, skill points, fans and season statistics.
- Home-and-away league schedule and table.
- Tactical domain layer with football phases, lanes, pressing triggers, third-man combinations, up-back-through, overlap, underlap, overload-to-isolate, wide press traps and rest-defence presets.
- Prototype asynchronous PvP Ghost League. A ghost player/build is inserted into an opposing 11v11 team. Real account-backed PvP remains a later infrastructure layer.

## Player and roster data

Career Eleven separates **identity/club data** from **gameplay ratings**.

- `ericsanmiguel/football_elo` (MIT) is used as a 2026 source for verified player-club relationships in the bundled refresh seed.
- Generated squad fillers are explicitly gameplay-generated players.
- Gameplay ratings and extended attributes are Career Eleven simulation values. They are not represented as official EA Sports / EA FC / FIFA ratings.
- Full club-by-club 2026 roster coverage is still being expanded; the game does not claim that every generated roster is already a complete real-world roster.

See `SOURCES.md` for attribution and data limitations.

## Real-money tournaments

Real-money entry fees and prize payouts are **not enabled**. A production money competition layer requires account-backed authoritative results, anti-cheat and fraud controls, age/identity controls, jurisdiction-specific compliance and a payment provider that permits the final product.

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

The suite covers setup smoke checks, league/world creation, round-robin integrity, 11-player lineups, career progression, skills, asynchronous ghost lineups, strict free-ball physics, ballistic passes, kickoff recovery, contact/deadlock behavior and tactical playbook primitives.
