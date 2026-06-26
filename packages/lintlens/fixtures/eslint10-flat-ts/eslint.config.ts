import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';


// export default defineConfig([
//     {
//         rules: {
//             "no-console": "warn",
//             semi: "error",
//         },
//     },
// ]);

const allowedBooleanPrefixes = ['bool'];

const namingConventionOptions = [
    { selector: 'default', format: ['camelCase'] },
    { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
    { selector: 'variable', types: ['boolean'], prefix: allowedBooleanPrefixes, format: ['UPPER_CASE', 'PascalCase'] },
    { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
    { selector: 'enumMember', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
    { selector: 'memberLike', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'require' },
    { selector: 'typeLike', format: ['PascalCase'] },
    { selector: ['property', 'parameterProperty'], format: ['camelCase', 'snake_case', 'PascalCase'] },
    { selector: 'objectLiteralProperty', format: ['camelCase', 'snake_case', 'PascalCase', 'UPPER_CASE'] },
    { selector: ['classProperty', 'parameterProperty', 'typeProperty'], types: ['boolean'], prefix: allowedBooleanPrefixes, format: ['snake_case', 'PascalCase'] },
    { selector: 'function', format: ['camelCase'] },
];

export default defineConfig([
    { settings: { react: { version: 'detect' } } },
    { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'], ...js.configs.recommended },
    tseslint.configs.eslintRecommended,
    {
        plugins: [
            "@typescript-eslint"
        ],
        rules: {
            '@typescript-eslint/naming-convention': ['error', ...namingConventionOptions]
        }
    }
]);
