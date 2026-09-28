// Allure 3 report settings: `npm run report` turns allure-results/ into allure-report/index.html.
import { defineConfig } from "allure";

export default defineConfig({
  name: "Stock Value iOS · end-to-end report",
  output: "./allure-report",
  plugins: {
    awesome: {
      options: {
        reportName: "Stock Value iOS · end-to-end report",
        reportLanguage: "en",
        groupBy: ["parentSuite", "suite", "subSuite"],
        singleFile: true, // one self-contained index.html: opens straight from a downloaded CI artifact
      },
    },
  },
});
