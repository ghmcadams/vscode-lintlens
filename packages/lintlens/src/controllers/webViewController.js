import { window, commands, ViewColumn, Uri } from 'vscode';
import url from 'url';
import open from 'open';
import { xhr } from 'request-light';
import { commands as commandConstants, extensionId, extensionName } from '../constants';
import loadingCSS from '../static/loading.css';
import webPanelScript from '../static/webPanelScript';


let extensionContext;
let webViewPanel;

export function initialize(context) {
    extensionContext = context;

    context.subscriptions.push(commands.registerCommand(commandConstants.openWebViewPanel, openInVSCode));
    context.subscriptions.push(commands.registerCommand(commandConstants.openInBrowser, openInBrowser));
}

function processWebviewMessage(message) {
    switch (message.command) {
        case 'alert':
            window.showErrorMessage(message.text);
            return;
        case 'openInVSCode':
            commands.executeCommand(commandConstants.openWebViewPanel, {url: message.url, title: extensionName});
            return;
        case 'openInBrowser':
            commands.executeCommand(commandConstants.openInBrowser, message.url);
            return;
        default:
            return;
    }
}

function getLoadingHtml() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            ${loadingCSS}
        </style>
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
    const baseHost = new url.URL(baseUrl).hostname;

    const newHtml = html
        // remove newline characters
        .replace(/\n/g, ' ')

        // replace relative paths with absolute
        .replace(
            /(href|src)="([^"]*?)"/gmi,
            function (match, p1, p2) {
                const newUrl = url.resolve(baseUrl, p2); // TODO: url.resolve is deprecated?
                return `${p1}="${newUrl}"`;
            }
        )

        // replace hyperlinks with extension commands
        .replace(
            /(<a(?!href)[^r]*?)href="([^"]*?)"/gmi,
            function (match, p1, p2) {
                return `${p1}onClick="openLinkInBrowser('${p2}');"`;
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
            `<script type="text/javascript">
            ${webPanelScript}
            </script></body>`
        );

    return newHtml;
}

export function openInVSCode({url, title}) {
    if (!webViewPanel) {
        webViewPanel = window.createWebviewPanel(`${extensionId}-webviewer`, `${extensionName} - Web Viewer`, ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });

        webViewPanel.webview.onDidReceiveMessage(processWebviewMessage, null, extensionContext.subscriptions);

        webViewPanel.onDidDispose(() => {
            webViewPanel = undefined;
        }, null, extensionContext.subscriptions);
    }

    webViewPanel.webview.html = getLoadingHtml();

    return xhr({ url, followRedirects: 5 })
        .then(response => prepareHtml(response.responseText, url))
        .then(html => {
            const column = window.activeTextEditor ? window.activeTextEditor.viewColumn : ViewColumn.One;
            webViewPanel.title = title;
            webViewPanel.webview.html = html;
            webViewPanel.reveal(column)
        }, (error) => {
            //TODO: error occurred.  handle it
        });
}

export function openInBrowser(url) {
    open(url);
}
