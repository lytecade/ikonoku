# Ikonoku

An arcade-style cyberpunk Sudoku game that replaces numbers with **9 unique color blocks**.

## Overview

Ikonoku is a logic puzzle where you fill a 9×9 grid with color blocks. Each row, column, and 3×3 section must contain every unique color block exactly once — no math required, just pure logic.

## How to Play

1. **Open** `index.html` in any modern browser (or serve locally with `python3 server.py`)
2. **Title Screen** — Press a key, click, or tap to begin
3. **Choose Difficulty** — Easy, Medium, or Hard
4. **Select a Color** — Tap/click one of the 9 color blocks (or use `1`–`9` / Tab + arrow keys + Enter)
5. **Place It** — Tap/click an empty grid cell (invalid Sudoku placements flash red and highlight conflicts)
6. **Undo / Clear** — Press and **hold** a tile you placed for **2 seconds** to clear it (initial puzzle clues are locked), or press Backspace/Delete with keyboard
7. **Complete the Grid** — Fill all empty cells to win!

## Controls

| Action | Mouse/Touch | Keyboard |
|---|---|---|
| Navigate cells | Click/tap cell | Arrow keys |
| Select color | Tap/click color block | `1`–`9`, or Tab + Arrows + Enter |
| Place color | Tap/click empty cell | Space / Enter |
| Clear placed tile | Hold player-filled tile for 2s | Backspace / Delete |
| Start game | Click/tap/press any key | Any key |
| Confirm difficulty | Click/tap difficulty card | Arrow keys + Enter |

## Color Scheme

Uses the **Arne16** palette exclusively:

| Hex | Role |
|---|---|
| `#000000` | Deep black |
| `#9D9D9D` | Mid gray |
| `#FFFFFF` | White |
| `#BE2633` | Crimson (Game Color 1) |
| `#E06F8B` | Rose (Game Color 2) |
| `#493C2B` | Brown |
| `#A46422` | Amber (Game Color 3) |
| `#EB8931` | Orange (Game Color 4) |
| `#F7E26B` | Yellow (Game Color 5) |
| `#2F484E` | Slate (Background) |
| `#44891A` | Green (Game Color 6) |
| `#A3CE27` | Lime (Game Color 7) |
| `#1B2632` | Navy (Dark BG) |
| `#005784` | Steel Blue (Game Color 8) |
| `#31A2F2` | Sky Blue (Game Color 9) |
| `#B2DCF0` | Ice Blue |

## File Structure

```
├── index.html   # Full-viewport HTML5 entry point
├── game.js      # Dynamic layout engine, input handling, game logic, rendering
├── server.py    # Simple local HTTP preview server
└── README.md    # This file
```

## Technical Details

- **No external runtime libraries** — pure HTML5 Canvas + JavaScript
- **Dynamic Viewport Scaling** — adapts automatically to desktop, tablet, mobile portrait (5+4 swatch grid), and mobile landscape (side-by-side board + 3×3 swatch grid) with crisp HiDPI rendering
- **Touch & Pointer Friendly** — unified pointer controls with tap-to-select, tap-to-place, conflict highlighting, and hold-to-clear undo
- **Three difficulty levels** affecting the number of pre-filled cells

## Credits

Game design and code by Kyrolyte. Color palette: [Arne16](https://lospec.com/palette-list/arne16).
