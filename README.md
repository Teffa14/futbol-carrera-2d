# HaxBall Manager 2D

A browser-first football manager game with an original HaxBall-inspired 2D autoplay match engine.

## Included systems

- Manager profile, country and club selection
- Persistent browser career using `localStorage`
- 5v5 2D autoplay matches on an HTML Canvas physics pitch
- Player attribute-driven movement, kicking, passing, shooting and role positioning
- League table and deterministic fixture simulation
- Squad selection, fitness, morale, injuries and contracts
- Preseason/global draft
- Transfer market and transfer budget
- Staff hiring: coaches, scouts, physios, analysts and youth staff
- Weekly training focus and intensity
- Multi-season progression
- Responsive desktop/mobile UI

## Data provenance

The bundled Premier League gameplay attributes are adapted from the CC0-1.0 repository `Yusufhan30/FC26-premier-league-dataset`. Public-domain player name pools for generated squads are adapted from `openfootball/players` (CC0-1.0). Generated ratings are clearly marked and are original gameplay values.

No HaxBall source code or proprietary game assets are included. The match engine is an original implementation inspired by the publicly documented disc-physics concepts and stadium parameters used by HaxBall.

## Run locally

No build step is required.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy

The repository is a static site and is compatible with Vercel with zero build dependencies.
