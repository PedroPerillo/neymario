# Super Neymario: The Hexa Quest

A fan-parody platformer in the style of the NES original. Neymario fights his way
through six of Neymar's World Cup matches, then storms the castle of **Mbappé Ditador**
to win the Hexa.

| Original | Neymario |
| --- | --- |
| Mario | Neymario (Brazil kit, blond mohawk, pink boots) |
| Super Mushroom | Football |
| Fire Flower | Each World Cup has its own transformation (see below) |
| "?" block | Prize block marked with a World Cup trophy |
| Starman | The World Cup trophy (the same trophy appears everywhere) |
| Coins | Golden soccer balls |
| 1-UP mushroom | Brazil #10 shirt |
| Goomba | Opposing defender (wears that match's kit) |
| Other enemies | Pipe goalkeepers, ball cannons, studs-up boots, camera drones, matryoshkas, falcons |
| Koopa / shell | Referee → hides behind a kickable VAR monitor |
| Flagpole / castle | Corner flag, then Neymario shoots into the goal: GOOOOL! |
| Warp pipes & bonus rooms | One pipe per match leads to a hidden tunnel full of golden balls |
| Bowser / axe | Mbappé Ditador / the World Cup trophy |

## Transformations

Grab a football to grow, then hit another power-up block for that World Cup's power.
The kit always stays yellow and green; the power shows on the hair and boots.

| World Cup | Power-up | Transformation |
| --- | --- | --- |
| 2014 (and the final) | Blaze flame | **Blaze**: X/Shift throws bouncing flaming footballs |
| 2018 | Cup of *miojo* (instant noodles) | **Miojo hair**: run, then ↓ to do the famous roll through defenders and bricks |
| 2022 | Pigeon feather | **Pombo**: hold jump to glide, jump again in mid-air to flap |

## Moves

- **Run** (hold X/Shift) and **skid** turns
- **Crouch** (↓ when big) and **crouch-slide** at speed; you can **crouch-jump** into one-tile gaps
- **Ground pound**: ↓ in mid-air. Flattens anything below, smashes bricks when big, pops prize blocks
- **Wall slide & wall jump**: push into a wall while falling, then jump
- **Pipes**: ↓ on the right pipe drops into a bonus room; walk into its sideways pipe to come back out further on

## The world map

Real maps of the host countries, one panel per World Cup: Brazil 2014, Western Russia
2018, Qatar 2022, and France for the Final (Mbappé's home turf). Every stadium sits on
its real host city. Walk Neymario along the route with ←/→ and press Enter to play.
Winning a match flies a Brazil flag over the stadium and draws the route to the next
one; flights between World Cups cross the seams. Progress is saved in the browser:
the title screen offers CONTINUE or NEW GAME.

Country outlines come from [Natural Earth](https://www.naturalearthdata.com/) (public
domain), pre-projected into `src/geo.js` by `node tools/build-geo.mjs`.

## Levels

Every World Cup match Neymar played, each with its own gimmick:

| | Match | Gimmick |
| --- | --- | --- |
| 2014-1 | Croatia, São Paulo | The classic opener |
| 2014-2 | Mexico, Fortaleza (0-0) | A pipe maze with goalkeepers popping out |
| 2014-3 | Cameroon, Brasília | Treetop platforms, moving lifts, camera drones |
| 2014-4 | Chile, Belo Horizonte | Night: ball cannons and trampolines |
| 2014-5 | Colombia, Fortaleza | Studs-up boots you can't stomp |
| 2018-1 | Switzerland, Rostov | Snow and slippery ice |
| 2018-2 | Costa Rica, St Petersburg | Lifts across the canals, cannons |
| 2018-3 | Serbia, Moscow | Matryoshkas that split in two |
| 2018-4 | Mexico, Samara | Floating platforms and keepers |
| 2018-5 | Belgium, Kazan | The Red Devils' night: everything at once |
| 2022-1 | Serbia, Lusail | Brick bridges, diving falcons |
| 2022-2 | South Korea, Stadium 974 | A stadium built from shipping containers |
| 2022-3 | Croatia, Al Rayyan | Ends in a "penalty shootout" of cannons |
| FINAL-1 | The Dictator's Fortress | Lava bubbles, firebars, lifts over lava |
| FINAL-2 | The Dictator's Castle | Beat Mbappé Ditador to open the gate to the cup |

Each match has a hidden bonus room behind one pipe and a halfway checkpoint flag.

## Mbappé Ditador

He guards the World Cup trophy behind a locked gate. Stomp him, roll into him,
ground-pound him (double damage) or hit him with Blaze fireballs: five hits and he
tumbles into the lava. He gets angry, faster and more fiery, at low health.

## Play

**In your browser:** https://pedroperillo.github.io/neymario/ (works on phones too).

**Locally:**

```sh
npm start        # http://localhost:5173
```

No dependencies and no build step. It's plain ES modules served statically.

Controls: ←/→ move · Z/Space/↑ jump (hold for height) · X/Shift run & use power ·
↓ crouch / enter pipes / ground pound · Enter start & pause · P/Esc pause · M mute.
On touch devices, on-screen buttons appear.

## Test

```sh
npm test
```

The simulation (`src/game.js`, `src/physics.js`, `src/levels.js`) is DOM-free, so the
tests drive the real game rules headlessly. `levels.test.js` includes a lookahead bot that
proves every level can be finished.

## Layout

- `src/game.js` holds game rules and the state machine (title → intro → play → flag/bridge → victory)
- `src/physics.js` handles tile collision
- `src/levels.js` has the level builder DSL and all fifteen levels
- `src/worldmap.js` holds the overworld layout and `src/maprender.js` draws it
- `src/render.js` and `src/sprites.js` do the canvas drawing; all art is procedural pixel strings
- `src/audio.js` synthesises WebAudio sound effects and original music loops
- `src/input.js` handles keyboard and touch input
- `src/main.js` is the browser bootstrap with a fixed 60 Hz timestep

*Unofficial fan parody. Not affiliated with or endorsed by Nintendo, Neymar Jr.,
Kylian Mbappé, FIFA or Blaze. All art and music are original.*
