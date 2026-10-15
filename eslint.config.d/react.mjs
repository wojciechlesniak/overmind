import refresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  {
    files: ["apps/desktop/**/*.tsx", "packages/ui-kit/**/*.tsx"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-refresh": refresh },
    rules: {
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
    },
  },
];
