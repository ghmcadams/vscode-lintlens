import fs from 'fs';
import path from 'path';
import { workspace } from 'vscode';

export function getWorkspaceDir(dirname) {
    return workspace.workspaceFolders
        .map(folder => {
            const folderPath = folder.uri.fsPath;
            const dir = path.join(folderPath, dirname);
            if (fs.existsSync(dir)) {
                return dir;
            }

            return null;
        })
        .find(dir => dir !== null);
}
