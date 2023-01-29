// some code copied from eslint codebase
// https://github.com/eslint/eslint/blob/dd58cd4afa6ced9016c091fc99a702c97a3e44f0/lib/shared/ajv.js#L12

import Ajv from 'ajv';
import metaSchema from 'ajv/lib/refs/json-schema-draft-06.json';


const errorKeywordOrder = [
    // (one|any)Of decision has not been made
    'oneOf',
    'anyOf',

    // value is array or object ((one|any|all)Of choice has been made)
    'minProperties',
    'minItems',
    'maxProperties',
    'maxItems',
    'additionalProperties',
    'additionalItems',

    // very specific
    'type',
    'enum',
    'required',
    'pattern',
    'const',
    'minLength',
    'maxLength',
    'maximum',
    'minimum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'uniqueItems',
    'format',
    'contains',

    // TODO: think more about these
    'if',
    'not',
    'dependencies',
    'propertyNames',
    'items',
    'unevaluatedProperties',
    'unevaluatedItems',
    'dependentRequired',
    'discriminator',
];

// Ensures that unknown keywords (indexOf returns -1) sort lower than others
errorKeywordOrder.reverse();


const ajv = new Ajv({
    meta: false,
    useDefaults: true,
    validateSchema: false,
    missingRefs: "ignore",
    verbose: true,
    schemaId: "auto",
    strict: false,
    allErrors: true
});

ajv.addMetaSchema(metaSchema);
ajv.opts.defaultMeta = metaSchema.id;


export function validate(schema, data) {
    if (!ajv.validate(schema, data)) {
        const isSingleOptionValue = (typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.length === 1);
        const errors = getErrorMessages(ajv.errors, isSingleOptionValue);

        return {
            valid: false,
            errors
        };
    }

    return {
        valid: true
    };
}

function getErrorMessages(
    errors,
    isSingleOptionValue,
) {
    const basePath = 'options';
    const parsedErrors = parseErrors(errors);

    return parsedErrors.map((error) => {
        let path = basePath;
        if (!isSingleOptionValue || error.instancePath !== '/0') {
            const realPointer = isSingleOptionValue ? error.instancePath.split('/').slice(2).join('/') : `${basePath}${error.instancePath}`;
            path = realPointer.replace(/\/(\d+)/g, '[$1]').replace(/\/(\w+)/g, '.$1');
        }

        switch (error.keyword) {
            case 'anyOf':
            case 'oneOf': {
                return `${path} ${getOfMessage(error)}`;
            }
            case 'additionalProperties': {
                return `${path}.${error.params.additionalProperty} not allowed.`;
            }
            case 'enum': {
                const qualifier = error.params.allowedValues.length === 1 ? 'equal to' : 'one of the following:';
                const allowedList = error.params.allowedValues
                    .map(value => (typeof value === 'string' || value instanceof String) ? `"${value}"` : value)
                    .join(', ');

                return `${path} must be ${qualifier} ${allowedList}.`;
            }
            case 'type': {
                const type = error.params.type;
                if (Array.isArray(type)) {
                    if (type.length === 2) {
                        return `${path} must be ${type.join(' or ')}`;
                    }
                    return `${path}' must be one of the following: ${type.join(', ')}`;
                }

                return `${path} must be ${type}`;
            }
            case 'required': {
                return `${path} is missing property '${error.params.missingProperty}'`;
            }
            case 'const': {
                return `${path} must be equal to '${error.params.allowedValue}'`;
            }
            case 'minItems': {
                return `${path} must have at least ${error.params.limit} items`;
            }
            case 'minProperties': {
                return `${path} must have at least ${error.params.limit} properties`;
            }
            case 'minLength': {
                return `${path} must have at least ${error.params.limit} characters`;
            }

            default: {
                let message = error.message
                    .replaceAll('NOT', 'not')
                    .replaceAll('"', '\'');

                return `${path} ${message}`;
            }
        }
    });
};

function parseErrors(errors) {
    // TODO: find a less brute-force approach
    const tracker = new Map();

    for (const error of errors) {
        const existing = tracker.get(error.instancePath);

        if (existing) {
            existing.push(error);
            continue;
        }

        // If ancestor exists, replace with current
        const check = error.instancePath.split('/').slice(0, -1);
        while (check.length > 0) {
            const checkKey = check.join('/');
            if (tracker.has(checkKey)) {
                tracker.delete(checkKey);
                tracker.set(error.instancePath, [error]);
            }
            check.pop();
        }

        // If there are no deeper ones, insert current
        const foundLonger = Array.from(tracker.keys()).some(key => key.startsWith(`${error.instancePath}/`));
        if (!foundLonger) {
            tracker.set(error.instancePath, [error]);
        }
    }

    const ret = [];
    for (const list of Array.from(tracker.values())) {
        list.sort((a, b) => {
            const keywordA = errorKeywordOrder.indexOf(a.keyword);
            const keywordB = errorKeywordOrder.indexOf(b.keyword);

            return keywordB - keywordA || a.schemaPath.localeCompare(b.schemaPath);
        });
        const firstError = list.shift();
        const ln = firstError.schemaPath.length;

        const listTracker = new Map();

        for (const item of list) {
            const schemaOption = parseInt(item.schemaPath.substring(ln + 1).split('/')[0], 10);
            const keyword = errorKeywordOrder.indexOf(item.keyword);

            const existing = listTracker.get(schemaOption);
    
            if (!existing) {
                listTracker.set(schemaOption, item);
                continue;
            }
    
            // it exists... IF this type sorts higher than the existing one, replace it
            const keywordExisting = errorKeywordOrder.indexOf(existing.keyword);
            if (keyword > keywordExisting) {
                listTracker.set(schemaOption, item);
                item.otherErrors = item.otherErrors ?? [];
                item.otherErrors.push(existing);
            } else {
                existing.otherErrors = existing.otherErrors ?? [];
                existing.otherErrors.push(item);
            }
        }

        firstError.otherErrors = Array.from(listTracker.values());

        ret.push(firstError);
    }

    ret.sort((a, b) => a.instancePath.localeCompare(b.instancePath));

    return ret;
}

function getOfMessage(error) {
    if (!['anyOf', 'oneOf'].includes(error.keyword)) {
        return 'must match schema';
    }

    let seenBe = false;
    function beOrNot() {
        const ret = seenBe ? '' : 'be ';
        seenBe = true;
        return ret;
    }

    try {
        const messageParts = error.otherErrors?.map(otherError => {
            switch (otherError.keyword) {
                case 'maxItems':
                case 'additionalItems':
                    return `not have more than ${otherError.params.limit} items`;
                case 'minItems':
                    return `not have less than ${otherError.params.limit} items`;
                case 'maxProperties':
                    return `not have more than ${otherError.params.limit} properties`;
                case 'minProperties':
                    return `not have less than ${otherError.params.limit} properties`;
                case 'additionalProperties':
                    return `not include "${otherError.params.additionalProperty}"`;
                case 'maximum':
                case 'minimum':
                case 'exclusiveMaximum':
                case 'exclusiveMinimum': {
                    const message = `${beOrNot()}${otherError.params.comparison} ${otherError.params.limit}`;
                    seenBe = true;
                    return message;
                }
                case 'multipleOf': {
                    const message = `${beOrNot()}a multiple of ${otherError.params.multipleOf}`;
                    seenBe = true;
                    return message;
                }
                case 'type': {
                    const type = otherError.params.type;
                    const message = `${beOrNot()}${Array.isArray(type) ? type.join(' or ') : type}`;
                    seenBe = true;
                    return message;
                }
                case 'enum': {
                    const allowedList = otherError.params.allowedValues
                        .map(value => (typeof value === 'string' || value instanceof String) ? `"${value}"` : value)
                        .join(', ');
                    const beWhat = otherError.params.allowedValues.length === 1 ? allowedList : `one of the following: ${allowedList}`;
                    const message = `${beOrNot()}${beWhat}`;
                    seenBe = true;
                    return message;
                }
                case 'required':
                    return `include '${otherError.params.missingProperty}'`;
                case 'pattern':
                    return `match pattern '${otherError.params.pattern}'`;
                case 'const': {
                    const message = `${beOrNot()} '${otherError.params.allowedValue}'`;
                    seenBe = true;
                    return message;
                }
                case 'minLength': {
                    const message = `${beOrNot()}at least ${otherError.params.limit} characters`;
                    seenBe = true;
                    return message;
                }
                case 'maxLength': {
                    const message = `${beOrNot()}no more than ${otherError.params.limit} characters`;
                    seenBe = true;
                    return message;
                }
                case 'uniqueItems': {
                    const message = `${beOrNot()}unique`;
                    seenBe = true;
                    return message;
                }
                case 'format':
                    return `match format ${otherError.params.format}`;
                default:
                    throw new Error('');
            }
        }) ?? ['match one of the schema options'];

        return `must ${messageParts.join(' or ')}`;
    } catch(err) {
        return 'must match one of the schema options';
    }
}
