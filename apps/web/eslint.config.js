import { baseConfig, ignores } from "@saas/eslint-config/base.js";
import globals from "globals";

export default [
    ...baseConfig,
    {
        files: ["**/*.tsx", "**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
                React: "readonly",
                JSX: "readonly",
                RequestInit: "readonly",
            },
        },
        rules: {
            // Next.js doesn't require React import with new JSX transform
            "react/react-in-jsx-scope": "off",
        },
    },
    {
        ignores: [
            ...ignores,
            ".next/**",
            "next-env.d.ts",
        ]
    },
];
