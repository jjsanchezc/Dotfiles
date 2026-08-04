# TODO

Audited by comparing the main `README.md` against what's actually running on the system (checked `hyprland.conf`'s real `exec-once` lines, installed packages, and systemd unit status). Last audited: 2026-08-04.

## 1. README says it's active, but it isn't

The "Startup Applications" table in `README.md` lists these as launched via `exec-once` — none of them actually are (verified against `hypr/hyprland.conf`):

- [ ] `hypridle` — the line exists but is commented out (`hypr/hyprland.conf:25`). Idle-based dim/lock/suspend never runs.
- [ ] `power-saver` — script exists (`scripts/.local/bin/power-saver`), just never started. Battery-aware brightness/refresh-rate switching isn't happening.
- [ ] `ags-watch` — script exists (`scripts/.local/bin/ags-watch`), never started. As a result **AGS itself never runs** (confirmed: `ags quit`/`ags run` fail on every matugen post-hook — see §2).
- [ ] `swayosd-server` — the `swayosd` package isn't even installed (`pacman -Qi swayosd` → not found). Volume/brightness OSD popups can't work at all right now.
- [ ] `hypr-monitor-manager` — doesn't exist anywhere in the repo or `$PATH`. Either this was never written, or it's a tool that got removed and the README reference is stale.
- [ ] `kitty` (nvim, workspace 3) — no second `kitty` exec line exists; only the tmux one on workspace 1 is real.
- [ ] `battery-alert.service` / `.timer` — the unit files exist in `systemd/.config/systemd/user/`, but `~/.config/systemd/user/` is a real (non-symlinked) empty directory — they were never copied in or enabled (`systemctl --user is-enabled` → not-found for both).

Pick one per item: actually wire it up, or edit the README table down to what's real (like we did once already this session, before it got reverted).

## 2. Actually missing / broken (found this session, not necessarily in the README)

- [ ] **`hyprlock` background is hardcoded**, not templated: `matugen/templates/hyprlock.conf.in:16` has `path = ~/.config/hypr/Wallpapers/pain.jpg` as a literal string. The lock screen always shows `pain.jpg` regardless of your actual current wallpaper. Fix: use matugen's `{{image}}` variable for the automatic-mode case; the 3 fixed-theme folders would need the wallpaper path threaded through some other way since they use `matugen json` (no image context).
- [ ] **AGS post-hook fails every time**: `matugen/config.toml`'s `[templates.ags_colors]` post_hook (`ags quit -i jjsanchezc-shell; ags run &`) errors on every single `wallpaper-set` run because AGS is never running to begin with (see §1, `ags-watch`). Either actually autostart AGS, or drop/simplify this post_hook so it stops erroring for no reason.
- [ ] **Orphaned `hypr/wallpapers/`** (lowercase) — a leftover directory with one old file (`allmight-dark.jpg`), separate from the real `hypr/Wallpapers/` (capital W) that everything actually uses. Nothing references it. Safe to delete.
- [ ] **Theming doesn't cover everything**: `wlogout/`, `swayosd/`, `mako/`, `foot/` have no matugen template — they stay static/hardcoded colors while everything else re-themes. Not broken, just inconsistent if you care about all apps matching.
- [ ] **`starship.toml` is unused** — exists and is symlinked, but `.zshrc` never initializes it (Powerlevel10k is the real prompt). Explicitly deferred earlier this session ("solo fastfetch por ahora").

## 3. Recommended fixes (priority order)

1. Fix the `hyprlock` hardcoded wallpaper path (§2) — most likely to be noticed day-to-day, since the lock screen visibly never matches your theme.
2. Decide on AGS once and for all: either add `ags-watch` back to `exec-once` (and `power-saver`, `hypridle` while you're at it — both are ready to go, zero extra work), or strip the AGS post_hook + `ags request toggle-cc` waybar binding if you've moved on from it.
3. Delete `hypr/wallpapers/` (lowercase, orphaned).
4. Either install `swayosd` for real or drop it from the README's Key Dependencies / startup table — right now it's documented as core infrastructure but isn't present on the system at all.
5. Write or remove `hypr-monitor-manager` — currently a dangling reference to a tool that doesn't exist.

## 4. Recommended additions

- [ ] Extend matugen templates to `wlogout/style.css`, `swayosd/style.css`, `mako/config`, and/or `foot/foot.ini` for full-system theme consistency (same pattern as the existing templates — see `matugen/README.md`).
- [ ] Actually enable + `systemctl --user enable --now battery-alert.timer` if you want the low-battery notifications the script already implements.
- [ ] Once you're ready to revisit starship: theme it via a new matugen template, *and* decide whether to actually switch from p10k or keep it as an opt-in alternate prompt.
- [ ] Now that `catppuccin/` has real wallpapers in it (added after the original testing pass), do one real `wallpaper-set` run against it to confirm end-to-end — same code path as everforest/gruvbox, which were verified, but never explicitly re-checked with the newer images.
