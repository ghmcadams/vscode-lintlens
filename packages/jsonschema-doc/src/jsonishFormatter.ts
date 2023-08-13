import {
    AllOfSchemaDoc,
    AnyOfSchemaDoc,
    ArraySchemaDoc,
    BaseFormatFunction,
    BooleanSchemaDoc,
    ConstantSchemaDoc,
    EnumerationSchemaDoc,
    ExternalRefSchemaDoc,
    IfThenElseSchemaDoc,
    MultiTypeSchemaDoc,
    NotSchemaDoc,
    NumericSchemaDoc,
    ObjectSchemaDoc,
    OneOfSchemaDoc,
    StringSchemaDoc,
    TupleSchemaDoc,
    Value,
} from "./types";

const indentSize = 2;


interface FormatterState {
    currentIndentCount: number;
}


function indent(state: FormatterState) {
    state.currentIndentCount++;
}
function outdent(state: FormatterState) {
    state.currentIndentCount--;
}
function getIndent(state: FormatterState) {
    return ' '.repeat(indentSize * state.currentIndentCount);
}


/*
Rules for functions:
    * never start with a newline
    * never start with an indent
    * never end with a newline
    * when a newline is used within, insert indent
    * when children are added, increase indent before and decrease after
*/


export function getInitialState(): FormatterState {
    return {
        currentIndentCount: 0,
    };
}

export function externalRef(doc: ExternalRefSchemaDoc) {
    return `<Unknown: external schema (${doc.baseUri}${doc.baseUri.endsWith('/') ? '' : '/'}${doc.reference})>`;
}

export function empty() {
    return '';
}

export function any() {
    return 'any';
}

export function not(doc: NotSchemaDoc, formatFunc: BaseFormatFunction) {
    // TODO: NOT formatter
    return `! ${formatFunc(doc.schema)}`;
}

export function nullvalue() {
    return 'null';
}

export function object(doc: ObjectSchemaDoc, formatFunc: BaseFormatFunction, state: FormatterState) {
    // TODO: deprecated/description for objects (when NOT an item in an array/tuple)
    let ret = '{\n';

    indent(state);

    let innards = '';

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        innards += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent(state)}// ${message}`;
        }).join('\n');

        innards += '\n\n';
    }

    const props: string[] = [];

    props.push(...doc.properties.map(property => {
        const propEntry: string[] = [];

        if ('deprecated' in property.value && property.value.deprecated === true) {
            propEntry.push(`${getIndent(state)}// deprecated`);
        }

        if ('annotations' in property.value) {
            const description = property.value?.annotations?.description ?? '';
            if (description.length > 0) {
                propEntry.push(...description.split('\n').map(line => `${getIndent(state)}// ${line}`));
            }
        }
        const prop = `${property.required ? '(required) ' : ''}"${property.key}": ${formatFunc(property.value)}`;
        propEntry.push(`${getIndent(state)}${prop}`);

        return propEntry.join('\n');
    }));

    if (doc.indexProperties) {
        props.push(...doc.indexProperties.map(property => {
            const propEntry: string[] = [];

            if ('deprecated' in property.value && property.value.deprecated === true) {
                propEntry.push(`${getIndent(state)}// deprecated`);
            }

            if ('annotations' in property.value) {
                const description = property.value.annotations?.description ?? '';
                if (description.length > 0) {
                    propEntry.push(...description.split('\n').map(line => `${getIndent(state)}// ${line}`));
                }
            }
            const prop = `${property.required ? '(required) ' : ''}${property.key}: ${formatFunc(property.value)}`;
            propEntry.push(`${getIndent(state)}${prop}`);
    
            return propEntry.join('\n');
        }));
    }

    innards += props.join(',\n');

    // TODO: default for objects

    if (innards !== '') {
        ret += innards;
    } else {
        ret += `${getIndent(state)}[string]: any`;
    }

    outdent(state);

    ret += `\n${getIndent(state)}}`;

    return ret;
}

export function tuple(doc: TupleSchemaDoc, formatFunc: BaseFormatFunction, state: FormatterState) {
    // TODO: deprecated/description for tuples (when NOT the value of an object param)
    let ret = '[\n';

    indent(state);

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        ret += Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent(state)}// ${message}`;
        }).join('\n');

        ret += '\n';
    }

    ret += doc.items.map(item => {
        const itemEntry: string[] = [];

        if ('deprecated' in item && item.deprecated === true) {
            itemEntry.push(`${getIndent(state)}// deprecated`);
        }

        if ('annotations' in item) {
            const description = item.annotations?.description ?? '';
            if (description.length > 0) {
                itemEntry.push(...description.split('\n').map(line => `${getIndent(state)}// ${line}`));
            }
        }
        const val = formatFunc(item);
        itemEntry.push(`${getIndent(state)}${val}`);

        return itemEntry.join('\n');
    }).join(',\n');

    if (doc.additionalItems !== undefined) {
        if (doc.items) {
            ret += ',\n';
        }
        if ('deprecated' in doc.additionalItems && doc.additionalItems.deprecated === true) {
            ret += `${getIndent(state)}// deprecated\n`;
        }
        if ('annotations' in doc.additionalItems) {
            doc.additionalItems.annotations?.description?.split('\n').forEach(line => {
                ret += `${getIndent(state)}// ${line}\n`;
            });
        }
        ret += `${getIndent(state)}...${formatFunc(doc.additionalItems)}`;
    }

    // TODO: default for tuples

    outdent(state);

    ret += `\n${getIndent(state)}]`;

    return ret;
}

export function array(doc: ArraySchemaDoc, formatFunc: BaseFormatFunction, state: FormatterState) {
    // TODO: deprecated/description for arrays (when NOT the value of an object param)


    const parts: string[] = [];

    indent(state);

    if ('deprecated' in doc.schema && doc.schema.deprecated === true) {
        parts.push(`${getIndent(state)}// deprecated`);
    }
    if ('annotations' in doc.schema && doc.schema.annotations?.description) {
        parts.push(...doc.schema.annotations.description.split('\n').map(line => `${getIndent(state)}// ${line}`));
    }

    if (doc.requirements && Object.keys(doc.requirements).length > 0) {
        parts.push(...Object.values(doc.requirements).map(({ message }) => {
            return `${getIndent(state)}// ${message}`;
        }));
    }

    const schemaText = formatFunc(doc.schema);
    parts.push(`${getIndent(state)}...${schemaText}`);

    // TODO: default for arrays

    outdent(state);

    // simple array of a type
    if (parts.length === 1 && schemaText.length <= 15) {
        return `${schemaText}[]`;
    }

    return `[\n${parts.join('\n')}\n${getIndent(state)}]`;
}

export function enumeration(doc: EnumerationSchemaDoc, _: BaseFormatFunction, state: FormatterState) {
    let ret = doc.values.map(value => getConstantText(value, state)).join(' | ');

    if (doc.default !== undefined) {
        ret += ` (default: ${getConstantText(doc.default, state)})`;
    }

    return ret;
}

export function constant(doc: ConstantSchemaDoc, _: BaseFormatFunction, state: FormatterState) {
    return getConstantText(doc.value, state);
}

export function string(doc: StringSchemaDoc) {
    let ret = 'string';

    if (doc.requirements !== undefined || doc.default !== undefined) {
        const mods: string[] = [];

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

export function numeric(doc: NumericSchemaDoc) {
    let ret = doc.numericType;

    if (doc.requirements !==undefined || doc.default !== undefined) {
        const mods: string[] = [];

        if (doc.requirements !== undefined) {
            mods.push(...Object.values(doc.requirements).map(req => req.message));
        }

        if (doc.default !== undefined) {
            mods.push(`default: ${doc.default}`);
        }

        ret += ` (${mods.join(', ')})`;
    }

    return ret;
}

export function boolean(doc: BooleanSchemaDoc) {
    let ret = 'boolean';

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

export function anyOf(doc: AnyOfSchemaDoc, formatFunc: BaseFormatFunction) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function oneOf(doc: OneOfSchemaDoc, formatFunc: BaseFormatFunction) {
    return doc.items.map(item => formatFunc(item)).join(' | ');
}

export function allOf(doc: AllOfSchemaDoc, formatFunc: BaseFormatFunction) {
    return doc.items.map(item => formatFunc(item)).join(' & ');
}

export function ifThenElse(doc: IfThenElseSchemaDoc, formatFunc: BaseFormatFunction, state: FormatterState) {
    let ret = `if (${formatFunc(doc.if)})`;

    indent(state);

    if (doc.then !== undefined) {
        ret += `\n${getIndent(state)}then ${formatFunc(doc.then)})`;
    }

    if (doc.else !== undefined) {
        ret += `\n${getIndent(state)}else ${formatFunc(doc.else)})`;
    }

    outdent(state);

    return ret;
}

export function multiType(doc: MultiTypeSchemaDoc) {
    let ret = doc.types.join(' | ');

    if (doc.default !== undefined) {
        ret += ` (default: ${doc.default})`;
    }

    return ret;
}

export function invalid() {
    return '<Unknown: invalid schema>';
}

function getConstantText(value: Value, state: FormatterState) {
    const stringifiedValue = JSON.stringify(value, null, indentSize);
    const indentedValue = stringifiedValue.replace(/\n/gi, `\n${getIndent(state)}`);

    return indentedValue;
}
