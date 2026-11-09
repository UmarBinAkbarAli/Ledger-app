import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // next.config.js sets `images.unoptimized: true`, so next/image gives no
      // optimization here — and logos must be plain <img> for html2canvas PDF capture.
      "@next/next/no-img-element": "off",
      // This rule targets the Pages Router (pages/_document.js). In the App Router,
      // fonts linked in the root app/layout.tsx already load on every page.
      "@next/next/no-page-custom-font": "off",
      // Remaining hits are the standard "set loading=true, then fetch" pattern (also used in
      // React's own docs), which costs one extra render but isn't a bug. Real misuses
      // (derived state, prop syncing) were refactored away. Keep visible as a warning.
      "react-hooks/set-state-in-effect": "warn",
      // Allow intentionally-unused parameters/variables when prefixed with "_".
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Plain CommonJS Node entry point (custom server), not bundled by Next.
    files: ["server.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-emulator/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated/vendored files, not app source:
    "public/workbox-*.js",
  ]),
]);

export default eslintConfig;
