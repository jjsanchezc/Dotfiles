# Lua Migration

Hyprland 0.55+ replaced the old `.conf` config language (hyprlang) with a real Lua-based config. Hyprland 0.56.1 (what you're on) still accepts `.conf` but warns; **0.57 removes support entirely** (per the warning you saw and the official announcement: *"the old hyprlang syntax will continue to be supported for 1-2 releases starting from 0.55"*).

**Gotcha found after the fact (2026-08-06):** `hyprctl dispatch exec <cmd>` (the old CLI syntax, useful for manually testing/launching something without editing a config) no longer works once you're on `hyprland.lua` — it tries to parse the CLI argument as Lua and fails with `unexpected symbol near '.'`. Haven't worked out the correct new ad-hoc syntax yet; for now, just background the command directly (`nohup cmd & disown`) instead of going through `hyprctl dispatch`.

## Scope — what actually needs to change

Only **Hyprland's own config** is affected. Confirmed from the official announcement: *"Other hypr\* tools will for now continue using hyprlang as their config language provider."*

- [x] Affected: `hypr/hyprland.conf` and everything it `source`s — `monitors.conf`, `look_and_feel.conf`, `input.conf`, `keybindings.conf`, `windows_and_workspaces.conf`, `colors.conf` (matugen-generated).
- [ ] **Not** affected, leave alone: `hyprlock.conf`, `hypridle.conf`, `hyprpaper.conf`.
- [ ] Also needs updating once `colors.conf` is migrated: `matugen/templates/hyprland-colors.conf.in` — it currently generates hyprlang syntax; matugen just fills in `{{colors.*}}` placeholders in whatever text the template contains, so the template itself needs to emit valid Lua. Output filename/path (`matugen/config.toml`'s `[templates.hyprland_colors]`) also needs to change from `colors.conf` to `colors.lua`.

## Tool

**Use [`hyprconf2lua`](https://github.com/Prateek-squadron/hyprconf2lua)** (Python, pip-installable — no AUR/Go toolchain needed):

```bash
pip install hyprconf2lua   # or: pipx install hyprconf2lua
hyprconf2lua <file>.conf -o <file>.lua
```

Verified directly against PyPI before recommending it: **v1.6.0, released 2026-08-01** — actively maintained, not abandoned. Claims ~97% automatic conversion, flags anything ambiguous with `-- TODO: manual review` comments instead of guessing.

(There's also `hyprlang2lua`, Go-based with an AUR package and a browser converter — didn't rule it out, just couldn't independently verify its AUR listing / activity claims the way I could for hyprconf2lua's PyPI release, so it's the backup option if hyprconf2lua chokes on something specific.)

## Ground truth for reviewing conversions

`hyprconf2lua`'s output is reviewed against real sources, not trusted blind — the tool's own README claims ~97% automatic conversion:
- [Official example `hyprland.lua`](https://github.com/hyprwm/Hyprland/blob/main/example/hyprland.lua) — the actual file from `hyprwm/Hyprland`'s repo, fetched verbatim on 2026-08-04. Covers `hl.monitor`, `hl.config` (general/decoration/animations/dwindle/master/scrolling/misc/input), `hl.curve`, `hl.animation`, `hl.gesture`, `hl.device`, `hl.bind`, `hl.window_rule`, `hl.layer_rule`.
- [Community `hl.*` API reference](https://alejandrominaya.github.io/hyprland-lua-docs/) — used as a secondary cross-check for anything the official example doesn't cover.

Key facts confirmed from the official example, since they change the shape of the remaining conversions non-trivially:
- **`col.active_border`/`inactive_border` accept either a plain string** (`"rgba(595959aa)"`, used for a single flat color — this is what our `colors.lua` uses) **or a table** `{ colors = {"rgba(..)", "rgba(..)"}, angle = 45 }` for gradients. Only relevant to us if a border ever goes back to a gradient.
- **No `exec-once` equivalent exists.** Autostart is `hl.on("hyprland.start", function() hl.exec_cmd("waybar") ... end)` — a single function body, not repeated `exec-once =` lines. This matters for the Step 3 cutover: `hyprland.conf`'s 4 `exec-once` lines (plus the 2 clipboard-watcher ones in `keybindings.conf`) all need to collapse into one `hl.on("hyprland.start", ...)` block, and the `[workspace 1 silent] kitty tmux` line's bracket dispatch-modifier needs an equivalent checked for specifically (not shown in the official example).
- **Keybindings use an `hl.dsp.*` namespace, not flat dispatcher-name strings** — e.g. `hl.bind(mainMod .. " + Q", hl.dsp.exec_cmd(terminal))`, `hl.dsp.window.close()`, `hl.dsp.focus({direction="left"})`, `hl.dsp.window.move({workspace=i})`, `hl.dsp.workspace.toggle_special("magic")`. This is a bigger structural rewrite than a simple syntax port, so `keybindings.conf`'s conversion needs a full old-vs-new dispatcher-by-dispatcher diff, not a skim.

## The safety net: use `hyprctl reload`, don't restart to test

Hyprland hot-reloads config on `hyprctl reload` — your **currently running session keeps using the old, working config in memory** until reload succeeds. This means:

- Never edit `hyprland.conf` in place. Keep it as the live config until the very last step.
- Build the new `.lua` files alongside the old `.conf` files, converted one at a time.
- Only the final cutover step (renaming `hyprland.conf` → `hyprland.conf.bak` and adding `hyprland.lua`) actually switches what Hyprland reads.
- After the cutover, run `hyprctl reload` immediately. If it errors, `mv hyprland.lua hyprland.conf` back and `hyprctl reload` again — you're instantly back to working, no restart needed.
- Only reboot to confirm everything survives a fresh Hyprland launch *after* `hyprctl reload` already succeeded cleanly.

**Resolved empirically (2026-08-04):** old-format `hyprland.conf` sourcing a `.lua` file does **not** work. Tested by adding an extra `source = ~/.config/hypr/colors.lua` line next to the working `source = ~/.config/hypr/colors.conf` and running `hyprctl reload` — the reload itself reports `ok` (doesn't crash), but `hyprctl configerrors` shows the old hyprlang parser tries to read the `.lua` file as hyprlang text and fails on every line (`Invalid config line`, `config option <hl.config(:general> does not exist`, `Unclosed category at EOF`). It fails gracefully — falls back to the last-good value, no crash — but the `.lua` content is not applied. **Confirms: no incremental mixing from the old-format side.** (The reverse direction — a new `hyprland.lua` `require()`-ing a file still in old hyprlang syntax — was never tested, since it's moot for the chosen workflow below: convert and hand-review every file first, then do one atomic cutover.)

## Migration order

Lowest risk / simplest syntax first, so mistakes are cheap and you learn the new syntax before touching anything that could lock you out of rebinding a terminal. Convert and **syntax-review** each file before moving to the next — don't activate anything until the very last step.

**All 7 converted and reviewed on 2026-08-04** — `hyprconf2lua` output was never trusted blind, checked line-by-line against the official example, the locally-installed `hl.meta.lua` stub, and finally a Hyprland `--verify-config` pass (`config ok`, zero errors) against the real files. Found and fixed real bugs the tool got wrong:

- [x] **1. `colors.conf`** → `colors.lua`. Clean conversion, no fixes needed. `matugen/templates/hyprland-colors.conf.in` renamed to `hyprland-colors.lua.in` and rewritten to emit the `hl.config({ general = { col = {...} } })` shape; `matugen/config.toml`'s output path updated to `colors.lua`. Re-ran `wallpaper-set` to confirm matugen still renders it correctly.
- [x] **2. `monitors.conf`** → `monitors.lua`. Clean conversion, field names (`output`/`mode`/`position`/`scale`) confirmed against the official example.
- [x] **3. `input.conf`** → `input.lua`. Fixed: the `gesture = 3, horizontal, workspace` line was left as a bare `-- TODO: manual review` comment, not converted — reconstructed as `hl.gesture({ fingers = 3, direction = "horizontal", action = "workspace" })`.
- [x] **4. `look_and_feel.conf`** → `look_and_feel.lua`. Fixed the biggest miss found: **all 5 `bezier` and 17 `animation` directives were silently dropped** (only their comments survived), and `enabled = yes, please :)` was mangled into an invalid `{ true, "please:)" }` table instead of `true`. Reconstructed every `hl.curve(...)`/`hl.animation(...)` call by hand, preserving this file's original values (not the official example's newer defaults, which differ).
- [x] **5. `windows_and_workspaces.conf`** → `windows_and_workspaces.lua`. Fixed: `move = "20 monitor_h-120"` was wrongly split into a `{20, "monitor_h-120"}` table instead of staying a plain string.
- [x] **6. `keybindings.conf`** → `keybindings.lua`. Multiple fixes: `$terminal`/`$fileManager`/`$menu`/`$browser` were left as broken literal strings (those hyprlang vars live in `hyprland.conf`, invisible to a single-file conversion — now read as real Lua globals set in `hyprland.lua` before `require("keybindings")`); the 4 `movewindow` (Super+Shift+H/L/K/J) binds had **no dispatcher call at all**, just an orphaned `{direction=...}` table — wrapped in `hl.dsp.window.move({...})`; the 4 `bindel` volume/mic binds lost `repeating = true`; `togglefloating` needed an explicit `{action="toggle"}` arg; and — caught only by the nested-instance smoke test, not by static review — **all 10 ASUS raw-keycode binds** (`hl.bind(156, ...)` etc.) failed at runtime with `Unknown keysym: "156"`, since `hl.bind()` doesn't auto-detect bare numbers as keycodes the way old hyprlang did; fixed with the `code:156` prefix.
- [x] **7. `hyprland.conf` → `hyprland.lua`** — done. `source =` lines replaced with `require(...)`, the 4 `exec-once` lines collapsed into one `hl.on("hyprland.start", function() ... end)` block, env vars converted to `hl.env(...)` calls. Verified with `Hyprland --verify-config` (`config ok`) — both as an isolated nested-instance smoke test and against the real deployed file.

**Note on testing this last step:** `hyprctl reload` cannot test the `.conf` → `.lua` switch at all — confirmed via research that Hyprland decides once, at its own process startup, whether to load `hyprland.lua` or `hyprland.conf` (`.lua` wins if present, silently, no log either way), and that check isn't repeated on reload. `hyprland.lua` now exists in the repo and is completely inert for the currently-running session — it only takes effect on the **next real Hyprland restart**, not a reload. Used `Hyprland --verify-config` (a real, dedicated Hyprland flag: parses and validates a config with no display server at all) plus one nested-instance test run for confidence before that restart, since there's no "reload and instantly see if it worked" safety net for this specific step the way there was for every individual file.

## Post-migration checklist

- [x] Restart Hyprland for real — **done 2026-08-04.** No more deprecation warning, `hyprctl configerrors` clean, `hyprctl getoption general:col.active_border` confirms `colors.lua` is being read live. Committed as `migration to .lua files`.
- [x] Confirmed no errors got missed by `--verify-config` — clean restart, no runtime config errors reported.
- [x] Re-tested the things this session already fixed — **confirmed working 2026-08-04**: `Super+Shift+T` wallpaper picker, all exec-once startup apps still launching (waybar, hyprpaper, ags-watch, `[workspace 1 silent] kitty tmux`). Border color following the theme was already confirmed live (see above).
- [x] Tested the binds that were hand-reconstructed rather than 1:1 copied from a confirmed reference — **confirmed working 2026-08-04**: `Super+Q` (close), `Super+V` (togglefloating — still bound twice, pre-existing quirk carried over as-is), `Super+Shift+H/L/K/J` (movewindow), `Super+F` (fullscreen), and the ASUS keys (156/211/121/122/123/256/232/233/237/238).
- [ ] Run `wallpaper-set` once for real (any mode — automatic or one of the 3 fixed themes) to confirm matugen's regenerated `colors.lua` still applies correctly via `hyprctl reload`.
- [ ] Once trusted for a few days: delete (or rename to `.bak`) the old `hyprland.conf`, `monitors.conf`, `input.conf`, `look_and_feel.conf`, `windows_and_workspaces.conf`, `keybindings.conf` — they're currently still sitting alongside the `.lua` files, inert but present (git history keeps them recoverable regardless). `colors.conf` can go now — it's already stale/unused since matugen writes `colors.lua` instead.
- [x] Update `README.md`'s references to `hyprland.conf` (directory overview, "Startup Applications" section) to `hyprland.lua`.
