import { Position, commands } from 'vscode';
import { commands as commandConstants } from '../constants';


export function initialize(context) {
    context.subscriptions.push(commands.registerTextEditorCommand(commandConstants.replaceText, replaceRange));
}

export function replaceRange(editor, edit, ...[ rangeStartLine, rangeStartCharacter, rangeEndLine, rangeEndCharacter, newText ]) {
    const position = new Position(rangeStartLine, rangeStartCharacter + 1);
    const range = editor.document.getWordRangeAtPosition(position, /[^\s\:\"\']+/);
    edit.replace(range, newText);
}
