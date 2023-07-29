# JSON Schema Visualizer

[![NPM](https://img.shields.io/npm/v/jsonschema-doc?label=npm%20install&color=red)](https://www.npmjs.com/package/jsonschema-doc)
[![SIZE](https://img.shields.io/bundlephobia/min/jsonschema-doc?label=size&color=blue)](https://www.npmjs.com/package/jsonschema-doc)
[![SPONSOR](https://img.shields.io/badge/Github-sponsor-blue
)](https://github.com/sponsors/ghmcadams)


Generates simple, customizable (with great defaults), easy to read documentation for JSON schemas.  Made by the creator of [LintLens](https://marketplace.visualstudio.com/items?itemName=ghmcadams.lintlens) to document the requirements/options of ESLint rules, this powerful, yet simple, documentation generator can now be used in your projects, too.  It features a provider-based formatting system that allows you to easily create any output style you wish, or use the simple and intuitive default provider.  The default format provider (the one used by LintLens) displays JSON schemas in a JSON(ish) format that is intuitive and easy to read.

Simple to use!  Just pass in your JSON schema and get incredibly easy to read documentation.  Want something different?  Create your own custom formatter and pass that in as the second argument.

## Example (using the default (JSON-ish) format provider):

```jsonc
{
  "useAllowList": boolean (default: false),
  "allowedValues": [
    // unique
    ...string
  ],
  "suggestedAmount": integer (x > 0) | "none",
  "sortOrder": [
    // required: 4 items
    // unique
    ..."name" | "position" | "location" | "company"
  ],
  "ignoreCase": boolean (default: true)
}
```


## Installation

```shell
npm install jsonschema-doc
```

## Usage

### API

```ts
function getSchemaDocumentation(schema: JSONSchema, formatter?: FormatProvider): string;
```

### Custom Format Providers API

<details>
    <summary>Click to expand</summary>

```ts
type FormatProvider<TState = State> = {
    // A function to initialize a mutable object, which is passed to every formatter function below
    getInitialState: () => TState;

    // A function for each type found in a JSON schema
    // Example:  object(doc, baseFunc, state) { ... }

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

type FormatterFunction<TSchemaDoc, TState = State> = (doc: TSchemaDoc, formatFunc: BaseFormatFunction, state: TState) => string;

type BaseFormatFunction = (doc: Schema) => string;
type State = { [key: string]: unknown };
```
</details>
<br>

### Implementation

```ts
import { getSchemaDocumentation } from 'jsonschema-doc';

const documentation = getSchemaDocumentation(schema);
```

### Using a custom format provider

```ts
// myFormatProvider.js

export function getInitialState() { /* ... */ }
export function any(doc, formatFunc, state) { /* ... */ }
export function not(doc, formatFunc, state) { /* ... */ }
export function nullvalue(doc, formatFunc, state) { /* ... */ }
export function object(doc, formatFunc, state) { /* ... */ }
export function tuple(doc, formatFunc, state) { /* ... */ }
export function array(doc, formatFunc, state) { /* ... */ }
export function enumeration(doc, formatFunc, state) { /* ... */ }
export function constant(doc, formatFunc, state) { /* ... */ }
export function string(doc, formatFunc, state) { /* ... */ }
export function numeric(doc, formatFunc, state) { /* ... */ }
export function boolean(doc, formatFunc, state) { /* ... */ }
export function anyOf(doc, formatFunc, state) { /* ... */ }
export function oneOf(doc, formatFunc, state) { /* ... */ }
export function allOf(doc, formatFunc, state) { /* ... */ }
export function ifThenElse(doc, formatFunc, state) { /* ... */ }
export function multiType(doc, formatFunc, state) { /* ... */ }
export function externalRef(doc, formatFunc, state) { /* ... */ }
export function empty(doc, formatFunc, state) { /* ... */ }
export function invalid(doc, formatFunc, state) { /* ... */ }
```

```ts
// app.js

import { getSchemaDocumentation } from 'jsonschema-doc';
import * as myFormatProvider from './myFormatProvider';

const documentation = getSchemaDocumentation(schema, myFormatProvider);
```

### Overriding the default provider

```ts
// myFormatFunctions.js

export function string(doc, formatFunc, state) { /* ... */ }
export function constant(doc, formatFunc, state) { /* ... */ }
export function invalid(doc, formatFunc, state) { /* ... */ }
```

```ts
// app.js

import { getSchemaDocumentation, jsonishFormatter } from 'jsonschema-doc';
import { string, constant, invalid } from './myFormatFunctions';

const customFormatProvider = {
    ...jsonishFormatter,
    string,
    constant,
    invalid
};

const documentation = getSchemaDocumentation(schema, customFormatProvider);
```


## Custom Format Providers

A format provider is a JS object containing a function for each schema type.  As your schema is crawled, whenever a particular schema type is reached, the formatter function for that type is called with a schema doc (information specific to its type), a base format function (to be called for any children), and a mutable state object you can use for anything you need to keep track of while formatting a schema document (ex: indentation).

### Format Function Signature

```ts
// TSchema is specific to the type represented by this function
(doc: TSchema, formatFunc: (doc: Schema) => string, state: {}) => string;
```

### Schema document types

```ts
type Schema = ExternalRefSchema | EmptySchema | AnySchema | NotSchema | NullvalueSchema | ObjectSchema | TupleSchema | ArraySchema | EnumerationSchema | ConstantSchema | StringSchema | NumericSchema | BooleanSchema | AnyOfSchema | OneOfSchema | AllOfSchema | IfThenElseSchema | MultiTypeSchema | InvalidSchema;

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

type Scalar = string | number | boolean;

type Property = {
    key: string;
    value: Schema;
    required: boolean;
};

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
```


## Current limitations

- Does not read from external schemas (for now... Later, we will allow multiple schemas to be loaded at once)
- Does not support non-standard JSON schema keywords/types, etc.
- Does not support the `contains` keyword (for arrays)
- Does not handle schema composition when used as part of another schema type (`anyOf`, `oneOf`, `allOf`, `not`)
- Does not handle `if/then/else` when used as part of another schema type
- Does not handle conditional object subschemas (`dependentRequired`, `dependentSchemas`)
