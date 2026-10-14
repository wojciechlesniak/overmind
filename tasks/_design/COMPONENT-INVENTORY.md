# Overmind - Component Inventory (design system `packages/ui-kit`)

Scope: all 18 static mocks in `source/*.dc.html` (pixel truth) scanned for tokens, primitives and composites. Every value below was extracted from the inline styles (139 distinct colour literals, 94 computed text styles, 26 distinct SVGs, 65 distinct button style strings were reviewed). Counts such as "16 views" refer to how many of the 18 mocks use the value. View names use the English names from `VIEWS.md`; the mock file name is given where needed.

Conventions:
- Token names are proposals (`--om-*` CSS custom properties, mirrored as a typed TS object in `packages/ui-kit/src/tokens`). The **values** are exact.
- The mocks contain **no** hover, focus, pressed, disabled, loading, transitions, animations or z-index. Everything in those categories in this document is a **recommendation**, flagged as such.
- Names of Owner-facing words stay Polish in UI copy (ADR 0017: code and docs English, product copy Polish first); component/prop names are English.

---

## A. Design tokens

### A.1 Colour

Theme: "dark violet with neon" (Style 1). The mocks are dark only; light theme does not exist. Tokens are semantic first (role), raw hex is the value.

#### A.1.1 Surfaces and lines

| Token | Value | Role | Used in |
|---|---|---|---|
| `bg-app` | `#0A0710` | Page background; canvas port fill; node ports; Start/Join fill base | all views |
| `bg-panel` | `#0D0915` | AppRail, TopBar, SubTabs, right asides, onboarding sidebar base | all rail views |
| `bg-panel-alt` | `#0C0814` | Left list panels, Lanes, canvas stage, select/field fill in Settings, Workspace sections | 12 views |
| `bg-surface` | `#140F20` | Default card, pill, secondary button, textarea | all views |
| `bg-surface-sel` | `#1A1422` | Selected/hovered list row, selected conversation, selected Decision (always with border `line-strong`) | 7 views |
| `bg-raised` | `#1C1330` | Active rail item, active filter chip, select hover candidate | 14 views |
| `bg-composer` | `#120D1C` | Composer, Chief message panel, Telegram input area | 5 views |
| `bg-code` | `#06040A` | Terminal, diff, Skill markdown preview | 4 views |
| `bg-node-start` | `#160F24` | Start / "zapisz Decyzje" pill, palette item | Workflow canvas |
| `bg-node-model` | `#17111F` | Model pill on node tile | Workflow canvas |
| `bg-badge-version` | `#191226` | Version badge (Workflow canvas, Task Board) | 2 views |
| `bg-logo-tile` | `#1E1330` to `#0A0710` (160deg) | Logo tile gradient | all |
| `ink` | `#12091F` | Text/icons on bright fills (primary buttons, avatars), switch knob (on) | all |
| `ink-amber` | `#1A1005` | Text on amber fills | 3 views |
| `line-subtle` | `#241B36` | Panel dividers, rail/top bar borders, list separators, card border of nested cards | all |
| `line` | `#2A2040` | Control and card borders, progress track | all |
| `line-strong` | `#5B3E8F` | Selected row border, active rail border, dashed "add" buttons, step ring | all |
| `line-canvas` | `#5B4596` | Canvas edges, Start/Save pill border, palette/minimap lines | Workflow canvas |
| `line-owner` | `#3A2A5C` | Composer border, Owner bubble (Telegram) | 4 views |
| `line-neutral-outline` | `#3A2E44` | Deny button (neutral outline) | 2 views |

Tinted node-tile fills (one per node kind): `#0B1424` (public/blue), `#130C22` (private/violet), `#08171A` (TOR/mint), `#140F22` (Discussion/lavender).

#### A.1.2 Text

| Token | Value | Role |
|---|---|---|
| `text-primary` | `#EFE9F7` | Body, titles, values (default `color` on root) |
| `text-bright` | `#F6EFFF` / `#F6F1FF` | Canvas node title, active rail icon (two near-duplicates; normalise to `#F6EFFF`) |
| `text-body-soft` | `#E3DAF0` | Card summary paragraphs (Workspace card, Decision text) |
| `text-body-chip` | `#D9C7EA` | Chief row sub-line, Deny label |
| `text-secondary` | `#A79BBF` | Secondary labels, inactive tabs, table values |
| `text-muted` | `#8C80A6` | Mono labels, section labels, timestamps, hints, disabled-looking meta |
| `text-lavender` | `#D6C9FF` | Skill chips text, doc references, icon stroke, link-ish mono |
| `text-link` | `#E9D8FF` | Underlined links ("Profil Agenta", "Tablica") |
| `text-lavender-strong` | `#C9B8FF` | Discussion kind, canvas pills text |

#### A.1.3 Accent families (each has a hot colour, a light text colour, a dark/gradient colour and a tint)

| Family | Hot (`-500`) | Light text (`-300`) | Dark/gradient (`-700`) | Fills / tints | Semantic role |
|---|---|---|---|---|---|
| Magenta | `#F25FC4` | `#FFB3E6` (also `#FF8AD8`, `#FFD3F1`, `#FF9BDD`) | `#C23FA0`, `#E0479F` | bg `#2A1026`, `#2A1130`, `#22102A`, `#1F0F25`, `#1C0B19`, `#120A18`; rgba(242,95,196, .05/.06/.07/.1/.12/.15/.16/.18/.22/.3/.35/.4/.45/.5/.55) | Chief identity, **working** state, primary CTA in wizard and Settings, drop target, dashed "drop here" borders, Global Pause (bg `#2A1026`, border `#5A2A4F`, text `#FFD3F1`) |
| Violet | `#9B7BFF` | `#D6C9FF`, `#C9B8FF` | `#7A55E8`, `#5B3E8F`, `#5B4596` | rgba(155,123,255, .04/.08/.12/.14/.16/.25/.28) | **Primary action** (button fill), **selection** ring, **PRYWATNY** visibility, Developer avatar |
| Mint | `#62E3B4` | `#B8F5DD`, `#BFF3DF`, `#CFF5E6` | `#3FBF8F` | bg `#08171A`, `#10161A`; rgba(98,227,180, .035/.06/.08/.12/.35/.5) | **Done / OK / passed**, TOR (lane) kind, quality-loop frame, PO avatar |
| Amber | `#FFB547` | `#FFCF85`, `#FFE2B5`, `#FFD69A`, `#FFE0A8` | `#D98A1C`, `#E09A2E`, `#6B4E22` | bg `#22180A`, `#2A1D0C`, `#24190F`, `#1E160A`, `#1A1208`; rgba(255,181,71, .12/.14/.18/.35/.5) | **Waiting for the Owner** (Approval, Access Request), return edge, Quality Gate, Security/Designer avatars |
| Blue | `#6FA8FF` | `#B9D3FF` | `#5B7FD6` | bg `#0B1424`; rgba(111,168,255,.1) | **PUBLICZNY** visibility, Senior Reviewer avatar |
| Cyan | `#3AA6C8` | `#C2F0FF` | n/a | glow `#3AA6C866` | Researcher avatar only (a third-party/local model Agent colour) |
| Error | `#FF8FA3` | `#FFC2CD`, `#E7AEBB`, `#E7B9D8` | `#6A2A3A` | bg `#2A0F18`, `#1A0B12`, `#1E0E16`; rgba(255,143,163, .08/.5) | Failed test, blocked, destructive buttons, Owner Rule refusal |
| Neutral status | `#8C80A6` | n/a | n/a | n/a | Idle / skipped / unknown |

State-to-colour mapping (Agent State and other states; always paired with text or icon, never colour alone):

| State | Colour | Dot glow | Where |
|---|---|---|---|
| working / pracuje | Magenta `#F25FC4` | yes (10px) | rail of Agents, node glow, Run pill |
| waiting for Approval / czeka na Zgodę | Amber `#FFB547` | yes | Agent row badge, node glow, Approvals button |
| done / skończył / ready | Mint `#62E3B4` | yes (small status dots) | node, chips, check rows |
| idle / bezczynny / wolny | Grey `#8C80A6` | no | Agent row, chips |
| waiting for gate / czeka | Grey (text) | no | Senior Reviewer |
| failed / blocked | Error `#FF8FA3` | yes (Approval list) | tests, events |
| paused by Owner | Grey dot, text "wstrzymany przez Ciebie" | no | Workspace card |

Visibility mapping (ADR 0028): PUBLICZNY = Blue `#6FA8FF`, PRYWATNY = Violet `#9B7BFF`. The word is mandatory; colour is secondary.

Agent avatar gradients (8 Agent hues; `radial-gradient(circle at 35% 30%, light, dark)` plus glow `0 0 14px dark+66`):

| Agent | Light | Dark | Notes |
|---|---|---|---|
| Chief | `#FF9BDD` | `#C23FA0` | Chief only; glow can be stronger (`0 0 18px rgba(242,95,196,.5)` on the send button) |
| QA | `#FFB3E6` | `#E0479F` | |
| Security | `#FFD69A` | `#D98A1C` | |
| Developer | `#C9B8FF` | `#7A55E8` | |
| Product Owner | `#B8F5DD` | `#3FBF8F` | |
| Designer | `#FFE0A8` | `#E09A2E` | very close to Security (see section E) |
| Senior Reviewer | `#B9D3FF` | `#5B7FD6` | |
| Researcher | `#C2F0FF` | `#3AA6C8` | |

Initial text on avatars is `ink` `#12091F`, JetBrains Mono 700. Dynamic Agents have no mock colour: assign deterministically from the same 8 hues by hashing the Agent id (recommended).

#### A.1.4 Tints and glows used as fills (rgba)

`rgba(242,95,196,.22)` logo tile glow; `.35` border of "uses Skill" and filter chips; `.4/.45/.5` borders of the working Workspace card, Chief card, Chief summary; `.12/.1/.06/.05` tinted fills for drop zones and chips; `.16` node ring; `.55` drag-chip shadow. `rgba(155,123,255,.14/.16)` Skill chip fill and selection ring (`0 0 0 4px`); `.25` active rail glow; `.28` selected node ring; `.04` Gantt row track; `.12` popover glow. `rgba(255,181,71,.5)` Approvals button border, `.35` callout border, `.14/.35` node waiting ring/glow, `.12` import badge fill. `rgba(98,227,180,.35/.5)` OK card borders and quality frame, `.08/.12` verdict tint. `rgba(255,143,163,.5)` Owner Rule card border, `.08` row tint. `rgba(0,0,0,.25)` hatch stripes in the waiting Gantt bar; `rgba(0,0,0,.6)` popover shadow; `rgba(20,15,32,.92/.96)` floating canvas legend / Tray background.

### A.2 Typography

Two families: **Bricolage Grotesque** (UI, weights 400/600/700) and **JetBrains Mono** (labels, paths, statuses, tabs, numbers; weights 400/500/600/700). Fallback stacks from the mocks: `'Bricolage Grotesque', system-ui, sans-serif` and `'JetBrains Mono', monospace`. Font loading: self-host both (no Google Fonts at runtime, the app is offline-capable); the mocks load Google Fonts. Default root: 14px Bricolage, colour `text-primary`.

Named text styles (size / weight / letter-spacing / line-height). "Uses" = number of text nodes in the mocks (indicative).

**Bricolage Grotesque**

| Style | Spec | Uses | Example |
|---|---|---|---|
| `display` | 34 / 700 / -0.68px / 39px | 2 | Onboarding step title |
| `display-sm` | 32 / 700 / -0.64px | 1 | Workspaces dashboard title |
| `title-page` | 26 / 700 / -0.52px | 5 | Workflow, Task Board, Skills, Agents page titles |
| `title-detail` | 26 / 700 / -0.26px or 0 | 2 | Decision title, Agent name (should be `title-page`) |
| `title-section` | 24 / 700 / -0.48px | 2 | Decision Register, Approvals titles |
| `title-24` | 24 / 700 / 0 | 2 | Approval item title, Run header (should align with `title-section`) |
| `title-22` | 22 / 700 / 0 | 3 | Discussion title, "Agenci", "Runy" |
| `wordmark` | 22 / 700 / -0.44px | 2 | "Overmind" |
| `node-title` | 20 / 700 / -0.2px, colour `text-bright` | 7 | Canvas node names |
| `stat` | 20 / 700 | 5 | Counts (Lane summary, Mini stats) |
| `card-title` | 18 / 700 | 10 | Workspace card name |
| `title-17` | 17 / 700 | 8 | Approval title, Chief/QA names in panels |
| `heading` | 16 / 700 | 6 | Settings section titles |
| `heading-sm` | 15 / 700 | 27 | Panel h2 ("Powiadomienia"), large buttons (Dalej), Lane titles |
| `lead` | 16 / 400 / 24.8px, `text-secondary` | 2 | Wizard lead |
| `body-lg` | 15 / 400 / 22.5px (summary) or 21.75px (chat message) | 10 | Chief summary, chat messages |
| `body` | 14 / 400 / 20.3px | 11 | Card summaries |
| `body-field` | 14 / 400 / normal | 33 | Input text, placeholder-like labels |
| `row-title` | 14 / 600 | 95 | Row titles, step names |
| `row-title-tight` | 14 / 600 / 18.9px | 15 | Task titles |
| `body-sm` | 13 / 400 | 67 | Rows, status text |
| `body-sm-multiline` | 13 / 400 / 18.85px (1.45) | 26 | Notices, Discussion text |
| `button` | 13 / 600 | 116 | Default button label |
| `button-strong` | 13 / 700 | 16 | Primary/filled button label |
| `button-lg` | 14 / 700 or 600 | 12 | Approval buttons (44 and 46px height) |
| `caption` | 12 / 400 / 17.4px | 18 | Hints, notes (also 12/400 normal, 114 uses) |
| `caption-strong` | 12 / 600 | 8 | Agent names in chips |
| `caption-xs` | 11 / 400 / 14.3-15.4px | 7 | Helper text under rows |
| `micro` | 11 / 400 | 17 | "opcjonalnie" |

**JetBrains Mono**

| Style | Spec | Uses | Example |
|---|---|---|---|
| `mono-label` (Section label) | 10 / 500 / +0.8px (0.08em), uppercase, `text-muted` | 69 | "AGENCI W TYM WORKSPACE" |
| `mono-eyebrow` | 11 / 500 / +0.88px, `#FFB3E6` | 2 | "PIERWSZE URUCHOMIENIE" |
| `mono-eyebrow-wide` | 11 / 500 / +1.1px | 1 | "ZAKŁADKA NA KAFELKU" |
| `badge-outline` | 9 / 600 / +0.72px (0.08em), 1px border, radius 5px | 24 | PUBLICZNY / PRYWATNY in lists |
| `badge-filled` | 10 / 700 / +1px, or 11 / 700 / +1.1px, radius 7px | 5 | PUBLICZNY / PRYWATNY / TOR in Inspector |
| `badge-node-tab` | 11 / 700 / +1.32px (0.12em), radius 8px | 7 | Node type tab |
| `mono-xs` | 10 / 400 | 10 | Gantt axis |
| `mono-sm` | 11 / 400 | 141 | Meta lines, timestamps, counts |
| `mono-sm-500` | 11 / 500 | 42 | Chips, version badges |
| `mono` | 12 / 400, `text-secondary` or muted | 179 | Status words, paths, table cells |
| `mono-500` | 12 / 500 | 39 | Counts, tab numbers |
| `mono-md` | 13 / 400 | 10 | Folder names, paths |
| `mono-skill` | 14 / 500 | 8 | Skill names |
| `mono-code` | 11 / 400 / 1.5-1.6 (16.5-17.6px); 12 / 1.6-1.7 | 14 | Terminal, diff, markdown preview |
| `mono-canvas-label` | 15 / 500, `#BFF3DF` | 1 | Quality-loop frame label |
| `mono-stat` | 16 / 600 | 1 | Big number |
| `mono-skill-title` | 18 / 600 | 1 | Skill detail title |
| `avatar-initials-{n}` | 700, size 10 at 22-28px avatars; 11 at 34; 12 at 36; 13 at 40; 14 at 44; 16 at 48; 18 at 56 (line-height = avatar size) | 90 | Avatars |

Rules: all uppercase labels are real uppercase strings in the mock (no `text-transform`); keep it that way in i18n (or use `text-transform: uppercase` and keep source strings sentence case; recommended: uppercase through CSS so translations stay simple). Numbers carry a word unit ("18 min", "3 z 3 naraz"). Links are underlined (12-13px, `text-link`), nothing else is underlined.

### A.3 Spacing

Observed paddings/gaps: 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 36, 40, 48, 56. The mocks mix an 8-pt rhythm with +/-2px values. Recommended scale (token = px): `s-2, s-4, s-6, s-8, s-10, s-12, s-14, s-16, s-18, s-20, s-24, s-28, s-36, s-40, s-48, s-56`. Page paddings per layout are listed in A.9. 22 appears as a page padding in 7 views and 24 in 2: normalise to 24 (section E).

### A.4 Radius

| Token | px | Used for |
|---|---|---|
| `r-xs` | 3 | Progress/limit track and bars |
| `r-sm` | 5 | Small outline badge (PUBLICZNY), Gantt bar, minimap items |
| `r-6` | 6 | Gantt track, minimap frame |
| `r-7` | 7 | Filled visibility badge |
| `r-8` | 8 | Node type tab, version badge, Tray logo tile, tooltips (proposed) |
| `r-10` | 10 | Select, small icon button, Telegram buttons, segmented items, secondary action |
| `r-12` | 12 | **Default button**, pill-like controls (top-bar chips use 999), Skill palette items |
| `r-13` | 13 | Switch track (44x26) |
| `r-14` | 14 | List rows, Agent rows, large buttons (44-46px), textarea, sub-cards, logo tile, rail items |
| `r-16` | 16 | Cards (Task, status list), Approval inline card, popover |
| `r-18` | 18 | Skill card, Chief conversation row, large panels |
| `r-20` | 20 | Lanes, node tile, wizard cards, section blocks |
| `r-22` | 22 | Workspace card, Chief summary strip, composer, Settings section |
| `r-24` | 24 | Canvas stage |
| `r-28` | 28 | Quality-loop group frame |
| `r-pill` | 999 | Pills, chips, status capsules |
| `r-round` | 50% | Dots, ports, step numbers, send button (Telegram) |
| `r-blob` | `42% 58% 55% 45% / 48% 42% 58% 52%` | **Agent avatar** (organic shape, the brand's cell) |
| `r-bubble-owner` | `20px 20px 6px 20px` desktop; `16px 16px 4px 16px` Telegram | Owner message |
| `r-bubble-other` | `16px 16px 16px 4px` (Telegram) | Chief/Agent message |

### A.5 Borders

1px (`line`) default; 1.5px for **selected** cards (colour = the selection colour: violet for Skill and Task cards, blue for public visibility radio, mint for chosen verdict) combined with a 4px ring (`0 0 0 4px rgba(155,123,255,.14-.16)`); 2px for node tiles, ports (2.5px), Gantt edges, tab underline; dashed 1px for add/drop surfaces (`line-strong` for "add" buttons and `#F25FC4` for active drop zones); dashed 2px for return edges (`#FFB547`) and the drop-target node (`#F25FC4`). Dividers: 1px `line-subtle`.

### A.6 Elevation, glows, shadows

The system uses **glow instead of drop shadow** (only the Tray popover has a real shadow).

| Token | Value | Used for |
|---|---|---|
| `glow-dot-mint/magenta/amber/error` | `0 0 10px <colour>` | Status dots |
| `glow-avatar` | `0 0 14px <dark>66` | Agent avatars |
| `glow-logo` | `0 0 22px rgba(242,95,196,.22)` | Logo tile |
| `glow-rail-active` | `0 0 18px rgba(155,123,255,.25)` | Active rail item, active filter |
| `glow-cta` | `0 0 24px rgba(242,95,196,.35)` | Wizard CTA |
| `glow-send` | `0 0 18px rgba(242,95,196,.5)` | Chief send button |
| `glow-step` | `0 0 16px #F25FC4` / `0 0 12px` | Wizard step dot |
| `glow-card-working` | `0 0 30px rgba(242,95,196,.12)` | Workspace card (working) |
| `glow-card-chief` | `0 0 24px rgba(242,95,196,.15)` | Selected Chief row |
| `glow-card-approval` | `0 0 40px rgba(255,181,71,.18)` | Inline Approval card |
| `glow-card-rule` | `0 0 28px rgba(242,95,196,.18)` | Magenta callout card |
| `glow-composer` | `0 0 30px rgba(155,123,255,.12)` | Composer |
| `ring-select-sm` | `0 0 0 4px rgba(155,123,255,.14)`, `.16` | Selected Skill card, Task card |
| `ring-node-selected` | `0 0 0 4px rgba(155,123,255,.28)` | Selected node |
| `glow-node-working` | `0 0 0 4px rgba(242,95,196,.16), 0 0 36px rgba(242,95,196,.45)` | Working node |
| `glow-node-waiting` | `0 0 0 4px rgba(255,181,71,.14), 0 0 30px rgba(255,181,71,.35)` | Node waiting for Approval |
| `glow-edge-active` | `0 0 8px #F25FC4` | Active edge |
| `glow-drag` | `0 12px 30px rgba(242,95,196,.55)` | Dragged Skill chip |
| `shadow-popover` | `0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(155,123,255,.12)` | Tray menu (pattern for all popovers) |

### A.7 Z-layers

Not defined in any mock (no `z-index`; the canvas layers by DOM order). Recommended scale: `z-base 0`, `z-sticky 10` (top bar, tab bar), `z-canvas-overlay 20` (zoom toolbar, minimap, legend, validation badge), `z-drag 30` (dragged Skill chip, drag ghost), `z-popover 40` (menus, selects), `z-dialog 50` (modal scrim + dialog), `z-toast 60`, `z-tooltip 70`.

### A.8 Motion

Not defined in any mock. Recommended (consistent with the neon glow language): `motion-fast 120ms ease-out` (hover, press), `motion-base 200ms cubic-bezier(.2,.8,.2,1)` (panels, tabs, toggles), `motion-slow 320ms` (dialog, toast enter); one looping animation `pulse` 1.6s on the 8-10px glow dot of a **working** Agent; blinking cursor 1s on the terminal caret (the mock draws `▍` as a text character); `prefers-reduced-motion`: disable `pulse` and blink, keep colour changes. Canvas node glow transitions 200ms.

### A.9 Layout constants

| Constant | Value | Where |
|---|---|---|
| App viewport (design) | 1440 x 900 | all desktop |
| AppRail | 72px wide, padding 16px 12px, items 44x44 (r14), gap 6, logo tile 44x44 (r14) at top, Settings item pinned to bottom | 14 views |
| TopBar | padding 12px 20px, wraps; one row = 67px high (items 28-42px); with workspace switcher the mock wraps to 117px | 14 views |
| SubTabs | height 45 (44px button + 1px border), padding 0 20px | 7 views |
| Conversation list (Chief, Direct agent chat) | 270px | Chief, Direct chat |
| Chief right panel | 300px | Chief |
| Direct chat right panel | 340px | Direct chat |
| Workspaces dashboard right column | 320px | Workspaces |
| Task Board detail | 320px | Task Board |
| Skill library detail | 340px | Skill library |
| Decision Register list (left) | 400px; the detail fills the main column (968px) | Decision Register |
| Approvals list | 360px | Approvals |
| Discussion list / aside | 260 / 310 | Discussion |
| Agents list (left) / memory aside (right) | 290 / 310 | Agents |
| Workflow canvas left / Inspector | 240 / 290 | Workflow canvas |
| Workspace settings section nav (left) / content | 240 / max 980 | Workspace settings |
| Connections aside | 320px | Connections |
| Activity Run list (left) / usage aside (right) | 250 / 300; Gantt label column 170px, row track flexible | Activity |
| Onboarding sidebar | 360px; main padding 48px 56px; content max-width 620 (step 1) / 640 (step 2) | Onboarding |
| Chat column | max-width 780px (Chief, Direct chat), 820px (Discussion) | |
| Settings content | max-width 980px (Workspace), 2 columns of 646px (App settings) | |
| Page paddings | 22-28px (main), 24px (Skills/Activity), 18px 20px (Task Board), 16px 18px (canvas) | |
| Canvas | world 1120x760, zoom 0.7 shown, dot grid 22px (`radial-gradient(rgba(155,123,255,.16) 1px, transparent 1px)`), node tile 224x112 (Discussion 240x112), port 14px, Join ring 26px, Start pill 64x30, Quality Gate diamond 44px rotated | Workflow canvas |
| Tray popover | 380px wide, padding 8, r16 | Tray |
| Telegram | 390 x 844, header 71, input row 85 (bottom 28 safe area), thread dot grid 18px | Telegram |
| Touch/click minimum | buttons 34-46px high; default 40px | |

### A.10 Icon set

Library: custom inline SVG, **viewBox 0 0 24 24, stroke 1.8, `fill: none`, round caps/joins, colour via `currentColor`** (a few mocks hard-code the stroke; implement as `currentColor` and pass colour through the parent). Sizes: 12, 14, 16, 18, 20, 22. Stroke 2 / 2.4 / 2.6 are used only inside filled buttons (send, chevron on the Chief button, check in the done ring); keep a `strokeWidth` prop (default 1.8). Brand marks use viewBox 0 0 64 64 with gradient `#FF8AD8` to `#9B7BFF`.

Status glyphs are **text characters**, not SVG: `✓ ✗ ● ○ ◆ ▍ → ↔ · ›`. Recommended: keep them as Unicode inside the `StatusText` composite, with a fixed mono font fallback.

#### Icon list (26 distinct SVGs; 23 UI icons + 3 brand marks)

| Name | Size(s) used | Inner SVG (viewBox 24, stroke 1.8, round) | Used in | Notes |
|---|---|---|---|---|
| `folder-plus` | 16 | `<path d="M3 6h6l2 2h10v11H3z"/><path d="M12 12v4M10 14h4"/>` | Onboarding 1, Workspaces | Add folder; Access Request notification |
| `chevron-right` | 12, 14, 16 | `<path d="m9 6 6 6-6 6"/>` | 16 views (shell and panels) | Button arrow; **also used as select caret (should be chevron-down, see E)** |
| `check` | 14, 16 | `<path d="m5 12 5 5 9-10"/>` | Onboarding 2, Workspaces, Direct chat | Done ring, checkbox-like tick (2.6 stroke on mint fill) |
| `home` | 20 | `<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>` | 14 views (shell and panels) | Rail: Workspaces |
| `chat` | 16, 20 | `<path d="M4 5h16v11H9l-5 4z"/>` | 15 views (shell and panels) | Rail: Chief, chats, Discussions |
| `workflow` | 16, 18, 20 | `<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.5 6.8 15.6 11M8.5 17.2l7.1-4.2"/>` | 14 views (shell and panels) | Rail: Workflow and Runs; Agent node type icon |
| `board` | 18, 20 | `<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>` | 14 views (shell and panels) | Rail: Task Board; TOR node icon |
| `scales` | 16, 20 | `<path d="M12 3v18"/><path d="M5 7h14l-2 4H5z"/><path d="M8 21h8"/>` | 14 views (shell and panels) | Rail: Decision Register |
| `agents` | 16, 20 | `<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.6 3 6"/>` | 14 views (shell and panels) | Rail: Agents and Skills |
| `settings` | 20 | `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>` | 14 views (shell and panels) | Rail: Settings (sun-like rays) |
| `shield-check` | 16 | `<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>` | 14 views (shell and panels) | Approvals button; Approval notification |
| `pause` | 16 | `<path d="M9 5v14M15 5v14"/>` | 15 views (shell and panels) | Global Pause; Pause Run; Workspace pause |
| `plus` | 14, 16 | `<path d="M12 5v14M5 12h14"/>` | 8 views (shell and panels) | Add / new |
| `lock` | 12, 14, 16, 18 | `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>` | Workspaces, Direct chat, Canvas, Agents | Private Agent node icon; private marker |
| `discussion` | 16, 18 | `<path d="M3 6h11v8H7l-4 3z"/><path d="M17 9h4v8l-3-2h-6v-1"/>` | Workspaces, Canvas | Two bubbles: Discussion node, Discussion notification |
| `activity` | 16 | `<path d="M3 12h4l3-7 4 14 3-7h4"/>` | Workspaces, Canvas, Tray | Heartbeat: Run/Activity, Escalation notification |
| `send` | 18 | `<path d="M4 12 20 4l-6 16-3-7z"/>` | Chief, Direct chat, Discussion, Telegram | Send (paper plane filled); stroke 2 on magenta |
| `search` | 16 | `<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>` | Canvas, Decisions | Search fields |
| `grip` | 14 | `<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>` | Canvas, Connections | Drag handle (6 dots) |
| `skill-cube` | 12, 14, 18, 22 | `<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>` | Canvas, Skills | Skill package: Skills tab, Skills list marker (blue at 2 stroke) |
| `document` | 12 | `<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>` | Task Board, Workspace settings | Documentation reference chip (spec.md#...) |
| `bell` | 16 | `<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>` | Discussion, Connections | Notification (Connections and Discussion started) |
| `telegram-plane` | 20 | `<path d="M21 4 3 11l6 2 2 6 3-4 5 4z"/><path d="m9 13 8-6"/>` | Connections | Telegram connection card |

**Brand marks** (viewBox `0 0 64 64`, gradient `#FF8AD8` to `#9B7BFF`, `x1=0 y1=0 x2=1 y2=1`). The mark is a four-cell hex cluster (one filled hexagon on top, three outlined hexagons below, stroke 3.2, round joins). The three instances differ only in gradient id and size:

| Name | Size | Where |
|---|---|---|
| `logo-mark` | 30px inside a 44px tile (rail, wizard sidebar 46px tile), 28px in Telegram header, 20px in the Tray header | rail (14 views), Onboarding (2), Tray, Telegram |

Geometry (use one component with a unique gradient id per instance):

```svg
<svg viewBox="0 0 64 64">
  <defs><linearGradient id="om-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8AD8"/><stop offset="1" stop-color="#9B7BFF"/></linearGradient></defs>
  <path d="M32.0 6.5 L40.7 11.5 L40.7 21.5 L32.0 26.5 L23.3 21.5 L23.3 11.5 Z" fill="url(#om-logo)"/>
  <path d="M23.3 21.5 L32.0 26.5 L32.0 36.5 L23.3 41.5 L14.6 36.5 L14.6 26.5 Z" fill="none" stroke="url(#om-logo)" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M40.7 21.5 L49.4 26.5 L49.4 36.5 L40.7 41.5 L32.0 36.5 L32.0 26.5 Z" fill="none" stroke="url(#om-logo)" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M32.0 36.5 L40.7 41.5 L40.7 51.5 L32.0 56.5 L23.3 51.5 L23.3 41.5 Z" fill="none" stroke="url(#om-logo)" stroke-width="3.2" stroke-linejoin="round"/>
</svg>
```

Missing icons that the UI needs but the mocks only draw as text: close/x, chevron-down (select caret), more (...), play/resume, stop, refresh, external-link, copy, trash, edit/pencil, filter, info, warning triangle, user/Owner, folder (plain), terminal, clock, zoom-fit, undo, redo, expand. Draw them in the same 24-grid, stroke 1.8 style (list in section D, task "icons").


---

## B. Primitives

Format per primitive: **Props**, **Variants** (exact values from the mocks), **States** (S = drawn in a mock, R = recommended, not drawn), **Used in**. Shared recommended state rules for every interactive primitive, defined once and referenced as "std states":

- **hover (R)**: surface fill +1 step (`bg-surface` to `bg-raised`, transparent to `bg-surface`), border to `line-strong`; filled buttons brighten 6% and add `glow-cta` in their own hue. 120ms.
- **focus-visible (R)**: 2px `bg-app` gap + 2px `#9B7BFF` ring (`0 0 0 2px #0A0710, 0 0 0 4px #9B7BFF`), never removed (the mocks set `outline: none` on inputs, so every input needs a replacement ring: border to `#9B7BFF`).
- **pressed (R)**: translateY(1px), fill -6% brightness.
- **disabled (R)**: opacity .45, no glow, `cursor: not-allowed`, `aria-disabled`. (The only dimmed element in the mocks is the "Klucze API" card at opacity .55.)
- **loading (R)**: label stays, leading icon replaced by a 14px spinner (stroke 1.8, 0.9s), button `aria-busy`.

### B1. Button (`Button`)

Props: `variant`, `size`, `icon` (leading), `iconEnd`, `iconOnly`, `fullWidth` (flex-grow), `loading`, `disabled`, `as` (`button` | `a` | router link), `toneSelected` (for toggle buttons).
Base: inline-flex, centered, gap 8, font Bricolage, no underline.

| Variant | Height / padding / radius | Fill / border / text | Font | Used in |
|---|---|---|---|---|
| `primary-violet` | 40 / 0 14 / 12 | `#9B7BFF`, no border, `ink` | 13/700 | Save as new Agent/Skill version, Edit as v8, Approve Discussion result (flex-grow) |
| `primary-magenta` | 40 / 0 14 / 12 | `#F25FC4`, none, `ink` | 13/700 | Keep dynamic Agent, Accept Skill, Open link (wizard), Pull/Open actions |
| `primary-magenta-lg` | 44 / 0 16 / 12 | `#F25FC4`, none, `ink` | 14/700 | "Wstrzymaj wszystko" in App settings |
| `cta-wizard` | 46 / 0 22 / 14 | `#F25FC4` + `glow-cta`, `ink` | 15/700 | Onboarding Next ("Dalej") |
| `approve-amber` | 44 / 0 18 / 14 (Chief), 46 / 0 20 / 14 (Approvals), 40 / flex1 / 10 (Telegram) | `#FFB547`, `ink-amber` | 14/700 (Telegram 13/700) | "Zezwól na ten Run", "Zezwól tym razem" |
| `approve-amber-outline` | 44 or 46 / 0 16 / 14 | transparent, 1px `#6B4E22`, `#FFE2B5` | 14/600 | "Zezwól na stałe" (desktop only; Telegram never offers it) |
| `deny-outline` | 44 or 46 / 0 16 / 14 | transparent, 1px `#3A2E44`, `#D9C7EA` | 14/600 | "Odmów", "Odmów z komentarzem" |
| `deny-telegram` | 40 / flex1 / 10 | transparent, 1px `#2A2040`, `#A79BBF` | 13/700 | Telegram "Odmów" |
| `secondary` | 40 / 0 14 / 12 | `#140F20`, 1px `#2A2040`, `#EFE9F7` | 13/600 (26 uses), 14/600 with 0 12 padding (12 uses) | Replay, Export, Dry-run, Pause run, Usuń, Wykryj, Back |
| `secondary-wizard` | 46 / 0 16 / 14 | `#140F20`, 1px `#2A2040` | 14/600 | Onboarding Back link-button |
| `select` (see B11) | 38 / 0 12 / 10 | `#0C0814`, 1px `#2A2040` | 13/400 | Settings |
| `palette` | 40 / 0 10 / 12 | `#160F24`, 1px `#2A2040`, cursor grab | 13/600 | Node palette (icon `#D6C9FF`) |
| `ghost` | 36-40 / 0 10-12 / 10 | transparent, none, `#A79BBF` | 12/400 (13/400 in Tray) | Undo/Redo, filter segments |
| `ghost-primary-text` | 40 / 0 10 / 10 | transparent, `#EFE9F7` | 13/400 left-aligned | Tray menu item (see C) |
| `pause` (Global Pause) | 40 / 0 14 / 12 (Tray 42, margin 4 2, 13/700) | `#2A1026`, 1px `#5A2A4F`, `#FFD3F1` | 13/600 | Top bar Global Pause, Tray |
| `danger` | 40 / 0 14 / 12 | `#2A0F18`, 1px `#6A2A3A`, `#FFC2CD` | 13/600 | Cancel Run, Stop Agent, Disconnect, Delete Workspace (outline) |
| `dashed-add` | 44 / full-width / 14 (12 in Onboarding/Workspace) | transparent, 1px dashed `#5B3E8F`, `#D6C9FF` | 13/600 | New Agent, Add folder, Choose in Finder |
| `dashed-more` | 40 / full-width / 12 | transparent, 1px dashed `#2A2040`, `#A79BBF` | 12/400 | "Pokaż 5 starszych" |
| `icon-square` | 36x36 r10 border `#2A2040`; 40x40 r10 no border | transparent, `#EFE9F7` (+/-) or `#A79BBF` (search) | 16-18/400 glyph | Zoom +/- (40), stepper +/- (36), search (40) |
| `icon-send` | 44x44 / r14 | avatar gradient magenta (Chief, Discussion: `#FF9BDD` to `#C23FA0`; Direct chat: agent gradient) + `glow-send` | icon 18 stroke 2 `ink` | Composers |
| `icon-send-flat` | 44x44 / 50% | `#F25FC4` | icon 18 | Telegram |
| `link` | n/a | `#E9D8FF`, underlined | 12-13/400 | In-text navigation ("Profil Agenta", "Tablica", "D-03") |

States: std states (R). Selected-toggle form (`aria-pressed`) exists for filters (S: `Wszystkie` with `#1C1330` fill, 600). Where used: all 18 views (Tray and Telegram have their own heights).
Count: 21 variants in the mocks.

### B2. Pill / Chip (`Pill`, `Chip`)

Common: inline-flex, gap 6, r999. Props: `tone` (neutral | mint | amber | lavender | blue | violet | magenta | error), `selected`, `removable`, `icon`, `mono`, `size` (sm 11 | md 12), `as`.

| Variant | Size / padding | Fill / border / text | Font | Used in |
|---|---|---|---|---|
| `meta` (TopBar) | 6 10 | `#140F20`, 1px `#2A2040`, `#A79BBF` | mono 12/400 | limit, slots, Telegram, filter chips |
| `meta-selected` (filter) | 6 10 | `#1C1330`, 1px `#5B3E8F`, `#EFE9F7` | mono 12/400 | Decisions "Wszystkie Workspace'y", Skills "Wszystkie" |
| `meta-tone` | 6 10 | as `meta`, text coloured: mint `#62E3B4` (artifacts, passed), amber `#FFCF85` (exceptions), lavender `#D6C9FF` (versions, Skills), blue `#6FA8FF` (Public filter), violet `#9B7BFF` (Private filter) | mono 12/400 | Evidence, exceptions, filters |
| `skill-uses` (magenta tint) | 6 10 | `rgba(242,95,196,.1)`, 1px `rgba(242,95,196,.35)`, `#FFB3E6` | mono 12/400 | "e2e-trace.zip" artifact in Task detail, "użyto Skilla" in chats (violet tint variant below) |
| `skill-chip` | 3 8 (11px) / 5 9 / 6 10 (12px) | `rgba(155,123,255,.14)` or `.16`, none, `#D6C9FF` | mono 11/500 or 12/500 | Skills assigned to Agent, Discussion "skill: X v2", Inspector |
| `skill-used` | 4 9 | `rgba(155,123,255,.14)`, none, `#D6C9FF`, align-self flex-start | mono 11/500 | "użyto Skilla: e2e-playwright v2" in chat |
| `count` | 2 8 | `#140F20`, none, `#A79BBF` | mono 11/500 | Lane counts |
| `origin` | 3 8 | amber tint `rgba(255,181,71,.12)`/`#FFCF85`; violet tint `rgba(155,123,255,.14)`/`#D6C9FF`; magenta tint `rgba(242,95,196,.12)`/`#FFB3E6` | mono 10/500 | Skill origin: import, Owner, Chief |
| `position` | 3 8 | transparent, 1px colour = text colour: mint `#62E3B4`, grey `#8C80A6`, amber `#FFCF85` | mono 11/500 | Discussion positions |
| `run` (live) | 5 10 | `rgba(242,95,196,.12)`, 1px `rgba(242,95,196,.4)`, `#FFB3E6`, with 8px dot | mono 12/500 | Workflow header Run pill |
| `removable` | 6 10 | transparent, 1px `#5B3E8F`, `#D6C9FF` | mono 12/400 | "+ zdejmij wymóg" |
| `quick-action` | min-h 34, 0 12 | `#140F20`, 1px `#2A2040`, `#A79BBF` | 12/400 (Bricolage) | Chief quick actions (button) |
| `model` (on node) | 3 12 3 3 | `#17111F`, 1px `#2A2040`, `#EFE9F7` | 12/400 | Node model pill (avatar ring + name) |
| `validation` | 5 10 | mint tint pill | mono 12 | "Walidacja: 0 błędów" |

States: std (R); selected is S only for `meta-selected`; removable needs a 14px x icon (R); error tone (R) for validation with errors.

### B3. Badge / Tab-label (`VisibilityBadge`, `NodeTab`, `SkillsTab`, `VersionBadge`, `CountBadge`)

| Variant | Spec | Where |
|---|---|---|
| `VisibilityBadge outline` | 9px mono 600, ls 0.08em, padding 2 6, r5, 1px border; PUBLICZNY `#6FA8FF`, PRYWATNY `#9B7BFF` (text = border) | Agent list rows, Skill library lists, Canvas Skills list |
| `VisibilityBadge filled-sm` | 10px mono 700, ls 0.1em, padding 3 8, r7, fill = colour, text `#0A0710` | Workflow header ("PRYWATNY"), Skills detail |
| `VisibilityBadge filled-md` | 11px mono 700, ls 0.1em, same shape | Inspector visibility cards |
| `NodeTab` | mono 11/700 ls 0.12em, padding 4 10, r8, absolute left 18 top -13; fill by kind: PUBLICZNY `#6FA8FF`, PRYWATNY `#9B7BFF`, TOR `#62E3B4`, DYSKUSJA `#C9B8FF`; text `#0A0710` | Canvas node tile |
| `SkillsTab` | pill padding 3 9, 2px border in kind colour, fill = tile fill, text kind colour, 12px skill-cube icon + "N skille"; drop-target state: border `#F25FC4`, text `#FFB3E6`, label "upuść → 1 skill" | Canvas node tile, top-right |
| `VersionBadge` | mono 11/500, padding 4 8, r8, `#191226`, `#C9B8FF` | Workflow "v7 · opublikowana", Task Board source Workflow |
| `CountBadge circle` | min-w 20, h 20, padding 0 6, r10, fill `#F25FC4`, text `ink` mono 11/700 | Agent row "1" (Approvals waiting; see E: should be amber) |
| `TorLabel` | like `filled-md` in mint | Inspector "TOR" tag |

### B4. Dot / StatusIndicator (`StatusDot`, `Port`, `StepRing`)

`StatusDot`: sizes 6, 8, 10; r50%; colour by state; `glow` boolean (`0 0 10px <colour>`).
- 6px mint glow: system rows, Telegram status, "ready" rows.
- 8px: grey (neutral/idle/paused, no glow), mint (done), amber (waiting) on Task cards and Connections; magenta glow in chat lists.
- 10px magenta glow (working Workspace card, Agent list), amber glow (waiting), mint glow (done), grey (idle).
- Positioned variant: overlay at avatar bottom-right (`left:34 top:34` of a 34px avatar).
- `Port` 14px, border 2.5 in kind colour, fill `#0A0710`, centered on node edge (-7px).
- `StepRing` 26px: done = mint fill + dark check (14px stroke 2.6); waiting = 2px `#F25FC4` ring + `0 0 12px`; skipped = 2px `#8C80A6` ring + glow; wizard step 28px: active = magenta fill + `0 0 16px` + number; pending = 1.5px `#5B3E8F` ring + number `#8C80A6`.
States: R: working dot pulses (A.8); no hover.

### B5. Avatar (`Avatar`)

Props: `agent` (hue key), `size`, `initials`, `ring`, `statusDot`, `stacked`.
Sizes in the mocks: 22 (chip), 24 (Chief strip chips, mono 10), 26 (card stacks, model pill 26/10), 28 (message avatars, mono 10), 34 (lists, mono 11), 36 (Chief header, mono 12), 40 (Chief row / header, mono 13), 44 (summary strip, mono 14), 48 (profile header, mono 16), 56 (Agent profile, mono 18). Shape `r-blob`, fill radial gradient per hue (A.1.3), glow `0 0 14px dark66`, initials `ink` mono 700 centered with `line-height = size`.
Variants: `ring` (wrapper r50% with 2px border in kind colour: model pill on node), `stack` (container `padding-left 6`, each avatar wrapper `margin-left -6`; see E, the mock stacks avatars without a separating border), `status` overlay dot.
Used in: 17 of 18 views.

### B6. Toggle / Switch (`Switch`)

44x26, padding 3, r13, no border; knob 20px circle. On: track `#9B7BFF`, knob `#12091F`, justify end. Off: track `#2A2040`, knob `#8C80A6`, justify start. Rendered as `button`; recommended `role="switch" aria-checked`. States: std (R); disabled (R: track `#1C1330`). Used in: App settings (autostart, "Pracuj po zamknięciu okna", Telegram forward), Workspace settings (isolation, private items).

### B7. Checkbox (`Checkbox`)

Native input 20x20, `accent-color #9B7BFF` (Onboarding 1 rights, Workspace folder table cells, margin-top 1px). Rights row (`CheckboxRow`): label `align-items:flex-start`, gap 12, title Bricolage 14/600, description 12/400 `#8C80A6`. Recommended: custom box 20px r6, border 1.5px `line-strong`, checked fill `#9B7BFF` with `ink` check, `indeterminate`, disabled; keep native input for a11y. Variants: row with description; bare cell.

### B8. Radio / Segmented (`RadioCardGroup`, `SegmentedControl`, `VerdictSelect`)

- `RadioCardGroup` (visibility chooser, Agent profile): items `flex 1 1 200`, column gap 3, padding 10 12, r14. Selected: border 1.5px `#6FA8FF`, fill `rgba(111,168,255,.1)`, text primary (colour follows the option: private selected would be violet, not drawn). Unselected: 1px `#2A2040`, transparent, `#A79BBF`. Content: outline `VisibilityBadge` with icon + title + description 12px. Compact form in the Inspector: `flex 1 1 0`, padding 8 10, r12, border 1.5/1px, same colours; `aria-pressed` or `radio`.
- `SegmentedControl` (Task Board filter): container padding 4, r14, border 1px `#2A2040`, `#140F20`; items h36, padding 0 12, r10, 12px; selected: `#1C1330`, 600, `#EFE9F7`; others transparent `#A79BBF`; `aria-pressed`.
- `VerdictSelect` (Decision outcome): 4 buttons h40 padding 0 14 r12 13/600; selected (pozytywny): border `#62E3B4`, fill `rgba(98,227,180,.12)`, text mint; unselected: border `#2A2040` transparent, text per outcome (mieszany `#FFCF85`, nieznany `#8C80A6`, negatywny `#FF8FA3`). Each outcome needs its own selected tint (R): mixed = amber, unknown = grey, negative = error.
Used in: Agents, Workflow canvas Inspector, Task Board, Decision Register.

### B9. Tabs (`Tabs`)

- `SubTabs` item: link, min-h 42, padding 0 14, 14/600, bottom border 2px; active: text `#EFE9F7`, border `#F25FC4`; inactive: `#A79BBF`, transparent. Container: gap 4, padding 0 20, border-bottom 1px `#241B36`, bg `#0D0915`.
- `ProfileTabs` (Agents): button, min-h 40, padding 0 14, 14/600, border-bottom 2px; active `#EFE9F7` + `#9B7BFF` underline.
Props: `items`, `value`, `onChange`, `variant` (page | profile). States: std (R). Underline colour differs (magenta vs violet); see E.

### B10. TextInput / Search / Textarea / Composer

| Component | Spec | Used in |
|---|---|---|
| `SearchField` | wrapper flex gap 8, padding 0 10, min-h 40 (42 in some), r12, 1px `#2A2040`, `#140F20`; 16px search icon `#8C80A6`; input 13px transparent, no border, no outline | Skills panel, Decisions |
| `TextField` | not used as a bordered field anywhere in the mock except below; recommended: same as SearchField without icon, error state border `#FF8FA3`, helper text 12px | R |
| `Textarea` | padding 12 14, r14, 1px `#2A2040`, `#140F20`, 14px/1.5, resize vertical | Agent instructions |
| `Composer` | container flex gap 10, padding 10 10 10 16, r22, 1px `#3A2A5C`, `#120D1C`, `glow-composer`; textarea rows 2, 15px, transparent, padding 6 0; send `icon-send`; placeholder "Napisz do Chiefa… albo @qa" | Chief, Direct chat, Discussion (Owner voice) |
| `TelegramInput` | min-h 44, padding 0 14, r22, 1px `#2A2040`, `#140F20`, 14px | Telegram |
| `VisuallyHidden` label | 1x1 absolute clip | every input (pattern: labels exist but hidden) |
States: std; focus replaces `outline: none` (R); error and disabled (R); composer disabled during Global Pause (R).

### B11. Select / Model picker (`Select`, `ModelPicker`)

- `SelectButton`: inline-flex, gap 8, min-h 38, padding 0 12, r10, 1px `#2A2040`, `#0C0814`, 13px, trailing 12px chevron (mock uses `chevron-right`, `#8C80A6`).
- `ModelPicker`: flex space-between, min-h 42, padding 0 12, r12, 1px `#2A2040`, `#140F20`, 14/600, trailing chevron, with a section label above ("MODEL", "MODEL ZAPASOWY"). Value format: "Claude Code · Opus 5.5" (CLI name, middle dot, model). A second line, mono 11, gives the fallback ("Zapasowy: Codex CLI · gpt-5.5").
Open state: `Menu` (B18), with the current option marked by a check. Disabled when the CLI is not logged in (R: option hidden/grey with "zaloguj w Połączeniach").

### B12. Card (`Card`)

Props: `tone`, `size` (sm r14 | md r16 | lg r18 | xl r20 | 2xl r22), `selected`, `interactive`, `padding`.

| Tone | Border / fill | Used |
|---|---|---|
| `default` | 1px `#2A2040`, `#140F20` | Workspace card, Skill card, Task card, Connection card (r22), tables (r16, overflow hidden) |
| `nested` | 1px `#241B36`, `#140F20`, r14/16 | status list, stat tiles, Decision sub-cards |
| `selected` | 1.5px `#9B7BFF` + `ring-select-sm`, `#140F20` | Task card T-31, Skill card |
| `list-selected` | 1px `#5B3E8F`, `#1A1422` | selected list row/card (Agent, Decision, Run, Approval) |
| `working` | 1px `rgba(242,95,196,.45)` + `glow-card-working`, `#140F20`, r22 | Workspace card with active Run |
| `chief` | 1px `rgba(242,95,196,.4)`, gradient 120deg `#2A1130` to `#120D1C` 60%, r22 (summary) / 135deg `#2A1130` to `#1A1029`, r18 (row) | Chief summary, Chief row |
| `approval` | 1.5px `#FFB547`, gradient 160deg `#2A1D0C` to `#170F1A` 70%, r20/22, `glow-card-approval` | Approval card |
| `rule-refusal` | 1.5px `rgba(255,143,163,.5)`, `#1E0E16`, r16 | Owner Rule refusal |
| `danger` | 1px `#6A2A3A`, `#1A0B12`, r16 | Delete Workspace |
| `callout-amber` | 1px `rgba(255,181,71,.35)`, `#1E160A`, text `#E9D2AE` 12/1.45, r14 | Subscription-policy note |
| `callout-magenta` | 1px `rgba(242,95,196,.5)`, `#1F0F25`, `glow-card-rule`, r18 | Chief proposal |
| `drop` | 1px dashed `#F25FC4`, `rgba(242,95,196,.05)`, r12-18 | Skill drop zones |
| `ok` | 1px `rgba(98,227,180,.35)`, `#10161A`, r14 | Skill-use result |
| `section` | 1px `#241B36`, `#0C0814`, r20/22, padding 16-20 | Settings sections, lanes |
| `disabled` | default + opacity .55 | "Klucze API po MVP" |
| `terminal` | 1px `#241B36`, `#06040A`, r14 | terminals, previews |

### B13. ListRow (`ListRow`)

Props: `leading` (Avatar/icon), `title`, `subtitle`, `trailing`, `selected`, `as`.
| Variant | Spec | Used |
|---|---|---|
| `ConversationRow` | padding 9 10, r14, 1px transparent; selected `#1A1422`/`#5B3E8F`; gap 10; avatar 34 + status dot; title 14/600, subtitle 12px state text | Chief, Direct chat |
| `ConversationRow chief` | padding 12, r18, gradient card (B12 `chief`); avatar 40; title 15/700 | Chief |
| `NotificationItem` | padding 10 0, bottom border `#241B36`; icon 16 coloured by kind; title 13/600, subtitle 12px; age mono 11 | Workspaces |
| `StatusRow` | gap 8, 13px; dot 8 mint; value right mono 12 `#A79BBF` | System list |
| `DecisionRow` | button, column gap 6, padding 12 14, r14; unselected: transparent with bottom border; selected: `#1A1422`/`#5B3E8F` | Decisions |
| `RunRow` | button column gap 4, padding 10 12, r14; selected `#1A1422`/`#5B3E8F` | Activity |
| `ApprovalRow` | button column gap 8, padding 12 14, r16; selected `#1A1422`/`#5B3E8F`, others `#140F20`/`#2A2040` | Approvals |
| `SkillPaletteItem` | gap 10, padding 9 10, r14, 1px `#2A2040`, `#140F20`, cursor grab, grip icon | Canvas |
| `SettingRow` | label (14/600) + help (12px muted) left, control right, padding 14-16, divider | App settings |
| `TrayItem` | min-h 40, padding 0 10, r10, gap 10 | Tray |
States: std; selected is S; unread/read for notifications (R: unread = bold + dot).

### B14. Progress / Segmented bar (`Meter`, `SegmentBar`, `GanttBar`)

- `Meter` (limit): track 48x6 r3 `#2A2040`, fill `#9B7BFF` width = percent (top bar, label next to it "62%"); R: >=90% fill amber, 100% error.
- `SegmentBar` (lane distribution): height 8, r4, gap 2, overflow hidden; segments `flex: N`; todo `#8C80A6`, in progress `#F25FC4`, review `#9B7BFF`, done `#62E3B4`. Caption mono 11 "4 do zrobienia · 5 w toku · 1 review · 7 gotowe z 17".
- `TaskProgress` (Task card): height 4, r2, track `#3A1C3A`, fill `#F25FC4`, shown only on working Tasks.
- `RoundBar` (Discussion): height 6, r3, track `#2A2040`, fill `#F25FC4`.
- `GanttBar`: track height 22 (r6, `rgba(155,123,255,.04)`), bar top 3 height 16 r5, left/width as %; done `#62E3B4`, failed `#FF8FA3` (thin 1.7% bar), current `#F25FC4` + glow, waiting `#FFB547` + glow + 45deg hatch `rgba(0,0,0,.25)`.

### B15. Tooltip (`Tooltip`) - not in the mocks

Only `title` attributes on rail items and the Approvals button. Spec (R): bg `#1C1330`, border 1px `#5B3E8F`, r8, padding 6 10, 12px Bricolage (mono for shortcuts), max-width 260, delay 400ms, offset 8px, `z-tooltip`, arrow none. Rail tooltips appear right of the item.

### B16. Dialog / Modal (`Dialog`) - not in the mocks

Needed for: deny with comment, confirm Delete Workspace (type name), Cancel Run, Stop Agent, Replay, New Workspace, Pull Ollama model, pairing code, import Skill. Spec (R): scrim `rgba(10,7,16,.72)`, dialog r22, `#140F20`, 1px `#2A2040`, padding 24, width 480 (sm 400, lg 640), title `title-22`, body 14px `#A79BBF`, actions right-aligned (secondary left, primary/danger right), `shadow-popover`, focus trap, Esc closes unless destructive-in-progress. Variants: `confirm`, `destructive` (danger primary + typed confirmation), `form`.

### B17. Toast (`Toast`) - not in the mocks

Bottom-right stack, width 360, r14, `#1A1422`, 1px `line-strong` (tone border: success mint, warning amber, error `#FF8FA3`), leading 16px icon, title 13/600, body 12px, optional action link, auto-dismiss 5s (error/warning persist), `role="status"` / `alert`. Used for: Run completed, Approval decided elsewhere, copy confirmation, backup done.

### B18. Menu / Popover (`Menu`, `Popover`)

Only instance: Tray menu. Container padding 8, r16, `rgba(20,15,32,.96)`, 1px `#2A2040`, `shadow-popover`, width 380. Items: `TrayItem` (B13) with leading 16px icon `#A79BBF`, trailing shortcut (mono 11 `#8C80A6`, "⌘O"). Header block with logo tile 28 (r8) + "Overmind" + status line. Divider between groups. Primary action row (Global Pause variant h42). Reuse for Select dropdowns, row "more" menus, Workspace switcher (R).

### B19. Divider (`Divider`)

1px `#241B36`. Variants: horizontal full, rail divider (28px wide, 1px, centered), vertical panel border (borders on panels), `dashed` (separate sections in terminal, R).

### B20. Kbd / hint (`Kbd`)

Shortcut text mono 11 `#8C80A6` (⌘O). Recommended chip: padding 1 6, r6, 1px `#2A2040`. Hints: 12px `#8C80A6`, line-height 1.4 below controls.

### B21. Section label (`SectionLabel`)

Mono 10/500, letter-spacing 0.08em, uppercase, `#8C80A6` (69 uses); with `margin: 14px 8px 4px` in lists. Variants: tone colour (`#FFCF85` in Approvals, `#FFB3E6` for Chief), with trailing count (e.g. "STALI · 7"), with right meta.

### B22. EmptyState (`EmptyState`) - not in the mocks

Layout: centered column, 44px icon tile (`#1C1330`, 1px `#5B3E8F`, r14, 20px icon `#D6C9FF`), title 15/700, text 13px `#A79BBF` max-width 320, optional primary/secondary button. Copy templates (Polish): Workspaces "Nie masz jeszcze Workspace'u" + CTA "Nowy Workspace"; Task Board "Tablica jest pusta. Chief doda Zadania, gdy Dokumentacja będzie gotowa."; Approvals "Nic nie czeka na Twoją Zgodę."; Decisions "Brak Decyzji. Pojawią się po pierwszej Dyskusji lub Decyzji Chiefa."; Skills "Brak Skilli. Zaimportuj lub poproś Chiefa o propozycję."; Activity "Brak Runów."; Notifications "Brak powiadomień."

### B23. Skeleton (`Skeleton`) - not in the mocks

Fill `#1C1330`, shimmer 1.4s linear gradient `rgba(155,123,255,.08)`; shapes: line (h12, r6), title (h18, r8), avatar (blob), card (r16). Variants per composite: `ConversationRowSkeleton`, `CardSkeleton`, `TableRowSkeleton`, `NodeSkeleton`. Honour `prefers-reduced-motion`.

### B24. Link and Text helpers

`TextLink` (underline, `#E9D8FF`), `MonoValue` (mono 12 `#A79BBF`), `Mono path` (path text with ellipsis), `StatusText` (glyph + colour: `✓ done` mint, `● working` magenta, `◆ waiting` amber, `○ idle` grey, `✗ failed` error). Count: 24 primitives + helpers.


---

## C. Composites

Included when used in at least two views or complex enough to need their own task. Each lists **composition** (primitives from B), **props**, **variants**, **views**. The view names are from `VIEWS.md`. Region slugs refer to boxes in `VIEWS.md`.

### C1. Shell

**C1.1 `AppRail`** (`shell/rail`). Composition: nav 72px, padding 16 12, bg `bg-panel`, right border `line-subtle`; `LogoTile` (44x44, r14, gradient 160deg `#1E1330` to `#0A0710`, 1px `#5B3E8F`, `glow-logo`, mark 30px) + 6 `RailItem` (44x44 r14, 20px icon) + divider + Agents item + spacer + Settings item pinned bottom. Props: `active` (route), `badges` (R: Approvals count). `RailItem` variants: inactive (`#A79BBF`, transparent), active (1px `#5B3E8F`, `#1C1330`, `#F6EFFF`, `glow-rail-active`); `aria-current="page"`, `aria-label` + `title`. States R: hover, focus, tooltip, badge. Views: 14.

**C1.2 `TopBar`** (`shell/top-bar`). Composition: header, wrap, padding 12 20, bottom border `line-subtle`, bg `bg-panel`. Left: `WorkspaceSwitcher` (button 40, r12, with 10px dot + name 15/700 + chevron, then path `mono-md`), spacer, `LimitMeter` pill ("Claude Max 62% · reset 3 h · wg CLI" with `Meter`), `SlotsPill` ("Agenci 3 z 3 naraz"), `ChannelPill` (6px mint dot + "Telegram połączony"), `ApprovalsButton` (amber, shield-check icon, "3 czekają", aria-label "Zgody i Prośby: 3 czekają"), `GlobalPauseButton` (`pause` variant). Props: `workspace`, `limits[]` (one per CLI), `slots`, `telegram`, `pendingApprovals`, `paused`. Variants: with switcher (Workspace views: wraps to 117px in the mock) and without (Workspaces, App settings: 67px). Views: 14.

**C1.3 `SubTabs`** (`shell/tab-bar`). Composition: nav (flex gap 4, padding 0 20, border-bottom `line-subtle`, `bg-panel`) + `Tabs` page variant. Sets: Canvas / Runy i Activity; Agenci / Skille; Ten Workspace / Połączenia i modele / Aplikacja. Views: 7.

**C1.4 `PageLayout`** presets: `rail + topbar + [tabs] + [list panel] + main + [detail panel]`. Panel presets: `listPanel(270|290|340|360|400)`, `detailPanel(290|300|320|340|400)`. Main padding 22-28. `scroll` on panels, not on the page. Views: 14.

**C1.5 `SidePanel`**: aside/section with padding 16-22, border (right for left panels `bg-panel-alt`, left for right panels `bg-panel`), column gap 16, overflow auto. Variants: `left` (`#0C0814`), `right` (`#0D0915`). Views: 12.

**C1.6 `PageHeader`**: h1 (`title-page`), meta chips, action buttons right-aligned (wraps below on narrow widths: Workflow header shows Run actions on the second row). Variants: `withEyebrow` (date line "wtorek, 13 października" mono), `withBadges` (visibility + version + Run pill). Views: 12.

### C2. Conversations (Chief, Direct chat, Discussion)

**C2.1 `ConversationList`**: SidePanel 270 with `ConversationRow chief` (pinned), `SectionLabel` "AGENCI W TYM WORKSPACE", `ConversationRow agent` x N (avatar 34 + status dot + name + state line, optional circle count badge), `SectionLabel` "DYSKUSJE NA ŻYWO" with `DiscussionRow`, dashed `Button dashed-add` "Nowy Agent". Row state lines coloured: working `#FFB3E6`-ish (magenta), waiting `#FFCF85`, done `#62E3B4`, idle `#8C80A6`. Views: Chief, Direct chat, Discussion (own list).

**C2.2 `MessageBubble`** variants:
- `owner` desktop: right aligned, max-width 78-80%, padding 12 16, `r-bubble-owner`, fill `#2A1F40`, 15/1.45; meta line below mono 11 `#8C80A6` ("z Telegrama · 14:02", right aligned).
- `chief` / `agent` desktop: left, avatar 28-36 + content; paragraphs 15/1.5; no fill (lines on page) or inside a bordered table block (r18 `#120D1C` overflow hidden) for lists; sender label `Bricolage 12/700` colour = agent hue light.
- `relay` ("QA → Chief:"): 13/1.45 `#A79BBF` with bold prefix `#EFE9F7`/600; text in a bordered note card (r14, `#140F20`, `#241B36`).
- `result-chip` ("Chief zaktualizował plan · …" with link): card r14 `ok` tone with link `text-link`.
- `skill-used`: chip `skill-used` aligned left.
- `rule-refusal`: see C5.3.
- `day-separator`: mono 11 `#8C80A6`, centered.
- Telegram variants: see C13.
Props: `role` (owner | chief | agent | system), `source` (desktop | telegram), `timestamp`, `attachments` (R), `status` (sending | failed R). Views: Chief, Direct chat, Discussion, Telegram.

**C2.3 `Composer`** (B10) with `QuickActions` row above (pills "Pokaż Tablicę", "Zacznij Dyskusję", "Podsumuj dzień") and placeholder `@agent` mention hint. Props: `placeholder`, `onSend`, `mentions`, `disabledReason`. Views: Chief, Direct chat, Discussion (Owner voice), App.

**C2.4 `LiveWorkPanel`** (Chief right panel 300): `SectionLabel` "Teraz pracuje · 3 z 3 slotów", `AgentWorkCard` (avatar 22 + "QA · testy e2e koszyka" + `MiniTestList` mono 11/16.5 with `✓` mint and `✗` error and progress "… 38 z 52"), idle Agent row, lane `StatTile`s (Tablica: 2 Build, 3 Review, 7 Gotowe...), "Ostatnie Decyzje" list (title 13/600, meta mono 11). Views: Chief.

**C2.5 `ChatHeader`** (Direct chat): avatar 36 + name 17/700 + subtitle mono ("Agent stały · Codex CLI · gpt-5.5") + state pill ("pracuje" with dot, magenta tint) + `text-link` "Profil Agenta". Views: Direct chat.

**C2.6 `BindingNotice`**: card r14 `#140F20` 13px `#A79BBF` ("Twoje polecenia w tym czacie są wiążące…") at thread top. Views: Direct chat.

### C3. Approvals and Access Requests

**C3.1 `ApprovalCard`** (inline, Chief): `Card approval` padding 18 gap 14; header row: `SectionLabel amber` ("ZGODA · SECURITY · RUN #14") + spacer + expiry mono 11 amber ("wygasa za 25 min"); title 17/700 ("Wejście na nową domenę: registry.npmjs.org"); explanation 13/1.45 `#E9D2AE` with inline mono; action row: `approve-amber`, `approve-amber-outline`, `deny-outline`. Props: `kind` (git-push | new-domain | delete | other), `agent`, `run`, `expiresAt`, `command?`, `actions`. States: pending (S), decided (R: card collapses to a result line "Zezwolono na ten Run · 14:21"), expired (R), decided elsewhere (R, Telegram). Telegram variant has only run-scoped approve + deny. Views: Chief, Telegram, Approvals (detail).

**C3.2 `ApprovalListItem`** (Approvals list 360): `ApprovalRow` with kind label (`SectionLabel` amber: "ZGODA · GIT PUSH", "ZGODA · NOWA DOMENA", "PROŚBA O DOSTĘP"), age mono, title 14/600, agent chip (avatar 24 + name). Sections: "OCZEKUJĄ · 3", "ESKALACJE", "ROZSTRZYGNIĘTE DZIŚ" (rows with `✓`/`✗`, summary, origin e.g. "z desktopu"). Views: Approvals, Workspaces (notifications).

**C3.3 `ApprovalDetail`**: header (kind label + Run link), title 24/700, agent row; `KeyValueList` x3 columns (origin, command, changes "2 pliki · +14 −3", evidence "testy 112 z 112"); `DiffView`; action row (`approve-amber` 46, outline amber, outline neutral); footnote 12px. Variants per kind: git push (S), new domain, delete files, Access Request (R: rights checkboxes Read/Write/Execute and duration "tylko ten Run" / "stałe"), escalation (R: loop-limit report with 3 resolutions). Views: Approvals.

**C3.4 `AccessRequestCard`**: B12 `default` with folder path mono, requested rights chips, "przy komputerze" origin, two actions. Only drawn as list item and as a row in the Workspace folder table (origin text "Prośba Designera · przy komputerze"); full card R.

**C3.5 `OwnerRuleRefusalCard`**: `Card rule-refusal` padding 14: label "REGUŁA WŁAŚCICIELA · R2" (mono, error tone), rule quote 13px, actions `secondary` "Zmień Regułę", `ghost`/outline "Zostaw jak jest". Views: Direct chat.

**C3.6 `ChiefProposalCard`**: dashed magenta card (`drop` tone for Skills / `callout-magenta` for Rules): Chief avatar 28 + "Chief proponuje: …", rationale 13px, buttons Accept (`primary-magenta`), Reject (`secondary`), "Zobacz treść". Views: Skills (release-checklist), Workspace settings (R4 proposal), Agents (dynamic Agent "Zachowaj jako stałego").

### C4. Workspaces and system

**C4.1 `WorkspaceCard`** (`dash/...`): link card r22 padding 18, gap 14. Header: 10px dot + name 18/700 + spacer + badges ("izolowany" pill, "3 Zgody czekają" amber pill). Path mono 12 muted. Chief one-liner 14/1.45 `#E3DAF0`. `SegmentBar` + counts caption. Footer: `AvatarStack` + run text ("Run #14 · pętla jakości 2 z 5", mono 12). Variants: `working` (magenta border + glow), `idle/done` (default), `paused` (grey dot, "wstrzymany przez Ciebie", "nikt nie pracuje"), `isolated` (lock badge + explanation line), `noRun` ("bez aktywnego Runu"). Views: Workspaces.

**C4.2 `ChiefSummaryStrip`**: `Card chief` r22 padding 16 18: avatar 44, eyebrow "CHIEF · PODSUMOWANIE" mono magenta, summary 15/1.5, trailing link "Otwórz czat" + chevron. Views: Workspaces.

**C4.3 `NotificationCenter`**: panel (aside 320) with h2 15/700 "Powiadomienia" + `NotificationItem` x N (kinds: Approval = shield amber, Access Request = folder-plus magenta, Discussion = discussion icon lavender, Run completed = check mint, Escalation = activity error, Telegram = bell/telegram). Unread dot (R). Views: Workspaces; also Tray summary line.

**C4.4 `SystemStatusList`**: `Card nested` padding 14 gap 10; rows `StatusRow` (6/8px mint dot, label 13px, value mono 12): "Silnik w tle · działa · 2 dni", "Izolacja (container) · 3 kontenery", "herdr · v0.9.2 · przypięta", "Kopia zapasowa · dziś 03:00", "Telegram · połączony". Degraded variants (R): amber dot + text, error dot + remedy link. Views: Workspaces, Onboarding 2 (CheckRow variant), App settings (security).

**C4.5 `AvatarStack`**: row of Avatar 26 with -6px overlap (see E), max 4 + "+N" chip (R). Views: Workspaces, Skills, Agents.

### C5. Tasks, Lanes, Decisions

**C5.1 `TaskCard`**: button card r16 padding 12 gap 8: row (id mono 11 muted `T-31`, trailing state word + dot: "pracuje" magenta, "w kolejce" grey, "czeka na Zgodę" amber, "ocenia" violet, "✓ Quality Gate"/"✓ zaakceptowane" mint), title 14/600/1.35, doc chip (`document` icon + `spec.md#koszyk`, mono 11 `#D6C9FF`), assignee row (avatar 22 + name 12px) or "nieprzypisane"; working Tasks add a `TaskProgress` bar (height 4, r2, track `#3A1C3A`, fill `#F25FC4`; tests 38/52 = 73%). Variants: default, selected (B12 selected), unassigned, parked (R, dimmed), blocked (R, error left border). Views: Task Board.

**C5.2 `Lane`**: section r20 padding 12 gap 10, min-width 180, flex 1 1 180, `#0C0814`/`#241B36`; header: h2 15/700 + `count` pill; hint line 11px muted; cards stack gap 10; footer `dashed-more`. Variants: default, `active` (1px `rgba(242,95,196,.35)` border + gradient 180deg `rgba(242,95,196,.07)` to transparent 40%; the QA lane in the mock, which contains the selected working Task), `empty` (R). Views: Task Board.

**C5.3 `BoardFilterBar`**: page title row (h1 `title-page` "Tablica Zadań"), `primary-violet` Button "+ Zadanie z Dokumentacji" (plus icon), `SegmentedControl` (Wszystkie, Moje Zgody, Zablokowane, Odłożone · 1) + title chip "Tory z Workflow „board” v3" (`VersionBadge`) + eyebrow "Zadanie z Dokumentacji" link. Views: Task Board.

**C5.4 `TaskDetail`** (320): header (id + "tor QA" label + title 20/700/25), `ProvenanceBlock` ("WYNIKA Z DOKUMENTACJI": doc path link mono, quote 13px), "POCHODZENIE" (Discussion/Decision link), "PRZEBIEG" `Timeline` (rows with dot + mono time + text), "DOWODY · ARTEFAKTY" chip row, actions (`secondary` "Czat z QA", ghost "Odłóż"). Views: Task Board.

**C5.5 `DecisionDetail`** (fills the 968px main column, with the 400px `DecisionList` on the left): header (id mono, workspace, Run, "Zastąp nową Decyzją" secondary), title 26/700; `SectionLabel` blocks: PROBLEM, ALTERNATYWY (`AlternativeCard`: title 14/600 + chosen pill "wybrana" mint-border card 1.5px `#62E3B4`/`rgba(98,227,180,.06)`, reasons 13px), UZASADNIENIE, UCZESTNICY (avatars), SKILLE (chips), PEWNOŚĆ ("średnia · 0,7"), ZAŁOŻENIA, RYZYKA, WYNIK DECYZJI (Chief proposal + review date, evidence chips mint, `VerdictSelect`), "Zastępuje" link. Views: Decision Register.

**C5.6 `DecisionRow`** (list 400... list is a `section` 380?): see B13; adds id mono (D-14), status chip (przyjęta mint tint / propozycja / do przeglądu / zastąpiona), outcome words coloured ("wynik: pozytywny"). Filters: `SearchField`, Workspace chip, status chip, outcome chip (selects). Views: Decision Register.

**C5.7 `Timeline`** (R generic): vertical list with 8px dots and connecting 1px `#241B36` line; used for Task history, Decision history, Agent versions. Mock draws it as plain rows.

### C6. Agents and Skills

**C6.1 `AgentRow`** (Agents list 290): `ListRow` with avatar 34 + name 14/600 + `VisibilityBadge outline` + subtitle (model "Claude · Opus 5.5") + state word (mono 12). Selected variant. Section labels "STALI · 7", "DYNAMICZNI · CZEKAJĄ NA AKCEPTACJĘ". Views: Agents.

**C6.2 `DynamicAgentCard`**: dashed magenta card (`drop` tone, r16 padding 12) with name, reason text 12px ("Chief stworzył go do Zadania T-22, prywatnie w tym…"), buttons `primary-magenta` "Zachowaj jako stałego" + `secondary` "Usuń". Views: Agents.

**C6.3 `AgentProfileHeader`**: avatar 56 + name 26/700 + subtitle mono ("Agent stały · konfiguracja v3 · utworzył Właściciel") + actions (`secondary` "Czat" with chat icon as link, `primary-violet` "Zapisz jako v4"). Views: Agents; Inspector variant (avatar 48).

**C6.4 `AgentConfigForm`**: `ProfileTabs` + sections: `RadioCardGroup` visibility + help line; `Textarea` instructions; `ModelPicker` x2 + budget (`StatTile` "45 min · 2 ponowienia"); `SkillAssignment` (skill chips + dashed drop zone "upuść tu Skill z biblioteki"); `ToolsTable` (rows: capability, value, policy intersection; values with `tak`, paths, "brak · Prośba o dostęp", "wymaga Zgody"); `MemoryPanel` in the 310px right aside (S: heading, "tylko podgląd" label, note "Pamięci nie edytujesz. Zachowanie Agenta korygujesz …", memory entries with title 13/600 + workspace mono tag + 12px text, and a disabled note for the isolated Workspace "Projekt klienta (NDA)"); the Memory tab itself and the other tabs' content are not drawn (R). Views: Agents.

**C6.5 `AgentInspector`** (Canvas right panel 290): `AgentProfileHeader` compact, `AgentStateCard` ("STAN AGENTA": state word + evidence "Dowód: 4 pliki w worktree, testy 112 z 112"), `RadioCardGroup` compact (visibility in this Workflow: "we wszystkich Workspace'ach" / "tylko w tym Workspace"), TOR block (filled TOR badge + text), model block, Skills chips, permissions block ("UPRAWNIENIA W TYM WĘŹLE": key/values with mono path chips), `Button secondary` "Otwórz czat z Developerem". Views: Canvas.

**C6.6 `SkillCard`** (Skill library): button card r18 padding 14 gap 10; row 1: mono 14/500 name + version chip + outline `VisibilityBadge` + origin chip right; description 13px `#A79BBF`; footer: `AvatarStack` + "3 agentów · 41 użyć" (mono 11). System Skill ("overmind") variant: read-only, no visibility badge. Selected: B12 selected. Views: Skills, Canvas (compact `SkillPaletteItem`), Agents (chip).

**C6.7 `SkillDetail`** (340): title mono 18/600, `VersionBadge` "v4 · aktualna", source line, `MarkdownPreview` (`bg-code` r14 12/1.6), "WERSJE" list, "OSTATNIE UŻYCIA" list (Run link + Agent + version + time), actions `primary-violet` "Edytuj jako v5", `secondary` "Odłącz od agentów". Views: Skills.

**C6.8 `SkillFilterBar`**: `Pill meta-selected` + tone pills (counts). Views: Skills.

### C7. Wizard (Onboarding)

**C7.1 `WizardLayout`**: sidebar 360 (radial `rgba(242,95,196,.16)` at 20% 0, `#0D0915`; logo tile 46 + wordmark `wordmark`; eyebrow "PIERWSZE URUCHOMIENIE"; intro 15/1.5; `WizardStepper`; footnote 12/1.5) + main (padding 48 56, step counter mono "Krok 1 z 4", `display` title, `lead`, content max-width 620/640, footer actions). Views: Onboarding 1, 2.

**C7.2 `WizardStepper`**: ol, items 28px number dot + label 14/600 (+ sublabel "opcjonalnie" 11px). States: done (R: mint check), active (magenta dot + glow, label `#EFE9F7`), pending (ring `#5B3E8F`, label `#A79BBF`). `aria-current="step"`.

**C7.3 `FolderPicker`**: `Card` r20 padding 14, rows: parent row (folder icon + mono path), child rows (indented, mono 13, selected: violet tint + check), `dashed-add` "Wybierz w Finderze…". Views: Onboarding 1.

**C7.4 `PermissionChecklist`**: `Card` magenta border r20 padding 18 gradient 160deg `#22102A` to `#120D1C`; `SectionLabel` "PRAWA DLA ~/Projects/…"; 3 `CheckboxRow`. Views: Onboarding 1; the Workspace folder table uses `PermissionMatrix` (C7.6).

**C7.5 `CheckRow`** (system check): row padding 14 16: `StepRing` 26 (done/waiting/skipped) + title 15/600 + description 13px muted + trailing mono status word (`gotowe`, `zaliczony`, `zalogowany` mint; `czeka na Ciebie` magenta; `pominięto` grey) or `secondary` "Wykryj". Container r20 `#140F20` overflow hidden. Views: Onboarding 2.

**C7.6 `PermissionMatrix`** (Workspace folders): table in r16 container: columns KATALOG (mono path + origin line), ODCZYT/ZAPIS/WYKONYWANIE (`Checkbox` cells, header label `mono-label`), DODANY (text 12px, "wygasło" for expired). Footer `dashed-add` "Dodaj katalog". Views: Workspace settings.

### C8. Terminal, code, data

**C8.1 `TerminalPane`**: r14 `bg-code` 1px `#241B36`, padding 12, mono 11-12 / 1.6-1.7, header (label mono-label + actions), lines coloured (`$` prompt `#A79BBF`, pass `#62E3B4`, fail `#FF8FA3`, muted `#8C80A6`); blinking caret `▍`; modes: `live-preview` (read-only, label "tylko podgląd"), `login` (magenta border r20 padding 16 `#120A18`, header with `primary-magenta` "Otwórz link w przeglądarce"). Also a herdr status block (`KeyValueList`). Views: Direct chat, Onboarding 2.

**C8.2 `DiffView`**: r16 `bg-code` padding 10 0, mono 12/1.7, hunk header `#8C80A6`, added lines mint with `rgba(98,227,180,.08)` row tint, removed lines error with `rgba(255,143,163,.08)`; horizontal scroll. Views: Approvals.

**C8.3 `KeyValueList`**: label `mono-label` above value 13-14/600 or mono; layouts: 3-column grid (Approval detail "POLECENIE/ZMIANY/DOWODY"), 2-column stack (Connection cards: "Plan: Claude Max", "Limit wg CLI: 62% · reset za 3 h"), definition rows with divider (herdr state: STAN wg herdr / ZADANIE / WORKTREE / IZOLACJA). Views: Approvals, Connections, Direct chat, Activity.

**C8.4 `StatTile`**: tile r12 padding 10 8 `#140F20`, big number 20/700 + caption 12px muted; link variant (Chief right panel lane counts). Views: Chief, Agents (budget), Activity.

**C8.5 `DataTable`**: table 100%, collapse; header `mono-label` row, cells padding 10 12, row dividers `#241B36`, mono cells; sticky header (R). Used for: events (CZAS, KTO, CO, WYNIK), tools (capability/value), folders. Result cell colours: ok mint, waiting amber, blocked error, fail error. Views: Activity, Agents, Workspace settings.

**C8.6 `RunTrace`** (Gantt): label column 170 (node/agent + iteration "Developer · it. 2"), track 22 + `GanttBar`s, axis labels mono 10 ("0 min", "5 min"…), legend. Views: Activity.

**C8.7 `RunListItem`**: `RunRow` with id mono ("#14"), state chip (działa magenta, ukończony mint, anulowany grey, Eskalacja amber), title 13/600, meta mono ("18 min · iteracja 2"). Views: Activity.

**C8.8 `UsagePanel`**: per-CLI `Meter` rows ("Claude Max 62% · reset 3 h"), per-Agent time list, reproducibility `KeyValueList`. Footnote "Wartości raportuje samo CLI." Views: Activity, Connections, TopBar.

### C9. Settings and connections

**C9.1 `SettingsSection`**: section r18 `#140F20` 1px `#2A2040` overflow hidden, h2 16/700 header, `SettingRow` x N separated by `line-subtle`. Variants: default, `danger` (Workspace delete row), `global-pause` (r18 `#1C0B19` 1px `#5A2A4F`, text, `primary-magenta-lg`). Views: App settings, Workspace settings.

**C9.2 `SettingRow`**: label 14/600 + help 12px/1.4 muted; control: `SelectButton`, `Switch`, buttons group, `TextValue` mono. Views: App settings, Workspace settings.

**C9.3 `ConnectionCard`**: section r22 padding 18 `#140F20`: header (logo tile 40-44 mono `>_`/`OL`, title 16-17/700, subtitle mono, state pill right: zalogowany/działa/sparowany mint dot; disabled variant opacity .55), `KeyValueList` rows, action buttons (`secondary` x2, `danger` "Wyloguj"/"Rozłącz"). Variants: CLI (Claude Code, Codex), local runtime (Ollama), channel (Telegram), future (API keys). Views: Connections.

**C9.4 `FallbackOrder`**: ordered list of 4 steps: number 20-26px circle + text; callout. Views: Connections.

**C9.5 `NumberStepper`**: `icon-square` "−", value Bricolage 16/700 + unit word, `icon-square` "+"; min/max disabled (R). Views: Connections ("Agenci naraz").

**C9.6 `OwnerRuleRow`** (Workspace settings): id mono "R2", text 14px, "Ostatnio powołany: …" mono 11, `ghost` "Edytuj". Plus `ConsentExceptionChips` (`meta-tone` amber + removable). Views: Workspace settings.

**C9.7 `DocsList`**: file chips (`document` icon + mono path) + status line "Git · main @ 4f2c9a1 · 14 Zadań wskazuje te pliki". Views: Workspace settings.

**C9.8 `SettingsNav`** (Workspace settings side list 240, bg `#0C0814`, padding 22 14): list items (padding 10 12, r12; active = list-selected) for: Workspace, Dozwolone katalogi, Uprawnienia, Reguły Właściciela, Dokumentacja projektu, Izolacja i budżet. Views: Workspace settings.

### C10. Discussions

**C10.1 `DiscussionHeader`**: title 22/700, `Pill` "na żywo" (magenta dot), agenda line, round bar (`RoundBar` + "Runda 2 z 4"), actions (`secondary` "Wstrzymaj"), note about the paused Run branch + "Chief rozpoczął tę Dyskusję sam…" info (callout). Views: Discussion.

**C10.2 `DiscussionMessage`**: card r14 padding 12-14: avatar 36 + name 14/700 + role/round mono + `position` chip + skill chips; body 14/1.55 `#E3DAF0`. Chief variant: moderator with summary of the round. Views: Discussion.

**C10.3 `DiscussionList`**: SidePanel 260: "TRWAJĄ" (row: title 13/600, "runda 2 z 4 · rozpoczął Chief"), "ZAKOŃCZONE" rows (outcome meta). Views: Discussion.

**C10.4 `DiscussionResultPanel`** (aside 310): positions summary (`position` chips with counts), draft Decision card (`SectionLabel` "DECYZJA (PROPOZYCJA)", title, "ZADANIA PO ZATWIERDZENIU" list with doc chips), fallback note, actions `primary-violet` "Zatwierdź wynik" (flex-grow) + `secondary` "Zakończ teraz". Views: Discussion.

### C11. Workflow canvas kit

All sizes are world px (screen = x0.7).

**C11.1 `CanvasStage`**: container r24, 1px `#241B36`, bg `#0C0814` + dot grid 22px; world 1120x760; overflow hidden; pan (space+drag / middle), zoom 0.7 default (mock label "70%"). Slots for overlays.

**C11.2 `NodeTile`** (anatomy): 224x112 (Discussion 240x112); two ghost layers offset (6,6) opacity .45 and (12,12) opacity .22 (denotes "shared" public/lane stacking; for PRYWATNY the mock also stacks, see E); main face: r20, 2px border in kind colour, fill = kind tile fill, padding 16 14 24, centered column gap 3. Content: kind icon 18px (top-left 12,14), title `node-title` (centered), status line 12px (`StatusText`, ellipsis, max 194). Overlays: `NodeTab` (top-left, -13), `SkillsTab` (top-right, -13), left/right `Port`, bottom `ModelPill` (left 22, top 95, avatar with ring). Props: `kind` (agent-public | agent-private | tor-build | tor-qa | tor-review | discussion | …), `state`, `selected`, `dropTarget`, `skillsCount`, `model`, `statusText`.
Kind colours: public `#6FA8FF`/`#0B1424`; private `#9B7BFF`/`#130C22`; TOR `#62E3B4`/`#08171A`; discussion `#C9B8FF`/`#140F22`.
States (S): `idle`, `selected` (`ring-node-selected`), `working` (`glow-node-working`; status text magenta `● …`), `waiting-approval` (`glow-node-waiting`; status amber `◆ …`), `done` (status mint `✓ …`), `dropTarget` (2px dashed `#F25FC4`, SkillsTab magenta "upuść → 1 skill"), `queued` (status grey `○ …`). Not shown (R): error (error glow), disabled/skipped, validation error badge, hover, multi-select, collapsed.

**C11.3 Node variants**: `StartNode` (pill 64x30, r999, 1.5px `#5B4596`, `#160F24`, mono 12 `#C9B8FF` "start"), `SaveDecisionsNode` (pill 118x36, same style, "zapisz Decyzje"), `JoinNode` (ring 26px, 2.5px `#5B4596`, `#160F24`, caption under "join · wszyscy"), `QualityGate` (44px square rotated 45deg, r10, 2.5px `#FFB547`, fill `#1A1208`, caption "Quality Gate" + sub "testy 100% · 0 krytycznych"), `DiscussionNode` (NodeTile discussion with output text "3 decyzje → 5 Zadań na Tablicy"), `IfNode`/`LoopNode`/`ParallelNode`/`ReviewNode` (R: palette lists them, no tile drawn).

**C11.4 `GroupFrame`**: absolute r28, 2px border `rgba(98,227,180,.5)`, fill `rgba(98,227,180,.035)`, label top-left mono 15/500 `#BFF3DF` ("Pętla jakości · Build → QA → Review · iteracja 2 z 5"), limit label top-right mono 12 `#8C80A6` ("limit 90 min · 5 iteracji"). Variants: loop (mint), parallel (R: violet), generic (R).

**C11.5 `Edge`**: orthogonal segments drawn as 2px divs, colour `#5B4596`; active segments `#F25FC4` + `glow-edge-active`; **return/back edge** dashed 2px `#FFB547` with label (mono 12 `#FFCF85`: "nie spełnia → wróć do Developera z raportem"). No arrowheads in the mock. Implementation (R): SVG paths, rounded orthogonal routing, 8px arrowhead markers, hover width 3px, selected `#9B7BFF`. Props: `from`, `to`, `state` (idle | active | done | return | error), `label`. Edge labels are mono 9-10 captions (e.g. "join · wszyscy").

**C11.6 `CanvasPalette`** (left panel lower half): `SectionLabel`/h2 "Węzły", chips (`palette` button, icon + label: Agent, Parallel, Join, IF, Loop, Dyskusja, Review), wrap, draggable. Hint "ZAKŁADKA NA KAFELKU" legend card (floating): rows "PUBLICZNY – we wszystkich Workspace'ach", "PRYWATNY – tylko w tym Workspace'ie", "TOR – prowadzi Zadania po Tablicy", "SKILLE" tab "tu upuszczasz Skille" (`rgba(20,15,32,.92)`, r16, 1px line, padding 12). Views: Canvas.

**C11.7 `SkillPalette`** (left panel upper half): header (h2 + count mono), `SearchField`, hint, `SkillPaletteItem` list (grip + name mono 13/600 + version + visibility outline + "3 agentów" caption), dragged item state (dashed magenta border, `rgba(242,95,196,.06)`, text `#FFB3E6`), `SkillDragChip` (pill, `#F25FC4`, ink, mono 13/600, rotate -4deg, `glow-drag`).

**C11.8 `CanvasToolbar`**: floating bar bottom-left: `icon-square` "−", zoom label ("70%", mono), `icon-square` "+", divider, Undo/Redo ghost buttons, `icon-square` search ("Szukaj Węzła"); container r16, `rgba(20,15,32,.92)`, 1px line, padding 4.
**C11.9 `Minimap`**: 140x92 r10 card bottom-right; node rectangles (6px r6 per kind colour) + viewport rectangle 1.5px `#9B7BFF`; click/drag to pan.
**C11.10 `ValidationBadge`**: top-right pill mint "Walidacja: 0 błędów"; error variant (R: error tone, count, click opens list).
**C11.11 `AgentStateChipsStrip`** ("Chief nadzoruje"): `Card` r16 padding 8 10 with magenta gradient edge: `ChiefBlock` (avatar 28 + "Chief nadzoruje" 14/700 + "6 agentów · 3 z 3 slotów" mono) then `AgentStateChip` x N: pill r999 `#140F20` 1px line, avatar 24 + name 13/600 + state word mono 11/12 (done mint "skończył", working magenta "pracuje", waiting amber "czeka na Zgodę", idle grey "czeka"). Views: Canvas.

### C12. Tray

**C12.1 `TrayMenu`**: Menu (B18) 380 wide: header (logo tile 28 + "Overmind" + status "pracuje · 3 z 3 Agentów"), `TrayWorkspaceGroup` ("Aplikacja rezerwacji" label + Agent rows with avatar 22 and state "pracuje"/"Zgoda" amber/none), waiting row ("Strona fundacji" label; "3 sprawy czekają na Ciebie" amber with `Zgody` action), `TrayItem`s: "Napisz do Chiefa…", "Wstrzymaj „Aplikacja rezerwacji”", "Wznów „Research rynku”", `pause` button "Global Pause", "Otwórz Overmind ⌘O", "Zamknij okno, pracuj dalej", "Zakończ Overmind…". Views: Tray.

### C13. Telegram

**C13.1 `TelegramHeader`**: 71px, logo tile 42 (r13), name 17/700 "Overmind", sub "bot · tylko Ty" 12px muted, bottom border.
**C13.2 `TelegramThread`**: dot-grid bg 18px, padding 12; day separator mono 11.
**C13.3 `TelegramBubble`**: owner (right, max 80%, padding 9 12, r `16 16 4 16`, fill `#3A2A5C`, 14/1.4, time mono 11 right), chief/agent (left, max 86%, r `16 16 16 4`, `#140F20`, 1px `#2A2040`, sender label 12/700: Chief `#FFB3E6`, Agent `#D6C9FF`), approval bubble (adds bold title 14/700 "Zgoda · Security", domain mono, inline buttons row `approve-amber` + `deny-telegram`, footnote 12px "Na stałe zatwierdzisz tylko przy komputerze."). Time mono 11 `#8C80A6`.
**C13.4 `TelegramInputBar`**: 85px (padding 12 12 28), `TelegramInput`, `icon-send-flat` 44.

### C14. Shared small composites

`EvidenceList` (mint chips with file names), `ArtifactChip`, `DocRefChip` (`document` icon + path), `OwnerBadge`/origin line ("z desktopu", "z Telegrama", "przy komputerze"), `RunLink` ("Run #14 · Dostarczanie funkcji"), `InfoNote` (12px `#8C80A6` footnote), `CalloutAmber`, `LinkRow`.


---

## D. Recommended implementation order and task grouping

Rules: each task is at most about 3 hours, ships its Storybook stories (all variants and the std states) and a Playwright screenshot that is compared with the matching crop of the mock PNG (use the region slugs in `VIEWS.md`, coordinates x2 for the PNG). No task changes a token value; token changes go through `UI-02..04`. IDs are proposals (`UI-` = `packages/ui-kit`).

### D.1 Order and dependency graph

```
UI-01 scaffold
 ├─ UI-02 colour tokens ─┬─ UI-03 type tokens + fonts
 │                       ├─ UI-04 spacing/radius/elevation/motion tokens
 │                       └─ UI-05 icons + logo ─ UI-06 missing icons
 └─ UI-07 story + visual-regression harness
Primitives (need 02-04; icons where noted):
 UI-10 Button(05) · UI-11 Pill/Badge(05) · UI-12 Dot/Meter/Divider/Label · UI-13 Avatar
 UI-14 Switch/Checkbox/Radio/Segmented(05) · UI-15 Inputs/Select(05,19a) · UI-16 Card/Skeleton/EmptyState
 UI-17 ListRow(10-13) · UI-18 Tabs · UI-19a Tooltip+Menu · UI-19b Dialog+Toast(10)
Shell (need primitives): UI-20 AppRail(05,13) → UI-21 TopBar(10,11,12,19a) → UI-22 PageLayout
Composite groups (parallel after shell; each needs the primitives it names):
 Chat: UI-30 bubbles(13,16) · UI-31 composer(10,15) · UI-32 conv list(17,13) · UI-33 approval card(10,16) · UI-34 approval detail(16,35)
 Data: UI-40…UI-54
Canvas (need 11,12,13,16): UI-60 stage → UI-61 node tile → UI-62 special nodes → UI-63 edges → UI-64 palette/DnD → UI-65 toolbar/minimap → UI-66 strip/inspector
Closing: UI-70 a11y · UI-71 visual regression vs all 18 PNGs · UI-72 docs
```

Critical path for the first usable screens: 01 → 02 → 03/04 → 05 → 10 → 11/12/13 → 16/17 → 20 → 21 → 22, then Chief (30-33) and Workspaces (40, 41) in parallel with Onboarding (48).

### D.2 Task list

| ID | Task | Est. | Depends on | Deliverables |
|---|---|---|---|---|
| UI-01 | Scaffold `packages/ui-kit` (Vite library mode, TS strict, Storybook, CSS-variable build, lint, unit-test setup) | 2h | none | package builds; `pnpm storybook` runs |
| UI-02 | Colour tokens: surfaces, lines, text, 7 accent families, state map, visibility map, 8 Agent hues, tint/glow rgba (A.1) as CSS vars + typed TS export + dark theme root | 3h | 01 | `tokens/colors.css`, `colors.ts`, swatch story |
| UI-03 | Typography: self-hosted Bricolage Grotesque + JetBrains Mono (woff2, subset latin + latin-ext for Polish), all named text styles (A.2) as `Text` component + CSS classes | 3h | 02 | `Text` primitive, type specimen story |
| UI-04 | Spacing, radius, border, elevation/glow, z-index, motion tokens (A.3-A.8) + `prefers-reduced-motion` | 2h | 02 | token files + story |
| UI-05 | Icon pipeline (SVGR or hand components), 23 icons from A.10 + `LogoMark` + Agent `Avatar` glyph rules | 3h | 01 | `Icon` registry, icon grid story |
| UI-06 | Draw the missing ~20 icons in the same grid (close, chevron-down, more, play, stop, refresh, external-link, copy, trash, edit, filter, info, warning, user, folder, terminal, clock, fit, undo, redo, expand) | 3h | 05 | icons + story, reviewed by design |
| UI-07 | Visual-regression harness: Playwright component screenshots, crop helper using `VIEWS.md` regions (2x), baseline update command | 3h | 01 | `pnpm test:visual`, README |
| UI-10 | `Button` (21 variants, 7 heights, std states, loading, link/icon-only) | 3h | 02-05 | B1 complete |
| UI-11 | `Pill`/`Chip`/`Badge` family: meta, tone, skill-chip, origin, position, run, removable, VisibilityBadge (3), NodeTab, SkillsTab, VersionBadge, CountBadge | 3h | 02-05 | B2, B3 |
| UI-12 | `StatusDot`, `Port`, `StepRing`, `Meter`, `SegmentBar`, `GanttBar`, `Divider`, `SectionLabel`, `Kbd`, `StatusText` | 2h | 02-04 | B4, B14, B19-B21, B24 |
| UI-13 | `Avatar` (10 sizes, 8 hues, ring, status dot) + `AvatarStack` with ring fix + deterministic hue for dynamic Agents | 2h | 02, 03 | B5 |
| UI-14 | `Switch`, `Checkbox` (custom + native), `RadioCardGroup`, `SegmentedControl`, `VerdictSelect` | 3h | 02-05 | B6-B8 |
| UI-15 | `SearchField`, `TextField`, `Textarea`, `Composer` shell, `SelectButton`, `ModelPicker` (with Menu hook) | 3h | 05, 19a | B10, B11 |
| UI-16 | `Card` (16 tones), `Skeleton`, `EmptyState` | 3h | 02-05 | B12, B22, B23 |
| UI-17 | `ListRow` family (conversation, notification, status, decision, run, approval, setting, tray) | 3h | 10-13, 16 | B13 |
| UI-18 | `Tabs` (SubTabs, ProfileTabs), roving tabindex | 2h | 02-04 | B9 |
| UI-19a | `Tooltip`, `Popover`, `Menu` (also the base for dropdowns, Tray) | 3h | 02-05 | B15, B18 |
| UI-19b | `Dialog` (confirm, destructive, form), `Toast` stack | 3h | 10, 19a | B16, B17 |
| UI-20 | `AppRail` + `RailItem` + `LogoTile` | 2h | 05, 13 | C1.1 |
| UI-21 | `TopBar` (switcher, limit meter, slots, channel, Approvals button, Global Pause; nowrap + ellipsis fix) | 3h | 10-12, 19a | C1.2 |
| UI-22 | `PageLayout`, `SidePanel`, `PageHeader`, `SubTabs` composite, panel width presets | 3h | 18, 20, 21 | C1.3-C1.6 |
| UI-30 | `MessageBubble` family (owner, chief, agent, relay, result chip, skill-used, day separator) | 3h | 11, 13, 16 | C2.2, C2.6 |
| UI-31 | `Composer` + `QuickActions` + mention hint | 2h | 10, 15 | C2.3 |
| UI-32 | `ConversationList` + `ChatHeader` + `LiveWorkPanel` | 3h | 13, 17 | C2.1, C2.4, C2.5 |
| UI-33 | `ApprovalCard` (inline, 3 states) + `ApprovalListItem` + Chief proposal / rule refusal cards | 3h | 10, 16, 17 | C3.1, C3.2, C3.5, C3.6 |
| UI-34 | `ApprovalDetail`, `DiffView`, `KeyValueList`, `StatTile` | 3h | 16, 33 | C3.3, C8.2-C8.4 |
| UI-35 | `TerminalPane` (login + live-preview), `MiniTestList`, herdr status block | 2h | 16, 12 | C8.1 |
| UI-40 | `WorkspaceCard` (5 variants) + `ChiefSummaryStrip` | 3h | 12, 13, 16 | C4.1, C4.2, C4.5 |
| UI-41 | `NotificationCenter` + `SystemStatusList` | 2h | 17 | C4.3, C4.4 |
| UI-42 | `TaskCard`, `Lane`, `BoardFilterBar` | 3h | 14, 16 | C5.1-C5.3 |
| UI-43 | `TaskDetail`, `Timeline`, `ProvenanceBlock` | 2h | 16, 42 | C5.4, C5.7 |
| UI-44 | `DecisionRow`, `DecisionDetail`, `AlternativeCard` | 3h | 14, 17 | C5.5, C5.6 |
| UI-45 | `AgentRow`, `AgentProfileHeader`, `DynamicAgentCard` | 3h | 13, 17 | C6.1-C6.3 |
| UI-46 | `AgentConfigForm` (visibility, instructions, models, budget, SkillAssignment), `ToolsTable`, `MemoryPanel` | 3h | 14, 15, 49 | C6.4 |
| UI-47 | `SkillCard`, `SkillDetail`, `SkillFilterBar`, `MarkdownPreview` | 3h | 11, 16 | C6.6-C6.8 |
| UI-48 | Wizard kit: `WizardLayout`, `WizardStepper`, `FolderPicker`, `PermissionChecklist`, `CheckRow` | 3h | 10, 12, 14 | C7.1-C7.5 |
| UI-49 | `DataTable`, `RunTrace` (Gantt), `RunListItem`, `UsagePanel` | 3h | 12, 17 | C8.5-C8.8 |
| UI-50 | `SettingsSection`, `SettingRow`, `ConnectionCard`, `FallbackOrder`, `NumberStepper` | 3h | 14, 15, 16 | C9.1-C9.5 |
| UI-51 | Workspace settings kit: `PermissionMatrix`, `OwnerRuleRow`, `ConsentExceptionChips`, `DocsList`, `SettingsNav` | 3h | 14, 49 | C7.6, C9.6-C9.8 |
| UI-52 | Discussion kit: header, message, list, result panel | 3h | 11, 13, 16 | C10 |
| UI-53 | `TrayMenu` | 2h | 19a, 13 | C12 |
| UI-54 | Telegram kit (header, thread, bubbles, input) for the in-app preview/storybook and the bot message design reference | 2h | 11, 03 | C13 |
| UI-60 | `CanvasStage` (dot grid, pan, zoom 0.1-2.0 with 70% default, coordinate helpers, keyboard) | 3h | 02-04 | C11.1 |
| UI-61 | `NodeTile` anatomy, 4 kinds, 7 states, ports, ghost layers | 3h | 11, 13, 60 | C11.2 |
| UI-62 | `StartNode`, `SaveDecisionsNode`, `JoinNode`, `QualityGate`, `GroupFrame` | 3h | 61 | C11.3, C11.4 |
| UI-63 | `Edge` as SVG (orthogonal routing, arrowheads, states, labels, return edge) | 3h | 60-62 | C11.5 |
| UI-64 | `SkillPalette`, `CanvasPalette`, DnD (HTML5 or dnd-kit), drop-target state on `SkillsTab`, drag chip | 3h | 61, 11 | C11.6, C11.7 |
| UI-65 | `CanvasToolbar`, `Minimap`, `ValidationBadge`, legend card | 3h | 60, 10 | C11.8-C11.10 |
| UI-66 | `AgentStateChipsStrip`, `AgentInspector` | 3h | 13, 14, 61 | C11.11, C6.5 |
| UI-70 | A11y pass: focus ring everywhere, roles (switch, tab, radio, dialog), contrast fixes, reduced motion, keyboard maps | 3h | all primitives | checklist + axe in Storybook |
| UI-71 | Visual regression against all 18 PNGs (page-level stories) | 3h | all | green baseline |
| UI-72 | Docs: token page, usage rules (visibility word, state icon + text, "wg CLI"), contribution guide | 2h | all | MDX |

Totals: 7 foundation tasks (UI-01..07), 11 primitive tasks, 3 shell, 6 chat, 15 data/feature composites, 7 canvas, 3 closing = 52 tasks, approximately 143 hours.

---

## E. Inconsistencies and open design questions

Each item: **Where** (view or token), **Problem**, **Recommendation** (specific normalisation).

| # | Where | Problem | Recommended normalisation |
|---|---|---|---|
| E1 | TopBar (12 views) | With the workspace switcher the bar wraps to two rows (117px); Global Pause drops to row 2 at x=92. Pulpit and App settings are one row (67px). The path is not truncated. | `flex-wrap: nowrap`, path `max-width: 220px` with ellipsis, limit pill collapses to "62%" + meter below 1280px, always 67px. Same bar in all views (switcher included on Workspaces too). |
| E2 | Onboarding 2 | Content is 943px tall in a 900px viewport; the wizard main and sidebar overflow. | Make main `overflow: auto`, reduce vertical padding 48 to 32 at heights < 960, keep footer actions sticky at the bottom. |
| E3 | Tray | Content is 613px, popover is 560px. | Fix popover `max-height: 560`, make Workspace groups scroll, keep header and the action list pinned. |
| E4 | Select caret | Selects use `chevron-right` (pointing right) as caret. | Use `chevron-down` (UI-06) in `SelectButton`, `ModelPicker`; rotate to up when open. |
| E5 | Tabs | `SubTabs` underline is magenta `#F25FC4`, height 42; `ProfileTabs` underline is violet `#9B7BFF`, height 40. | One `Tabs` with violet underline (violet = selection) and 42px height; reserve magenta for "working". |
| E6 | Page padding | 22, 24, 26, 28 and 18-20 are all used for main padding. | Standard `page-pad` 24 (left/right) and 24 (top); dense canvas/board 20. |
| E7 | Titles | `title-page` appears as 26/-0.52, 26/-0.26, 26/0 (Decision title, Agent name); 24 with and without tracking; 22 with and without tracking. | Collapse to: `title-page` 26/700/-0.52; `title-section` 24/700/-0.48; `title-22` 22/700/-0.2 (adds the tracking). |
| E8 | Button radius and height | 10, 12, 14 radii and 34-46px heights, with the same role getting different sizes (approve is 44, 46, 40 across Chief, Approvals, Telegram; Back is 40 in step 1 and 46 in step 2). | Define 3 sizes: `sm` 34 r10, `md` 40 r12 (default), `lg` 44 r14. Approve/deny in all desktop and Telegram use `lg`; Telegram touch target 44. Wizard CTA stays 46/r14 as `xl`. Back = `secondary lg` in both steps. |
| E9 | Button label | 13/600 (116 uses) and 14/600 (12 uses) for same-role secondary buttons; canvas Agent chips show 13.33px because the text lives in an unstyled `<button>` (browser default). | Secondary 13/600 everywhere; reset `font: inherit` on buttons in the base CSS. |
| E10 | Count badge | The "1" badge on the Security row (waiting for Approval) is magenta (`#F25FC4`), while the waiting state is amber. | Use amber badge for Approvals count, magenta only for working counts. |
| E11 | Colour duplicates | `#F6EFFF` vs `#F6F1FF`; `#D9C7EA`, `#E3DAF0`, `#E9D8FF`, `#E9D2AE` are all near-body text variants; `#FFB3E6`, `#FF8AD8`, `#FF9BDD`, `#FFD3F1` are four magentas. | Keep 1 bright text (`#F6EFFF`), 1 soft body (`#E3DAF0`), 1 link (`#E9D8FF`), map `#D9C7EA` to `#E3DAF0`. Magenta light = `#FFB3E6` (text), `#FF9BDD` only in the Chief avatar gradient, `#FFD3F1` only on the pause button. |
| E12 | Colour alpha notation | Mixed `#RRGGBBAA` (`#E0479F66`) and `rgba()`; shadows hard-code colours. | All tints through `color-mix()` or tokens `--om-*-a14` etc.; no raw rgba in components. |
| E13 | Agent hues | Security (`#FFD69A` / `#D98A1C`) and Designer (`#FFE0A8` / `#E09A2E`) are nearly identical; amber also means "waiting". | Re-hue Designer to teal/cyan-green variant (e.g. `#9FE8E0` / `#2FA39A`), keep amber exclusively for the waiting state, and avoid mint overlap with PO by shifting PO to green-lime `#C9F0A0` / `#6FBF4A`. Needs a design decision; until then keep as in the mock. |
| E14 | Avatar stack | Stacked avatars overlap by 6px with no separating ring; glows merge. | Add a 2px ring in the card background colour (`box-shadow: 0 0 0 2px #140F20`), max 4 + "+N". |
| E15 | Node ghost layers | Every node (public and private, all kinds) draws two offset ghost layers (opacity .45/.22). The legend does not explain them; they look like "stack of runs/iterations". | Open question for design. Recommendation: ghost layers only for nodes inside a Loop (iteration count), otherwise none; count shown in the NodeTab ("it. 2"). |
| E16 | Visibility words | `PUBLICZNY/PRYWATNY` rendered in 3 shapes: outline 9px, filled 10px, filled 11px, plus node tab 11px tracking 0.12em. | Two shapes: `outline` (lists, 10px min) and `filled` (header/inspector 11px). Node tab keeps its own shape but same colour and word. |
| E17 | 9px text | `badge-outline` is 9px, mono-label 10px. Below 10px is illegible at 1x. | Minimum 10px for any text; make `badge-outline` 10/600/+0.06em. |
| E18 | Contrast of control borders | `line` `#2A2040` on `#140F20` is 1.2:1; `line-strong` `#5B3E8F` is 2.4:1. Decorative for cards, but form controls need 3:1 (WCAG 1.4.11). | Keep `line` for cards; introduce `line-control` `#6E5AA6` (3.3:1 on `#140F20`) for inputs, selects, checkboxes, switches off-state outline. Text pairs pass (muted on surface 5.1:1, secondary 7.2:1). |
| E19 | Focus | Every `<input>`/`<textarea>` has `outline: none` and no replacement; buttons have none defined. | Global `:focus-visible` ring (std states); remove `outline: none` from components. |
| E20 | Search field height | Field built from a `div` is `box-sizing: content-box`: 40 + 2 border = 42px, buttons are 40px. | `box-sizing: border-box` globally; fields 40px (same as `md` buttons). |
| E21 | Status glyphs | `✓ ✗ ● ◆ ○ ▍ →` are plain text; font fallback will differ per OS. | `StatusText` renders SVG glyphs (UI-06) with text for screen readers. Keep the same shapes. |
| E22 | Checkbox | Native `accent-color` checkbox (20px) in a custom-designed UI. | Custom `Checkbox` (B7). |
| E23 | Switch | `button` without role. | `role="switch" aria-checked`. |
| E24 | Back in step 1 | The first wizard step shows an enabled "Wstecz" button; Back is a `button` in step 1 and a link in step 2. | Hide Back in step 1 (or disable); Back always a `button`. |
| E25 | Terminology | Lanes are labelled "TOR" on node tabs and "Tor …" in the Board aria labels, but the glossary term is Lane; "Zgoda" (Approval) and "Prośba o dostęp" (Access Request) share a screen titled "Zgody i Prośby". | Keep Polish UI words (Tor = Lane), but use `Lane`, `Approval`, `Access Request` in code and slugs; do not rename in the mock. |
| E26 | Approval scope | Chief card offers "Zezwól na stałe"; Telegram never does; Approvals page offers "Zezwalaj na git push w tym Workspace". Labels for the same permanent grant differ. | One label: "Zezwalaj na stałe w tym Workspace" for both desktop surfaces; Telegram footnote stays. |
| E27 | Run pill vs state | Run state is magenta pill with dot; the Agent state "pracuje" uses the same magenta but different shapes (pill, text). | Share `StatusPill` (dot + word) for Run, Agent and Workspace states. |
| E28 | Loop frame label | Quality-loop label is 15px mono mint, not in the type scale. | Add `mono-canvas-label` (done in A.2) and use the same style for future frames (Parallel). |
| E29 | Missing canvas states | The mock shows no error, skipped or collapsed node, no multi-select, no edge hover, no empty canvas. | Design before UI-61 (node error/skipped), UI-63 (edge states), and UI-60 (empty state with palette hint). |
| E30 | Approval kinds | Only git push is detailed; Access Request, new domain and escalation detail panes are not drawn. | Design the three detail variants before UI-34 (R in C3.3). |
| E31 | Public/Private in dropped Skills | Visibility chooser (Agents) shows "dostępny we wszystkich Workspace'ach" selected; Inspector shows "tylko tutaj" selected: same concept, different colours (blue vs violet). | Colour follows the option: public = blue, private = violet in both places (B8). |
| E32 | Dates and numbers | Dates mix "wtorek, 13 października", "dziś 03:00", "wczoraj"; numbers "0,7". | Use `Intl` with `pl-PL`; relative times via a single helper. |
| E33 | Global Pause state | No view shows Global Pause active. | Design: top bar turns magenta-tint banner "Wszystko wstrzymane" with "Wznów" button, and disable composers and Approval buttons that start work. |
| E34 | Top-bar on Onboarding/Tray/Telegram | Not applicable, but the Tray and Telegram duplicate state pills in different shapes. | Reuse `StatusText` and `StatusDot`. |

Open design questions (need an Owner decision before the related tasks): (1) E13 Agent hue palette; (2) E15 meaning of node ghost layers; (3) whether the Owner can drag Task cards between Lanes (Task Board); (4) dark-only vs adding a light theme later (tokens are semantic so it is possible); (5) Access Request default duration and rights UI; (6) what the unread notification state looks like; (7) whether the window should support widths below 1280 (the mocks are 1440 only; Tray and Telegram are fixed).
