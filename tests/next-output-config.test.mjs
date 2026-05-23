import assert from 'node:assert/strict'
import test from 'node:test'

const originalPlatform = process.env.TAURI_ENV_PLATFORM
const originalLifecycleEvent = process.env.npm_lifecycle_event

function restoreEnvironment() {
  if (originalPlatform === undefined) {
    delete process.env.TAURI_ENV_PLATFORM
  } else {
    process.env.TAURI_ENV_PLATFORM = originalPlatform
  }

  if (originalLifecycleEvent === undefined) {
    delete process.env.npm_lifecycle_event
  } else {
    process.env.npm_lifecycle_event = originalLifecycleEvent
  }
}

async function loadNextConfig(platform, lifecycleEvent, cacheKey) {
  process.env.TAURI_ENV_PLATFORM = platform
  process.env.npm_lifecycle_event = lifecycleEvent

  return (await import(`../next.config.ts?${cacheKey}`)).default
}

test.after(restoreEnvironment)

test('Tauri development does not enable static export output', async () => {
  const config = await loadNextConfig('macos', 'dev', 'tauri-dev')

  assert.equal(config.output, undefined)
})

test('Tauri production build enables static export output', async () => {
  const config = await loadNextConfig('macos', 'build', 'tauri-build')

  assert.equal(config.output, 'export')
})
