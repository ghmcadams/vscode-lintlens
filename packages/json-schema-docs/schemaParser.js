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


// TODO: root is being passed around so I can use it in getRef - that's it
//  IDEA: expando?

// TODO: handle all errors (what do I return?)

export function getSchemaDocumentation(schema, formatter) {
    const doc = getSchemaDoc({ schema });

    if (formatter) {
        return formatDoc(formatter, doc);
    }

    return doc;
}

function getSchemaDoc({ schema, root = schema }) {
    if (!schema) {
        return getEmptyDoc({ schema, root: schema });
    }

    const varType = getType(schema);

    if (!['object', 'array'].includes(varType)) {
        return getInvalidDoc({ schema, root: schema });
    }

    if (varType === 'array' && schema.length === 0) {
        return getEmptyDoc({ schema, root: schema });
    }

    if (varType === 'object' && Object.keys(schema).length === 0) {
        return getEmptyDoc({ schema, root: schema });
    }

    let item = schema;
    // TODO: what if item.$ref[0] !== '#'?
    if (schema.hasOwnProperty('$ref') && item.$ref[0] === '#') {
        item = getRef(root, item.$ref);
    }

    const schemaType = getSchemaType(item);

    switch (schemaType) {
        case schemaTypes.object:
            return getObjectDoc({ schema: item, root });
        case schemaTypes.array:
            return getArrayDoc({ schema: item, root });
        case schemaTypes.anyOf:
        case schemaTypes.oneOf:
            return getOneOfDoc({ schema: item, root });
        case schemaTypes.allOf:
            return getAllOfDoc({ schema: item, root });
        case schemaTypes.multiType:
            return getMultiTypeDoc({ schema: item, root });
        case schemaTypes.enumeration:
            return getEnumDoc({ schema: item, root });
        case schemaTypes.string:
            return getStringDoc({ schema: item, root });
        case schemaTypes.numeric:
            return getNumericDoc({ schema: item, root });
        case schemaTypes.boolean:
            return getBooleanDoc({ schema: item, root });
        case schemaTypes.constant:
            return getConstDoc({ schema: item, root });
        case schemaTypes.any:
            return getAnyDoc({ schema: item, root });
        case schemaTypes.not:
            return getNotDoc({ schema: item, root });
        case schemaTypes.nullvalue:
            return getNullDoc({ schema: item, root });
        case schemaTypes.ifThenElse:
            return getIfThenElseDoc({ schema: item, root });
        case schemaTypes.empty:
            return getEmptyDoc({ schema: item, root });
        case schemaTypes.invalid:
        default:
            return getInvalidDoc({ schema: item, root });
    }
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
        ...getAnnotations(schema),
    };
}

function getNullDoc({ schema }) {
    return {
        schemaType: schemaTypes.nullvalue,
        ...getAnnotations(schema),
    };
}

function getMultiTypeDoc({ schema, root }) {
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
        ...getAnnotations(schema),
    };
}

function getEnumDoc({ schema }) {
    if (schema.enum.length === 1) {
        return getConstDoc({ schema: {
            ...schema,
            const: schema.enum[0],
        } });
    }

    return {
        schemaType: schemaTypes.enumeration,
        items: schema.enum,
        ...getAnnotations(schema),
    };
}

function getConstDoc({ schema }) {
    return {
        schemaType: schemaTypes.constant,
        value: schema.const,
        ...getAnnotations(schema),
    };
}

function getObjectDoc({ schema, root }) {
    // https://json-schema.org/understanding-json-schema/reference/object.html

    //TODO: dependencies
    //   dependentRequired - { property: ["otherProperty"] } conditionally requires that certain properties must be present if a given property is present in an object
    //   dependentSchemas - { property: { ...otherSchema } } conditionally applies a subschema when a given property is present

    //TODO: propertyNames
    //  (validates the name of the properties - assumes type: string)
    //     minLength
    //     maxLength
    //     format
    //     pattern (regex)


    const ret = {
        schemaType: schemaTypes.object,
        properties: [],
        ...getAnnotations(schema),
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

        // TODO: By default any additional properties are allowed.
        // TODO: unevaluatedProperties should be considered the same as additionalProperties
        if (schema.hasOwnProperty('additionalProperties')) {
            if (getType(schema.additionalProperties) === 'boolean') {
                if (schema.additionalProperties === true) {
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
                    value: getSchemaDoc({ schema: schema.additionalProperties, root }),
                });
            }
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

    if (Object.keys(requirements).length > 0) {
        ret.requirements = requirements;
    }

    return ret;
}

function getArrayDoc({ schema, root }) {
    // https://json-schema.org/understanding-json-schema/reference/array.html

    const ret = {
        schemaType: schemaTypes.array,
        ...getAnnotations(schema),
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
        ...getAnnotations(schema),
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
        ...getAnnotations(schema),
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
        ...getAnnotations(schema),
    };
}

// TODO: do I combine allOf here as well?
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
        ...getAnnotations(schema),
    };
}

function getAllOfDoc({ schema, root }) {
    // TODO: How do I handle AllOf

    const { allOf, ...rest } = schema;

    if (allOf.length === 1) {
        return getSchemaDoc({ schema: allOf[0], root });
    }

    return {
        schemaType: schemaTypes.allOf,
        items: allOf.map((item) => {
            const combinedItem = {
                ...rest,
                ...item
            };
            return getSchemaDoc({ schema: combinedItem, root });
        }),
        ...getAnnotations(schema),
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
    //     ...getAnnotations(schema),
    // };
}

function getIfThenElseDoc({ schema, root }) {
    return {
        schemaType: schemaTypes.ifThenElse,
        if: getSchemaDoc({ schema: schema.if, root }),
        then: getSchemaDoc({ schema: schema.then, root }),
        else: getSchemaDoc({ schema: schema.else, root }),
        ...getAnnotations(schema),
    };
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

function getSchemaType(item = {}) {
    if (Array.isArray(item)) {
        return schemaTypes.array;
    }

    if (Object.keys(item).length === 0) {
        return schemaTypes.any;
    }

    if (item.hasOwnProperty('const')) {
        return schemaTypes.constant;
    }

    if (Array.isArray(item.type)) {
        return schemaTypes.multiType;
    }

    if (item.hasOwnProperty('type') && item.type === "null") {
        return schemaTypes.nullvalue;
    }

    if (item.hasOwnProperty('type') && item.type === "object") {
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
    if (!item.hasOwnProperty('type') && objectProperties.some(prop => item.hasOwnProperty(prop))) {
        return schemaTypes.object;
    }

    if (item.hasOwnProperty('type') && item.type === "array") {
        return schemaTypes.array;
    }
    const arrayProperties = [
        'prefixItems',
        'items',
        'contains',
        'additionalItems',
    ];
    if (!item.hasOwnProperty('type') && arrayProperties.some(prop => item.hasOwnProperty(prop))) {
        return schemaTypes.array;
    }

    if (item.hasOwnProperty('enum')) {
        return schemaTypes.enumeration;
    }
    if (item.hasOwnProperty('type') && item.type === "string") {
        return schemaTypes.string;
    }
    if (item.hasOwnProperty('type') && ['integer', 'number'].includes(item.type)) {
        return schemaTypes.numeric;
    }
    if (item.hasOwnProperty('type') && item.type === "boolean") {
        return schemaTypes.boolean;
    }

    if (item.hasOwnProperty('anyOf')) {
        return schemaTypes.anyOf;
    }
    if (item.hasOwnProperty('oneOf')) {
        return schemaTypes.oneOf;
    }
    if (item.hasOwnProperty('allOf')) {
        return schemaTypes.allOf;
    }

    if (item.hasOwnProperty('if') && item.hasOwnProperty('then')) {
        return schemaTypes.ifThenElse;
    }

    // TODO: when it has a not, usually it would exist as part of something else
    if (item.hasOwnProperty('not')) {
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

    if (Object.keys(annotations).length > 0) {
        ret.annotations = annotations;
    }

    return ret;
}


function formatDoc(formatter, doc) {
    switch (doc.schemaType) {
        case schemaTypes.any:
        case schemaTypes.not:
        case schemaTypes.nullvalue:
        case schemaTypes.object:
        case schemaTypes.array:
        case schemaTypes.tuple:
        case schemaTypes.enumeration:
        case schemaTypes.constant:
        case schemaTypes.string:
        case schemaTypes.numeric:
        case schemaTypes.boolean:
        case schemaTypes.anyOf:
        case schemaTypes.oneOf:
        case schemaTypes.allOf:
        case schemaTypes.ifThenElse:
        case schemaTypes.multiType:
        case schemaTypes.empty:
        case schemaTypes.invalid:
            if (!formatter.hasOwnProperty(doc.schemaType)) {
                throw new Error(`Missing formatter: ${doc.schemaType}`);
            }
            const formatFunc = formatDoc.bind(undefined, formatter);
            return formatter[doc.schemaType](doc, formatFunc);

        default:
            throw new Error(`Unknown schema type: ${doc.schemaType}`);
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
