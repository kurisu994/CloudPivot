import assert from 'node:assert/strict'
import test from 'node:test'

import { isTauriEnv } from '../lib/tauri/core.ts'

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalIsTauriDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'isTauri')
const originalTauriDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__TAURI__')
const originalTauriInternalsDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__TAURI_INTERNALS__')

function restoreGlobal(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor)
  } else {
    Reflect.deleteProperty(globalThis, name)
  }
}

function resetTauriGlobals() {
  restoreGlobal('window', originalWindowDescriptor)
  restoreGlobal('isTauri', originalIsTauriDescriptor)
  restoreGlobal('__TAURI__', originalTauriDescriptor)
  restoreGlobal('__TAURI_INTERNALS__', originalTauriInternalsDescriptor)
}

test.afterEach(resetTauriGlobals)

test('isTauriEnv returns false without a browser window', () => {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'isTauri')
  Reflect.deleteProperty(globalThis, '__TAURI__')
  Reflect.deleteProperty(globalThis, '__TAURI_INTERNALS__')

  assert.equal(isTauriEnv(), false)
})

test('isTauriEnv detects Tauri 2 internals without global __TAURI__', () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })
  Object.defineProperty(globalThis, '__TAURI_INTERNALS__', {
    configurable: true,
    value: { invoke: () => undefined },
  })
  Reflect.deleteProperty(globalThis, '__TAURI__')

  assert.equal(isTauriEnv(), true)
})

test('isTauriEnv keeps compatibility with global __TAURI__ mode', () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })
  Object.defineProperty(globalThis, '__TAURI__', {
    configurable: true,
    value: {},
  })

  assert.equal(isTauriEnv(), true)
})
