# Kenney art packs

Drop-in art for Cavebreak. Everything here is **CC0** (public domain) by [Kenney](https://kenney.nl) — no attribution required, but keep the per-pack `License.txt` files.

Files in `public/` are served statically by Next.js, so a file at
`public/assets/kenney/sci-fi-rts/PNG/Default size/Unit/scifiUnit_01.png`
is reachable in the browser at
`/assets/kenney/sci-fi-rts/PNG/Default%20size/Unit/scifiUnit_01.png`.

## Packs

| Folder | Original pack | Use in Cavebreak |
|---|---|---|
| `sci-fi-rts/` | Sci-Fi RTS | **Primary art.** Units, structures, tiles, environment props. |
| `top-down-tanks/` | Top-down Tanks (Remastered) | Extra ground units / vehicles, tracks, explosions. |
| `space-shooter/` | Space Shooter (Remastered) | Projectiles, lasers, effects, UI bits, meteors; SFX (`.ogg`). |
| `light-masks/` | Light Masks 1.0 | Soft radial masks for fog-of-war reveal, unit/building glow, muzzle flash. |
| `cursors/` | Cursor Pack | UI cursors (Basic + Outline), PNG and SVG. |

## Most useful files

- **sci-fi-rts atlas** — `sci-fi-rts/Spritesheet/scifiRTS_spritesheet.png` + `.xml` (Kenney XML atlas; `@2` = retina). Individual PNGs live in `sci-fi-rts/PNG/Default size/` (`Unit/` ×48, `Structure/` ×16, `Environment/` ×20, `Tile/` ×42) and `PNG/Retina/`.
- **sci-fi-rts tiles** — `sci-fi-rts/Tilesheet/scifi_tilesheet.png` (+ `@2`) for the terrain grid.
- **light masks** — `light-masks/Default/`, `/Inverted/`, `/Transparent/` (~150 each).
- **cursors** — `cursors/PNG/Basic/` and `cursors/PNG/Outline/` (raster), `cursors/Vector/` (SVG).

> Sprites are numbered, not named (`scifiUnit_01`…). When you wire art to units/buildings,
> map them in code and note the mapping in the relevant `docs/*.md` system file.
