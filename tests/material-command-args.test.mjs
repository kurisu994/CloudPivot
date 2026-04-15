import test from "node:test";
import assert from "node:assert/strict";

import {
  buildToggleMaterialStatusArgs,
} from "../app/[locale]/materials/_components/material-command-args.ts";

test("buildToggleMaterialStatusArgs maps to tauri snake_case args", () => {
  assert.deepEqual(buildToggleMaterialStatusArgs(7, true), {
    id: 7,
    is_enabled: false,
  });
});
