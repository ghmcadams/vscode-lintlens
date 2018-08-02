const vscode = require('vscode');
const path = require('path');
const url = require('url');
const open = require('open');
const fetch = require('node-fetch');
const constants = require('../constants');


let extensionContext;
let extensionPath;
let webViewPanel;

function initialize(context) {
    extensionContext = context;
    extensionPath = context.extensionPath;
}

function processWebviewMessage(message) {
    switch (message.command) {
        case 'alert':
            vscode.window.showErrorMessage(message.text);
            return;
        case 'openInVSCode':
            vscode.commands.executeCommand(constants.openWebViewPanelCommand, {url: message.url, title: constants.extensionName});
            return;
        case 'openInBrowser':
            vscode.commands.executeCommand(constants.openInBrowserCommand, message.url);
            return;
        default:
            return;
    }
}

function getScriptText() {
    const scriptPath = path.join(extensionPath, 'static', 'webPanelScript.js');
    return `<script type="text/javascript" src="vscode-resource:${scriptPath}"></script>`;
}

function getLoadingHtml() {
    const cssPath = path.join(extensionPath, 'static', 'loading.css');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src vscode-resource: https:; style-src vscode-resource:;">
        <link href="vscode-resource:${cssPath}" rel="stylesheet">
    </head>
    <body>
        <div class="preloader">
            <span class="line line-1"></span>
            <span class="line line-2"></span>
            <span class="line line-3"></span>
            <span class="line line-4"></span>
            <span class="line line-5"></span>
            <span class="line line-6"></span>
            <span class="line line-7"></span>
            <span class="line line-8"></span>
            <span class="line line-9"></span>
            <div>Loading</div>
        </div>
    </body>
    </html>   
    `;
}

function prepareHtml(html, baseUrl) {
    let baseHost = new url.URL(baseUrl).hostname;

    return html
        // replace hyperlinks with extension commands
        .replace(
            /<a(.*?)href="([^"]*)"([^>]*?)>(.*?)<\/a>/gmi,
            function (match, p1, p2, p3, p4) {
                let newUrl = url.resolve(baseUrl, p2);
                return `<a${p1}onClick="openLinkInBrowser('${newUrl}');"${p3}>${p4}</a>`;
            }
        )

        // strip out all script tags
        .replace(
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gmi,
            ''
        )

        // add extension specific meta tags
        .replace(
            '</head>',
            `<meta http-equiv="Content-Security-Policy" content="default-src ${baseHost} vscode-resource:; font-src vscode-resource: https:; img-src https:; style-src vscode-resource: https: 'unsafe-inline'; script-src vscode-resource: 'unsafe-inline';"></head>`
        )

        // add extension specific javascript
        .replace(
            '</body>',
            `${getScriptText()}</body>`
        );
}

function openInVSCode({url, title}) {
    if (!webViewPanel) {
        webViewPanel = vscode.window.createWebviewPanel(`${constants.extensionId}-webviewer`, `${constants.extensionName} - Web Viewer`, vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(extensionPath, 'static'))
            ],
            retainContextWhenHidden: true
        });

        webViewPanel.webview.onDidReceiveMessage(processWebviewMessage, null, extensionContext.subscriptions);

        webViewPanel.onDidDispose(() => {
            webViewPanel = undefined;
        }, null, extensionContext.subscriptions);
    }

    webViewPanel.webview.html = getLoadingHtml();

    return fetch(url)
        .then(res => res.text())
        .then(html => prepareHtml(html, url))
        .then(html => {
            const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : vscode.ViewColumn.One;
            webViewPanel.title = title;
            webViewPanel.webview.html = html;
            webViewPanel.reveal(column)
        })
        .catch(err => {
            //TODO: error occurred.  handle it
        });
}

function openInBrowser(url) {
    open(url);
}

module.exports = {
    initialize,
    openInBrowser,
    openInVSCode
}
