import type {
    JSONSchema4, JSONSchema4Type,
    JSONSchema6, JSONSchema6Type,
    JSONSchema7, JSONSchema7Type,
} from 'json-schema';


export enum SchemaTypes {
    any = 'any',
    not = 'not',
    nullvalue = 'nullvalue',
    object = 'object',
    array = 'array',
    tuple = 'tuple',
    enumeration = 'enumeration',
    constant = 'constant',
    string = 'string',
    numeric = 'numeric',
    boolean = 'boolean',
    anyOf = 'anyOf',
    oneOf = 'oneOf',
    allOf = 'allOf',
    ifThenElse = 'ifThenElse',
    multiType = 'multiType',
    invalid = 'invalid',
    empty = 'empty',
    ref = 'ref',
    externalRef = 'externalRef',
};

export type JSONSchemaType = | string | number | boolean | JSONSchemaObject | JSONSchemaArray | null;
export interface JSONSchemaObject {
    [key: string]: JSONSchemaType;
}
export interface JSONSchemaArray extends Array<JSONSchemaType> {}

export type Schema = (JSONSchema4 | JSONSchema6 | JSONSchema7) & {
    // Added to account for draft properties
    unevaluatedProperties?: Schema;
    prefixItems?: Schema | Schema[];
    deprecated?: boolean;
    readOnly?: boolean;
    writeOnly?: boolean;
};
type SchemaTypeName = Schema["type"];


// TODO: think through the Schema vs SchemaDoc using the same name (schema) in the below types


type Scalar = string | number | boolean;
export type Value = JSONSchema4Type | JSONSchema6Type | JSONSchema7Type;

/**
 * A type representing an object property
 */
type Property = {
    key: string;
    value: SchemaDoc;
    required: boolean;
};

/**
 * JSON Schema keywords used to describe parts of a schema.
 * None of these “annotations” are required, but they are encouraged for
 * good practice, and can make your schema “self-documenting”.
 */
export type Annotations = {
    title?: string;
    description?: string;
    examples?: Value[];
    readOnly?: boolean;
    writeOnly?: boolean;
};

export type Requirements = {
    [x: string]: {
        [x: string]: Scalar | undefined;
        message: string;
    };
};

type BareSchemaDoc = {
    schemaType: SchemaTypes;
};

export type BaseSchemaDoc = BareSchemaDoc & {
    default?: Value;
    deprecated?: boolean;
    annotations?: Annotations;
};

export type ExternalRefSchemaDoc = BareSchemaDoc & {
    baseUri: string;
    reference: string;
};
export type EmptySchemaDoc = BareSchemaDoc & {
    schema: Schema;
};
export type InvalidSchemaDoc = BareSchemaDoc & {
    schema: Schema;
};
export type AnySchemaDoc = BaseSchemaDoc & {};
export type NotSchemaDoc = BaseSchemaDoc & {
    schema: SchemaDoc;
};
export type NullvalueSchemaDoc = BaseSchemaDoc & {};
export type ObjectSchemaDoc = BaseSchemaDoc & {
    properties: Property[];
    indexProperties?: Property[];
    requirements?: Requirements;
};
export type TupleSchemaDoc = BaseSchemaDoc & {
    items: SchemaDoc[];
    additionalItems?: SchemaDoc;
    requirements?: Requirements;
};
export type ArraySchemaDoc = BaseSchemaDoc & {
    schema: SchemaDoc;
    requirements?: Requirements;
};
export type EnumerationSchemaDoc = BaseSchemaDoc & {
    values: Value[];
};
export type ConstantSchemaDoc = BaseSchemaDoc & {
    value: Value;
};
export type StringSchemaDoc = BaseSchemaDoc & {
    requirements?: Requirements;
};
export type NumericSchemaDoc = BaseSchemaDoc & {
    numericType: string;
    requirements?: Requirements;
};
export type BooleanSchemaDoc = BaseSchemaDoc & {};
export type OneOfSchemaDoc = BaseSchemaDoc & {
    items: SchemaDoc[];
};
export type AnyOfSchemaDoc = BaseSchemaDoc & {
    items: SchemaDoc[];
};
export type AllOfSchemaDoc = BaseSchemaDoc & {
    items: SchemaDoc[];
};
export type IfThenElseSchemaDoc = BaseSchemaDoc & {
    if: SchemaDoc;
    then: SchemaDoc;
    else: SchemaDoc;
};
export type MultiTypeSchemaDoc = BaseSchemaDoc & {
    types: SchemaTypeName[];
};

export type SchemaDoc = ExternalRefSchemaDoc | EmptySchemaDoc | AnySchemaDoc | NotSchemaDoc | NullvalueSchemaDoc | ObjectSchemaDoc | TupleSchemaDoc | ArraySchemaDoc | EnumerationSchemaDoc | ConstantSchemaDoc | StringSchemaDoc | NumericSchemaDoc | BooleanSchemaDoc | AnyOfSchemaDoc | OneOfSchemaDoc | AllOfSchemaDoc | IfThenElseSchemaDoc | MultiTypeSchemaDoc | InvalidSchemaDoc;


/**
 * A function to be called by formatter functions for any subschemas
 */
export type BaseFormatFunction = (doc: SchemaDoc) => string;
/**
 * A format provider function
 */
export type FormatterFunction<TSchemaDoc extends SchemaDoc> = (doc: TSchemaDoc, formatFunc: BaseFormatFunction, state: any) => string;

export type FormatProvider = {
    getInitialState: () => any;
    any: FormatterFunction<AnySchemaDoc>;
    not: FormatterFunction<NotSchemaDoc>;
    nullvalue: FormatterFunction<NullvalueSchemaDoc>;
    object: FormatterFunction<ObjectSchemaDoc>;
    tuple: FormatterFunction<TupleSchemaDoc>;
    array: FormatterFunction<ArraySchemaDoc>;
    enumeration: FormatterFunction<EnumerationSchemaDoc>;
    constant: FormatterFunction<ConstantSchemaDoc>;
    string: FormatterFunction<StringSchemaDoc>;
    numeric: FormatterFunction<NumericSchemaDoc>;
    boolean: FormatterFunction<BooleanSchemaDoc>;
    anyOf: FormatterFunction<AnyOfSchemaDoc>;
    oneOf: FormatterFunction<OneOfSchemaDoc>;
    allOf: FormatterFunction<AllOfSchemaDoc>;
    ifThenElse: FormatterFunction<IfThenElseSchemaDoc>;
    multiType: FormatterFunction<MultiTypeSchemaDoc>;
    externalRef: FormatterFunction<ExternalRefSchemaDoc>;
    empty: FormatterFunction<EmptySchemaDoc>;
    invalid: FormatterFunction<InvalidSchemaDoc>;
};

export type FormatFunctionName = Exclude<keyof FormatProvider, 'getInitialState'>;
