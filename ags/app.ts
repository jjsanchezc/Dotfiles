import app from "ags/gtk4/app"
import style from "./style.scss"
import ControlCenter from "./widget/ControlCenter"
import Notifications, { dismissLatest, dismissAll } from "./widget/Notifications"

app.start({
    css: style,
    instanceName: "jjsanchezc-shell",
    requestHandler(request, response) {
        // `request` is the argv array from `ags request [argv...]` (the
        // "request" signal passes it as `args`, plural) — not a joined
        // string. Comparing it directly against a string literal never
        // matched, so every request (toggle-cc included) silently fell
        // through to "unknown command".
        const cmd = request[0]
        if (cmd === "toggle-cc") {
            app.toggle_window("control-center")
            response("toggled")
        } else if (cmd === "dismiss-notif") {
            dismissLatest()
            response("dismissed")
        } else if (cmd === "dismiss-all") {
            dismissAll()
            response("dismissed all")
        } else {
            response("unknown command")
        }
    },
    main() {
        ControlCenter()
        Notifications()
    },
})
