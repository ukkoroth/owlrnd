# owlrnd logo kit (All-round, 4 × 4)

Eight squares form an "o" on a 4 × 4 grid, deepening in colour as they go round. The wordmark is Inter Bold, outlined, so no font is needed.

## Files

| File | Use |
| --- | --- |
| `owlrnd-logo.svg` / `owlrnd-logo@2x.png` | Mark + wordmark, for white or light backgrounds |
| `owlrnd-logo-on-blue.svg` / `owlrnd-logo-on-blue@2x.png` | Mark + wordmark, for brand blue `#1E40AF` |
| `owlrnd-mark.svg` / `.png` | Mark only, light backgrounds |
| `owlrnd-mark-on-blue.svg` / `.png` | Mark only, on blue |
| `owlrnd-app-icon.svg`, `icon-192.png`, `icon-512.png` | App icon / web manifest (rounded blue square) |
| `favicon.svg`, `favicon.ico` (16/32/48/64) | Browser tab |
| `apple-touch-icon.png` (180 × 180, square; iOS rounds it) | iPhone/iPad home screen |

## In the website `<head>`

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

Web manifest icons: `icon-192.png` and `icon-512.png`.

## Header logo

Use `owlrnd-logo-on-blue.svg` on the blue header (about 30 px tall), or `owlrnd-logo.svg` on light backgrounds. Keep clear space of at least one grid square around the logo. Minimum size: 16 px for the mark, 24 px tall for the full logo.

## Colours

Light: `#BFD3FB`, `#7FA9F5`, `#3F7CEB`, `#2563EB`, `#1E40AF`; empty squares `#E3ECFC`; wordmark `#132C6B`.
On blue: `#5F86E6`, `#7AA2FF`, `#A9C4FF`, `#D6E3FF`, `#FFFFFF`; empty squares white at 9% opacity; wordmark `#FFFFFF`.
