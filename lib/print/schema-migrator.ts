/**
 * 模板配置 schema 版本迁移
 *
 * 每次升级 schema：
 * 1. 在 lib/print/types.ts 把 CURRENT_SCHEMA_VERSION 加 1
 * 2. 在下面 MIGRATORS 数组里加一条 (from -> to) 函数
 * 3. 后端 print_template_schema_history 表会记录每次迁移
 *
 * 调用时机：
 * - PrintRenderer 加载 config 后，schema_version < CURRENT_SCHEMA_VERSION 时调用
 * - 设计器加载 saved config 后调用
 * - 调用方需要把 migrate 后的 config 自动 save 回 DB（或提示用户保存）
 */

import type { PrintTemplateRecord } from '@/lib/tauri/print-template'
import { CURRENT_SCHEMA_VERSION } from './types'

type MigratorFn = (record: PrintTemplateRecord) => PrintTemplateRecord

/** 迁移函数列表，按 fromVersion 顺序 */
interface MigratorEntry {
  fromVersion: number
  toVersion: number
  notes: string
  migrate: MigratorFn
}

const MIGRATORS: MigratorEntry[] = [
  // 示例（未来 v2 时启用）：
  // {
  //   fromVersion: 1,
  //   toVersion: 2,
  //   notes: '加入 columns[].fontSize 字段（v1 默认 10pt）',
  //   migrate: (record) => ({
  //     ...record,
  //     schemaVersion: 2,
  //     columnsJson: record.columnsJson.map(c => ({ ...c, fontSize: 10 })),
  //   }),
  // },
]

/** 迁移结果 */
export interface MigrationResult {
  record: PrintTemplateRecord
  migrated: boolean
  fromVersion: number
  toVersion: number
  steps: string[]
}

/**
 * 把 record 升级到 CURRENT_SCHEMA_VERSION。
 *
 * 行为：
 * - record.schemaVersion >= CURRENT → 直接返回，migrated = false
 * - record.schemaVersion < CURRENT → 顺序应用 MIGRATORS，记录每步 notes
 * - 找不到迁移路径 → 回退到 default config 并打警告（避免崩）
 */
export function migrateTemplateRecord(record: PrintTemplateRecord): MigrationResult {
  const fromVersion = record.schemaVersion
  if (fromVersion >= CURRENT_SCHEMA_VERSION) {
    return {
      record,
      migrated: false,
      fromVersion,
      toVersion: fromVersion,
      steps: [],
    }
  }

  let current = record
  const steps: string[] = []

  while (current.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const next = MIGRATORS.find(m => m.fromVersion === current.schemaVersion)
    if (!next) {
      // 找不到下一步迁移函数，schema 链断了
      // 不抛错，避免炸前端；记录警告让上游决定 fallback
      console.warn(`[print/schema-migrator] 找不到从 v${current.schemaVersion} 到 v${CURRENT_SCHEMA_VERSION} 的迁移路径。`)
      break
    }
    current = next.migrate(current)
    steps.push(`v${next.fromVersion} → v${next.toVersion}: ${next.notes}`)
  }

  return {
    record: current,
    migrated: steps.length > 0,
    fromVersion,
    toVersion: current.schemaVersion,
    steps,
  }
}
