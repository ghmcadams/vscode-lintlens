import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        rules: {
            "no-console": "warn",
            "prefer-const": "error",
        },
    },
]);
