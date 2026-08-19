# Sources and attribution

## Player data

### Yusufhan30/FC26-premier-league-dataset
- Repository: https://github.com/Yusufhan30/FC26-premier-league-dataset
- License: CC0 1.0 Universal.
- Use: bundled Premier League seed names, clubs and six gameplay attributes.

### openfootball/players
- Repository: https://github.com/openfootball/players
- License: CC0 1.0 Universal / public domain.
- Use: public player-name and positional pools used to complete 11v11 squads and generated career players.
- Generated ratings, extended attributes and potentials are original Career Eleven gameplay values.

### dcaribou/transfermarkt-datasets
- Repository: https://github.com/dcaribou/transfermarkt-datasets
- License: CC0 1.0 Universal.
- Use: structural research for club / competition data. The DVC-hosted raw player payload is not bundled.

## Match engine

`engine.js` and `contacts.js` are original project code. The engine models 22 players and a permanently free ball. There is no ball owner, capture, attachment or magnetic-control state. Dribbling emerges from repeated player-ball collisions. Passes and shots are armed as player intentions but only change ball velocity when physical contact occurs, in the direction the player is facing.

Player-player contests use effective mass, Physical, derived or explicit balance, momentum transfer, lateral deadlock escape, path steering and body-position shielding leverage. Those systems affect player movement only and never reposition, steer or attach the ball.

HaxBall is not used as the product name or represented as the engine implementation. Publicly documented disc-physics concepts were only an early calibration reference for ideas such as damping, radius, collision and kick impulse.

## Builds and skills

Career builds and skills are original gameplay abstractions. They use common football-game concepts such as archetypes, perks and player development. No proprietary EA Sports / FIFA / EA FC code, data, artwork or trademarked UI is copied.
