import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createRoot } from "ags"
import AstalNotifd from "gi://AstalNotifd"
import GLib from "gi://GLib"

const notifd = AstalNotifd.get_default()
const MAX_POPUPS = 3
const DEFAULT_TIMEOUT = 4000

// Prefer the notification's own attached image (e.g. a chat avatar) over
// the sending app's icon. `app_icon` is usually a themed icon *name*
// ("firefox"), but the spec also allows it to be a file path/URI, so check
// for that too instead of assuming it's always a name.
function getNotificationIcon(notification: AstalNotifd.Notification): { file?: string; iconName?: string } | null {
    const image = notification.get_image()
    if (image) return { file: image.replace(/^file:\/\//, "") }

    const appIcon = notification.get_app_icon()
    if (!appIcon) return null

    return appIcon.startsWith("/") || appIcon.startsWith("file://")
        ? { file: appIcon.replace(/^file:\/\//, "") }
        : { iconName: appIcon }
}

function NotificationPopup(notification: AstalNotifd.Notification, onDone: () => void) {
    const urgency = notification.get_urgency()
    const isCritical = urgency === AstalNotifd.Urgency.CRITICAL

    let timeoutId: number | null = null
    let destroyed = false
    // This whole function runs from inside the `notifd.connect("notified", ...)`
    // event callback, not as a rendered <NotificationPopup/> — so none of the
    // JSX built below has a tracking context, and every onCleanup() call
    // Astal's JSX runtime makes for it fails ("out of tracking context: will
    // not be able to cleanup", logged on every single notification). Visible
    // effect: the leftover $border-colored sliver after a popup closes — its
    // GTK resources never got torn down. createRoot() below (the same helper
    // Astal itself uses to run app.ts's main() in a tracking context) gives
    // this JSX a real scope; disposeScope() runs alongside our own manual
    // cleanup instead of leaking it.
    let disposeScope: (() => void) | null = null

    const destroy = () => {
        if (destroyed) return
        destroyed = true
        if (timeoutId) GLib.source_remove(timeoutId)
        revealer.revealChild = false
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            outer.unparent()
            disposeScope?.()
            onDone()
            return GLib.SOURCE_REMOVE
        })
    }

    // Auto-dismiss all notifications (critical gets more time)
    const timeout = isCritical
        ? 6000
        : (notification.get_expire_timeout() > 0
            ? notification.get_expire_timeout()
            : DEFAULT_TIMEOUT)
    timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
        timeoutId = null
        destroy()
        return GLib.SOURCE_REMOVE
    })

    // Listen for external resolve
    const resolvedId = notifd.connect("resolved", (_: any, id: number) => {
        if (id === notification.get_id()) {
            notifd.disconnect(resolvedId)
            destroy()
        }
    })

    const body = notification.get_body()
    const cssClass = isCritical ? "notification critical" : "notification"
    const icon = getNotificationIcon(notification)

    let revealer!: Gtk.Revealer
    let outer!: Gtk.Widget

    createRoot((dispose) => {
        disposeScope = dispose

        const content = (
            <button cssClasses={[cssClass]}
                onClicked={() => {
                    notification.dismiss()
                    notifd.disconnect(resolvedId)
                    destroy()
                }}>
                <box spacing={12}>
                    {icon ? (
                        <image cssClasses={["notif-icon"]}
                            file={icon.file}
                            iconName={icon.iconName}
                            pixelSize={40} />
                    ) : <box />}
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
                        <label cssClasses={["notif-app"]}
                            label={notification.get_app_name() || "Notification"}
                            xalign={0} maxWidthChars={40} ellipsize={3} />
                        <label cssClasses={["notif-summary"]}
                            label={notification.get_summary()}
                            xalign={0} maxWidthChars={40} ellipsize={3} />
                        {body ? (
                            <label cssClasses={["notif-body"]}
                                label={body}
                                xalign={0} wrap maxWidthChars={40} />
                        ) : <box />}
                    </box>
                </box>
            </button>
        )

        revealer = (
            <revealer
                revealChild={false}
                transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                transitionDuration={200}>
                {content}
            </revealer>
        ) as Gtk.Revealer

        outer = <box>{revealer}</box>

        // Slide in on next frame
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
            revealer.revealChild = true
            return GLib.SOURCE_REMOVE
        })
    })

    return { widget: outer, destroy, notificationId: notification.get_id() }
}

function resetNotifWindowSize() {
    const win = app.get_window("notifications")
    // Same fix as ControlCenter's resetWindowSize(): this window never
    // shrinks back down on its own once GTK has allocated it a larger size
    // for a popup, so a removed popup can leave a stale sliver of its own
    // border painted where it used to be. -1 is GTK's "compute natural
    // size" sentinel — recomputing it after every removal is what actually
    // clears that leftover render, not just disposing the popup's JSX scope.
    if (win) win.set_default_size(-1, -1)
}

export default function Notifications() {
    const { TOP, RIGHT } = Astal.WindowAnchor
    const popups: { widget: Gtk.Widget; destroy: () => void; notificationId: number }[] = []

    const container = (
        <box orientation={Gtk.Orientation.VERTICAL} spacing={6}
            halign={Gtk.Align.END} valign={Gtk.Align.START} />
    ) as Gtk.Box

    notifd.connect("notified", (_: any, id: number, replaced: boolean) => {
        if (notifd.dont_disturb) return

        // If replaced, remove old popup for same id
        if (replaced) {
            const idx = popups.findIndex(p => p.notificationId === id)
            if (idx >= 0) {
                popups[idx].destroy()
                popups.splice(idx, 1)
            }
        }

        const notification = notifd.get_notification(id)
        if (!notification) return

        const popup = NotificationPopup(notification, () => {
            const idx = popups.indexOf(popup)
            if (idx >= 0) popups.splice(idx, 1)
            resetNotifWindowSize()
        })

        container.prepend(popup.widget)
        popups.unshift(popup)

        // Enforce max popups
        while (popups.length > MAX_POPUPS) {
            const oldest = popups.pop()!
            oldest.destroy()
        }
    })

    return (
        <window
            name="notifications"
            visible
            application={app}
            anchor={TOP | RIGHT}
            layer={Astal.Layer.OVERLAY}
            keymode={Astal.Keymode.NONE}
            margin_top={10}
            margin_right={10}
            namespace="notifications">
            {container}
        </window>
    )
}

export function dismissLatest() {
    const notifs = notifd.get_notifications()
    if (notifs.length > 0) notifs[0].dismiss()
}

export function dismissAll() {
    for (const n of notifd.get_notifications()) n.dismiss()
}
