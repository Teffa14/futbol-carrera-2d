# Career Eleven — Canonical Game Plan

This file is the canonical product roadmap for `futbol-carrera-2d`.

It is based on the full 148-section design plan supplied by the project owner. Every implementation pass must move the repository toward this product, not merely optimize the subsystem that was touched most recently.

## Precedence

1. The product vision in this roadmap defines the destination.
2. Explicit later decisions from the project owner override older implementation details.
3. Current non-negotiable physics invariants override any older wording that could imply magnetic possession, automatic ball capture, or ball ownership.
4. Existing green behavior must not be broken just to add scope.

In particular, any old design language such as `controlled possession`, `first touch`, `shielding`, or `reception` must be interpreted as football context, perception, intent, analytics, or sequences of physical contacts. It must never mean that the ball attaches to a player.

---

# 1. Product identity

Career Eleven is not an automatic manager game and not merely HaxBall with autonomous players.

The core fantasy is:

- Create a footballer.
- Enter a club that already has its own coach, tactical model, squad hierarchy, competitions and problems.
- Learn what the coach expects from your role.
- Configure how your footballer interprets that role.
- Train technical actions, tactical concepts, relationships and prepared patterns.
- Prepare for opponents.
- Watch the autonomous match engine attempt to execute those ideas.
- Improve technical capacity, football intelligence, tactical understanding, reputation and influence across an entire career.
- Eventually gain enough status to influence some club decisions without becoming the manager.
- In full-team competitive 11v11, unlock the complete Tactical Lab and program the whole football ecosystem.

The campaign is an individual football career. The club exists independently from the user. At the start the user does not choose the XI, formation, transfer policy or collective pressing system.

The final identity is: **a 2D football career simulator where the player develops not only technical ability but a programmable tactical identity.**

The distinctive feeling should be: "That move happened because I taught and prepared it."

---

# 2. Fundamental action model

Ability, decision and execution are different things.

A complete action follows:

`PERCEPTION -> INTERPRETATION -> INTENTION -> DECISION -> EXECUTION -> RESULT`

Passing 90 means high capacity to execute a pass, not automatic selection of the best pass.

Two players with identical visible attributes can behave very differently because their tactical profiles, learned concepts, scanning habits, role interpretations, risk preferences and playbook rules differ.

Attributes answer: **Can I execute this?**

Tactical intelligence and perception answer: **Can I see and understand this?**

Decision policy answers: **Do I choose this?**

Preparation and familiarity answer: **Can I coordinate this with teammates at the right time?**

---

# 3. Non-negotiable physical simulation

The ball is always a free physical entity.

It has its own position, velocity, direction, friction, collisions, rebounds and optional future spin model.

It never has:

- `ownerId`
- logical owner movement
- attachment to a player
- magnetic control
- automatic capture
- first-touch capture
- homing passes
- mid-flight steering toward a receiver

Dribbling is repeated physical player-ball contacts.

Passing and shooting only create an intention and player orientation. The ball moves only when a real physical contact occurs. The kick impulse starts from the direction the player is facing at contact, with contextual technical error layered on top.

After the kick, the ball follows physics until another physical collision changes it.

Keepers also save through physical contact. They do not magically catch a shot.

Analytics may infer who is advantaged, shielding, contesting, closest, or likely to control the next touch. Those labels never govern the ball.

The current smaller ball scale is intentional and should remain unless there is a strong measured reason to change it.

---

# 4. Player-player physical contact

Players must not become welded together or repeatedly chase an impossible identical point.

Physical and balance must have mechanical meaning:

- effective mass
- displacement resistance
- shoulder leverage
- shielding leverage
- momentum conservation
- balance recovery
- body orientation

A stronger player can move a weaker player when geometry and momentum allow it. Strength is not a pure RNG duel winner.

Position matters. A smaller player with better leverage and body position can still protect a line.

The collision system must include deterministic anti-deadlock behavior, lateral exits and path avoidance. AI agents should route around a directly blocked line instead of repeatedly recreating the collision.

---

# 5. Football space model

The engine must understand more than X/Y coordinates.

It needs relative football references such as:

- build-up zone
- first, middle and final thirds
- box
- left/right wide lanes
- left/right half-spaces
- central lane
- between lines
- behind a line
- in front of a line
- blind side
- fullback-centre-back interval
- centre-back-centre-back interval
- strong side
- weak side
- free zone
- pressure zone
- receiving zone
- finishing zone

Instructions and playbooks should target relative football spaces, not fixed coordinates whenever possible.

The engine also needs defensive-line identification and line-breaking detection.

A seven-metre pass through a midfield line can be more valuable than a twenty-metre harmless lateral pass.

---

# 6. Dynamic control of space

The engine should estimate time-to-arrival, not just nearest-player distance.

Space control should consider:

- current position
- velocity
- acceleration
- orientation
- fatigue
- momentum
- reaction latency

This should support questions such as:

- Is the passing lane actually open?
- Does the receiver have time?
- Can a defender intercept?
- Is there a dynamic advantage despite similar distances?
- Which space can be attacked before the opponent controls it?

This layer becomes a shared dependency for passing, pressing, runs, interception, tactical evaluation and playbook branching.

---

# 7. Match phases and shapes

A nominal formation is only the starting reference.

Teams need phase-dependent shapes. Example:

- base: 4-3-3
- build-up: 3-2
- progression: 3-2-5
- final third: 2-3-5
- defensive transition: 4-1-4-1
- high press: 4-4-2

Match tactical states should include at least:

With ball:

- BUILD_UP
- FIRST_PROGRESSION
- MIDDLE_THIRD_PROGRESSION
- FINAL_THIRD
- BOX_ATTACK
- SUSTAINED_ATTACK
- COUNTERATTACK

Without ball:

- HIGH_PRESS
- MEDIUM_PRESS
- MID_BLOCK
- LOW_BLOCK
- BOX_DEFENCE

Transitions:

- BALL_WON
- BALL_LOST
- COUNTERPRESS
- RECOVERY
- EMERGENCY_DEFENCE

Players can have different responsibilities in every state.

---

# 8. Perception, scanning and body orientation

Agents need an information model, not omniscience.

A player should perceive and retain information according to scanning, vision, awareness and context.

Important concepts:

- recent scan direction
- marker visual cone
- approximate remembered opponent position
- blind-side movement
- reaction delay
- body orientation
- receiving profile
- dominant/weak foot

Vision affects what and how much the player can perceive.

Tactical IQ affects what information the player looks for and how it is interpreted.

Composure affects how effectively the information is used under pressure.

Body orientation changes what actions are technically available and how much time they require.

---

# 9. Tactical profiles

Visible technical stats must not fully define behavior.

Players need tactical profiles and conditional tendencies.

Examples for two statistically identical wingers:

Isolation winger:

- high width priority
- high 1v1 appetite
- ball-to-feet preference
- outside isolation
- cutback preference

Combinative winger:

- higher half-space occupation
- third-man combinations
- one-touch layoffs
- inside movements
- underlaps and rotations

Do not reduce this to a single `Dribble Frequency` slider.

---

# 10. Conditional personal programming

The advanced system should use football logic blocks rather than code:

- WHEN
- IF
- AND
- UNLESS
- THEN
- UNTIL

Example:

WHEN possession enters right flank
IF I am outside the opposition block
AND the opposing LB is narrow
THEN maintain maximum width
UNTIL the ball progresses beyond me

Another:

WHEN receiving on right wing
IF defender distance > threshold
THEN carry
IF defender closes quickly
THEN decelerate and evaluate
IF defender protects outside
THEN cut inside
IF second defender arrives
THEN seek combination

Rules need priority resolution based on team instruction, active pattern, context specificity, coach priority, player freedom, risk and personal preference.

---

# 11. Coach model, Role Contract, Trust and Influence

A coach is a tactical model, not a buff provider.

A coach can define:

- build-up preference
- width model
- fullback behavior
- pressing approach
- defensive line
- rest defence
- final-third principles
- directness
- transition rules

Before matches, the player should receive a Role Contract describing responsibilities by phase.

Evaluation should separate:

- technical/performance rating
- tactical compliance
- coach assessment

Coach Trust affects minutes, tactical freedom, responsibility and role security.

Tactical Influence is different from Trust. Influence comes from sustained performance, tenure, leadership, reputation, contract weight, captaincy, tactical intelligence and team success.

Low influence: receive instructions.

Medium: request personal adjustments.

Higher: suggest relationships or patterns.

Very high: influence some structural choices.

The coach can still reject the suggestion. The user remains a footballer, not the manager.

---

# 12. Opposition preparation and adaptation

Before matches, scouting can reveal imperfect tendencies such as:

- aggressive fullback stepping
- slow channel recovery
- narrow midfield block
- backpass pressing trigger
- high defensive line
- preferred attack side
- common patterns

The user prepares personal behavior against those tendencies.

During the match the opponent should adapt. Repeating the same cut-ins or combinations should gradually alter defender expectations according to intelligence and scouting knowledge.

Pattern history enables tactical deception: show one behavior repeatedly, then exploit the opponent's expectation.

---

# 13. Playbooks

A playbook is not a fixed animation or a drawing of arrows.

Each pattern needs:

- name
- phase
- required shape
- trigger
- preconditions
- participants
- spatial references
- roles
- first movement
- preferred sequence
- reads
- branches
- abort conditions
- reaction to loss
- success condition
- training familiarity

Core real-football templates include:

- Third Man
- Up-Back-Through
- Overlap
- Underlap
- Overload-to-Isolate
- Wide Rotation
- Box Midfield concepts
- five-lane occupation
- box occupation
- cutback structures
- far-post attack
- pressing traps
- Rest Defence
- Rest Attack
- transition patterns
- goal-kick routines
- kick-off routines
- throw-ins
- corners and free kicks

Patterns must react to defenders and available space. Never implement them as rigid A->B->C scripts.

Every pattern needs abort conditions and fallbacks so the simulation cannot freeze waiting for an unavailable action.

---

# 14. Decision engine

The agent loop conceptually contains six systems:

1. Simulation — positions, ball, physics and collisions.
2. Perception — what each agent currently knows.
3. Tactical State — current phase, structure and active pattern.
4. Decision Engine — what the agent intends to do.
5. Execution — how attributes and context turn intention into physical action.
6. Evaluation — what football value resulted.

Different layers can update at different frequencies. Movement can update rapidly, perception less often and high-level tactical decisions less often again.

Agents should build candidate actions, remove tactically invalid options, score the remaining actions, commit to one and execute it physically.

Candidate utility may use:

- progression value
- turnover risk
- coach instruction
- pattern relevance
- space gain
- goal threat
- possession security
- tactical profile
- score
- match time
- fatigue
- pressure

Use controlled stochasticity among plausible high-value actions, not pure RNG.

Action commitment is required so players do not change their minds every frame. Decisions can abort when meaningful conditions change.

---

# 15. Attribute mechanics

Every attribute should alter concrete mechanics.

Pace summarizes acceleration, top speed, deceleration and explosiveness.

Dribbling affects:

- touch precision while moving
- loss of speed during direction changes
- rhythm changes
- technical accuracy at pace

Ball Control affects:

- physical first-contact quality
- difficult receptions
- close-space touches
- oriented touches

Passing affects:

- technical direction
- weight
- trajectory
- usable kicking surfaces

Shooting affects:

- power
- placement
- finishing
- curve

Defence affects:

- tackle timing
- anticipation
- interception
- defensive positioning
- blocking

Physical affects:

- balance
- shielding
- shoulder contact
- displacement resistance

Stamina affects:

- repeat effort
- recovery
- acceleration capacity over time
- pressing/running choices

Vision affects option detection and line recognition.

Composure affects technique and decision quality under pressure.

Flair unlocks and supports unconventional but contextually valid solutions.

---

# 16. Dribbling and duels

Dribbling must be visible physical behavior.

Touch length and timing vary with speed, open space, pressure, orientation, Dribbling and Ball Control.

Support:

- microtouches
- close carry
- push-and-run
- stop-start
- inside cut
- outside push
- body feint
- double touch
- shielding
- letting the ball run
- acceleration after a touch

Defenders can choose or infer responses such as contain, step, force inside, force outside, tackle, shoulder challenge or drop.

The relationship between attacker decision, defender decision, body geometry and execution matters more than a one-roll RNG contest.

---

# 17. Passing, shooting, rebounds and second balls

Passes can have intent types such as:

- ground
- driven
- lofted
- through
- cross
- cutback
- switch
- layoff

A pass to space targets a future location, not a moving player after the kick. Prediction happens before physical contact; after contact there is no steering.

Shooting decisions consider angle, balance, pressure, foot, keeper position, shot type, finishing and composure.

Rebounds matter:

- posts
- keeper parries
- blocks
- loose clearances
- second balls

Teams and players can be trained for rebound and second-ball positioning.

---

# 18. Causal evaluation and ratings

Do not reward only goals and assists.

The evaluation layer should recognize causal football value such as:

- width fixation
- defender displacement
- space creation
- line breaks
- third-man involvement
- progressive passes
- receiving advantage created
- pressing that forces a backpass
- cover shadows
- denied lanes
- counterattack delay
- defensive cover
- decoy runs
- rest-defence value

Match rating should internally separate:

- technical contribution
- tactical contribution
- possession contribution
- defensive contribution
- off-ball contribution
- error cost
- context weighting

Build an xT/EPV-like threat model that also accounts for defensive structure, numerical advantage, orientation and space.

Post-match should eventually provide:

- touches
- runs
- received zones
- defensive actions
- average position
- width/depth behavior
- line breaks
- pressures
- heatmap
- pattern attempts/success/breakdown
- coach review

---

# 19. Training and familiarity

Training is not simply `+1 Shooting`.

There are technical and tactical development tracks.

Pattern Familiarity represents synchronization quality, not a flat buff.

Low familiarity can cause:

- late runs
- poor body orientation
- mistimed passes
- duplicated space occupation
- slow branch recognition

High familiarity improves coordinated timing and anticipation.

Track familiarity at multiple levels:

- player-to-concept familiarity
- pair familiarity
- trio/unit familiarity
- line/unit familiarity
- pattern familiarity
- opponent-specific temporary preparation

Changing teammates can reduce effective synchronization even if the replacement has better raw attributes.

Training sessions are limited. Concepts can decay. The player must choose what to maintain and what to prepare.

---

# 20. Player development system

The career must have long-term progression, not three perks and an almost-finished 70 OVR starter.

A created player should start young and meaningfully below elite level. Starting ability depends on age, background, academy, position, potential and competition level.

A normal career can begin in:

- academy
- reserve team
- third tier
- second division
- small first-division club

The player earns minutes, starts, promotion, reputation and transfers.

Track:

- age/date of birth
- season history
- dynamic potential
- technical development
- physical development
- tactical development
- confidence
- form
- fitness/load
- injuries
- minutes
- club context
- coach relationship
- role experience

Development curves differ by attribute. Pace and some physical qualities develop and decline earlier. Vision, Composure and Tactical IQ can mature later.

A career has a peak, decline and retirement.

Retirement can result from age, physical decline, injuries, lack of club opportunities or player choice.

Keep a complete career history: clubs, divisions, promotions, trophies, international career, statistics and achievements.

---

# 21. Traits, techniques and specialization

Replace the hard cap of three generic perks with a deeper capability system.

Possible capability families:

- technical traits
- role specializations
- weak foot development
- kicking surfaces
- first-contact techniques
- scanning habits
- timing concepts
- off-ball movements
- shielding
- pressing
- passing techniques
- finishing techniques
- dribbling actions
- tactical concepts

Traits should unlock or improve specific solutions, not universal percentage buffs.

Examples:

- Elite First Touch
- Threaded Pass
- Outside Foot
- Press Resistant
- Interceptor
- Long Shot
- Speed Burst

Some capabilities are learned permanently. Others depend on mastery, training or familiarity.

Build identity comes from attributes + traits + role + tendencies + personal playbook + familiarity.

---

# 22. Career hierarchy and club life

Career authority should evolve roughly through:

- academy/rookie
- rotation player
- starter
- key player
- star
- leader
- captain
- club icon

Include real competition for places, bench/reserve status, loans, contract status, salary, agent relationships, club interest, transfers and the real possibility of not playing.

The club and coach decide collective strategy. The player works within it.

Mentors and teammates should matter to football development and relationships.

New coaches, injuries, signings and system changes create tactical career narratives rather than only numerical season progression.

---

# 23. Football world

The long-term product needs a persistent football world, not an isolated league screen.

Build reusable data-driven systems for:

- countries
- clubs
- multiple domestic divisions
- promotion/relegation
- domestic cups
- super cups
- schedules
- tables
- history
- reputation
- rivalries
- persistent seasons
- transfer market
- player contracts

National teams need:

- eligibility
- call-ups
- competition for positions
- friendlies
- qualifying
- continental competitions
- World Cups

International club and national competitions need regional qualification, groups/knockouts where appropriate, hosts/cycles and history.

Club and international calendars affect fatigue, form, injuries, prestige, market value and narrative.

Do not hardcode one league if the same competition model can be made reusable.

---

# 24. Player-centred match presentation

The user's footballer must always be identifiable.

Use:

- ring/glow
- name
- shirt number inside the circle
- current rating
- current role
- current instruction
- optional active pattern/tactical event

Camera framing should consider the user player, the ball and the tactically relevant zone rather than only following the ball.

Live events should explain meaningful football behavior without becoming spam.

Examples:

- Created 1v1 through width
- Successful third-man movement
- Press forced turnover
- Wrong-side positioning
- Ignored overlap trigger

The UI should teach the user why actions mattered.

---

# 25. Competitive 11v11 and Tactical Lab

Campaign and competitive use the same football concepts but different authority.

In competitive full-team mode, the user can eventually control:

- base formation
- in-possession shapes
- out-of-possession shapes
- individual roles
- zone occupation
- pressing triggers
- rest defence
- rest attack
- transition rules
- playbooks
- set pieces
- training priorities
- match-state rules
- substitution logic

The Tactical Lab is a central visual editor with:

- pitch
- players
- lines
- zones
- triggers
- conditions
- branches
- phase-based behavior

Provide templates such as Third Man, Overlap, Underlap, Overload-Isolate, Wide Rotation, Box Midfield, High Press Trap and Low Block Counter.

Advanced users can edit space thresholds, defender distance, delays, run angles, desired reception points, preferred foot, pass speed, risk and abort thresholds.

A training simulator should allow `Run Pattern`, inspect execution, alter timing/branches and rerun before using a pattern competitively.

Opponent scouting should reveal tendencies, not exact rule nodes, so counter-planning and information uncertainty remain part of the skill ceiling.

PvP must not reduce to who grinded the highest raw stats.

---

# 26. Learning curve

Do not expose the full tactical system immediately.

Progressively unlock complexity:

1. basic role
2. a few personal instructions
3. conditional instructions
4. pattern training
5. opposition preparation
6. influence
7. full Tactical Lab

Tutorials should teach football through situations and consequences rather than a giant manual.

---

# 27. Healthy design constraints

Do not:

- convert football concepts into generic buffs
- expose hundreds of context-free sliders
- disguise fixed animations as tactics
- let playbooks ignore opponents
- reward only traditional box-score stats
- let overall dominate behavior
- make Familiarity a flat percentage bonus
- turn Influence into manager mode
- make competitive PvP a raw-stat grind
- use random outcomes when contextual mechanics can explain the result

Every structure needs advantages, costs and counterplay.

High press creates high recoveries but space behind.

Low block protects the box but yields territory.

Extreme width opens the block but increases support distances.

Narrow attack supports combinations but loses outside threat.

---

# 28. How each automated development pass must work

Every scheduled development pass must use this file as its north star.

The pass is not "work on physics again" or "add one more feature from the last conversation." It is:

1. Read `GAME_PLAN.md`.
2. Inspect current `main`, recent commits, open PRs/issues and the full test surface.
3. Map the current product against the roadmap's major pillars.
4. Identify the highest-leverage missing dependency or weakest vertical slice.
5. Choose one bounded implementation slice that can be completed and tested in this run.
6. Prefer a slice that unlocks later roadmap work instead of polishing an already-mature subsystem.
7. Implement it using reusable/data-driven abstractions.
8. Run syntax/build/tests and fix regressions before expanding scope.
9. Leave real GitHub progress through a safe branch/PR/merge workflow.
10. Report which roadmap pillar advanced, what remains missing and what major block should be considered next.

Do not repeat completed work.

Do not perform endless consecutive micro-tuning of one subsystem while major pillars remain absent. Physics regressions are high priority because they can invalidate the game, but once the physical foundation is stable, deliberately advance career, tactical intelligence, progression, world simulation, evaluation, UI and competition as well.

A good pass is small in code scope but large in architectural direction.

Examples of good bounded slices:

- add persistent squad numbers to roster data rather than only runtime assignment
- create a low-OVR youth starting model and tests
- introduce reserve/second-division starting status
- add age-development curves for one attribute family
- add coach Trust with one concrete effect on selection
- add a Role Contract domain model for one phase
- add line detection and a line-break evaluation primitive
- add one perception/scanning primitive used by decisions
- add action commitment with abort conditions
- make one real playbook branch execute through the physical engine
- add pair Familiarity and use it in timing rather than as a flat buff
- add one reusable domestic competition tier with promotion/relegation
- add a national-team eligibility/call-up foundation
- add one causal off-ball evaluation event

Each pass should name the roadmap dependency it is closing.

---

# 29. Current explicit additions to the canonical plan

The following requirements were added explicitly after the original long-form design and are part of the same roadmap:

- Ball radius is slightly smaller than the original prototype.
- Shirt numbers are visible inside player circles and should evolve into persistent squad numbers.
- Dribbling must be substantially improved through physical touch profiles.
- The created player should start below 70 OVR in normal careers rather than as an almost finished player.
- Careers may begin in lower divisions, reserve teams or academies.
- Age, development curve, peak, decline and retirement are required.
- Character progression must be significantly deeper than three perks.
- The overall scheduled task must continuously move the whole project toward this complete game, using small verified slices rather than treating each run as an isolated feature request.

---

# 30. Destination

The final match should emerge from:

- player attributes
- perception
- decisions
- preparation
- teammates
- coach model
- opponent behavior
- trained automatisms
- space
- body orientation
- physical ball interactions
- score and match state
- fatigue
- adaptation

Not from a rigid script.

The user should be able to watch a goal and understand the causal chain that made it possible.

That sense of authorship is the product.