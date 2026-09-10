import { formatter } from "@lingui/format-po";
export default {
  sourceLocale: "en",
  locales: ["en"],
  catalogs: [{ path: "src/locales/{locale}", include: ["src"] }],
  format: formatter({ lineNumbers: false }),
};
