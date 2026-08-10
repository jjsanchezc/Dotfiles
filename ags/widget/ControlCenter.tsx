import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createBinding, createState, For, With } from "ags"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import AstalWp from "gi://AstalWp"
import AstalBluetooth from "gi://AstalBluetooth"
import AstalBattery from "gi://AstalBattery"
import AstalMpris from "gi://AstalMpris"
import AstalNotifd from "gi://AstalNotifd"
import GLib from "gi://GLib"

// === Services ===
const wp = AstalWp.get_default()!
const speaker = wp.audio.default_speaker!
const mic = wp.audio.default_microphone!
const bt = AstalBluetooth.get_default()
const battery = AstalBattery.get_default()
const mpris = AstalMpris.get_default()
const notifd = AstalNotifd.get_default()

// === Brightness (via brightnessctl) ===
const decoder = new TextDecoder()
const getBrightness = () => {
    try {
        const max = Number(decoder.decode(GLib.spawn_command_line_sync("brightnessctl max")[1] as any))
        const cur = Number(decoder.decode(GLib.spawn_command_line_sync("brightnessctl get")[1] as any))
        return max > 0 ? cur / max : 1
    } catch { return 1 }
}
const [brightnessVal, setBrightnessVal] = createState(getBrightness())

// === Uptime ===
const uptime = createPoll("", 60_000, () => {
    try {
        const contents = GLib.file_get_contents("/proc/uptime")
        if (contents[0]) {
            const text = decoder.decode(contents[1] as any)
            const secs = Number(text.split(".")[0])
            const h = Math.floor(secs / 3600)
            const m = Math.floor((secs % 3600) / 60)
            return `${h}h ${m < 10 ? "0" + m : m}m`
        }
    } catch {}
    return "0h 00m"
})

// === Power Profile (via asusctl) ===
const [profileExpanded, setProfileExpanded] = createState(false)

const getActiveProfile = () => {
    try {
        const out = decoder.decode(GLib.spawn_command_line_sync(
            "bash -c \"asusctl profile get 2>/dev/null | sed 's/Active profile: //' | tr '[:upper:]' '[:lower:]'\""
        )[1] as any).trim()
        return out || "balanced"
    } catch { return "balanced" }
}

const [currentProfileState, setCurrentProfile] = createState(getActiveProfile())
const currentProfile = currentProfileState

// === Expandable toggle state ===
const [btExpanded, setBtExpanded] = createState(false)
const [powerExpanded, setPowerExpanded] = createState(false)
const [powerConfirm, setPowerConfirm] = createState("")

function resetWindowSize() {
    const win = app.get_window("control-center")
    // -1 is GTK's "compute natural size" sentinel. Forcing 1x1 (the old
    // value) made every child lay out in a near-zero space for a frame,
    // which corrupted Pango's cached layout on any label with `ellipsize`
    // set (e.g. BluetoothToggle's status label got stuck showing "…"
    // after collapsing the details panel) — this avoids that entirely.
    if (win) win.set_default_size(-1, -1)
}

// ============================================================
//  HEADER
// ============================================================
function Header() {
    return (
        <box class="header" spacing={10}>
            <box valign={Gtk.Align.CENTER} hexpand spacing={12}>
                <box spacing={6} visible={createBinding(battery, "isPresent")}>
                    <image iconName={createBinding(battery, "iconName")} />
                    <label label={createBinding(battery, "percentage")((p) => `${Math.floor(p * 100)}%`)} />
                </box>
                <label class="header-sep" label="|"
                    visible={createBinding(battery, "isPresent")} />
                <box spacing={6}>
                    <image iconName="preferences-system-time-symbolic" />
                    <label label={uptime} />
                </box>
            </box>
            <button class="sys-button" valign={Gtk.Align.CENTER}
                onClicked={() => {
                    const next = !powerExpanded()
                    setPowerExpanded(next)
                    setPowerConfirm("")
                    // Fire the resize as the collapse *starts*, not after the
                    // revealer's own animation finishes — otherwise the window
                    // sits at the old size through the whole smooth slide and
                    // only snaps at the very end, which reads as a jarring
                    // two-step motion instead of one.
                    if (!next) resetWindowSize()
                }}>
                <image iconName="system-shutdown-symbolic" />
            </button>
        </box>
    )
}

// ============================================================
//  POWER PANEL (expandable)
// ============================================================
const powerActions = [
    { id: "lock", label: "Lock", icon: "system-lock-screen-symbolic", cmd: ["hyprlock"], confirm: false },
    { id: "suspend", label: "Suspend", icon: "media-playback-pause-symbolic", cmd: ["systemctl", "suspend"], confirm: false },
    { id: "logout", label: "Logout", icon: "system-log-out-symbolic", cmd: ["pkill", "Hyprland"], confirm: true },
    { id: "reboot", label: "Reboot", icon: "system-reboot-symbolic", cmd: ["systemctl", "reboot"], confirm: true },
    { id: "shutdown", label: "Shutdown", icon: "system-shutdown-symbolic", cmd: ["systemctl", "poweroff"], confirm: true },
    { id: "reload", label: "Reload AGS", icon: "emblem-synchronous-symbolic", cmd: ["bash", "-c", "setsid bash -c 'ags quit -i jjsanchezc-shell; sleep 1; cd ~/.config/ags && exec ags run' >/dev/null 2>&1 < /dev/null &"], confirm: false },
]

function PowerPanel() {
    return (
        <box class="power-panel" orientation={Gtk.Orientation.VERTICAL} spacing={4}>
            {powerActions.map((action) => (
                <box orientation={Gtk.Orientation.VERTICAL}>
                    <button class="power-item"
                        onClicked={() => {
                            if (!action.confirm) {
                                execAsync(action.cmd)
                                setPowerExpanded(false)
                                return
                            }
                            if (powerConfirm() === action.id) {
                                execAsync(action.cmd)
                                setPowerConfirm("")
                                setPowerExpanded(false)
                            } else {
                                setPowerConfirm(action.id)
                            }
                        }}>
                        <box spacing={8}>
                            <image iconName={action.icon} />
                            <label label={action.label} hexpand xalign={0} />
                            <label class="power-hint"
                                label={powerConfirm((c: string) => c === action.id ? "Click to confirm" : "")} />
                        </box>
                    </button>
                    <revealer
                        revealChild={powerConfirm((c: string) => c === action.id)}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                        transitionDuration={150}>
                        <box class="power-confirm" spacing={8}>
                            <label label={`Confirm ${action.label}?`} hexpand xalign={0} />
                            <button class="confirm-yes"
                                onClicked={() => {
                                    execAsync(action.cmd)
                                    setPowerConfirm("")
                                    setPowerExpanded(false)
                                }}>
                                <label label="Yes" />
                            </button>
                            <button class="confirm-no"
                                onClicked={() => setPowerConfirm("")}>
                                <label label="No" />
                            </button>
                        </box>
                    </revealer>
                </box>
            ))}
        </box>
    )
}

// ============================================================
//  VOLUME SLIDER
// ============================================================
function VolumeSlider() {
    return (
        <box class="slider-row" spacing={8}>
            <button valign={Gtk.Align.CENTER}
                onClicked={() => speaker.set_mute(!speaker.mute)}>
                <image iconName={createBinding(speaker, "volumeIcon")} />
            </button>
            <slider
                hexpand
                value={createBinding(speaker, "volume")}
                onChangeValue={({ value }) => speaker.set_volume(value)}
            />
            <label class="slider-value"
                label={createBinding(speaker, "volume")((v) => `${Math.round(v * 100)}%`)}
                widthChars={4} xalign={1} />
        </box>
    )
}

// ============================================================
//  MICROPHONE SLIDER
// ============================================================
function MicSlider() {
    return (
        <box class="slider-row" spacing={8}>
            <button valign={Gtk.Align.CENTER}
                onClicked={() => mic.set_mute(!mic.mute)}>
                <image iconName={createBinding(mic, "volumeIcon")} />
            </button>
            <slider
                hexpand
                value={createBinding(mic, "volume")}
                onChangeValue={({ value }) => mic.set_volume(value)}
            />
            <label class="slider-value"
                label={createBinding(mic, "volume")((v) => `${Math.round(v * 100)}%`)}
                widthChars={4} xalign={1} />
        </box>
    )
}

// ============================================================
//  BRIGHTNESS SLIDER
// ============================================================
function BrightnessSlider() {
    return (
        <box class="slider-row" spacing={8}>
            <button valign={Gtk.Align.CENTER}
                onClicked={() => {
                    execAsync(["brightnessctl", "set", "0%", "-q"])
                    setBrightnessVal(0)
                }}>
                <image iconName="display-brightness-symbolic" />
            </button>
            <slider
                hexpand
                value={brightnessVal()}
                onChangeValue={({ value }) => {
                    execAsync(["brightnessctl", "set", `${Math.round(value * 100)}%`, "-q"])
                    setBrightnessVal(value)
                }}
            />
            <label class="slider-value"
                label={brightnessVal((v: number) => `${Math.round(v * 100)}%`)}
                widthChars={4} xalign={1} />
        </box>
    )
}

// ============================================================
//  BLUETOOTH TOGGLE (expandable)
// ============================================================
function BluetoothToggle() {
    return (
        <box class="toggle-btn"
            $={(self) => {
                const update = () => {
                    if (bt.is_powered) self.add_css_class("active")
                    else self.remove_css_class("active")
                }
                bt.connect("notify::is-powered", update)
                update()
            }}>
            <button class="toggle-main" hexpand
                onClicked={() => bt.toggle()}>
                <box spacing={8}>
                    <image iconName={createBinding(bt, "isPowered")((on) =>
                        on ? "bluetooth-active-symbolic" : "bluetooth-disabled-symbolic"
                    )} />
                    <label label={createBinding(bt, "isPowered")((on) => {
                        if (!on) return "Off"
                        const connected = bt.get_devices().filter(d => d.connected)
                        if (connected.length === 1) return connected[0].alias
                        if (connected.length > 1) return `${connected.length} Connected`
                        return "On"
                    })} hexpand xalign={0} maxWidthChars={8} ellipsize={3} />
                </box>
            </button>
            <button class="toggle-arrow"
                onClicked={() => {
                    const next = !btExpanded()
                    setBtExpanded(next)
                    if (!next) resetWindowSize()
                }}>
                <image iconName={btExpanded((e: boolean) => e ? "pan-down-symbolic" : "pan-end-symbolic")} />
            </button>
        </box>
    )
}

// ============================================================
//  BLUETOOTH DETAILS (expandable panel)
// ============================================================
function BluetoothDetails() {
    const devices = createBinding(bt, "devices")

    return (
        <box class="details-panel" orientation={Gtk.Orientation.VERTICAL} spacing={4}>
            <box spacing={8}>
                <label class="detail-section-label" label="CONNECTED" hexpand xalign={0} />
                <button class="scan-btn"
                    onClicked={() => bt.adapter?.start_discovery()}>
                    <image iconName="view-refresh-symbolic" />
                </button>
            </box>

            <For each={devices}>
                {(dev) => (
                    <button class="detail-item connected"
                        visible={createBinding(dev, "connected")}
                        onClicked={() => dev.disconnect_device(null)}>
                        <box spacing={8}>
                            <image iconName={`${dev.icon}-symbolic`} />
                            <label label={dev.alias} hexpand xalign={0}
                                maxWidthChars={20} ellipsize={3} />
                            <label class="detail-status" label="Connected" />
                        </box>
                    </button>
                )}
            </For>

            <label class="detail-section-label" label="PAIRED" xalign={0} />

            <For each={devices}>
                {(dev) => (
                    <button class="detail-item"
                        visible={createBinding(dev, "connected")((c) => !c)}
                        onClicked={() => dev.connect_device(null)}>
                        <box spacing={8}>
                            <image iconName={`${dev.icon}-symbolic`} />
                            <label label={dev.alias} hexpand xalign={0}
                                maxWidthChars={20} ellipsize={3} />
                            <label class="detail-status" label="Paired" />
                        </box>
                    </button>
                )}
            </For>
        </box>
    )
}

// ============================================================
//  DND TOGGLE (uses notifd binding for persistent state)
// ============================================================
function DndToggle() {
    return (
        <button class="toggle-btn" hexpand
            $={(self) => {
                const update = () => {
                    if (notifd.dont_disturb) self.add_css_class("active")
                    else self.remove_css_class("active")
                }
                notifd.connect("notify::dont-disturb", update)
                update()
            }}
            onClicked={() => {
                notifd.set_dont_disturb(!notifd.dont_disturb)
            }}>
            <box spacing={8}>
                <image iconName={createBinding(notifd, "dontDisturb")((d) =>
                    d ? "notifications-disabled-symbolic"
                      : "preferences-system-notifications-symbolic"
                )} />
                <label label={createBinding(notifd, "dontDisturb")((d) => d ? "DND" : "Alerts")}
                    hexpand xalign={0} maxWidthChars={8} ellipsize={3} />
            </box>
        </button>
    )
}

// ============================================================
//  POWER PROFILE TOGGLE (expandable)
// ============================================================
const profileModes = [
    { id: "quiet", label: "Quiet", icon: "weather-clear-night-symbolic" },
    { id: "balanced", label: "Balanced", icon: "power-profile-balanced-symbolic" },
    { id: "performance", label: "Performance", icon: "power-profile-performance-symbolic" },
]

function PowerProfileToggle() {
    return (
        <box class="toggle-btn"
            $={(self) => {
                const update = () => {
                    const p = currentProfile()
                    self.remove_css_class("profile-quiet")
                    self.remove_css_class("profile-balanced")
                    self.remove_css_class("profile-performance")
                    self.add_css_class(`profile-${p}`)
                    self.add_css_class("active")
                }
                update()
            }}>
            <button class="toggle-main" hexpand
                onClicked={() => {
                    execAsync(["asusctl", "profile", "next"])
                        .then(() => setCurrentProfile(getActiveProfile()))
                        .catch(() => {})
                }}>
                <box spacing={8}>
                    <image iconName={currentProfile((p: string) => {
                        const mode = profileModes.find(m => m.id === p)
                        return mode?.icon || "power-profile-balanced-symbolic"
                    })} />
                    <label label={currentProfile((p: string) => {
                        const mode = profileModes.find(m => m.id === p)
                        return mode?.label || "Balanced"
                    })} hexpand xalign={0} maxWidthChars={8} ellipsize={3} />
                </box>
            </button>
            <button class="toggle-arrow"
                onClicked={() => {
                    const next = !profileExpanded()
                    setProfileExpanded(next)
                    if (!next) resetWindowSize()
                }}>
                <image iconName={profileExpanded((e: boolean) => e ? "pan-down-symbolic" : "pan-end-symbolic")} />
            </button>
        </box>
    )
}

function PowerProfileDetails() {
    return (
        <box class="details-panel" orientation={Gtk.Orientation.VERTICAL} spacing={4}>
            {profileModes.map((mode) => (
                <button class="detail-item"
                    $={(self) => {
                        const check = () => {
                            if (currentProfile() === mode.id) {
                                self.add_css_class("connected")
                            } else {
                                self.remove_css_class("connected")
                            }
                        }
                        check()
                    }}
                    onClicked={() => {
                        const name = mode.id.charAt(0).toUpperCase() + mode.id.slice(1)
                        execAsync(["asusctl", "profile", "set", name])
                            .then(() => setCurrentProfile(mode.id))
                            .catch(() => {})
                    }}>
                    <box spacing={8}>
                        <image iconName={mode.icon} />
                        <label label={mode.label} hexpand xalign={0} />
                        <label class="detail-status"
                            label={currentProfile((p: string) => p === mode.id ? "Active" : "")} />
                    </box>
                </button>
            ))}
        </box>
    )
}

// ============================================================
//  MEDIA PLAYER
// ============================================================
function lengthStr(length: number) {
    const min = Math.floor(length / 60)
    const sec = Math.floor(length % 60)
    return `${min}:${sec < 10 ? "0" : ""}${sec}`
}

function Player({ player }: { player: AstalMpris.Player }) {
    return (
        <box class="player" spacing={12}>
            <box
                class="cover"
                css={createBinding(player, "coverArt")((path) => `
                    min-width: 96px;
                    min-height: 96px;
                    background-image: url('${path || ""}');
                    background-size: cover;
                    border-radius: 8px;
                `)}
                valign={Gtk.Align.START}
            />
            <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                <box>
                    <label class="title" label={createBinding(player, "title")}
                        maxWidthChars={20} ellipsize={3} xalign={0} hexpand />
                    <image
                        class="player-icon"
                        iconName={`${player.entry}-symbolic`}
                        halign={Gtk.Align.END}
                    />
                </box>
                <label class="artist" label={createBinding(player, "artist")}
                    maxWidthChars={20} ellipsize={3} xalign={0} />
                <box vexpand />
                <box spacing={8} halign={Gtk.Align.CENTER}>
                    <button onClicked={() => player.previous()}
                        visible={createBinding(player, "canGoPrevious")}>
                        <image iconName="media-skip-backward-symbolic" />
                    </button>
                    <button class="play-pause" onClicked={() => player.play_pause()}
                        visible={createBinding(player, "canControl")}>
                        <image iconName={createBinding(player, "playbackStatus")((s) =>
                            s === AstalMpris.PlaybackStatus.PLAYING
                                ? "media-playback-pause-symbolic"
                                : "media-playback-start-symbolic"
                        )} />
                    </button>
                    <button onClicked={() => player.next()}
                        visible={createBinding(player, "canGoNext")}>
                        <image iconName="media-skip-forward-symbolic" />
                    </button>
                </box>
            </box>
        </box>
    )
}

function MediaWidget() {
    const players = createBinding(mpris, "players")

    return (
        <box orientation={Gtk.Orientation.VERTICAL} visible={players((p) => p.length > 0)}>
            <For each={players}>
                {(player) => <Player player={player} />}
            </For>
        </box>
    )
}

// ============================================================
//  CONTROL CENTER WINDOW
// ============================================================
export default function ControlCenter() {
    const { TOP, RIGHT } = Astal.WindowAnchor

    return (
        <window
            name="control-center"
            visible={false}
            application={app}
            anchor={TOP | RIGHT}
            layer={Astal.Layer.OVERLAY}
            keymode={Astal.Keymode.EXCLUSIVE}
            margin_top={10}
            margin_right={10}
            $={(self) => {
                self.connect("notify::is-active", () => {
                    if (!self.is_active) self.visible = false
                })
                // Same class of bug as resetNotifWindowSize() in
                // Notifications.tsx: this layer-shell window doesn't always
                // recompute its natural size on its own when it's shown —
                // whatever size GTK last settled on (e.g. from before a
                // font-size change, or a stale allocation left over from the
                // last time it was open) can stick, clipping taller content
                // like .section-label at the top instead of growing to fit
                // it. Forcing a recompute on every show fixes that.
                self.connect("notify::visible", () => {
                    if (self.visible) resetWindowSize()
                })
                const key = new Gtk.EventControllerKey()
                key.connect("key-pressed", (_: any, keyval: number) => {
                    if (keyval === Gdk.KEY_Escape) {
                        self.visible = false
                        return true
                    }
                    return false
                })
                self.add_controller(key)
            }}
        >
            <box class="control-center" orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Header />

                {/* Power panel (expandable) */}
                <revealer
                    revealChild={powerExpanded}
                    transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                    transitionDuration={200}
                    $={(self) => {
                        self.connect("notify::child-revealed", () => {
                            if (!self.child_revealed) resetWindowSize()
                        })
                    }}>
                    <PowerPanel />
                </revealer>

                {/* Audio & Display */}
                <label class="section-label" label="Audio & Display" xalign={0} />
                <box class="sliders" orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                    <VolumeSlider />
                    <MicSlider />
                    <BrightnessSlider />
                </box>

                {/* Quick Settings */}
                <label class="section-label" label="Quick Settings" xalign={0} />
                <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                    {/* Bluetooth + DND + Power Profile, one balanced row */}
                    <box class="toggles" spacing={8} homogeneous>
                        <BluetoothToggle />
                        <DndToggle />
                        <PowerProfileToggle />
                    </box>

                    {/* Bluetooth expandable panel */}
                    <revealer
                        revealChild={btExpanded}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                        transitionDuration={200}
                        $={(self) => {
                            self.connect("notify::child-revealed", () => {
                                if (!self.child_revealed) resetWindowSize()
                            })
                        }}>
                        <BluetoothDetails />
                    </revealer>

                    {/* Power profile expandable panel */}
                    <revealer
                        revealChild={profileExpanded}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                        transitionDuration={200}
                        $={(self) => {
                            self.connect("notify::child-revealed", () => {
                                if (!self.child_revealed) resetWindowSize()
                            })
                        }}>
                        <PowerProfileDetails />
                    </revealer>
                </box>

                {/* Media */}
                <MediaWidget />
            </box>
        </window>
    )
}
