import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_REMEMBER_ME_DAYS, rememberMeDurationMs } from '../lib/remember-session.ts'

const DAY_MS = 24 * 60 * 60 * 1000

test('记住我天数按配置换算，缺省回退 7 天', () => {
  assert.equal(rememberMeDurationMs('14'), 14 * DAY_MS)
  assert.equal(rememberMeDurationMs('7.9'), 7 * DAY_MS)
  assert.equal(rememberMeDurationMs(undefined), DEFAULT_REMEMBER_ME_DAYS * DAY_MS)
  assert.equal(rememberMeDurationMs(''), DEFAULT_REMEMBER_ME_DAYS * DAY_MS)
  assert.equal(rememberMeDurationMs('0'), DEFAULT_REMEMBER_ME_DAYS * DAY_MS)
  assert.equal(rememberMeDurationMs('-3'), DEFAULT_REMEMBER_ME_DAYS * DAY_MS)
  assert.equal(rememberMeDurationMs('9999'), DEFAULT_REMEMBER_ME_DAYS * DAY_MS)
})
