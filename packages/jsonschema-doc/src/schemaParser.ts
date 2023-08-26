import {
    Schema,
    Annotations,
    SchemaDoc,
    EmptySchemaDoc,
    ObjectSchemaDoc,
    AnySchemaDoc,
    NullvalueSchemaDoc,
    MultiTypeSchemaDoc,
    EnumerationSchemaDoc,
    ConstantSchemaDoc,
    ArraySchemaDoc,
    StringSchemaDoc,
    NumericSchemaDoc,
    BooleanSchemaDoc,
    OneOfSchemaDoc,
    AllOfSchemaDoc,
    NotSchemaDoc,
    IfThenElseSchemaDoc,
    InvalidSchemaDoc,
    TupleSchemaDoc,
    SchemaTypes,
    BaseSchemaDoc,
    FormatProvider,
    AnyOfSchemaDoc,
    ExternalRefSchemaDoc,
    ObjectRequirements,
    ArrayRequirements,
    StringRequirements,
    NumericRequirements,
} from './types';

import * as jsonishFormatter from './jsonishFormatter';
import { JSONSchema7 } from 'json-schema';


type DefinedSchema = Exclude<Schema, 'undefined'>;

type DocParams = {
    schema: DefinedSchema;
    root?: DefinedSchema;
};


export function getSchemaDocumentation(schema: Schema, formatter: FormatProvider = jsonishFormatter) {
    if (schema === undefined) {
        throw new Error('Schema required');
    }

    let doc: SchemaDoc;

    try {
        doc = getSchemaDoc({ schema });
    } catch(err) {
        doc = getInvalidDoc({ schema, root: schema });
    }

    return formatDoc(formatter, doc);
}

function getSchemaDoc({ schema, root = schema }: DocParams): SchemaDoc {
    if (!schema) {
        return getEmptyDoc({ schema, root });
    }

    const schemaType = getSchemaType(schema);

    const annotations = getAnnotations(schema);
    let doc: SchemaDoc;

    switch (schemaType) {
        case SchemaTypes.object:
            doc = getObjectDoc({ schema, root });
            break;
        case SchemaTypes.array:
            doc = getArrayDoc({ schema, root });
            break;
        case SchemaTypes.anyOf:
        case SchemaTypes.oneOf:
            doc = getOneOfDoc({ schema, root });
            break;
        case SchemaTypes.allOf:
            doc = getAllOfDoc({ schema, root });
            break;
        case SchemaTypes.multiType:
            doc = getMultiTypeDoc({ schema, root });
            break;
        case SchemaTypes.enumeration:
            doc = getEnumDoc({ schema, root });
            break;
        case SchemaTypes.string:
            doc = getStringDoc({ schema, root });
            break;
        case SchemaTypes.numeric:
            doc = getNumericDoc({ schema, root });
            break;
        case SchemaTypes.boolean:
            doc = getBooleanDoc({ schema, root });
            break;
        case SchemaTypes.constant:
            doc = getConstDoc({ schema, root });
            break;
        case SchemaTypes.any:
            doc = getAnyDoc({ schema, root });
            break;
        case SchemaTypes.not:
            doc = getNotDoc({ schema, root });
            break;
        case SchemaTypes.nullvalue:
            doc = getNullDoc({ schema, root });
            break;
        case SchemaTypes.ifThenElse:
            doc = getIfThenElseDoc({ schema: schema as JSONSchema7, root });
            break;
        case SchemaTypes.empty:
            doc = getEmptyDoc({ schema, root });
            break;
        case SchemaTypes.ref:
        case SchemaTypes.externalRef:
            doc = getRefDoc({ schema, root });
            break;
        case SchemaTypes.invalid:
        default:
            doc = getInvalidDoc({ schema, root });
            break;
    }

    return {
        ...doc,
        ...annotations,
    };
}


function getRefDoc({ schema, root }: DocParams): SchemaDoc {
    // https://json-schema.org/understanding-json-schema/structuring.html#ref

    if (!schema.hasOwnProperty('$ref') || schema.$ref === undefined || root === undefined) {
        return getInvalidDoc({ schema, root: schema });
    }

    if (schema.$ref[0] !== '#') {
        return {
            schemaType: SchemaTypes.externalRef,
            baseUri: root.$id,
            reference: schema.$ref,
        };
    }

    const ref = getRef(root, schema.$ref);

    return getSchemaDoc({ schema: ref, root });
}

function getEmptyDoc({ schema }: DocParams): EmptySchemaDoc {
    return {
        schemaType: SchemaTypes.empty,
        schema,
    };
}

function getAnyDoc({}: DocParams): AnySchemaDoc {
    return {
        schemaType: SchemaTypes.any,
    };
}

function getNullDoc({}: DocParams): NullvalueSchemaDoc {
    return {
        schemaType: SchemaTypes.nullvalue,
    };
}

function getMultiTypeDoc({ schema, root }: DocParams): MultiTypeSchemaDoc | SchemaDoc {
    if (!schema.hasOwnProperty('type') || !Array.isArray(schema.type)) {
        return getInvalidDoc({ schema, root });
    }

    // Allows requirements on other type
    if (schema.type.length === 2 && schema.type.includes('null')) {
        const otherSchema = {
            ...schema,
            type: schema.type.find(i => i !== 'null')
        };
        return getSchemaDoc({ schema: {
            oneOf: [
                otherSchema as any, // TODO: TS breaks when this is not any (expects to satisfy ALL union types instead of any of them)
                { type: "null" }
            ]
        }, root })
    }

    return {
        schemaType: SchemaTypes.multiType,
        types: schema.type,
    };
}

function getEnumDoc({ schema, root }: DocParams): EnumerationSchemaDoc | InvalidSchemaDoc {
    if (schema.enum === undefined) {
        return getInvalidDoc({ schema, root});
    }

    return {
        schemaType: SchemaTypes.enumeration,
        values: schema.enum,
    };
}

function getConstDoc({ schema, root }: DocParams): ConstantSchemaDoc | InvalidSchemaDoc {
    if (schema.const === undefined) {
        return getInvalidDoc({ schema, root});
    }

    return {
        schemaType: SchemaTypes.constant,
        value: schema.const,
    };
}

function getObjectDoc({ schema, root }: DocParams): ObjectSchemaDoc {
    // https://json-schema.org/understanding-json-schema/reference/object.html

    //TODO: dependencies
    //   dependentRequired - { property: ["otherProperty"] } conditionally requires that certain properties must be present if a given property is present in an object
    //       https://json-schema.org/understanding-json-schema/reference/conditionals.html#dependentrequired
    //   dependentSchemas - { property: { ...otherSchema } } conditionally applies a subschema when a given property is present
    //       https://json-schema.org/understanding-json-schema/reference/conditionals.html#dependentschemas

    // TODO: does if/then/else apply only to objects?
    //       https://json-schema.org/understanding-json-schema/reference/conditionals.html#if-then-else

    const ret: ObjectSchemaDoc = {
        schemaType: SchemaTypes.object,
        properties: [],
    };

    if (schema.hasOwnProperty('properties') && schema.properties !== undefined) {
        const requiredKeys = schema.required ?? [];
        const properties = Object.entries(schema.properties).map(([key, value]) => {
            const required = requiredKeys === true || (Array.isArray(requiredKeys) && requiredKeys.includes(key));

            return {
                key,
                required,
                value: getSchemaDoc({ schema: value, root }),
            };
        });
        ret.properties.push(...properties);
    }

    // separate other property types (to represent as index properties) so that they can be formatted differently
    if (schema.hasOwnProperty('patternProperties') || schema.hasOwnProperty('additionalProperties')) {
        ret.indexProperties = [];

        if (schema.hasOwnProperty('patternProperties') && schema.patternProperties !== undefined) {
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
                    value: getSchemaDoc({ schema: additionalProperties as DefinedSchema, root }),
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

    const requirements: ObjectRequirements = {};

    if ((schema.hasOwnProperty('minProperties') || schema.hasOwnProperty('maxProperties')) &&
        (schema.minProperties !== undefined || schema.maxProperties !== undefined)
    ) {
        requirements.size = {
            minProperties: schema.minProperties,
            maxProperties: schema.maxProperties,
            message: '',
        };

        if (schema.hasOwnProperty('minProperties') && schema.hasOwnProperty('maxProperties') &&
            (schema.minProperties ?? 0) > 0 && (schema.maxProperties ?? 0) > 0
        ) {
            if (schema.minProperties === schema.maxProperties) {
                requirements.size.message = `required: ${schema.minProperties} ${schema.minProperties === 1 ? 'property' : 'properties'}`;
            } else {
                requirements.size.message = `required: ${schema.minProperties} to ${schema.maxProperties} properties`;
            }
        } else if (schema.hasOwnProperty('minProperties') && (schema.minProperties ?? 0) > 0) {
            requirements.size.message = `min properties: ${schema.minProperties}`;
        } else if (schema.hasOwnProperty('maxProperties') && (schema.maxProperties ?? 0) > 0) {
            requirements.size.message = `max properties: ${schema.maxProperties}`;
        }
    }

    if (schema.hasOwnProperty('propertyNames')) {
        const messageParts: string[] = [];
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

        requirements.propertyNames = {
            ...schema.propertyNames,
            message: `Property names: ${messageParts.join(', ')}`,
        };
    }

    if (Object.keys(requirements).length > 0) {
        ret.requirements = requirements;
    }

    return ret;
}

function getArrayDoc({ schema, root }: DocParams): ArraySchemaDoc | TupleSchemaDoc {
    // https://json-schema.org/understanding-json-schema/reference/array.html

    if (Object.keys(schema).length == 1 && schema.hasOwnProperty('type')) {
        return {
            schemaType: SchemaTypes.array,
            schema: getSchemaDoc({ schema: {}, root }),
        };
    }

    const ret = {} as ArraySchemaDoc & TupleSchemaDoc;

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
        ret.schemaType = SchemaTypes.tuple;

        const tupleItems = (Array.isArray(schema)
            ? schema
            : schema.prefixItems ?? schema.items) as DefinedSchema[];
        const additionalItems = schema.hasOwnProperty('prefixItems')
            ? schema.additionalItems ?? schema.items
            : schema.additionalItems;

        ret.items = tupleItems.map(item => getSchemaDoc({ schema: item, root }));

        if (additionalItems !== undefined) {
            if (typeof additionalItems === 'boolean') {
                if (additionalItems === true) {
                    ret.additionalItems = getSchemaDoc({ schema: {}, root });
                }
            } else {
                ret.additionalItems = getSchemaDoc({ schema: additionalItems, root });
            }
        }
    } else {
        // TODO: do I need to do this for other things (like object, numeric, etc.)?
        const arrayItems = (schema.items ?? schema.anyOf ?? schema.oneOf ?? schema.allOf) as DefinedSchema;

        ret.schemaType = SchemaTypes.array;
        ret.schema = getSchemaDoc({ schema: arrayItems, root });
    }

    // TODO: contains
    // While the items schema must be valid for every item in the array, the contains schema only needs to validate against one or more items in the array.
    // minContains and maxContains can be used with contains to further specify how many times a schema matches a contains constraint (>= 0).
    // idea: treat contains like additionalItems: any (contains, then that)


    const requirements: ArrayRequirements = {};

    if ((schema.hasOwnProperty('minItems') || schema.hasOwnProperty('maxItems')) &&
        ((schema.minItems ?? 0) > 0 || (schema.maxItems ?? 0) > 0)
    ) {
        requirements.length = {
            minItems: schema.minItems,
            maxItems: schema.maxItems,
            message: '',
        };

        if (schema.hasOwnProperty('minItems') && schema.hasOwnProperty('maxItems') &&
        (schema.minItems ?? 0) > 0 && (schema.maxItems ?? 0) > 0
        ) {
            if (schema.minItems === schema.maxItems) {
                requirements.length.message = `required: ${schema.minItems} ${schema.minItems === 1 ? 'item' : 'items'}`;
            } else {
                requirements.length.message = `required: ${schema.minItems} to ${schema.maxItems} items`;
            }
        } else if (schema.hasOwnProperty('minItems') && (schema.minItems ?? 0) > 0) {
            requirements.length.message = `min items: ${schema.minItems}`;
        } else if (schema.hasOwnProperty('maxItems') && (schema.maxItems ?? 0) > 0) {
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

function getStringDoc({ schema }: DocParams): StringSchemaDoc {
    const ret: StringSchemaDoc = {
        schemaType: SchemaTypes.string,
    };

    const requirements: StringRequirements = {};

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

    if (schema.hasOwnProperty('pattern') && schema.pattern !== undefined) {
        requirements.pattern = {
            value: schema.pattern,
            message: `regex: /${schema.pattern}/`,
        };
    }

    if (schema.hasOwnProperty('format') && schema.format !== undefined) {
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

function getNumericDoc({ schema }: DocParams): NumericSchemaDoc {
    const ret: NumericSchemaDoc = {
        schemaType: SchemaTypes.numeric,
        numericType: schema.type as "number" | "integer",
    };

    const requirements: NumericRequirements = {};

    if (schema.hasOwnProperty('minimum') || schema.hasOwnProperty('exclusiveMinimum') || schema.hasOwnProperty('maximum') || schema.hasOwnProperty('exclusiveMaximum')) {
        requirements.range = {
            minimum: schema.minimum,
            maximum: schema.maximum,
            exclusiveMinimum: schema.exclusiveMinimum,
            exclusiveMaximum: schema.exclusiveMaximum,
            message: '',
        };

        const messages: string[] = [];

        // TODO: handle when exclusive one is boolean
        if (schema.hasOwnProperty('minimum')) {
            messages.push(`x ≥ ${schema.minimum}`);
        } else if (schema.hasOwnProperty('exclusiveMinimum')) {
            messages.push(`x > ${schema.exclusiveMinimum}`);
        }

        // TODO: handle when exclusive one is boolean
        if (schema.hasOwnProperty('maximum')) {
            messages.push(`x ≤ ${schema.maximum}`);
        } else if (schema.hasOwnProperty('exclusiveMaximum')) {
            messages.push(`x < ${schema.exclusiveMaximum}`);
        }

        requirements.range.message = messages.join(', ');
    }

    if (schema.hasOwnProperty('multipleOf') && schema.multipleOf !== undefined) {
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

function getBooleanDoc({}: DocParams): BooleanSchemaDoc {
    return {
        schemaType: SchemaTypes.boolean,
    };
}

function getOneOfDoc({ schema, root }: DocParams): OneOfSchemaDoc | InvalidSchemaDoc {
    // https://json-schema.org/understanding-json-schema/reference/combining.html

    const { anyOf, oneOf, ...rest } = schema;
    const anyOrOneOf = anyOf ?? oneOf;

    if (anyOrOneOf === undefined) {
        return getInvalidDoc({ schema, root });
    }

    // TODO: can both anyOf and oneOf exist? (if so, combine them here [...anyOf, ...oneOf])
    // TODO: what is the type if both exist?
    const schemaType = anyOf ? SchemaTypes.anyOf : SchemaTypes.oneOf;

    return {
        schemaType,
        items: anyOrOneOf.map((item) => {
            if (typeof item === 'boolean') {
                return getInvalidDoc({ schema, root });
            }
            const combinedItem = {
                ...rest,
                ...item
            };
            return getSchemaDoc({ schema: combinedItem as DefinedSchema, root });
        }),
    };
}

function getAllOfDoc({ schema, root }: DocParams): AllOfSchemaDoc | InvalidSchemaDoc {
    const { allOf, ...rest } = schema;

    if (allOf === undefined) {
        return getInvalidDoc({ schema, root });
    }

    return {
        schemaType: SchemaTypes.allOf,
        items: allOf.map((item) => {
            if (typeof item === 'boolean') {
                return getInvalidDoc({ schema, root });
            }
            const combinedItem = {
                ...rest,
                ...item
            };
            return getSchemaDoc({ schema: combinedItem as DefinedSchema, root });
        }),
    };
}

function getNotDoc({ schema, root }: DocParams): NotSchemaDoc {
    // TODO: handle NOTs (might exist inside of something else)
    const { not, ...rest } = schema;
    const adjustedSchema = { ...rest, ...not as Schema } as DefinedSchema;

    return {
        schemaType: SchemaTypes.not,
        schema: getSchemaDoc({ schema: adjustedSchema, root }),
    };
}

type JSONSchema7DocParams = {
    schema: JSONSchema7;
    root: DefinedSchema;
};
function getIfThenElseDoc({ schema, root }: JSONSchema7DocParams): IfThenElseSchemaDoc | InvalidSchemaDoc | AnySchemaDoc {
    if (!schema.hasOwnProperty('if') || schema.if === undefined || typeof schema.if === 'boolean') {
        return getInvalidDoc({ schema, root });
    }

    if (!schema.hasOwnProperty('then') && !schema.hasOwnProperty('else')) {
        return getAnyDoc({ schema, root });
    }

    return {
        schemaType: SchemaTypes.ifThenElse,
        if: getSchemaDoc({ schema: schema.if, root }),
        then: schema.then !== undefined && typeof schema.then !== 'boolean'
            ? getSchemaDoc({ schema: schema.then, root })
            : getAnyDoc({ schema, root }),
            else: schema.else !== undefined && typeof schema.else !== 'boolean'
            ? getSchemaDoc({ schema: schema.else, root })
            : getAnyDoc({ schema, root }),
    };
}

function getInvalidDoc({ schema }: DocParams): InvalidSchemaDoc {
    return {
        schemaType: SchemaTypes.invalid,
        schema,
    };
}


function getType(variable: unknown): string {
    return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
}

function getSchemaType(schema: Schema = {}): SchemaTypes {
    if (schema.hasOwnProperty('$ref')) {
        return SchemaTypes.ref;
    }

    const varType = getType(schema);

    if (!['object', 'array'].includes(varType)) {
        return SchemaTypes.invalid;
    }

    if (Array.isArray(schema)) {
        if (schema.length === 0) {
            return SchemaTypes.empty;
        }
        return SchemaTypes.array;
    }

    if (Object.keys(schema).length === 0) {
        return SchemaTypes.any;
    }

    if (schema.hasOwnProperty('const')) {
        return SchemaTypes.constant;
    }

    if (Array.isArray(schema.type)) {
        return SchemaTypes.multiType;
    }

    if (schema.hasOwnProperty('type') && schema.type === "null") {
        return SchemaTypes.nullvalue;
    }

    if (schema.hasOwnProperty('type') && schema.type === "object") {
        return SchemaTypes.object;
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
        return SchemaTypes.object;
    }

    if (schema.hasOwnProperty('type') && schema.type === "array") {
        return SchemaTypes.array;
    }
    const arrayProperties = [
        'prefixItems',
        'items',
        'contains',
        'additionalItems',
    ];
    if (!schema.hasOwnProperty('type') && arrayProperties.some(prop => schema.hasOwnProperty(prop))) {
        return SchemaTypes.array;
    }

    if (schema.hasOwnProperty('enum')) {
        return SchemaTypes.enumeration;
    }
    if (schema.hasOwnProperty('type') && schema.type === "string") {
        return SchemaTypes.string;
    }
    if (schema.hasOwnProperty('type') && schema.type !== undefined && ['integer', 'number'].includes(schema.type)) {
        return SchemaTypes.numeric;
    }
    if (schema.hasOwnProperty('type') && schema.type === "boolean") {
        return SchemaTypes.boolean;
    }

    // All of the below schema types can exist along with any of the above, but can also exist by themselves

    // TODO: oneOf, anyOf, allOf, if/then/else, and not - could exist alone, together, or as part of another schema

    if (schema.hasOwnProperty('if')) {
        return SchemaTypes.ifThenElse;
    }

    if (schema.hasOwnProperty('anyOf')) {
        return SchemaTypes.anyOf;
    }
    if (schema.hasOwnProperty('oneOf')) {
        return SchemaTypes.oneOf;
    }
    if (schema.hasOwnProperty('allOf')) {
        return SchemaTypes.allOf;
    }

    if (schema.hasOwnProperty('not')) {
        return SchemaTypes.not;
    }

    return SchemaTypes.invalid;
}

function getRef(schemaRoot: DefinedSchema, refName: string, history: string[] = []): DefinedSchema {
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
            current = current[path[i] as keyof DefinedSchema];
        }

        if (current.hasOwnProperty('$ref') && current.$ref !== undefined) {
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

function getAnnotations(schema: Schema) {
    const annotations = {} as Annotations;
    const ret = {} as BaseSchemaDoc;

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


function formatDoc(formatter: FormatProvider, schemaDoc: SchemaDoc) {
    const state = getFormatterInitialState(formatter);

    function format(doc: SchemaDoc) {
        if (!formatter.hasOwnProperty(doc.schemaType)) {
            throw new Error(`Missing formatter function: ${doc.schemaType}`);
        }

        try {
            // TODO: TS complained when I tried formatter[doc.schemaType as FormatFunctionName]
            // const fn = formatter[doc.schemaType as FormatFunctionName];
            // return fn(doc, format, state);

            // switch case allows me to use type assertion correctly
            switch (doc.schemaType) {
                case SchemaTypes.any:
                    return formatter.any(doc as AnySchemaDoc, format, state);
                case SchemaTypes.not:
                    return formatter.not(doc as NotSchemaDoc, format, state);
                case SchemaTypes.nullvalue:
                    return formatter.nullvalue(doc as NullvalueSchemaDoc, format, state);
                case SchemaTypes.object:
                    return formatter.object(doc as ObjectSchemaDoc, format, state);
                case SchemaTypes.array:
                    return formatter.array(doc as ArraySchemaDoc, format, state);
                case SchemaTypes.tuple:
                    return formatter.tuple(doc as TupleSchemaDoc, format, state);
                case SchemaTypes.enumeration:
                    return formatter.enumeration(doc as EnumerationSchemaDoc, format, state);
                case SchemaTypes.constant:
                    return formatter.constant(doc as ConstantSchemaDoc, format, state);
                case SchemaTypes.string:
                    return formatter.string(doc as StringSchemaDoc, format, state);
                case SchemaTypes.numeric:
                    return formatter.numeric(doc as NumericSchemaDoc, format, state);
                case SchemaTypes.boolean:
                    return formatter.boolean(doc as BooleanSchemaDoc, format, state);
                case SchemaTypes.anyOf:
                    return formatter.anyOf(doc as AnyOfSchemaDoc, format, state);
                case SchemaTypes.oneOf:
                    return formatter.oneOf(doc as OneOfSchemaDoc, format, state);
                case SchemaTypes.allOf:
                    return formatter.allOf(doc as AllOfSchemaDoc, format, state);
                case SchemaTypes.ifThenElse:
                    return formatter.ifThenElse(doc as IfThenElseSchemaDoc, format, state);
                case SchemaTypes.multiType:
                    return formatter.multiType(doc as MultiTypeSchemaDoc, format, state);
                case SchemaTypes.externalRef:
                    return formatter.externalRef(doc as ExternalRefSchemaDoc, format, state);
                case SchemaTypes.empty:
                    return formatter.empty(doc as EmptySchemaDoc, format, state);
                case SchemaTypes.invalid:
                    return formatter.invalid(doc as InvalidSchemaDoc, format, state);
                default:
                    return formatter.invalid(doc as InvalidSchemaDoc, format, state);
            }
        } catch(err) {
            let message = err;
            if (err instanceof Error) message = err.message;
            throw new Error(`Error formatting ${doc.schemaType} schema: ${message}`);
        }
    }

    return format(schemaDoc);
}

function getFormatterInitialState(formatter: FormatProvider) {
    if (formatter.hasOwnProperty('getInitialState')) {
        return formatter.getInitialState();
    }

    return {};
}
