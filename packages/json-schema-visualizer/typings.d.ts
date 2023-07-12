declare module 'json-schema-visualizer' {
    type State = { [key: string]: unknown };

    /**
     * A function to be called by formatter functions for any subschemas
     */
    type BaseFormatFunction = (doc: Schema) => string;
    /**
     * A format provider function
     */
    type FormatterFunction<TSchemaDoc extends Schema, TState = State> = (doc: TSchemaDoc, formatFunc: BaseFormatFunction, state: TState) => string;

    type Scalar = string | number | boolean;

    /**
     * A type representing an object property
     */
    type Property = {
        key: string;
        value: Schema;
        required: boolean;
    };

    /**
     * JSON Schema keywords used to describe parts of a schema.
     * None of these “annotations” are required, but they are encouraged for
     * good practice, and can make your schema “self-documenting”.
     */
    type Annotations = {
        title: string;
        description: string;
        examples: unknown[];
        readOnly: boolean;
        writeOnly: boolean;
    };

    type Requirement = {
        [string]: {
            [string]: Scalar;
            message: string;
        };
    };

    type FormatProvider<TState = State> = {
        getInitialState: () => TState;
        any: FormatterFunction<AnySchema, TState>;
        not: FormatterFunction<NotSchema, TState>;
        nullvalue: FormatterFunction<NullvalueSchema, TState>;
        object: FormatterFunction<ObjectSchema, TState>;
        tuple: FormatterFunction<TupleSchema, TState>;
        array: FormatterFunction<ArraySchema, TState>;
        enumeration: FormatterFunction<EnumerationSchema, TState>;
        constant: FormatterFunction<ConstantSchema, TState>;
        string: FormatterFunction<StringSchema, TState>;
        numeric: FormatterFunction<NumericSchema, TState>;
        boolean: FormatterFunction<BooleanSchema, TState>;
        anyOf: FormatterFunction<AnyOfSchema, TState>;
        oneOf: FormatterFunction<OneOfSchema, TState>;
        allOf: FormatterFunction<AllOfSchema, TState>;
        ifThenElse: FormatterFunction<IfThenElseSchema, TState>;
        multiType: FormatterFunction<MultiTypeSchema, TState>;
        externalRef: FormatterFunction<ExternalRefSchema, TState>;
        empty: FormatterFunction<EmptySchema, TState>;
        invalid: FormatterFunction<InvalidSchema, TState>;
    };

    type BaseSchema = {
        default?: unknown;
        deprecated?: boolean;
        annotations?: Annotations;
    };

    type ExternalRefSchema = {
        baseUri: string | undefined;
        reference: string;
    };
    type EmptySchema = {
        schema: Schema;
    };
    type AnySchema = BaseSchema & {};
    type NotSchema = BaseSchema & {
        schema: Schema;
    };
    type NullvalueSchema = BaseSchema & {};
    type ObjectSchema = BaseSchema & {
        properties: Property[];
        indexProperties?: Property[];
        requirements?: Requirement[];
    };
    type TupleSchema = BaseSchema & {
        items: Schema[];
        additionalItems?: Schema;
    };
    type ArraySchema = BaseSchema & {
        schema: Schema;
    };
    type EnumerationSchema = BaseSchema & {
        values: unknown[];
    };
    type ConstantSchema = BaseSchema & {
        value: unknown;
    };
    type StringSchema = BaseSchema & {
        requirements?: Requirement[];
    };
    type NumericSchema = BaseSchema & {
        numericType: string;
        requirements?: Requirement[];
    };
    type BooleanSchema = BaseSchema & {};
    type OneOfSchema = BaseSchema & {
        items: Schema[];
    };
    type AnyOfSchema = BaseSchema & {
        items: Schema[];
    };
    type AllOfSchema = BaseSchema & {
        items: Schema[];
    };
    type IfThenElseSchema = BaseSchema & {
        if: Schema;
        then: Schema;
        else: Schema;
    };
    type MultiTypeSchema = BaseSchema & {
        types: string[];
    };
    type InvalidSchema = {
        schema: Schema;
    };

    type Schema = ExternalRefSchema | EmptySchema | AnySchema | NotSchema | NullvalueSchema | ObjectSchema | TupleSchema | ArraySchema | EnumerationSchema | ConstantSchema | StringSchema | NumericSchema | BooleanSchema | AnyOfSchema | OneOfSchema | AllOfSchema | IfThenElseSchema | MultiTypeSchema | InvalidSchema;

    /**
     * Get human readable documentation from a JSON schema.
     * @param {object} schema - a valid JSON schema.
     * @param {FormatProvider} [formatter=jsonishFormatter] - The specified format provider (If not provided, jsonishFormatter is used).
     * @returns {string} Schema documentation, formatted via the specified format provider.
     */
    export function getSchemaDocumentation(
        schema: object,
        formatter?: FormatProvider,
    ): string;

    /**
     * The default format provider which outputs JSON(ish) schema documentation
     */
    export const jsonishFormatter: FormatProvider<{}>;
}
