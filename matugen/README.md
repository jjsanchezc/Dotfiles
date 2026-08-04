# Theming: `wallpaper-set` and color modes

How picking a wallpaper turns into a full system theme, what's automatic, and what's hardcoded.

## Entry points

| Script | Role |
|---|---|
| `scripts/.local/bin/wallpaper-set <path>` | Does the actual work: sets the wallpaper via hyprpaper, decides which color mode to use (see below), runs matugen, caches the path to `~/.cache/current-wallpaper`. |
| `scripts/.local/bin/wallpaper-picker` | Rofi file browser over `hypr/Wallpapers/` (recursive). On selection, calls `wallpaper-set` by its own script path — not by `$PATH` — so it also works from the `Super+Shift+T` keybind, which doesn't have `~/.local/bin` on its `PATH`. |

Every template in `matugen/templates/*.in` is re-rendered on every run, so **all** themed apps (waybar, rofi, kitty, tmux, hyprland border, hyprlock, ags, gtk4, fastfetch) update together, regardless of which color mode below was used.

## Mode 1 — Fixed themes (default palettes)

If the chosen wallpaper's path contains `Wallpapers/everforest/`, `Wallpapers/gruvbox/`, or `Wallpapers/catppuccin/`, `wallpaper-set` skips color extraction entirely and runs:

```bash
matugen json matugen/themes/<name>.json
```

Each `matugen/themes/*.json` is a **hand-mapped, hardcoded palette** using that project's real/official colors (not a Material You tint derived from the image) — so every wallpaper in that folder produces the exact same, recognizable theme.

| Folder | Theme | `primary` (main accent) |
|---|---|---|
| `hypr/Wallpapers/everforest/` | [Everforest](https://github.com/sainnhe/everforest) (dark, medium contrast) | `#A7C080` |
| `hypr/Wallpapers/gruvbox/` | [Gruvbox](https://github.com/morhetz/gruvbox) (dark, medium contrast) | `#fe8019` |
| `hypr/Wallpapers/catppuccin/` | [Catppuccin Mocha](https://github.com/catppuccin/catppuccin) | `#cba6f7` |

### Full token table

Every template only ever reads these 19 color tokens (grepped from `matugen/templates/*.in`). Role = what it's used for across the templates:

| Token | Role | Everforest | Gruvbox | Catppuccin |
|---|---|---|---|---|
| `primary` | Main accent (icons, active border, focused chip bg) | `#A7C080` | `#fe8019` | `#cba6f7` |
| `on_primary` | Text/icon on a `primary` background | `#2D353B` | `#282828` | `#11111b` |
| `on_primary_container` | Bright neutral (ANSI 15) | `#D3C6AA` | `#fbf1c7` | `#cdd6f4` |
| `secondary` | 2nd accent (ANSI green/blue slots) | `#7FBBB3` | `#8ec07c` | `#89b4fa` |
| `secondary_container` | 3rd accent (ANSI magenta) | `#D699B6` | `#b16286` | `#f5c2e7` |
| `on_secondary_container` | Bright variant of the above (ANSI 13) | `#D3C6AA` | `#d3869b` | `#f2cdcd` |
| `tertiary` | Success/warning/yellow role | `#DBBC7F` | `#fabd2f` | `#f9e2af` |
| `on_tertiary` | Text on a `tertiary` background | `#2D353B` | `#282828` | `#11111b` |
| `tertiary_container` | 4th accent (ANSI cyan) | `#7FBBB3` | `#458588` | `#89dceb` |
| `on_tertiary_container` | Text/bright variant of the above | `#2D353B` | `#83a598` | `#74c7ec` |
| `surface` | Main background | `#2D353B` | `#282828` | `#1e1e2e` |
| `surface_container` | Elevated background (module bg, tabs) | `#343F44` | `#3c3836` | `#313244` |
| `surface_container_low` | Darkest tier (headerbar, ANSI black) | `#232A2E` | `#1d2021` | `#181825` |
| `surface_container_high` | Lightest tier (hover states) | `#3D484D` | `#504945` | `#45475a` |
| `on_surface` | Main text | `#D3C6AA` | `#ebdbb2` | `#cdd6f4` |
| `on_surface_variant` | Muted/secondary text | `#859289` | `#bdae93` | `#a6adc8` |
| `outline_variant` | Borders | `#7A8478` | `#7c6f64` | `#6c7086` |
| `error` | Critical/urgent (red) | `#E67E80` | `#fb4934` | `#f38ba8` |
| `on_error` | Text on an `error` background | `#2D353B` | `#282828` | `#11111b` |

Design rule used throughout: `primary`/`error`/`tertiary` are also used as light "chip" backgrounds in a few places (waybar focused workspace, tmux mode bar), so their `on_*` counterpart is always the theme's darkest background tone, for dark-text-on-light-chip contrast.

Each JSON also carries `hex_stripped`, `red`, `green`, `blue` per token (some templates need raw RGB components, e.g. `hyprlock.conf.in`, `ags-colors.scss.in`) — matugen does **not** derive these automatically from `hex` when importing, so all four must be present or the whole run aborts with a "value does not exist in context" error.

### Adding a new fixed theme

1. Pick the real hex codes for your theme (its own docs/repo are the source of truth — don't guess).
2. Copy an existing file, e.g. `cp matugen/themes/gruvbox.json matugen/themes/mytheme.json`, and fill in all 19 tokens using the role column above as a guide.
3. Add a case to `scripts/.local/bin/wallpaper-set`:
   ```bash
   */Wallpapers/mytheme/*) matugen json "$THEMES_DIR/mytheme.json" ;;
   ```
4. `mkdir hypr/Wallpapers/mytheme` and drop wallpapers in it.
5. Test directly (bypasses rofi): `wallpaper-set hypr/Wallpapers/mytheme/<image>`, then check e.g. `hypr/colors.conf` or `waybar/style.css` for the expected hex values.

## Mode 2 — Automatic (everything else)

Any wallpaper *not* in one of the 3 folders above runs:

```bash
matugen image "$WALLPAPER" --source-color-index 0
```

This extracts a Material You palette from the image itself — same wallpaper, different colors each time. `--source-color-index 0` forces matugen to pick the single most dominant color automatically.

That flag is required, not optional: without it, an image with several similarly-dominant colors makes matugen block on an interactive terminal prompt asking which one to use. That prompt needs a TTY — it works fine when you run `wallpaper-set` from a shell, but silently does nothing when triggered from the `Super+Shift+T` keybind (no TTY attached there). `--source-color-index 0` always resolves deterministically, no prompt, so both paths behave the same.
