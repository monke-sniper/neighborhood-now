import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React 19's strict rule rejects setState inside useEffect for cases
      // that are standard and correct: starting a clock, hydrating a localStorage
      // cache, kicking off an async data load. The patterns here all use a
      // cancelled flag and proper cleanup. We rely on dependency arrays and
      // explicit cleanup, not on the rule.
      "react-hooks/set-state-in-effect": "off",
      // Allow client components to import pure engine helpers that don't pull
      // in upstream-only modules. Enforced manually via the scenarios.client
      // split and the pre-computed report.schoolImpacts.
    },
  },
]);

export default eslintConfig;
