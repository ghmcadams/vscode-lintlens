openLinkInBrowser = (function() {
    const vscode = acquireVsCodeApi();

    return function(url) {
        vscode.postMessage({
            command: 'openInVSCode',
            url
        });
    };
})();
