import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    ".claude/**",
    // Bundled vendor runtimes for the standalone design prototype.
    "designs/shop-qr-dashboard/src/*-runtime.js",
    "designs/shop-qr-dashboard/src/animate-components.js",
  ]),
]);

export default eslintConfig;
