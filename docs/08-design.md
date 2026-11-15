# 8. Design

owlrnd has two looks: the **app** (modern, blue, sans serif) and the **exam paper** (white, black ink, serif). Match the screenshots.

## Brand

- Name: **owlrnd**, always lower case. No owl imagery in the logo.
- Logo: eight squares forming an "o" on a 4 × 4 grid, deepening in colour as they go round, beside the outlined wordmark. Use the kit in `public/brand/` (guide: `docs/brand/logo-kit.md`): the on-blue version on the sidebar, sign-in panel and site header, the light version on white. About 30px tall in headers; keep one grid square of clear space.

## Type

| Use | Font | Notes |
| --- | --- | --- |
| Everything in the app | Inter, with a system sans-serif fallback | Body 15–16px; headings 600 weight |
| Exam questions, answer options and typed answers on the paper | STIX Two Text, with Times New Roman as fallback | Questions 16–17px |
| Exam top bar, buttons, page navigation, dialogs | Inter | These are app controls, not part of the paper |

Never shrink exam text below 16px to fit (rules §5).

## Colour: app screens

| Use | Colour |
| --- | --- |
| Page background | `#F3F7FF` |
| Cards, inputs, message boxes | `#FFFFFF` |
| Sidebar and dark panels | `#1E40AF` |
| Buttons, links, highlights, today's bar | `#2563EB` |
| Text | `#132C6B` |
| Secondary text | `#4A5F8A` |
| Borders and rules | `#CFDDF5` |
| Input borders | `#A9BCE0` |
| Pale fills (tags, untested topics) | `#DCE9FF`, `#E3ECFB` |
| Needs work, errors, delete | `#B3261E` border, `#FBEAE8` fill, `#8C1D18` text |

Activity grid shades, fewest to most: `#E3ECFB`, `#BBD2FB`, `#7FA9F5`, `#3F7CEB`, `#1E40AF`.

## Colour: exam paper

| Use | Colour |
| --- | --- |
| Background | `#FFFFFF` |
| Text | `#111111` |
| Secondary text | `#4D4D4D` |
| Rules | `#BDBAB0` |
| Option circles | `#8A8880` |
| Selected and correct answers; Submit button | `#172F73` (dark blue) |
| Wrong answers | `#B3261E` |

## Shape and spacing

- Corners nearly square: 2px radius on cards, buttons and inputs.
- No drop shadows, gradients or emoji.
- Touch targets at least 44px high.
- Cards: 1px border, 18–24px padding.
- Content width up to about 1000px on app screens and 1240px on exam papers.

## Components

- **Sidebar** (student and parent): logo, menu items (active item white with blue text), then at the bottom the points box (students only) and the **profile button** (avatar, name, role, chevron) that opens a small menu with Profile and Sign out.
- **Buttons:** primary (filled blue), outline (dark border), danger (red border), disabled (pale border and text).
- **Exam option:** a lettered circle (A–D) and the option text. No box around options; a thin outline on hover or keyboard focus; the selected circle fills dark blue.
- **Track card:** status line, name, score bars per exam (latest highlighted), topic strength strip (strong, needs work, not tested), needs-work topics, goal progress (three segments), actions.
- **Charts:** 7-day bar chart and 26-week activity grid (rules §9).
- **Chat:** parent messages right-aligned in a thin box labelled "You"; AI replies left-aligned as plain text labelled "owlrnd AI"; a message box with Attach file, Take photo and Send; a track preview panel beside the chat.

## Layout

- Screenshots are drawn at 1280px wide. App pages should be fluid: the sidebar stacks above the content on narrow screens, and grids collapse to one column.
- The exam paper always fits the window (rules §5).

## Accessibility

- Real buttons, links and labelled inputs; icon-only buttons have labels.
- Text contrast at least 4.5:1.
- Colours that carry meaning also differ in shape or label (ticks and crosses, "Needs work" text), not colour alone.
