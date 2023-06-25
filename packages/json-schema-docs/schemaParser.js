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

    let item = schema;
    // TODO: what if item.$ref[0] !== '#'?
    if (schema.hasOwnProperty('$ref') && item.$ref[0] === '#') {
        item = getRef(root, item.$ref);
    }

    const schemaType = getSchemaType(item);

    const annotations = getAnnotations(item);
    let doc;

    switch (schemaType) {
        case schemaTypes.object:
            doc = getObjectDoc({ schema: item, root });
            break;
        case schemaTypes.array:
            doc = getArrayDoc({ schema: item, root });
            break;
        case schemaTypes.anyOf:
        case schemaTypes.oneOf:
            doc = getOneOfDoc({ schema: item, root });
            break;
        case schemaTypes.allOf:
            doc = getAllOfDoc({ schema: item, root });
            break;
        case schemaTypes.multiType:
            doc = getMultiTypeDoc({ schema: item, root });
            break;
        case schemaTypes.enumeration:
            doc = getEnumDoc({ schema: item, root });
            break;
        case schemaTypes.string:
            doc = getStringDoc({ schema: item, root });
            break;
        case schemaTypes.numeric:
            doc = getNumericDoc({ schema: item, root });
            break;
        case schemaTypes.boolean:
            doc = getBooleanDoc({ schema: item, root });
            break;
        case schemaTypes.constant:
            doc = getConstDoc({ schema: item, root });
            break;
        case schemaTypes.any:
            doc = getAnyDoc({ schema: item, root });
            break;
        case schemaTypes.not:
            doc = getNotDoc({ schema: item, root });
            break;
        case schemaTypes.nullvalue:
            doc = getNullDoc({ schema: item, root });
            break;
        case schemaTypes.ifThenElse:
            doc = getIfThenElseDoc({ schema: item, root });
            break;
        case schemaTypes.empty:
            doc = getEmptyDoc({ schema: item, root });
            break;
        case schemaTypes.invalid:
        default:
            doc = getInvalidDoc({ schema: item, root });
            break;
    }

    return {
        ...doc,
        ...annotations,
    };
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
        items: schema.enum,
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
    //   dependentSchemas - { property: { ...otherSchema } } conditionally applies a subschema when a given property is present

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
                        key: '[any]',
                        required: false,
                        value: getSchemaDoc({ schema: {}, root }),
                    });
                }
            } else {
                ret.indexProperties.push({
                    key: '[any]',
                    required: false,
                    value: getSchemaDoc({ schema: additionalProperties, root }),
                });
            }
        } else {
            ret.indexProperties.push({
                key: '[any]',
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

    const ret = {
        schemaType: schemaTypes.array,
    };

    if (Object.keys(schema).length == 1 && schema.hasOwnProperty('type')) {
        return ret;
    }

    if (schema.hasOwnProperty('prefixItems')) {
        ret.schemaType = schemaTypes.tuple;
        ret.items = schema.prefixItems.map(item => getSchemaDoc({ schema: item, root }));

        if (schema.hasOwnProperty('additionalItems') || schema.hasOwnProperty('items')) {
            const additionalItems = schema.additionalItems ?? schema.items;

            if (getType(additionalItems) === 'boolean') {
                if (additionalItems === true) {
                    ret.additionalItems = getSchemaDoc({ schema: {}, root });
                }
            } else {
                ret.additionalItems = getSchemaDoc({ schema: additionalItems, root });
            }
        }
    } else {
        let items = Array.isArray(schema) ? schema : schema.items;
        items = (Array.isArray(items) && items.length === 1) ? items[0] : items;

        if (items === undefined) {
            items = schema.anyOf ?? schema.oneOf ?? schema.allOf;
        }

        // In Draft 4 - 2019-09, tuple validation was handled by an alternate form of the items keyword
        //       When items was an array of schemas instead of a single schema, it behaved the way prefixItems behaves.
        //  translation: if `items` is an array, then it is a tuple
        if (Array.isArray(items)) {
            ret.schemaType = schemaTypes.tuple;
            ret.items = items.map(item => getSchemaDoc({ schema: item, root }));

            if (schema.hasOwnProperty('additionalItems')) {
                if (getType(schema.additionalItems) === 'boolean') {
                    if (schema.additionalItems === true) {
                        ret.additionalItems = getSchemaDoc({ schema: {}, root });
                    }
                } else {
                    ret.additionalItems = getSchemaDoc({ schema: schema.additionalItems, root });
                }
            }
        } else {
            ret.schemaType = schemaTypes.array;
            ret.schema = getSchemaDoc({ schema: items, root });
        }
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
    // TODO: handle NOTs (seems to exist with something else)

    return {
        schemaType: schemaTypes.not,
        schema: {},
    };

    // // TODO: not sure if this code is correct
    // const { not, ...rest } = schema;
    // const adjustedSchema = { ...rest, ...not };

    // return {
    //     schemaType: schemaTypes.not,
    //     schema: getSchemaDoc({ schema: adjustedSchema, root }),
    // };
}

function getIfThenElseDoc({ schema, root }) {
    if (!schema.hasOwnProperty('if') || !schema.hasOwnProperty('then')) {
        return getInvalidDoc({ schema, root });
    }

    const ret = {
        schemaType: schemaTypes.ifThenElse,
        if: getSchemaDoc({ schema: schema.if, root }),
    };

    if (schema.hasOwnProperty('then')) {
        ret.then = getSchemaDoc({ schema: schema.then, root });
    }

    if (schema.hasOwnProperty('else')) {
        ret.else = getSchemaDoc({ schema: schema.else, root });
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

    if (schema.hasOwnProperty('anyOf')) {
        return schemaTypes.anyOf;
    }
    if (schema.hasOwnProperty('oneOf')) {
        return schemaTypes.oneOf;
    }
    if (schema.hasOwnProperty('allOf')) {
        return schemaTypes.allOf;
    }

    if (schema.hasOwnProperty('if')) {
        return schemaTypes.ifThenElse;
    }

    // TODO: when it has a not, usually it would exist as part of something else
    if (schema.hasOwnProperty('not')) {
        return schemaTypes.not;
    }

    return schemaTypes.invalid;
}

function getRef(schema, refName) {
    // path
    if (refName.includes('/')) {
        try {
            const path = refName.split('/');
            // remove first entry ('#')
            path.shift();
            let current = schema;
            for (let i = 0; i < path.length; i++) {
                current = current[path[i]];
            }
            return current;
        } catch (err) {
            return {};
        }
    }

    // identifier
    try {
        const id = refName;
        // remove # character
        id.shift();
        return Object.values(schema.definitions).find(def => def.$id === id) || {};
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


function formatDoc(formatter, doc) {
    if (!formatter.hasOwnProperty(doc.schemaType)) {
        throw new Error(`Missing formatter function: ${doc.schemaType}`);
    }
    const formatFunc = formatDoc.bind(undefined, formatter);

    try {
        return formatter[doc.schemaType](doc, formatFunc);
    } catch(err) {
        throw new Error(`Error formatting ${doc.schemaType} schema: ${err.message ?? err}`);
    }
}



// TODO: rework this based on new details
/*
type (can be an array of these or a single value)
    string
        minLength
        maxLength
        pattern (regex)
        default

    number | integer
        multipleOf
        minimum
        maximum
        exclusiveMinimum
        exclusiveMaximum
        default

    object
        properties
        required (array of property names)
        propertyNames (validates the name of the properties)
            minLength
            maxLength
            pattern (regex)
        minProperties
        maxProperties
        dependencies (object:
            if property with the name <key> is included,
            then a property with the name <value> is required
        )

    array (elements CAN be anything at all, but usually have these things)
        minItems
        maxItems
        uniqueItems

        a)
            items (an object like any other schema object)
            contains (where items says all items must be this, contains says at least one must be this)

        b)
            items (an array of schema objects)
            additionalItems (boolean - in addition to the list in items, are others allowed)

    boolean
        default


other things (can be at any level)
    allOf
        value must be valid against all of these things (schema objects)
    anyOf
        value can be valid against any of these things (schema objects)
    oneOf
        value must be valid against exactly one of these things (schema objects)
    not
        value must NOT be valid against this thing (schema object)

    definitions
    $ref (points to definition)

    const
        a constant value

    default

    if/then/else
        if (valid against this thing)
        then (use this thing (schema object))
        else (use this thing (schema object))
*/
