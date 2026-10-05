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
| Starman | World Cup trophy |
| Coins | Golden soccer balls |
| 1-UP mushroom | Brazil #10 shirt |
| Goomba | Opposing defender (wears that match's kit) |
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

## Levels

1. **2014-1** Opening match vs Croatia, São Paulo
2. **2014-2** Quarter-final vs Colombia, Fortaleza (dusk)
3. **2018-1** Round of 16 vs Mexico, Samara (floating platforms)
4. **2018-2** Quarter-final vs Belgium, Kazan (night)
5. **2022-1** Group stage vs Serbia, Lusail (brick bridges)
6. **2022-2** Quarter-final vs Croatia, Al Rayyan (night)
7. **FINAL** vs France in the Dictator's castle: firebars, lava and the bridge boss fight

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
- `src/levels.js` has the level builder DSL and the seven levels
- `src/render.js` and `src/sprites.js` do the canvas drawing; all art is procedural pixel strings
- `src/audio.js` synthesises WebAudio sound effects and original music loops
- `src/input.js` handles keyboard and touch input
- `src/main.js` is the browser bootstrap with a fixed 60 Hz timestep

*Unofficial fan parody. Not affiliated with or endorsed by Nintendo, Neymar Jr.,
Kylian Mbappé, FIFA or Blaze. All art and music are original.*
