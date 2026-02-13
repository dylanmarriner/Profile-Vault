import * as vscode from "vscode";
import { ProfileStore } from "../core/store";

export class ProfileProvider implements vscode.TreeDataProvider<ProfileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProfileItem | undefined | null | void> = new vscode.EventEmitter<ProfileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProfileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private store: ProfileStore) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProfileItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ProfileItem): Promise<ProfileItem[]> {
        if (!element) {
            const profiles = await this.store.list();
            return profiles.map(p => new ProfileItem(p.name, p.id, vscode.TreeItemCollapsibleState.None));
        }
        return [];
    }
}

class ProfileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly profileId: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} (${this.profileId})`;
        this.contextValue = "profile";
        this.iconPath = new vscode.ThemeIcon("archive");
    }
}
