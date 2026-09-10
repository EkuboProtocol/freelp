import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";
export default ts.config(
  { ignores: ["dist/**", "artifacts/**", "node_modules/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    plugins: {"react-hooks":hooks},
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.bun },
    },
    rules: {
      "react-hooks/rules-of-hooks":"error",
      "react-hooks/exhaustive-deps":"error",
      complexity: ["error", 10],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
