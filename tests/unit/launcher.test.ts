import { expect, test } from "bun:test";
import { parseLauncherArgs, validatePort } from "../../cli/main";

test("launcher parser keeps the requested stable port and browser flag", () => {
  expect(parseLauncherArgs(["--port", "4321", "--no-browser"])).toEqual({
    port: "4321",
    "no-browser": true,
  });
});

test("launcher parser rejects invalid ports without selecting a replacement", () => {
  expect(() => validatePort("4173x")).toThrow("integer from 1024 to 65535");
  expect(() => validatePort("80")).toThrow("integer from 1024 to 65535");
  expect(validatePort("4173")).toBe(4173);
});
