const { createDefaultPreset } = require("ts-jest");
require("dotenv").config();

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  testRegex: ".*\\.test\\.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: false, // Disable type checking
      },
    ],
  },
  silent: false,

  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
