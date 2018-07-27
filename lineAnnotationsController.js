const vscode = require('vscode');
const eslintManager = require('./eslintManager');

const starIcon = '\uD83D\uDC4D'; // recommended
const arrowIcon = '\u2197'; // link
const wrenchIcon = '\uD83D\uDD27'; // fixable
const NoEntryIcon = '\uD83D\uDEAB'; //deprecated
const emptyIcon = '\u2205'; // missing
const magnifyIcon = '\uD83D\uDD0E'; // not found

const annotationDecoration = vscode.window.createTextEditorDecorationType({
    after: {
        margin: '0 0 0 1em',
        color: '#999999',
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

function addAnnotations(editor, parser) {
    if (editor === undefined || editor._disposed === true || editor.document === undefined) {
        return;
    }

    const rules = parser(editor.document);
    if (rules.length === 0) {
        return clearAnnotations(editor);
    }

    Promise.all(rules.map(rule => {
        return eslintManager.getRuleDetails(rule.name)
            .then(ruleInfo => {
                const contentText = getContentText(ruleInfo);
                const hoverMessage = getHoverMessage(ruleInfo);
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

function getContentText(ruleInfo) {
    let contentText;
    if (ruleInfo.isPluginMissing) {
        contentText = `${emptyIcon} Missing: \`${ruleInfo.pluginPackageName}\``;
    } else if (!ruleInfo.isRuleFound) {
        contentText = `${magnifyIcon} Rule not found`;
    } else {
        contentText = '';
        if (ruleInfo.isRecommended === true) {
            contentText += `${starIcon} `;
        }

        if (ruleInfo.isDeprecated === true) {
            contentText += `${NoEntryIcon} `;
        }

        if (ruleInfo.isFixable === true) {
            contentText += `${wrenchIcon} `;
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

    return contentText;
}

function getHoverMessage(ruleInfo) {
    let hoverMessage;
    //TODO: pull out the app name
    let commandString = getCommandString(`Click for more information \[${arrowIcon}\]`, ruleInfo.infoUrl, `${ruleInfo.infoPageTitle} - LintLens`, 'Click for more information');
    if (ruleInfo.isPluginMissing) {
        /*
        Missing plugin: `{{ pluginName }}`

        [Click for more information `↗`](infoUrl)
        */
        hoverMessage = `${emptyIcon} Missing plugin: \`${ruleInfo.pluginName}\`\n\n${commandString}`;
    } else if (!ruleInfo.isRuleFound) {
        /*
        `{{ ruleName }}` not found

        [Click for more information `↗`](infoUrl)
        */
        hoverMessage = `${magnifyIcon} \`${ruleInfo.ruleName}\` not found\n\n${commandString}`;
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
        hoverMessage += '\n\n';

        if (ruleInfo.isRecommended === true) {
            hoverMessage += `- ${starIcon}&nbsp;&nbsp;recommended\n\n`;
        }

        if (ruleInfo.isFixable === true) {
            hoverMessage += `- ${wrenchIcon}&nbsp;&nbsp;fixable\n\n`;
        }

        if (ruleInfo.isDeprecated === true) {
            hoverMessage += `- ${NoEntryIcon}&nbsp;&nbsp;deprecated\n\n`;
        }

        if (ruleInfo.replacedBy) {
            hoverMessage += `- replaced by \`${ruleInfo.replacedBy}\`\n\n`;
        }

        if (ruleInfo.description) {
            hoverMessage += `\n---\n`;

            hoverMessage += `> ${ruleInfo.description}\n`;
            hoverMessage += `> ${nonBreakingPad('', 70)}\n`;

            hoverMessage += `\n---\n`;
        }

        hoverMessage += `\n${commandString}`;
    }

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

function getCommandString(text, url, pageTitle, tooltip = '') {
    let args = {
        url,
        pageTitle
    };

    return `[${text}](command:lintlens.openWebView?${encodeURIComponent(JSON.stringify(args))} "${tooltip || text}")`;
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
