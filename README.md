# HUSTLE: FROM NOTHING

A static 3D browser simulator built to deploy on **GitHub Pages**.

## Features
- Three.js 3D low-poly city
- Third-person player character
- Character creation (name, skin, shirt, pants, hair)
- Cash + bank account + reputation + energy + hunger
- Job system with skill progression
- Business purchases with passive daily income
- Vehicle garage
- Property progression
- Inventory and stats screens
- Phone UI
- Minimap + full-screen map
- Mission progression
- Local save via `localStorage`
- No Node server and no build step

## GitHub Pages
Put the contents of this folder into the **root** of a GitHub repository.
Then go to:

`Settings → Pages → Deploy from a branch → main → /(root)`

The game loads Three.js from jsDelivr, so the page needs internet access while the game is running.

## Controls
- WASD / Arrow keys = move
- Shift = sprint
- E = interact
- P = phone
- M = map
- F = vehicle mode
- Esc = pause

## Notes
The example NageshCity project uses a separated `index.html`, `css`, `src`, `assets`, and vendor-style layout. This game follows the same static-project idea, but is intentionally simpler to deploy: everything needed is plain HTML/CSS/JS, with Three.js loaded from a CDN.
