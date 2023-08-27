import Module from 'module';


export function getPackageForDocument(packageName, documentFilePath) {
    const myRequire = Module.createRequire(documentFilePath);
    const pkg = myRequire(packageName);
    return pkg;
}
