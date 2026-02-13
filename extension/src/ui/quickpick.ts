import * as vscode from "vscode";
import { ProfileListItem } from "../core/model";

export async function pickProfile(items: ProfileListItem[], placeHolder: string) {
    const qpItems = items.map(i => ({
        label: i.name,
        description: `${i.ideFlavor} • ${new Date(i.createdAt).toLocaleString()}`,
        detail: i.id
    }));

    const picked = await vscode.window.showQuickPick(qpItems, { placeHolder, matchOnDetail: true });
    return picked?.detail;
}
