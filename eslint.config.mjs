import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Next 16 ships flat configs; no compatibility layer needed.
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ["_legacy/**", ".next/**", "node_modules/**", "prisma/generated/**", "coverage/**", ".mail/**"],
  },
];

export default eslintConfig;
