const vscode = require('vscode');
const showWebPanel = require('./webPanel');
const lineAnnotationsController = require('./lineAnnotationsController');
const constants = require('./constants');


function setupAnnotations(context) {
    // generate on start
    let activeEditor = vscode.window.activeTextEditor;

    // generate when document is made active
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            lineAnnotationsController.addAnnotations(editor);
        }
	}, null, context.subscriptions);

    // generate when the document is edited
    vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
            lineAnnotationsController.addAnnotations(activeEditor);
		}
	}, null, context.subscriptions);

	if (activeEditor) {
		lineAnnotationsController.addAnnotations(activeEditor);
	}
}

function replaceRange(editor, edit, ...args) {
    const [
        rangeStartLine,
        rangeStartCharacter,
        rangeEndLine,
        rangeEndCharacter,
        newText
    ] = args;

    range = editor.document.getWordRangeAtPosition(new vscode.Position(rangeStartLine, rangeStartCharacter + 1), /[^\s\:\"\']+/);

    edit.delete(range);
    edit.insert(range.start, newText);
}

function openWebPanel({url, pageTitle}) {
    showWebPanel(url, pageTitle);
}

exports.activate = function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand(constants.openWebViewPanelCommand, openWebPanel));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand(constants.replaceTextCommand, replaceRange));

    setupAnnotations(context);
}

exports.deactivate = function deactivate() {
};
