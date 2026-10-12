import { baseConfig, ignores } from "@saas/eslint-config/base.js";
import globals from "globals";

export default [
    ...baseConfig,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
    },
    { ignores },
];
