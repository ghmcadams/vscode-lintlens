const vscode = require('vscode');
const jsonParser = require('./parsers/jsonParser');
const jsParser = require('./parsers/jsParser');
const yamlParser = require('./parsers/yamlParser');
const pkgParser = require('./parsers/pkgParser');
const showWebPanel = require('./webPanel');
const lineAnnotationsController = require('./lineAnnotationsController');


function setupAnnotations(editor) {
    let parser;

    if (vscode.languages.match({ pattern: '**/.eslintrc.js', scheme: 'file', language: 'javascript' }, editor.document) > 0) {
        parser = jsParser;
    } else if (vscode.languages.match({ pattern: '**/.eslintrc.json', scheme: 'file', language: 'json' }, editor.document) > 0) {
        parser = jsonParser;
    } else if (vscode.languages.match({ pattern: '**/.eslintrc.yaml', scheme: 'file', language: 'yaml' }, editor.document) > 0) {
        parser = yamlParser;
    } else if (vscode.languages.match({ pattern: '**/.eslintrc.yml', scheme: 'file', language: 'yaml' }, editor.document) > 0) {
        parser = yamlParser;
    } else if (vscode.languages.match({ pattern: '**/.eslintrc', scheme: 'file', language: 'json' }, editor.document) > 0) {
        parser = jsonParser;
    } else if (vscode.languages.match({ pattern: '**/.eslintrc', scheme: 'file', language: 'yaml' }, editor.document) > 0) {
        parser = yamlParser;
    } else if (vscode.languages.match({ pattern: '**/package.json', scheme: 'file', language: 'json' }, editor.document) > 0) {
        parser = pkgParser;
    } else {
        return;
    }

    lineAnnotationsController.addAnnotations(editor, parser);
}

exports.activate = function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('lintlens.openWebView', function openWebPanel({url, pageTitle}) {
        showWebPanel(url, pageTitle);
    }));

    // generate on start
    let activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		setupAnnotations(activeEditor);
	}

    // generate when document is made active
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            setupAnnotations(editor);
        }
	}, null, context.subscriptions);

    // generate when the document is edited
    vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
            setupAnnotations(activeEditor);
		}
	}, null, context.subscriptions);
}

exports.deactivate = function deactivate() {
};
