# TODO

Audited by comparing the main `README.md` against what's actually running on the system (checked `hyprland.conf`'s real `exec-once` lines, installed packages, and systemd unit status). Last audited: 2026-08-04. **Re-audited 2026-08-04 (later same day)** after the Lua migration ([`lua_MIGRATION.md`](lua_MIGRATION.md)) and a separate AGS-fixing session — see inline notes below for what changed.

## 1. README says it's active, but it isn't

The "Startup Applications" table in `README.md` lists these as launched at startup — most still aren't (verified against `hypr/hyprland.lua`'s `hl.on("hyprland.start", ...)` block):

- [ ] `hypridle` — still commented out, and turns out it's not a one-line fix: the only `hypridle.conf` anywhere in the repo is a stale copy in `hyprland_backup/` with no `listener {}` blocks at all (just `lock_cmd`/`before_sleep_cmd`/`after_sleep_cmd` hooks) — so even enabling the exec line would start a daemon that does nothing. Needs a real `hypr/hypridle.conf` written with actual dim/lock/suspend timeout listeners before the exec line is worth adding.
- [x] ~~`power-saver`~~ **RESOLVED 2026-08-06.** Added to `hyprland.lua`'s autostart block and confirmed running live — genuinely self-contained (no config file, just `upower`/`brightnessctl`/`hyprctl`, both installed).
- [x] ~~`ags-watch`~~ **RESOLVED.** Now actually in `hyprland.lua`'s autostart block, and AGS itself is confirmed running (`ags list` → `jjsanchezc-shell`). Took fixing a chain of issues in a later session: the `~/.config/ags` symlink didn't exist, `ags-watch` wasn't `cd`-ing into `$AGS_DIR` before `ags run` (AGS resolves `app.ts` relative to CWD), `sass`/`inotify-tools` weren't installed, and 6 `libastal-*-git` AUR packages were missing entirely. See §2 for a related bug this surfaced.
- [ ] `swayosd-server` — the `swayosd` package isn't even installed (`pacman -Qi swayosd` → not found). Volume/brightness OSD popups can't work at all right now.
- [ ] `hypr-monitor-manager` — doesn't exist anywhere in the repo or `$PATH`. Either this was never written, or it's a tool that got removed and the README reference is stale.
- [ ] `kitty` (nvim, workspace 3) — no second `kitty` exec line exists; only the tmux one on workspace 1 is real.
- [ ] `battery-alert.service` / `.timer` — the unit files exist in `systemd/.config/systemd/user/`, but `~/.config/systemd/user/` is a real (non-symlinked) empty directory — they were never copied in or enabled (`systemctl --user is-enabled` → not-found for both).

Pick one per item: actually wire it up, or edit the README table down to what's real (like we did once already this session, before it got reverted).

## 2. Actually missing / broken (found this session, not necessarily in the README)

- [x] ~~**`hyprlock` background is hardcoded**~~ **RESOLVED 2026-08-06.** `matugen/templates/hyprlock.conf.in` no longer has a literal path — it now has a `__WALLPAPER_SET_PATH__` marker that `wallpaper-set` `sed`-replaces with the real `$WALLPAPER` path on every run, after matugen finishes. Works for automatic *and* all 3 fixed-theme branches uniformly (sidesteps `{{image}}` not existing in `matugen json` mode at all). Verified end-to-end against a Catppuccin wallpaper: `hyprlock.conf`'s `path =` line matched the real active wallpaper, `colors.lua` showed Catppuccin Mocha's real `cba6f7`/`6c7086` (not a derived tint), zero config errors.
- [x] ~~**AGS post-hook CWD bug**~~ **RESOLVED 2026-08-06.** Deleted the redundant post_hook entirely from `matugen/config.toml` — `ags-watch` already restarts AGS correctly on every `_colors.scss` change, so this was pure dead weight that happened to also be broken.
- [x] ~~**Orphaned `hypr/wallpapers/`**~~ **RESOLVED 2026-08-06.** Deleted.
- [ ] **Theming doesn't cover everything**: `wlogout/`, `swayosd/`, `mako/`, `foot/` have no matugen template — they stay static/hardcoded colors while everything else re-themes. Not broken, just inconsistent if you care about all apps matching.
- [ ] **`starship.toml` is unused** — exists and is symlinked, but `.zshrc` never initializes it (Powerlevel10k is the real prompt). Explicitly deferred earlier this session ("solo fastfetch por ahora").

## 3. Recommended fixes (priority order)

**Items 1-4 below (hyprlock path, AGS post_hook, orphaned dir, power-saver) all resolved 2026-08-06 — see §1/§2.** Remaining, in order:

1. Write a real `hypr/hypridle.conf` with actual dim/lock/suspend `listener {}` blocks (§1) — the exec line alone does nothing without it.
2. Either install `swayosd` for real or drop it from the README's Key Dependencies / startup table — right now it's documented as core infrastructure but isn't present on the system at all.
3. Write or remove `hypr-monitor-manager` — currently a dangling reference to a tool that doesn't exist.

## 4. Recommended additions

- [ ] Extend matugen templates to `wlogout/style.css`, `swayosd/style.css`, `mako/config`, and/or `foot/foot.ini` for full-system theme consistency (same pattern as the existing templates — see `matugen/README.md`).
- [ ] Actually enable + `systemctl --user enable --now battery-alert.timer` if you want the low-battery notifications the script already implements.
- [ ] Once you're ready to revisit starship: theme it via a new matugen template, *and* decide whether to actually switch from p10k or keep it as an opt-in alternate prompt.
- [x] ~~Verify `catppuccin/` end-to-end~~ **RESOLVED 2026-08-06.** Ran `wallpaper-set` against a real Catppuccin wallpaper — confirmed correct border colors (Mocha's real palette, not a derived tint) and the new hyprlock path fix, zero errors.
