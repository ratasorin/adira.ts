const { createDefaultPreset } = require("ts-jest");
require("dotenv").config();

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: false, // Disable type checking
      },
    ],
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
