const vscode = require('vscode');


function initialize(context) {
}

function replaceRange(editor, edit, ...[ rangeStartLine, rangeStartCharacter, rangeEndLine, rangeEndCharacter, newText ]) {
    range = editor.document.getWordRangeAtPosition(new vscode.Position(rangeStartLine, rangeStartCharacter + 1), /[^\s\:\"\']+/);
    edit.replace(range, newText);
}

module.exports = {
    initialize,
    replaceRange
};
