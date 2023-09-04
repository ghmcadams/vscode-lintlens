# JSON Schema Documentation Generator

[![NPM](https://img.shields.io/npm/v/jsonschema-docgen?label=npm%20install&color=red)](https://www.npmjs.com/package/jsonschema-docgen)
[![SIZE](https://img.shields.io/bundlephobia/min/jsonschema-docgen?label=size&color=blue)](https://www.npmjs.com/package/jsonschema-docgen)
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
npm install jsonschema-docgen
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
type FormatProvider = {
    // A function to initialize a mutable object, which is passed to every formatter function below
    getInitialState: () => any;

    // A function for each type found in a JSON schema
    // Example:  object(doc, baseFunc, state) { ... }

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

type FormatterFunction<TSchemaDoc extends SchemaDoc> = (doc: TSchemaDoc, formatFunc: BaseFormatFunction, state: any) => string;

type BaseFormatFunction = (doc: SchemaDoc) => string;
```
</details>
<br>

### Implementation

```ts
import { getSchemaDocumentation } from 'jsonschema-docgen';

const documentation = getSchemaDocumentation(schema);
```

### Using a custom format provider

```ts
// myFormatProvider.js

export function getInitialState() { /* ... */ }
export function externalRef(doc, formatFunc, state) { /* ... */ }
export function empty(doc, formatFunc, state) { /* ... */ }
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
export function invalid(doc, formatFunc, state) { /* ... */ }
```

```ts
// app.js

import { getSchemaDocumentation } from 'jsonschema-docgen';
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

import { getSchemaDocumentation, jsonishFormatter } from 'jsonschema-docgen';
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
(doc: TSchemaDoc, formatFunc: (doc: SchemaDoc) => string, state: any) => string;
```

### Schema document types

```ts
type SchemaDoc = ExternalRefSchemaDoc | EmptySchemaDoc | AnySchemaDoc | NotSchemaDoc | NullvalueSchemaDoc | ObjectSchemaDoc | TupleSchemaDoc | ArraySchemaDoc | EnumerationSchemaDoc | ConstantSchemaDoc | StringSchemaDoc | NumericSchemaDoc | BooleanSchemaDoc | AnyOfSchemaDoc | OneOfSchemaDoc | AllOfSchemaDoc | IfThenElseSchemaDoc | MultiTypeSchemaDoc | InvalidSchemaDoc;

type BareSchemaDoc = {
    schemaType: SchemaTypes;
};
type BaseSchemaDoc = BareSchemaDoc & {
    default?: Value;
    deprecated?: boolean;
    annotations?: Annotations;
};

type ExternalRefSchemaDoc = BareSchemaDoc & {
    baseUri: string;
    reference: string;
};
type EmptySchemaDoc = BareSchemaDoc & {
    schema: Schema;
};
type InvalidSchemaDoc = BareSchemaDoc & {
    schema: Schema;
};
type AnySchemaDoc = BaseSchemaDoc & {};
type NotSchemaDoc = BaseSchemaDoc & {
    schema: SchemaDoc;
};
type NullvalueSchemaDoc = BaseSchemaDoc & {};
type ObjectSchemaDoc = BaseSchemaDoc & {
    properties: Property[];
    indexProperties?: Property[];
    requirements?: ObjectRequirements;
};
type TupleSchemaDoc = BaseSchemaDoc & {
    items: SchemaDoc[];
    additionalItems?: SchemaDoc;
    requirements?: ArrayRequirements;
};
type ArraySchemaDoc = BaseSchemaDoc & {
    schema: SchemaDoc;
    requirements?: ArrayRequirements;
};
type EnumerationSchemaDoc = BaseSchemaDoc & {
    values: Value[];
};
type ConstantSchemaDoc = BaseSchemaDoc & {
    value: Value;
};
type gSchemaDoc = BaseSchemaDoc & {
    requirements?: StringRequirements;
};
type NumericSchemaDoc = BaseSchemaDoc & {
    numericType: string;
    requirements?: NumericRequirements;
};
type BooleanSchemaDoc = BaseSchemaDoc & {};
type OneOfSchemaDoc = BaseSchemaDoc & {
    items: SchemaDoc[];
};
type AnyOfSchemaDoc = BaseSchemaDoc & {
    items: SchemaDoc[];
};
type AllOfSchemaDoc = BaseSchemaDoc & {
    items: SchemaDoc[];
};
type IfThenElseSchemaDoc = BaseSchemaDoc & {
    if: SchemaDoc;
    then: SchemaDoc;
    else: SchemaDoc;
};
type MultiTypeSchemaDoc = BaseSchemaDoc & {
    types: SchemaTypeName[];
};

type Property = {
    key: string;
    value: SchemaDoc;
    required: boolean;
};

type Annotations = {
    title?: string;
    description?: string;
    examples?: Value[];
    readOnly?: boolean;
    writeOnly?: boolean;
};

type Requirement = {
    message: string;
};
type ObjectRequirements = {
    size?: Requirement & {
        minProperties?: number;
        maxProperties?: number;
    };
    propertyNames?: Requirement & {
        minLength?: number;
        maxLength?: number;
        pattern?: string;
        format?: string;
    };
};
type ArrayRequirements = {
    length?: Requirement & {
        minItems?: number;
        maxItems?: number;
    };
    uniqueItems?: Requirement & {
        value: true;
    };
};
type StringRequirements = {
    length?: Requirement & {
        minLength?: number;
        maxLength?: number;
    };
    pattern?: Requirement & {
        value: string;
    };
    format?: Requirement & {
        value: string;
    };
};
type NumericRequirements = {
    range?: Requirement & {
        minimum?: number;
        maximum?: number;
        exclusiveMinimum?: number | boolean;
        exclusiveMaximum?: number | boolean;
    };
    multipleOf?: Requirement & {
        value: number;
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
