const { getSchemaDocumentation } = require('jsonschema-docgen');


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

const documentation = getSchemaDocumentation(schema);
console.log(documentation);
