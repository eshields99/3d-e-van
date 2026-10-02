# AURA One — interactive electric shuttle

A real-time 3D showcase of an electric autonomous shuttle (exterior **and** interior), built with
[three.js](https://threejs.org) and Vite. Everything — the van, cabin, city block, textures and
lighting — is generated procedurally in code; there are no external model or texture files.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (relative paths, host anywhere)
```

## What's in the scene

**Exterior**
- Pod-shaped body generated from a superellipse loft, so paint, glass, door skins, trims, light
  bars and cabin shell all share one surface and fit perfectly.
- Clear-coated black paint, tinted panoramic glass with screen-space transmission (you see the
  cabin through it) and live environment reflections captured from the surrounding street.
- Twin sliding doors (pop out, then slide apart) with shut lines, jambs and inner trim.
- Warm-white front and twin red rear light signatures, amber sill accents, roof sensor pod with
  lidar status ring, corner cameras, sculpted wheel-arch flares and aero wheels with bronze rings.

**Interior**
- Face-to-face lounge for six with leather seats, stitched channels, armrests and headrests.
- Walnut plank floor, fabric headliner, ceiling light strips, cove and floor ambient lighting
  (warm / ice / violet / off), a pedestal table, a grab rail and a double-sided route display
  that animates the trip.

**World**
- Atmospheric sky with clouds, three times of day (golden hour, blue hour, night with stars),
  layered mountain silhouettes, street with lane paint, kerbs, hedges, leaf-card trees, office
  buildings with lit windows and street lights with light pools.
- Drive mode streams the street past the van, spins the wheels, adds subtle body motion and
  refreshes reflections as you go.

**Rendering**
- ACES tone mapping, HDR bloom on emissives, MSAA, soft sun shadows plus a contact shadow, and a
  final lens pass (vignette, grain, slight chromatic fringing).

## Controls

| Input | Action |
| --- | --- |
| Drag / pinch / scroll | Orbit and zoom (look around when inside) |
| `1` `2` `3` | Exterior, Interior, Drive |
| `D` | Open / close doors |
| `L` | Lights on / off |
| Markers on the van | Doors, step inside, light signature, wheels |

URL options: `?time=golden|blue|night`, `?mode=interior|drive`, `?doors=open`, `?q=low`
(1x pixel ratio, no MSAA, for slower GPUs), `?nointro`.

## Project layout

```
src/
  main.js          renderer, camera shots, modes, post-processing, main loop
  ui.js / style.css overlay UI, hotspots, HUD
  finish.js        final lens shader pass
  textures.js      procedural canvas textures
  van/shape.js     parametric body surface and patch/ribbon helpers
  van/van.js       body, glass, doors, arches, wheels, lights, sensors
  van/interior.js  cabin: floor, seating, lighting, table, display
  world/world.js   sky, lighting presets, street, trees, buildings, env capture
```
