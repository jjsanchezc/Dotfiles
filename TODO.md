# TODO

Tracks drift between `README.md` (and subdirectory READMEs) and what's actually on the system. Last audited: 2026-08-09.

## 1. README says it's active, but it isn't

Startup Applications table in `README.md` vs. `hypr/hyprland.lua`'s `hl.on("hyprland.start", ...)` block:

- [ ] `hypridle` — commented out, and there's no `hypridle.conf` anywhere in the repo (not even a broken stub — the old copy in the pre-rename backup didn't survive). Needs a real `hypr/hypridle.conf` with dim/lock/suspend `listener {}` blocks before the exec line does anything.
- [x] ~~`power-saver`~~ **RESOLVED 2026-08-06.** In the autostart block, confirmed running live.
- [x] ~~`ags-watch`~~ **RESOLVED.** In the autostart block, AGS confirmed running (`ags list`). Needed a missing `~/.config/ags` symlink, a missing `cd $AGS_DIR`, missing `sass`/`inotify-tools`, and 6 missing `libastal-*-git` AUR packages.
- [ ] `swayosd-server` — `swayosd` isn't installed. Volume/brightness OSD popups don't work.
- [ ] `hypr-monitor-manager` — doesn't exist in the repo or `$PATH`.
- [ ] `kitty` (nvim, workspace 3) — no second `kitty` exec line exists.
- [ ] `battery-alert.service`/`.timer` — unit files exist in `systemd/`, but were never copied to `~/.config/systemd/user/` or enabled.

Pick one per item: wire it up for real, or trim the README table to match reality.

## 2. Actually missing / broken

- [x] ~~`hyprlock` background hardcoded~~ **RESOLVED 2026-08-06.** `hyprlock.conf.in` now uses a `__WALLPAPER_SET_PATH__` marker `sed`-replaced by `wallpaper-set`, works across automatic and all 3 fixed themes.
- [x] ~~AGS post-hook CWD bug~~ **RESOLVED 2026-08-06.** Redundant/broken post_hook removed from `matugen/config.toml`; `ags-watch` already handles the AGS restart.
- [x] ~~Orphaned `hypr/wallpapers/`~~ **RESOLVED 2026-08-06.** Deleted.
- [ ] Theming doesn't cover everything: `wlogout/` and `swayosd/` have no matugen template, stay hardcoded.
- [ ] `starship.toml` unused — symlinked but `.zshrc` never initializes it (p10k is the real prompt).
- [x] ~~`foot/`/`mako/` dead config folders~~ **INVESTIGATED 2026-08-06.** Neither installed/symlinked/referenced. `foot/` kept in case it's wanted as an alt terminal later. AGS's own `Notifications.tsx`/`ControlCenter.tsx` are the real, active, matugen-themed notification system — the daemon actually competing for them was `dunst` (not mako, never in this repo), now masked (`systemctl --user mask dunst.service`). `mako/` stays in the repo unused.
- [x] ~~Notification icons~~ **RESOLVED 2026-08-06.** `Notifications.tsx` now prefers the notification's own image over the app icon; handles icon-theme names and file paths.
- [ ] Pre-existing bug: every notification logs `Error: out of tracking context: will not be able to cleanup` in `ags-watch.log` — `NotificationPopup` builds its widget tree outside a proper Astal component context. Not fatal; worth checking for a memory leak over long uptime.
- [ ] `ControlCenter.tsx` has no live UI trigger — waybar's network module `on-click` (`ags request toggle-cc`) is commented out in favor of `iwgtk`; nothing else calls `toggle-cc`. Decide: restore the click, bind a keybind, or retire it.
- [x] ~~README waybar/ControlCenter sections stale~~ **RESOLVED 2026-08-09.** Module layout and the `toggle-cc` disconnect above are now documented.
- [x] ~~README missing `bash/`, `starship/`, `hyprconf2lua`~~ **RESOLVED 2026-08-09.** All three added to the Directory Overview / scripts table.
- [ ] Stray binary: `scripts/.local/bin/claude` is a symlink to the Claude Code CLI itself, not a dotfile. Looks accidental — consider `git rm`.
- [ ] `backup_hyprland/` (renamed from `hyprland_backup/` 2026-08-09) doesn't match its own README — claims to hold just the `.conf` files, but also carries a full duplicate `.lua` set and a duplicate `Wallpapers/` (~25MB, identical to `hypr/Wallpapers/`). Prune to the 9 `.conf` files unless intentional.
- [ ] `tmux/colors.conf` isn't version-controlled — every other app's `~/.config/<app>/` is a whole-folder symlink into this repo, but `~/.config/tmux/` is a real directory with only `tmux.conf` individually symlinked. Matugen's tmux output and TPM's `plugins/` never enter the repo. Not urgent (regenerates on next `wallpaper-set`), but a fresh clone won't have tmux colors until then.

## 3. Recommended fixes (priority order)

1. Write a real `hypr/hypridle.conf` with dim/lock/suspend listeners.
2. Install `swayosd` for real, or drop it from the README.
3. Write or remove `hypr-monitor-manager`.
4. Decide `ControlCenter.tsx`'s trigger.

## 4. Recommended additions

- [ ] Extend matugen templates to `wlogout/style.css` and `swayosd/style.css` for full theme consistency.
- [ ] `systemctl --user enable --now battery-alert.timer` if you want the low-battery notifications.
- [ ] Revisit starship: theme it via matugen, decide whether to replace p10k or keep it as an opt-in prompt.
- [x] ~~Verify `catppuccin/` end-to-end~~ **RESOLVED 2026-08-06.**
