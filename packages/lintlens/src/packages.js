import { createRequire } from 'module';


export function getPackageForDocument(packageName, documentFilePath) {
    const myRequire = createRequire(documentFilePath);
    const pkg = myRequire(packageName);
    return pkg;
}
