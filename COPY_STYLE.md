# Career Eleven — Player-Facing Copy Standard

This file defines the canonical writing standard for every text a player can see in Career Eleven.

The interface must speak from inside football. It must not explain the software behind the football.

## Core rule

Every visible sentence should help the player understand one of these things:

- what is happening now;
- what the player can do;
- what the coach, club, teammate, scout or competition expects;
- what changed because of a football action or decision;
- what is at stake next.

If a sentence does none of those things, remove it.

## Never expose implementation as product copy

Do not put engineering language in the player interface unless the player genuinely needs it to use a technical feature.

Avoid player-facing references to:

- engine or motor;
- AI or IA;
- autoplay;
- backend;
- Supabase;
- internal scoring weights;
- evidence weights;
- simulation architecture;
- physics implementation;
- shared or identical physics between modes;
- authoritative server architecture;
- anti-cheat implementation;
- logs or internal telemetry;
- old sliders or systems that were replaced;
- internal IDs, drill IDs, rule IDs or code terminology.

The player already assumes that training and matches belong to the same game. Do not say that they use the same engine, physics or systems.

## Do not narrate the obvious

Do not explain facts the player can already see or reasonably assumes.

Bad:

`El entrenamiento usa el mismo motor 11v11 que los partidos.`

Better:

`Ruptura a la espalda — temporizá y atacá el intervalo cuando aparezca la ventana.`

Bad:

`La cámara sigue a tu jugador.`

Better, only if guidance is needed:

`El aro marca a tu futbolista.`

## Emotion must come from football stakes

Do not manufacture emotion with generic motivational language.

Avoid slogans and filler such as:

- tu historia;
- tu destino;
- viví el sueño;
- miles de historias;
- empezá desde abajo;
- convertite en leyenda;
- sentí la pasión;
- una carrera que es sólo tuya;
- el fútbol cobra vida;
- todo puede pasar.

Use concrete situations instead:

- the coach leaves you out of the XI;
- another player takes your place;
- you enter with twenty minutes left;
- a scout is watching the trial;
- the captain asks you to repeat a movement after training;
- your contract expires;
- the club rejects a transfer request;
- you are carrying a yellow card into a derby;
- your teammate stops reading your run;
- you lose trust after ignoring an instruction;
- you earn the starting spot after several good performances.

The football situation creates the emotion. The copy does not need to tell the player how to feel.

## Vocabulary

Prefer normal football language used by players and supporters.

Use words such as DT, puesto, once, banco, plantel, fecha, entrenamiento, visores, vestuario, tabla, contrato, titular, suplente, rival, marca, ruptura, apoyo, cobertura, pase, remate, duelo and recuperación when they are accurate.

Do not replace clear football language with product-design language such as identity system, decision engine, mastery, behavioral profile, emergent narrative, simulation layer or progression architecture.

## Buttons

Buttons name the action that will happen.

Good:

- JUGAR PARTIDO
- EMPEZAR LA PRUEBA
- VOLVER A ENTRENAMIENTOS
- GUARDAR COPIA
- RECUPERAR CARRERA
- TRABAJAR ESTA RAMA

Avoid buttons that advertise the system instead of performing an action.

## Training

Training copy must describe the football problem.

A drill can tell the player what to read, where to move, what action to execute and what the coach is looking for.

Do not explain the training runtime, shared match engine, internal markers, simulation model or implementation relationship to matches.

Results should use player-readable terms such as nota, repeticiones buenas, ejecución, remate, timing, cobertura, control or pase.

## Match and pre-match

Pre-match copy should sound like a coach briefing or team sheet.

Show the player's role, relevant opponent threats, physical condition, place in the squad, useful teammate relationships and concrete instructions.

Do not expose internal priorities, rule weights, role-discipline numbers or engine terminology when a football sentence can express the same thing.

## Career screens

Career copy should make consequences visible.

Prefer concrete status:

`El DT te dejó en el banco por segunda fecha seguida.`

Over abstract framing:

`Tu carrera atraviesa un momento decisivo.`

Prefer:

`Tu contrato vence en junio. El club todavía no ofreció renovación.`

Over:

`El futuro de tu carrera está en tus manos.`

## Landing page

The landing page sells the actual situations the player will face now.

Do not sell architecture, roadmap jargon or vague promises of emotion.

Do not claim depth that the current build does not yet provide.

A strong line names a recognizable football conflict or action. It should make the visitor understand what they will do after pressing Play.

## Roadmap copy

Describe future player experiences, not engineering milestones.

Good:

`Partidos organizados donde cada persona lleva su futbolista y comparte equipo con otros diez.`

Avoid:

`Servidor autoritativo, reconexión, anti-cheat, logs e infraestructura competitiva.`

Engineering plans belong in internal documentation.

## Final check before shipping visible copy

Read every new visible sentence and ask:

1. Is this something a footballer, coach, scout, teammate, club or competition could plausibly communicate?
2. Does the player need this information now?
3. Is it concrete enough to affect a choice or expectation?
4. Am I describing software instead of football?
5. Am I trying to create emotion with a slogan when a football consequence would be stronger?

If the answer to 4 or 5 is yes, rewrite or remove the sentence.
