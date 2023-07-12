import * as jsonishFormatter from './jsonishFormatter';


const schemaTypes = {
    any: 'any',
    not: 'not',
    nullvalue: 'nullvalue',
    object: 'object',
    array: 'array',
    tuple: 'tuple',
    enumeration: 'enumeration',
    constant: 'constant',
    string: 'string',
    numeric: 'numeric',
    boolean: 'boolean',
    anyOf: 'anyOf',
    oneOf: 'oneOf',
    allOf: 'allOf',
    ifThenElse: 'ifThenElse',
    multiType: 'multiType',
    invalid: 'invalid',
    empty: 'empty',
    ref: 'ref',
    externalRef: 'externalRef',
};


export function getSchemaDocumentation(schema, formatter = jsonishFormatter) {
    let doc;

    try {
        doc = getSchemaDoc({ schema });
    } catch(err) {
        doc = getInvalidDoc({ schema, root: schema });
    }

    if (formatter !== null) {
        return formatDoc(formatter, doc);
    }

    return doc;
}

function getSchemaDoc({ schema, root = schema }) {
    if (!schema) {
        return getEmptyDoc({ schema, root });
    }

    const schemaType = getSchemaType(schema);

    const annotations = getAnnotations(schema);
    let doc;

    switch (schemaType) {
        case schemaTypes.object:
            doc = getObjectDoc({ schema, root });
            break;
        case schemaTypes.array:
            doc = getArrayDoc({ schema, root });
            break;
        case schemaTypes.anyOf:
        case schemaTypes.oneOf:
            doc = getOneOfDoc({ schema, root });
            break;
        case schemaTypes.allOf:
            doc = getAllOfDoc({ schema, root });
            break;
        case schemaTypes.multiType:
            doc = getMultiTypeDoc({ schema, root });
            break;
        case schemaTypes.enumeration:
            doc = getEnumDoc({ schema, root });
            break;
        case schemaTypes.string:
            doc = getStringDoc({ schema, root });
            break;
        case schemaTypes.numeric:
            doc = getNumericDoc({ schema, root });
            break;
        case schemaTypes.boolean:
            doc = getBooleanDoc({ schema, root });
            break;
        case schemaTypes.constant:
            doc = getConstDoc({ schema, root });
            break;
        case schemaTypes.any:
            doc = getAnyDoc({ schema, root });
            break;
        case schemaTypes.not:
            doc = getNotDoc({ schema, root });
            break;
        case schemaTypes.nullvalue:
            doc = getNullDoc({ schema, root });
            break;
        case schemaTypes.ifThenElse:
            doc = getIfThenElseDoc({ schema, root });
            break;
        case schemaTypes.empty:
            doc = getEmptyDoc({ schema, root });
            break;
        case schemaTypes.ref:
        case schemaTypes.externalRef:
            doc = getRefDoc({ schema, root });
            break;
        case schemaTypes.invalid:
        default:
            doc = getInvalidDoc({ schema, root });
            break;
    }

    return {
        ...doc,
        ...annotations,
    };
}


function getRefDoc({ schema, root }) {
    // https://json-schema.org/understanding-json-schema/structuring.html#ref

    if (schema.$ref[0] !== '#') {
        return {
            schemaType: schemaTypes.externalRef,
            baseUri: root.$id,
            reference: schema.$ref,
        };
    }

    const ref = getRef(root, schema.$ref);

    return getSchemaDoc({ schema: ref, root });
}

function getEmptyDoc({ schema, root }) {
    return {
        schemaType: schemaTypes.empty,
        schema,
    };
}

function getAnyDoc({ schema, root }) {
    return {
        schemaType: schemaTypes.any,
    };
}

function getNullDoc({ schema }) {
    return {
        schemaType: schemaTypes.nullvalue,
    };
}

function getMultiTypeDoc({ schema, root }) {
    // Allows requirements on other type
    if (schema.type.length === 2 && schema.type.includes('null')) {
        return getSchemaDoc({ schema: {
            oneOf: [
                {
                    ...schema,
                    type: schema.type.find(i => i !== 'null')
                },
                { type: "null" }
            ]
        }, root })
    }

    return {
        schemaType: schemaTypes.multiType,
        types: schema.type,
    };
}

function getEnumDoc({ schema }) {
    return {
        schemaType: schemaTypes.enumeration,
        values: schema.enum,
    };
}

function getConstDoc({ schema }) {
    return {
        schemaType: schemaTypes.constant,
        value: schema.const,
    };
}

function getObjectDoc({ schema, root }) {
    // https://json-schema.org/understanding-json-schema/reference/object.html

    //TODO: dependencies
    //   dependentRequired - { property: ["otherProperty"] } conditionally requires that certain properties must be present if a given property is present in an object
    //       https://json-schema.org/understanding-json-schema/reference/conditionals.html#dependentrequired
    //   dependentSchemas - { property: { ...otherSchema } } conditionally applies a subschema when a given property is present
    //       https://json-schema.org/understanding-json-schema/reference/conditionals.html#dependentschemas

    // TODO: does if/then/else apply only to objects?
    //       https://json-schema.org/understanding-json-schema/reference/conditionals.html#if-then-else

    const ret = {
        schemaType: schemaTypes.object,
        properties: [],
    };

    if (schema.hasOwnProperty('properties')) {
        const requiredKeys = schema.required || [];
        const properties = Object.entries(schema.properties).map(([key, value]) => {
            return {
                key,
                required: requiredKeys.includes(key),
                value: getSchemaDoc({ schema: value, root }),
            };
        });
        ret.properties.push(...properties);
    }

    // separate other property types (to represent as index properties) so that they can be formatted differently
    if (schema.hasOwnProperty('patternProperties') || schema.hasOwnProperty('additionalProperties')) {
        ret.indexProperties = [];

        if (schema.hasOwnProperty('patternProperties')) {
            const patternProperties = Object.entries(schema.patternProperties).map(([key, value]) => {
                return {
                    key: `[/${key}/]`,
                    required: false,
                    value: getSchemaDoc({ schema: value, root }),
                };
            });
            ret.indexProperties.push(...patternProperties);
        }

        if (schema.hasOwnProperty('additionalProperties') || schema.hasOwnProperty('unevaluatedProperties')) {
            const additionalProperties = schema.additionalProperties ?? schema.unevaluatedProperties;
            if (getType(additionalProperties) === 'boolean') {
                if (additionalProperties === true) {
                    ret.indexProperties.push({
                        key: '[string]',
                        required: false,
                        value: getSchemaDoc({ schema: {}, root }),
                    });
                }
            } else {
                ret.indexProperties.push({
                    key: '[string]',
                    required: false,
                    value: getSchemaDoc({ schema: additionalProperties, root }),
                });
            }
        } else {
            ret.indexProperties.push({
                key: '[string]',
                required: false,
                value: getSchemaDoc({ schema: {}, root }),
            });
        }
    }

    const requirements = {};

    if (schema.hasOwnProperty('minProperties') || schema.hasOwnProperty('maxProperties')) {
        requirements.size = {
            minProperties: schema.minProperties,
            maxProperties: schema.maxProperties,
            message: '',
        };

        if (schema.hasOwnProperty('minProperties') && schema.hasOwnProperty('maxProperties') &&
            schema.minProperties > 0 && schema.maxProperties > 0
        ) {
            if (schema.minProperties === schema.maxProperties) {
                requirements.size.message = `required: ${schema.minProperties} ${schema.minProperties === 1 ? 'property' : 'properties'}`;
            } else {
                requirements.size.message = `required: ${schema.minProperties} to ${schema.maxProperties} properties`;
            }
        } else if (schema.hasOwnProperty('minProperties') && schema.minProperties > 0) {
            requirements.size.message = `min properties: ${schema.minProperties}`;
        } else if (schema.hasOwnProperty('maxProperties') && schema.maxProperties > 0) {
            requirements.size.message = `max properties: ${schema.maxProperties}`;
        }
    }

    if (schema.hasOwnProperty('propertyNames')) {
        requirements.propertyNames = {
            ...schema.propertyNames,
            message: '',
        };

        const messageParts = [];
        if (schema.propertyNames.hasOwnProperty('minLength') || schema.propertyNames.hasOwnProperty('maxLength')) {
            if (!schema.propertyNames.hasOwnProperty('minLength')) {
                messageParts.push(`length: ≤ ${schema.propertyNames.maxLength}`);
            } else if (!schema.propertyNames.hasOwnProperty('maxLength')) {
                messageParts.push(`length: ≥ ${schema.propertyNames.minLength}`);
            } else {
                messageParts.push(`length: ${schema.propertyNames.minLength} to ${schema.propertyNames.maxLength}`);
            }
        }

        if (schema.propertyNames.hasOwnProperty('pattern')) {
            messageParts.push(`regex: /${schema.propertyNames.pattern}/`);
        }

        if (schema.propertyNames.hasOwnProperty('format')) {
            messageParts.push(`format: ${schema.propertyNames.format}`);
        }

        requirements.propertyNames.message = `Property names: ${messageParts.join(', ')}`;
    }

    if (Object.keys(requirements).length > 0) {
        ret.requirements = requirements;
    }

    return ret;
}

function getArrayDoc({ schema, root }) {
    // https://json-schema.org/understanding-json-schema/reference/array.html

    if (Object.keys(schema).length == 1 && schema.hasOwnProperty('type')) {
        return {
            schemaType: schemaTypes.array,
            schema: getSchemaDoc({ schema: {}, root }),
        };
    }

    const ret = {};

    // In Draft 4 - 2019-09, tuple validation was handled by an alternate form of the items keyword
    //       When items was an array of schemas instead of a single schema, it behaved the way prefixItems behaves.
    //  translation: if `items` is an array, then it is a tuple
    if (Array.isArray(schema) ||
        schema.hasOwnProperty('prefixItems') ||
        (
            !schema.hasOwnProperty('prefixItems') &&
            schema.hasOwnProperty('items') &&
            Array.isArray(schema.items)
        )
    ) {
        ret.schemaType = schemaTypes.tuple;

        const tupleItems = Array.isArray(schema)
            ? schema
            : schema.prefixItems ?? schema.items;
        const additionalItems = schema.hasOwnProperty('prefixItems')
            ? schema.additionalItems ?? schema.items
            : schema.additionalItems;

        ret.items = tupleItems.map(item => getSchemaDoc({ schema: item, root }));

        if (additionalItems !== undefined) {
            if (getType(additionalItems) === 'boolean') {
                if (additionalItems === true) {
                    ret.additionalItems = getSchemaDoc({ schema: {}, root });
                }
            } else {
                ret.additionalItems = getSchemaDoc({ schema: additionalItems, root });
            }
        }
    } else {
        // TODO: do I need to do this for other things (like object, numeric, etc.)?
        const arrayItems = schema.items ?? schema.anyOf ?? schema.oneOf ?? schema.allOf;

        ret.schemaType = schemaTypes.array;
        ret.schema = getSchemaDoc({ schema: arrayItems, root });
    }

    // TODO: contains
    // While the items schema must be valid for every item in the array, the contains schema only needs to validate against one or more items in the array.
    // minContains and maxContains can be used with contains to further specify how many times a schema matches a contains constraint (>= 0).
    // idea: treat contains like additionalItems: any (contains, then that)


    const requirements = {};

    if ((schema.hasOwnProperty('minItems') || schema.hasOwnProperty('maxItems')) &&
        (schema.minItems > 0 || schema.maxItems > 0)
    ) {
        requirements.length = {
            minItems: schema.minItems,
            maxItems: schema.maxItems,
            message: '',
        };

        if (schema.hasOwnProperty('minItems') && schema.hasOwnProperty('maxItems') &&
            schema.minItems > 0 && schema.maxItems > 0
        ) {
            if (schema.minItems === schema.maxItems) {
                requirements.length.message = `required: ${schema.minItems} ${schema.minItems === 1 ? 'item' : 'items'}`;
            } else {
                requirements.length.message = `required: ${schema.minItems} to ${schema.maxItems} items`;
            }
        } else if (schema.hasOwnProperty('minItems') && schema.minItems > 0) {
            requirements.length.message = `min items: ${schema.minItems}`;
        } else if (schema.hasOwnProperty('maxItems') && schema.maxItems > 0) {
            requirements.length.message = `max items: ${schema.maxItems}`;
        }
    }

    if (schema.hasOwnProperty('uniqueItems') && schema.uniqueItems === true) {
        requirements.uniqueItems = {
            value: schema.uniqueItems,
            message: 'unique',
        };
    }

    if (Object.keys(requirements).length > 0) {
        ret.requirements = requirements;
    }

    return ret;
}

function getStringDoc({ schema }) {
    const ret = {
        schemaType: schemaTypes.string,
    };

    const requirements = {};

    if (schema.hasOwnProperty('minLength') || schema.hasOwnProperty('maxLength')) {
        requirements.length = {
            minLength: schema.minLength,
            maxLength: schema.maxLength,
            message: '',
        };

        if (!schema.hasOwnProperty('minLength')) {
            requirements.length.message = `length: ≤ ${schema.maxLength}`;
        } else if (!schema.hasOwnProperty('maxLength')) {
            requirements.length.message = `length: ≥ ${schema.minLength}`;
        } else {
            requirements.length.message = `length: ${schema.minLength} to ${schema.maxLength}`;
        }
    }

    if (schema.hasOwnProperty('pattern')) {
        requirements.pattern = {
            value: schema.pattern,
            message: `regex: /${schema.pattern}/`,
        };
    }

    if (schema.hasOwnProperty('format')) {
        requirements.format = {
            value: schema.format,
            message: `format: ${schema.format}`,
        };
    }

    if (Object.keys(requirements).length > 0) {
        ret.requirements = requirements;
    }

    return ret;
}

function getNumericDoc({ schema }) {
    const ret = {
        schemaType: schemaTypes.numeric,
        numericType: schema.type, // may be integer, number
    };

    const requirements = {};

    if (schema.hasOwnProperty('minimum') || schema.hasOwnProperty('exclusiveMinimum') || schema.hasOwnProperty('maximum') || schema.hasOwnProperty('exclusiveMaximum')) {
        requirements.range = {
            minimum: schema.minimum,
            maximum: schema.maximumn,
            exclusiveMinimum: schema.exclusiveMinimum,
            exclusiveMaximum: schema.exclusiveMaximum,
            message: '',
        };

        const messages = [];

        if (schema.hasOwnProperty('minimum')) {
            messages.push(`x ≥ ${schema.minimum}`);
        } else if (schema.hasOwnProperty('exclusiveMinimum')) {
            messages.push(`x > ${schema.exclusiveMinimum}`);
        }

        if (schema.hasOwnProperty('maximum')) {
            messages.push(`x ≤ ${schema.maximum}`);
        } else if (schema.hasOwnProperty('exclusiveMaximum')) {
            messages.push(`x < ${schema.exclusiveMaximum}`);
        }

        requirements.range.message = messages.join(', ');
    }

    if (schema.hasOwnProperty('multipleOf')) {
        requirements.multipleOf = {
            value: schema.multipleOf,
            message: `multiple of: ${schema.multipleOf}`,
        };
    }

    if (Object.keys(requirements).length > 0) {
        ret.requirements = requirements;
    }

    return ret;
}

function getBooleanDoc({ schema }) {
    return {
        schemaType: schemaTypes.boolean,
    };
}

function getOneOfDoc({ schema, root }) {
    // https://json-schema.org/understanding-json-schema/reference/combining.html

    const { anyOf, oneOf, ...rest } = schema;
    const anyOrOneOf = anyOf ?? oneOf;
    const schemaType = anyOf ? schemaTypes.anyOf : schemaTypes.oneOf;

    return {
        schemaType,
        items: anyOrOneOf.map((item) => {
            const combinedItem = {
                ...rest,
                ...item
            };
            return getSchemaDoc({ schema: combinedItem, root });
        }),
    };
}

function getAllOfDoc({ schema, root }) {
    const { allOf, ...rest } = schema;

    return {
        schemaType: schemaTypes.allOf,
        items: allOf.map((item) => {
            const combinedItem = {
                ...rest,
                ...item
            };
            return getSchemaDoc({ schema: combinedItem, root });
        }),
    };
}

function getNotDoc({ schema, root }) {
    // TODO: handle NOTs (might exist inside of something else)
    const { not, ...rest } = schema;
    const adjustedSchema = { ...rest, ...not };

    return {
        schemaType: schemaTypes.not,
        schema: getSchemaDoc({ schema: adjustedSchema, root }),
    };
}

function getIfThenElseDoc({ schema, root }) {
    if (!schema.hasOwnProperty('if')) {
        return getInvalidDoc({ schema, root });
    }

    if (!schema.hasOwnProperty('then') && !schema.hasOwnProperty('else')) {
        return getAnyDoc({ schema, root });
    }

    const ret = {
        schemaType: schemaTypes.ifThenElse,
        if: getSchemaDoc({ schema: schema.if, root }),
    };

    if (schema.hasOwnProperty('then')) {
        ret.then = getSchemaDoc({ schema: schema.then, root });
    } else {
        ret.then = getAnyDoc({ schema, root });
    }

    if (schema.hasOwnProperty('else')) {
        ret.else = getSchemaDoc({ schema: schema.else, root });
    } else {
        ret.else = getAnyDoc({ schema, root });
    }

    return ret;
}

function getInvalidDoc({ schema, root }) {
    return {
        schemaType: schemaTypes.invalid,
        schema,
    };
}


function getType(variable) {
    return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
}

function getSchemaType(schema = {}) {
    if (schema.hasOwnProperty('$ref')) {
        return schemaTypes.ref;
    }

    const varType = getType(schema);

    if (!['object', 'array'].includes(varType)) {
        return schemaTypes.invalid;
    }

    if (varType === 'array') {
        if (schema.length === 0) {
            return schemaTypes.empty;
        }
        return schemaTypes.array;
    }

    if (Object.keys(schema).length === 0) {
        return schemaTypes.any;
    }

    if (schema.hasOwnProperty('const')) {
        return schemaTypes.constant;
    }

    if (Array.isArray(schema.type)) {
        return schemaTypes.multiType;
    }

    if (schema.hasOwnProperty('type') && schema.type === "null") {
        return schemaTypes.nullvalue;
    }

    if (schema.hasOwnProperty('type') && schema.type === "object") {
        return schemaTypes.object;
    }
    const objectProperties = [
        'properties',
        'dependentRequired',
        'dependentSchemas',
        'propertyNames',
        'patternProperties',
        'additionalProperties',
    ];
    if (!schema.hasOwnProperty('type') && objectProperties.some(prop => schema.hasOwnProperty(prop))) {
        return schemaTypes.object;
    }

    if (schema.hasOwnProperty('type') && schema.type === "array") {
        return schemaTypes.array;
    }
    const arrayProperties = [
        'prefixItems',
        'items',
        'contains',
        'additionalItems',
    ];
    if (!schema.hasOwnProperty('type') && arrayProperties.some(prop => schema.hasOwnProperty(prop))) {
        return schemaTypes.array;
    }

    if (schema.hasOwnProperty('enum')) {
        return schemaTypes.enumeration;
    }
    if (schema.hasOwnProperty('type') && schema.type === "string") {
        return schemaTypes.string;
    }
    if (schema.hasOwnProperty('type') && ['integer', 'number'].includes(schema.type)) {
        return schemaTypes.numeric;
    }
    if (schema.hasOwnProperty('type') && schema.type === "boolean") {
        return schemaTypes.boolean;
    }

    // All of the below schema types can exist along with any of the above, but can also exist by themselves

    // TODO: oneOf, anyOf, allOf, if/then/else, and not - could exist alone, together, or as part of another schema

    if (schema.hasOwnProperty('if')) {
        return schemaTypes.ifThenElse;
    }

    if (schema.hasOwnProperty('anyOf')) {
        return schemaTypes.anyOf;
    }
    if (schema.hasOwnProperty('oneOf')) {
        return schemaTypes.oneOf;
    }
    if (schema.hasOwnProperty('allOf')) {
        return schemaTypes.allOf;
    }

    if (schema.hasOwnProperty('not')) {
        return schemaTypes.not;
    }

    return schemaTypes.invalid;
}

function getRef(schemaRoot, refName, history = []) {
    // https://json-schema.org/understanding-json-schema/structuring.html#ref
    //   paths are relative to the root and are that simple
    //    EX: #/definitions/someSchema

    // TODO: how do I handle recursive $refs (EX: children are the same type as parent) so as to NOT cause an endless loop?
    //         refName could also be '#', which points to the root of the schema (same concept as the above)

    try {
        const path = refName.split('/');

        // remove first entry ('#'), which means schema root
        path.shift();

        let current = schemaRoot;
        for (let i = 0; i < path.length; i++) {
            current = current[path[i]];
        }

        if (current.hasOwnProperty('$ref')) {
            if (history.includes(refName)) {
                throw new Error(`Infinite reference loop: ${history[0]}`);
            }

            return getRef(schemaRoot, current.$ref, [
                ...history,
                refName
            ]);
        }

        return current;
    } catch (err) {
        return {};
    }
}

function getAnnotations(schema) {
    const annotations = {};
    const ret = {};

    //   default (boolean)
    if (schema.hasOwnProperty('default')) {
        ret.default = schema.default;
    }

    //   deprecated (boolean)
    if (schema.hasOwnProperty('deprecated')) {
        ret.deprecated = schema.deprecated;
    }

    //   title (string)
    if (schema.hasOwnProperty('title')) {
        annotations.title = schema.title;
    }

    //   description (string)
    if (schema.hasOwnProperty('description')) {
        annotations.description = schema.description;
    }

    //   examples (array)
    if (schema.hasOwnProperty('examples')) {
        annotations.examples = schema.examples;
    }

    //   readOnly (boolean)
    if (schema.hasOwnProperty('readOnly')) {
        annotations.readOnly = schema.readOnly;
    }

    //   writeOnly (boolean)
    if (schema.hasOwnProperty('writeOnly')) {
        annotations.writeOnly = schema.writeOnly;
    }

    if (Object.keys(annotations).length > 0) {
        ret.annotations = annotations;
    }

    return ret;
}


function formatDoc(formatter, schemaDoc) {
    const state = getFormatterInitialState(formatter);

    function format(doc) {
        if (!formatter.hasOwnProperty(doc.schemaType)) {
            throw new Error(`Missing formatter function: ${doc.schemaType}`);
        }

        try {
            return formatter[doc.schemaType](doc, format, state);
        } catch(err) {
            throw new Error(`Error formatting ${doc.schemaType} schema: ${err.message ?? err}`);
        }
    }

    return format(schemaDoc);
}

function getFormatterInitialState(formatter) {
    if (formatter.hasOwnProperty('getInitialState')) {
        return formatter.getInitialState();
    }

    return {};
}
