import assert from 'node:assert/strict'
import test from 'node:test'

import { buildToggleMaterialStatusArgs } from '../app/[locale]/materials/_components/material-command-args.ts'

test('buildToggleMaterialStatusArgs maps to tauri camelCase args', () => {
  assert.deepEqual(buildToggleMaterialStatusArgs(7, true), {
    id: 7,
    isEnabled: false,
  })
})
