import { window, commands, ViewColumn, Uri } from 'vscode';
import path from 'path';
import url from 'url';
import open from 'open';
import axios from 'axios';
import { commands as commandConstants, extensionId, extensionName } from '../constants';
import loadingCSS from '../static/loading.css';
import webPanelScript from '../static/webPanelScript';

let extensionContext;
let webViewPanel;

export function initialize(context) {
    extensionContext = context;
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
    let baseHost = new url.URL(baseUrl).hostname;

    const newHtml = html
        // remove newline characters
        .replace(/\n/g, ' ')

        // replace relative paths with absolute
        .replace(
            /(href|src)="([^"]*?)"/gmi,
            function (match, p1, p2) {
                let newUrl = url.resolve(baseUrl, p2);
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

    return axios.get(url)
        .then(response => prepareHtml(response.data, url))
        .then(html => {
            const column = window.activeTextEditor ? window.activeTextEditor.viewColumn : ViewColumn.One;
            webViewPanel.title = title;
            webViewPanel.webview.html = html;
            webViewPanel.reveal(column)
        })
        .catch(err => {
            //TODO: error occurred.  handle it
        });
}

export function openInBrowser(url) {
    open(url);
}
