const indentSize = 2;
let currentIndentCount = 0;


function indent() {
    currentIndentCount++;
}
function outdent() {
    currentIndentCount--;
}
function getIndent() {
    return ' '.repeat(indentSize * currentIndentCount);
}

// TODO: include deprecated flag
// TODO: consider moving requirements (array, object) to the top
// TODO: include annotations (title, description, maybe examples)
// TODO: consider changing comments starter from # to //
//   would need to change language things in lintlens


// TODO: do I support passing of state object?
//      this would solve the indent problem (indent doesn't clear on error - when moving to the next schema)

/*
Rules for functions:
    * never start with a newline
    * never start with an indent
    * never end with a newline
    * when a newline is used within, insert indent
    * when children are added, increase indent before and decrease after
*/


export function any(doc, formatFunc) {
    return 'any';
}

export function not(doc, formatFunc) {
    // TODO: NOT formatter

    return '';
}

export function nullvalue(doc, formatFunc) {
    return 'null';
}

export function object(doc, formatFunc) {
    if (doc.properties.length === 0 &&
        !doc.indexProperties &&
        (!doc.requirements || Object.keys(doc.requirements).length === 0)
    ) {
        return '{}';
    }

    let ret = '{\n';

    indent();

    try {
        const props = [];

        props.push(...doc.properties.map(property => {
            const prop = `${property.required ? '(required) ' : ''}"${property.key}": ${formatFunc(property.value)}`;
            return `${getIndent()}${prop}`;
        }));

        if (doc.indexProperties) {
            props.push(...doc.indexProperties.map(property => {
                const prop = `${property.required ? '(required) ' : ''}${property.key}: ${formatFunc(property.value)}`;
                return `${getIndent()}${prop}`;
            }));
        }

        ret += props.join(',\n');

        if (doc.requirements && Object.keys(doc.requirements).length > 0) {
            ret += '\n';
            ret += Object.values(doc.requirements).map(({ message }) => {
                return `${getIndent()}# ${message}`;
            }).join('\n');
        }
    } finally {
        outdent();
    }

    ret += `\n${getIndent()}}`;

    return ret;
}

export function tuple(doc, formatFunc) {
    // TODO: handle additionalItems in tuple
    // TODO: handle when tuple has additionalItems that is an array

    let ret = '[\n';

    indent();

    try {
        ret += doc.items.map(item => {
            const val = formatFunc(item);
            return `${getIndent()}${val}`;
        }).join(',\n');

        if (doc.requirements && Object.keys(doc.requirements).length > 0) {
            ret += '\n';
            ret += Object.values(doc.requirements).map(({ message }) => {
                return `${getIndent()}# ${message}`;
            }).join('\n');
        }
    } finally {
        outdent();
    }

    ret += `\n${getIndent()}]`;

    return ret;
}

export function array(doc, formatFunc) {
    // simple plain array
    if (!doc.schema && (!doc.requirements || Object.keys(doc.requirements).length === 0)) {
        return '[]';
    }

    let ret = '[\n';

    indent();

    try {
        ret += `${getIndent()}${formatFunc(doc.schema)}`;

        if (doc.requirements && Object.keys(doc.requirements).length > 0) {
            ret += '\n';
            ret += Object.values(doc.requirements).map(({ message }) => {
                return `${getIndent()}# ${message}`;
            }).join('\n');
        }
    } finally {
        outdent();
    }

    ret += `\n${getIndent()}]`;

    // TODO: consider basing this on doc.schema rather than the whole thing
    //  THOUGHT: then I could have `string[], // min items: 3, unique`

    // simple array of a type (simple, no requirements/annotations)
    //  TODO: can I use doc.schema.schemaType somehow?
    const regex = /\[\n\s+(\w+)\n\s+\]/;
    const matches = ret.match(regex);
    if (matches) {
        ret = `${matches[1]}[]`;
    }

    return ret;
}

export function enumeration(doc, formatFunc) {
    let ret = doc.items.map(item => getConstantText(item)).join(' | ');

    if (doc.default !== undefined) {
        ret += ` (default: ${getConstantText(doc.default)})`;
    }

    return ret;
}

export function constant(doc, formatFunc) {
    return getConstantText(doc.value);
}

export function string(doc, formatFunc) {
    let ret = 'string';

    if (doc.requirements !== undefined || doc.default !== undefined) {
        const mods = [];

        if (doc.requirements !== undefined) {
            mods.push(...Object.values(doc.requirements).map(req => req.message));
        }

        if (doc.default !== undefined) {
            mods.push(`default: "${doc.default}"`);
        }

        ret += ` (${mods.join(', ')})`;
    }

    return ret;
}

export function numeric(doc, formatFunc) {
    let ret = doc.numericType;

    if (doc.requirements !==undefined || doc.default !== undefined) {
        const mods = Object.values(doc.requirements).map(req => req.message);

        if (doc.default !== undefined) {
            mods.push(`default: ${doc.default}`);
        }

        ret += ` (${mods.join(', ')})`;
    }

    return ret;
}

export function boolean(doc, formatFunc) {
    let ret = 'boolean';

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

// TODO: should I do something different for anyOf vs oneOf?
export function anyOf(doc, formatFunc) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function oneOf(doc, formatFunc) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function allOf(doc, formatFunc) {
    // TODO: allOf formatter
    return doc.items.map(item => formatFunc(item)).join(' & ');
}

export function ifThenElse(doc, formatFunc) {
    let ret = `if (${formatFunc(doc.if)})`;

    indent();

    try {
        ret += `\n${getIndent()}then ${formatFunc(doc.then)})`;

        if (doc.else !== undefined) {
            ret += `\n${getIndent()}else ${formatFunc(doc.else)})`;
        }
    } finally {
        outdent();
    }

    return ret;
}

export function multiType(doc, formatFunc) {
    let ret = doc.types.join(' | ');

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

function getConstantText(text) {
    if (typeof text === 'string') {
        return `"${text}"`;
    }

    return text;
}
