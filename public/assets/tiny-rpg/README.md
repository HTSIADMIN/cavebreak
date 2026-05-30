# Tiny RPG Character Asset Pack — Soldier & Orc

Pixel-art animated characters (v1.03b). Two characters with full animation strips, served statically by Next.js from `/assets/tiny-rpg/...`.

> ⚠️ **License:** this pack shipped **without a license file**. It's distributed as a "free" pack (itch.io); free use typically expects **credit to the author**. Confirm the source page's terms before any public/commercial use. Unlike the `kenney/` packs, this is **not** confirmed CC0.

## Contents

Two characters, each as horizontal sprite **strips of 100×100 frames**:

| Character | Animations |
|---|---|
| **Soldier** | Idle, Walk, Attack01, Attack02, Attack03, Hurt, Death |
| **Orc** | Idle, Walk, Attack01, Attack02, Hurt, Death |

Each character ships in several variants under `Characters(100x100)/<Character>/`:

- `…/<Character>/` — base frames + a `Shadow sprites/` subfolder
- `…/<Character> with shadows/` — frames with the shadow baked in
- `…/<Character>(Split Effects)/` — attack effects split onto their own layer
- Soldier also has `Arrow(projectile)/` — `Arrow01` at 100×100 and 32×32

Editable source: `Aseprite file/Soldier.aseprite`, `Aseprite file/Orc.aseprite`.

## Note on style

These are **side-view pixel-art** characters — a different style from the top-down vector `kenney/sci-fi-rts` set used for the main RTS units. Keep that in mind before mixing them in the same view.
