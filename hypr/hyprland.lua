-- Migrated from hyprland.conf on 2026-08-04.
-- Converted with hyprconf2lua v1.6.0, then hand-reviewed and fixed against
-- https://github.com/hyprwm/Hyprland/blob/main/example/hyprland.lua and the
-- locally-installed /usr/share/hypr/stubs/hl.meta.lua type stub — see
-- lua_MIGRATION.md for what was actually broken in the raw tool output.
--
-- You can (and should) split config into multiple files, then require them:
-- require("myColors")


----------------
---- MONITORS ----
----------------
require("monitors")

-------------------
---- MY PROGRAMS ----
-------------------

-- NOT `local` — keybindings.lua (required further down) reads these as
-- globals. See the NOTE at the top of keybindings.lua for why.
terminal    = "kitty"
fileManager = "nautilus"
menu        = "rofi -show drun"
browser     = "zen-browser"

-------------------
---- AUTOSTART ----
-------------------

-- Old hyprland.conf had 4 separate `exec-once =` lines; the new Lua config
-- has no exec-once equivalent, so they collapse into one hl.on(...) block.
hl.on("hyprland.start", function()
    hl.exec_cmd("waybar")
    hl.exec_cmd("hyprpaper")
    hl.exec_cmd(os.getenv("HOME") .. "/Dotfiles/scripts/.local/bin/ags-watch")
    -- hl.exec_cmd("hypridle") -- see TODO.md: no real hypridle.conf exists yet
    hl.exec_cmd(os.getenv("HOME") .. "/Dotfiles/scripts/.local/bin/power-saver")

    -- workspaces startup apps
    -- NOTE: the "[workspace 1 silent]" dispatch-rule prefix was part of the
    -- exec dispatcher's own string parsing in the old format, not something
    -- hyprland.conf's config language did — kept as-is since hl.exec_cmd is
    -- the same underlying exec dispatcher. Verify this still assigns the
    -- window to workspace 1 silently after cutover (see checklist).
    hl.exec_cmd("[workspace 1 silent] kitty tmux")
end)

-------------------------------
---- ENVIRONMENT VARIABLES ----
-------------------------------

hl.env("HYPRCURSOR_THEME", "Adwaita")
hl.env("HYPRCURSOR_SIZE", "24")
hl.env("XCURSOR_THEME", "Adwaita")
hl.env("XCURSOR_SIZE", "24")

-- Nvidia stuff
hl.env("GBM_BACKEND", "nvidia-drm")
hl.env("LIBVA_DRIVER_NAME", "nvidia")
hl.env("__GLX_VENDOR_LIBRARY_NAME", "nvidia")

-----------------------
---- PERMISSIONS ----
-----------------------

-- See https://wiki.hypr.land/Configuring/Permissions/
-- Please note permission changes here require a Hyprland restart and are
-- not applied on-the-fly for security reasons.
-- All commented out in the original hyprland.conf too — nothing active.

-- hl.config({
--   ecosystem = {
--     enforce_permissions = true,
--   },
-- })

-- hl.permission("/usr/(bin|local/bin)/grim", "screencopy", "allow")
-- hl.permission("/usr/(lib|libexec|lib64)/xdg-desktop-portal-hyprland", "screencopy", "allow")
-- hl.permission("/usr/(bin|local/bin)/hyprpm", "plugin", "allow")

-----------------------
---- LOOK AND FEEL ----
-----------------------
require("look_and_feel")
require("colors")

---------------
---- INPUT ----
---------------
require("input")

---------------------
---- KEYBINDINGS ----
---------------------

-- Must come after the `terminal`/`fileManager`/`menu`/`browser` globals
-- above are set — keybindings.lua reads them as globals, not locals.
require("keybindings")

--------------------------------
---- WINDOWS AND WORKSPACES ----
--------------------------------
require("windows_and_workspaces")
