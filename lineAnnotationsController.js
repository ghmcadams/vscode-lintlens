const vscode = require('vscode');
const jsonParser = require('./parsers/jsonParser');
const jsParser = require('./parsers/jsParser');
const yamlParser = require('./parsers/yamlParser');
const pkgParser = require('./parsers/pkgParser');
const eslintManager = require('./eslintManager');
const constants = require('./constants');

const glyphs = constants.glyphs;

const annotationDecoration = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('lintlens.annotationColor'),
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none'
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
});

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

    const rules = parser(editor.document);
    if (rules.length === 0) {
        return clearAnnotations(editor);
    }

    Promise.all(rules.map(rule => {
        return eslintManager.getRuleDetails(rule.name)
            .then(ruleInfo => {
                const contentText = getContentText(rule, ruleInfo);
                const hoverMessage = getHoverMessage(rule, ruleInfo);
                let decoration = getDecorationObject(contentText, hoverMessage);
                decoration.range = rule.lineEndingRange;
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
    let contentText;
    if (ruleInfo.isPluginMissing) {
        contentText = `${glyphs.emptyIcon} Missing: \`${ruleInfo.pluginPackageName}\``;
    } else if (!ruleInfo.isRuleFound) {
        contentText = `${glyphs.magnifyIcon} Rule not found`;
    } else {
        contentText = '';
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
        /*
        Missing plugin: `{{ pluginName }}`

        [Click for more information `↗`](infoUrl)
        */
        hoverMessage = `**Missing plugin**: \`${ruleInfo.pluginName}\`\n`;
    } else if (!ruleInfo.isRuleFound) {
        /*
        `{{ ruleName }}` not found
        [[ "did you mean" {{ suggestion(s) }} ]]

        [Click for more information `↗`](infoUrl)
        */
        // ruleInfo.suggestedRules
        hoverMessage = `**Rule not found**: \`${ruleInfo.ruleName}\`\n`;

        if (ruleInfo.suggestedRules && ruleInfo.suggestedRules.length > 0) {
            ruleInfo.suggestedRules.slice(0, 3).forEach(item => {
                let cmd = createReplaceTextCommand(item, rule.keyRange, item, `Click to replace rule with ${item}`);
                hoverMessage += `&nbsp;&nbsp;${glyphs.lightbulbIcon}&nbsp;&nbsp;did you mean ${cmd}\n`;
            });
        }
    } else {
        /*
        [ {{ category }} ] {{ ruleName }}
        [[ {{ star }} "recommended" ]]
        [[ {{ wrench }} "fixable" ]]
        [[ {{ skull }} "deprecated" ]]
        [[ "replaced by" {{ double arrow }} {{ replacedBy }} ]]

        > {{ description }}

        [Click for more information `↗`](infoUrl)
        */

        hoverMessage = `**${ruleInfo.ruleName}**`;
        if (ruleInfo.category) {
            hoverMessage += `&nbsp;&nbsp;&nbsp;\\[\`${ruleInfo.category}\`\\]`;
        }
        hoverMessage += '\n';

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

    let openWebViewPanelCommandString = createOpenWebViewPanelCommand(`Click for more information \[${glyphs.arrowIcon}\]`, ruleInfo.infoUrl, `${ruleInfo.infoPageTitle} - ${constants.extensionName}`, 'Click for more information');
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

    return `[${commandText}](command:${constants.replaceTextCommand}?${encodeURIComponent(JSON.stringify(args))} "${tooltip || 'Replace text'}")`;
}

function createOpenWebViewPanelCommand(text, url, pageTitle, tooltip = '') {
    let args = {
        url,
        pageTitle
    };

    return `[${text}](command:${constants.openWebViewPanelCommand}?${encodeURIComponent(JSON.stringify(args))} "${tooltip || 'Click here'}")`;
}

function getDecorationObject(contentText, hoverMessage) {
    return {
        hoverMessage,
        renderOptions: {
            after: {
                contentText
            }
        }
    };
}

module.exports = {
    addAnnotations,
    clearAnnotations
};
