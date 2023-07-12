# Simple AJV Errors

[![NPM](https://img.shields.io/npm/v/simple-ajv-errors?label=npm%20install&color=red)](https://www.npmjs.com/package/simple-ajv-errors)
[![SIZE](https://img.shields.io/bundlephobia/min/simple-ajv-errors?label=size&color=blue)](https://www.npmjs.com/package/simple-ajv-errors)
[![SPONSOR](https://img.shields.io/badge/Github-sponsor-blue
)](https://github.com/sponsors/ghmcadams)

A function that accepts an array of errors that were returned from `ajv.validate()`, and returns an array of simplified error messages along with some of the information from the original ajv error.


## Examples

### Example 1

Schema:
```js
// An array of:
//   enum ("tab" or "first")
//   integer
//   object
[
    "tab" | "first" | integer | {   
        //... 
    }
]
```

Data:
```js
["space", "2"]
```

ajv errors:
```
/0 must be equal to one of the allowed values
/0 must be integer
/0 must be object
/0 must match exactly one schema in oneOf
```

Simple AJV Errors:
```
data[0] must be one of the following: 'tab', 'first' or integer or object
```


<br />

### Example 2

Schema:
```js
{
  //...
  "maxDepth": integer (x ≥ 1) | "∞",   
}
```

Data:
```js
{ maxDepth: true }
```

ajv errors:
```
/maxDepth must be integer
/maxDepth must be string
/maxDepth must be equal to one of the allowed values
/maxDepth must match exactly one schema in oneOf
```

Simple AJV Errors:
```
data.maxDepth must be integer or '∞'
```

<br />

### Example 3

Schema:
```js
{   
  //...
  "supported": "composition" | "nesting" | {
    (required) "some": "composition" | "nesting"
  } | {   
    (required) "every": "composition" | "nesting"
  },
}
```

Data:
```js
{
    //...
    supported: {
    all: 'nesting',
    },
}
```

ajv errors:
```
/supported must be string
/supported must be equal to one of the allowed values
/supported must have required property 'some'
/supported must have required property 'every'
/supported must match exactly one schema in oneOf
```

Simple AJV Errors:
```
data.supported must include property 'some' or include property 'every'
```

<br />

### Example 4

Schema:
```js
// An array of unique objects, each requiring properties:
//    either `object` or `property`
//    `message`
[
  {   
    (required) "object": string,   
    "property": string,   
    (required) "message": string   
  } | {   
    "object": string,   
    (required) "property": string,   
    (required) "message": string   
  }   
  # unique   
]
```

Data:
```js
[
  {
    property: 'callee',
    message: 'arguments.callee is deprecated',
  },
  {
    message: 'Please use Number.isFinite instead',
  },
  {
    object: 'window',
    property: 'isFinite',
    message: 'Please use Number.isFinite instead',
  },
  {
    object: 'window',
    property: 'isFinite',
    message: 'Please use Number.isFinite instead',
  }
]
```

ajv errors:
```
/1 must have required property 'object'
/1 must have required property 'property'
/1 must match a schema in anyOf
must NOT have duplicate items (items ## 2 and 3 are identical)
```

Simple AJV Errors:
```
data must have all unique items (items 2 and 3 are identical)
data[1] must include property 'object' or include property 'property'
```


## Installation

```shell
npm install simple-ajv-errors
```

## Usage

### API

```ts
getSimpleErrors(errors: ErrorObject[], options?: Options): SimpleError[];
```

### Types

```ts
interface Options {
    // Used in error messages as part of a reference path
    //  EX: `data.someProp[0].prop must not be empty`
    rootVar: string; // default: 'data'
}

interface SimpleError {
    // Simplified error message with clear wording
    //  EX: `data[0] must be string or integer`
    message: string;

    // Copied directly from ajv errors (when available)
    instancePath: string;
    schemaPath: string;
    schema?: any;
    parentSchema?: object;
    data?: any;
}
```

<br />

### Implementation

```js
import Ajv from 'ajv';
import { getSimpleErrors } from 'simple-ajv-errors';

const ajv = new Ajv({
    // ...
    allErrors: true,
    verbose: true,
});

const schema = { /* ... */ };
const data = { /* ... */ };

const valid = ajv.validate(schema, data);
if (valid === false) {
    const simpleErrors = getSimpleErrors(ajv.errors, {
        rootVar: 'root'
    });
}
```

## ajv options

Simple AJV Errors supports any/all options passed to `ajv.validate()`.  There are two configuration options, however, that would improve your experience.  Those are `allErrors` and `verbose`.

### allErrors

- Default: `false`
- Suggestion:  `true`

The default value of `allErrors` in ajv is `false`, which directs it to return after the first error found.  Setting this value to `true` directs it to check all rules and collect all errors.  Many might feel this option makes ajv errors too verbose and opt for less information in order to improve their experience, by setting this value to `false`.

Simple AJV Errors solves this by determining which errors are the most applicable and filtering out the noise.

[Read more](https://ajv.js.org/options.html#allerrors) about this option in the ajv documentation.


### verbose

- Default: `false`
- Suggestion:  `true`

Setting this value to `true` directs ajv to include the relevant part of the schema and data with each error.  This gives Simple AJV Errors information to better determine the most applicable errors.  Setting this to `false` will result in less applicable errors, but will still improve the wording.

[Read more](https://ajv.js.org/options.html#verbose) about this option in the ajv documentation.
