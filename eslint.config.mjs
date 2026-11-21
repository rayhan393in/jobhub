import { dirname } from "path";
import { fileURLToPath } from "url";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Next 16 ships React Compiler lint rules. A few of them misfire on this codebase:
 *  - `react-hooks/purity` flags `Date.now()` in *async Server Components*, where it is
 *    the intended way to read wall-clock time for a request-scoped render.
 *  - `react-hooks/set-state-in-effect` flags async data loaders that legitimately set
 *    state after `await`, and steppers that react to a prop change.
 * They stay visible as warnings so real violations are still reviewable, but they do
 * not fail `npm run lint`.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // Server Components read the clock per request by design.
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/lib/**/*.ts"],
    rules: { "react-hooks/purity": "off" },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
      "supabase/**",
      "scripts/**",
    ],
  },
];

export default eslintConfig;
