import { workspace } from 'vscode';
import { relative, isAbsolute } from 'path';
import findup from 'findup-sync';


// a collection of paths to node modules (or the yarn equivalant) for a file path
const documentCache = new Map();
// an array of open workspace root folders
const workspaceRoots = (workspace.workspaceFolders ?? [])
    .map(folder => folder.uri.fsPath);


function isDescendant(parent, folder) {
    const isRelative = relative(parent, folder);
    return isRelative && !isRelative.startsWith('..') && !isAbsolute(isRelative);
}

export function getPackagePathForDocument(documentFilePath, packageName) {
    if (!documentCache.has(documentFilePath)) {
        documentCache.set(documentFilePath, new Map());
    }
    const packagesForDocument = documentCache.get(documentFilePath);

    if (packagesForDocument.has(packageName)) {
        return packagesForDocument.get(packageName);
    }

    let packageFolder = findup(`node_modules/${packageName}`, { cwd: documentFilePath });
    if (!packageFolder) {
        packageFolder = findup(`.yarn/sdks/${packageName}`, { cwd: documentFilePath });
    }

    if (packageFolder !== null) {
        // make sure this is within open workspace folders only
        const isInWorkspace = workspaceRoots.some(root => isDescendant(root, packageFolder));
        if (!isInWorkspace) {
            packageFolder = null;
        }
    }

    if (packageFolder !== null) {
        packagesForDocument.set(packageName, packageFolder);
    }

    return packagesForDocument.get(packageName);
}
