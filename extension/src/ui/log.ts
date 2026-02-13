import * as vscode from "vscode";

export class Log {
    private channel = vscode.window.createOutputChannel("Profile Vault");

    info(msg: string) {
        this.channel.appendLine(`[INFO] ${msg}`);
    }
    warn(msg: string) {
        this.channel.appendLine(`[WARN] ${msg}`);
    }
    error(msg: string) {
        this.channel.appendLine(`[ERROR] ${msg}`);
    }
    show() {
        this.channel.show(true);
    }
}
