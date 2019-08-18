const vscode = require('vscode');
const DocumentParser = require('../parsers/DocumentParser');
const eslintManager = require('../eslintManager');
const constants = require('../constants');

const glyphs = constants.glyphs;
const annotationDecoration = vscode.window.createTextEditorDecorationType({});

function initialize(context) {
    // generate on start
    let activeEditor = vscode.window.activeTextEditor;

    // generate when document is made active
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            addAnnotations(editor);
        }
	}, null, context.subscriptions);

    // generate when the document is edited
    vscode.workspace.onDidChangeTextDocument(event => {
		if (activeEditor && event.document === activeEditor.document) {
            addAnnotations(activeEditor);
		}
	}, null, context.subscriptions);

	if (activeEditor) {
		addAnnotations(activeEditor);
	}
}

function clearAnnotations(editor) {
    if (editor === undefined || editor._disposed === true) {
        return;
    }
    editor.setDecorations(annotationDecoration, []);
}

function addAnnotations(editor) {
    if (editor === undefined || editor._disposed === true || editor.document === undefined) {
        return;
    }

    let parser = new DocumentParser(editor.document);
    const rules = parser.getRules();
    if (rules.length === 0) {
        return clearAnnotations(editor);
    }

    Promise.all(rules.map(rule => {
        return eslintManager.getRuleDetails(rule.name)
            .then(ruleInfo => {
                const contentText = getContentText(rule, ruleInfo);
                const hoverMessage = getHoverMessage(rule, ruleInfo);
                let decoration = getDecorationObject(contentText, hoverMessage);
                decoration.range = rule.eolRange;
                return decoration;
            });
    }))
        .then(decorations => {
            editor.setDecorations(annotationDecoration, decorations);
        })
        .catch(err => {
            console.log(err);
        });
}

function getContentText(rule, ruleInfo) {
    let contentText = '';

    if (rule.duplicate === true) {
        contentText += `${glyphs.plusInCircle} `;
    }

    if (ruleInfo.isPluginMissing) {
        contentText += `${glyphs.emptyIcon} Missing: \`${ruleInfo.pluginPackageName}\``;
    } else if (!ruleInfo.isRuleFound) {
        contentText += `${glyphs.magnifyIcon} Rule not found`;
    } else {
        if (ruleInfo.isRecommended === true) {
            contentText += `${glyphs.thumbsUpIcon} `;
        }

        if (ruleInfo.isDeprecated === true) {
            contentText += `${glyphs.NoEntryIcon} `;
        }

        if (ruleInfo.isFixable === true) {
            contentText += `${glyphs.wrenchIcon} `;
        }

        if (ruleInfo.category) {
            contentText += `[${ruleInfo.category}]:  `;
        }

        if (ruleInfo.description) {
            contentText += ruleInfo.description;
        } else {
            contentText += `eslint rule: ${ruleInfo.ruleName}`;
        }
    }

    return ` ${glyphs.dot} ${glyphs.dot} ${glyphs.dot} ${contentText}`;
}

function getHoverMessage(rule, ruleInfo) {
    let hoverMessage;
    if (ruleInfo.isPluginMissing) {
        hoverMessage = `**Missing plugin**: \`${ruleInfo.pluginName}\`\n`;

        if (rule.duplicate === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.plusInCircle}&nbsp;&nbsp;duplicate rule configuration\n`;
        }
    } else if (!ruleInfo.isRuleFound) {
        hoverMessage = `**Rule not found**: \`${ruleInfo.ruleName}\`\n`;

        if (rule.duplicate === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.plusInCircle}&nbsp;&nbsp;duplicate rule configuration\n`;
        }

        if (ruleInfo.suggestedRules && ruleInfo.suggestedRules.length > 0) {
            ruleInfo.suggestedRules.slice(0, 3).forEach(item => {
                let cmd = createReplaceTextCommand(item, rule.keyRange, item, `Click to replace rule with ${item}`);
                hoverMessage += `&nbsp;&nbsp;${glyphs.lightbulbIcon}&nbsp;&nbsp;did you mean ${cmd}\n`;
            });
        }
    } else {
        hoverMessage = `**${ruleInfo.ruleName}**`;
        if (ruleInfo.category) {
            hoverMessage += `&nbsp;&nbsp;&nbsp;\\[\`${ruleInfo.category}\`\\]`;
        }
        hoverMessage += '\n';

        if (rule.duplicate === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.plusInCircle}&nbsp;&nbsp;duplicate rule configuration\n`;
        }

        if (ruleInfo.isRecommended === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.thumbsUpIcon}&nbsp;&nbsp;recommended\n`;
        }

        if (ruleInfo.isFixable === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.wrenchIcon}&nbsp;&nbsp;fixable\n`;
        }

        if (ruleInfo.isDeprecated === true) {
            hoverMessage += `&nbsp;&nbsp;${glyphs.NoEntryIcon}&nbsp;&nbsp;deprecated\n`;
        }

        if (ruleInfo.replacedBy && ruleInfo.replacedBy.length > 0) {
            let replacedByRules = ruleInfo.replacedBy.map(item => {
                return createReplaceTextCommand(item, rule.keyRange, item, `Click to replace rule with ${item}`);
            });
            hoverMessage += `&nbsp;&nbsp;${glyphs.lightbulbIcon}&nbsp;&nbsp;replaced by ${replacedByRules.join(', ')}\n`;
        }

        if (ruleInfo.description) {
            hoverMessage += `\n---\n`;

            hoverMessage += `> ${ruleInfo.description}\n`;
        }
    }

    let openWebViewPanelCommandString = createOpenWebViewPanelCommand(`Click for more information`, ruleInfo.infoUrl, `${ruleInfo.infoPageTitle} - ${constants.extensionName}`);
    hoverMessage += `${nonBreakingPad('', 70)}\n\n---\n\n${openWebViewPanelCommandString}`;
    hoverMessage = hoverMessage.replace(/\n/g, '  \n');

    let markdown = new vscode.MarkdownString(hoverMessage);
    markdown.isTrusted = true;

    return markdown;
}

function nonBreakingPad(text, length) {
    let ret = text;
    for (let i = text.length; i <= length; i++) {
        ret += '&nbsp;';
    }
    return ret;
}

function createReplaceTextCommand(commandText, range, newText, tooltip = '') {
    let args = [
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character,
        newText
    ];

    return `[${commandText}](command:${constants.commands.replaceText}?${encodeURIComponent(JSON.stringify(args))} "${tooltip || 'Replace text'}")`;
}

function createOpenWebViewPanelCommand(text, url, title) {
    let args = {
        url,
        title
    };

    let textLink = `[${text}](command:${constants.commands.openWebViewPanel}?${encodeURIComponent(JSON.stringify(args))} "Open in VSCode")`;
    let glyphLink = `[\\\[${glyphs.arrowIcon}\\\]](command:${constants.commands.openInBrowser}?${encodeURIComponent(JSON.stringify(url))} "Open in browser")`;

    return `${textLink} ${glyphLink}`;
}

function getDecorationObject(contentText, hoverMessage) {
    return {
        hoverMessage,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        renderOptions: {
            after: {
                color: new vscode.ThemeColor('lintlens.annotationColor'),
                fontWeight: 'normal',
                fontStyle: 'normal',
                textDecoration: 'none',
                margin: '0',
                contentText
            }
        }
    };
}

module.exports = {
    initialize,
    addAnnotations,
    clearAnnotations
};
