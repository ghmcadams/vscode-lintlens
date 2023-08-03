const Ajv = require("ajv");
const { getSimpleErrors } = require("simple-ajv-errors");

const ajv = new Ajv({allErrors: true, verbose: true});

const schema = {
  "type": "object",
  "properties": {
    "maxDepth": {
      "oneOf": [
        {
          "type": "integer",
          "minimum": 1
        },
        {
          "type": "string",
          "enum": ["∞"]
        }
      ]
    }
  },
  "additionalProperties": false
};

const validate = ajv.compile(schema);

function test(data) {
  validate(data);

  console.log("AJV:");
  console.log(ajv.errorsText(validate.errors, { separator: "\n", dataVar: "data" }));
  console.log("\n");

  console.log("simple-ajv-errors:");
  console.log(getSimpleErrors(validate.errors).map(err => err.message).join('\n'));

  console.log("\n");
  console.log("---------------------------");
  console.log("\n");
}

test({maxDepth: "2"});
test({maxDepth: "2", minAllowed: 3});
