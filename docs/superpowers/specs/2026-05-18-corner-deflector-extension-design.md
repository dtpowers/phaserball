# Extend Top-Right Corner Deflector to Table Ceiling

## Problem

The 45-degree corner deflector in the top-right corner does not visually or physically connect to the top wall of the table. There's a ~64px gap between the deflector's left endpoint at (620, 80) and the top wall at y=16. The existing top-right connector (a vertical wall at x=700 from y=16 to y=160) only seals the right side, leaving the left gap exposed.

## Design

Extend the deflector along its existing 45-degree angle until it meets the top wall.

### Geometry

- **Current deflector line:** (620, 80) → (700, 160) — slope 1 (45°)
- **Extended deflector line:** (556, 16) → (700, 160) — same 45° angle
- The left endpoint (556, 16) touches the bottom edge of the top wall (y=16)
- The right endpoint (700, 160) touches the right wall (x=700)

### Physics

- **Current deflector body:** center (660, 120), 113×16, 45°
- **Extended deflector body:** center (628, 88), 204×16, 45°
- **Remove top-right connector body:** no longer needed — the extended deflector's right endpoint (700, 160) touches the right wall, and its left endpoint (556, 16) touches the top wall. The only gap between these two points is along the right edge, which is already bounded by the right wall itself.

### Visuals

- Replace `lineBetween(620, 80, 700, 160)` with `lineBetween(556, 16, 700, 160)`
- Remove `lineBetween(700, 16, 700, 160)` (connector visual)

### Files Changed

- `src/scenes/GameScene.js` — `buildTable()` method only

### Scope

- 2 lines removed (connector physics + visual)
- 2 lines modified (deflector physics center/width, deflector visual endpoints)
- No new files, no new features — purely geometric cleanup
