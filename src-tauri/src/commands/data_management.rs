//! 数据管理命令
//!
//! 提供数据库备份、业务模板数据导入导出等能力。

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use tauri::{AppHandle, Manager, State};

use crate::db::DbState;
use crate::error::AppError;
use crate::operation_log::{OperationLogEntry, write_log};

use super::{CurrentUser, inventory_ops, material};

/// 备份文件信息
#[derive(Debug, Serialize)]
pub struct BackupFileInfo {
    pub file_name: String,
    pub file_path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

/// 数据管理状态
#[derive(Debug, Serialize)]
pub struct DataManagementStatus {
    pub db_path: String,
    pub db_size_bytes: u64,
    pub backup_dir: String,
    pub last_backup_at: Option<String>,
    pub backups: Vec<BackupFileInfo>,
}

/// 物料导入行
#[derive(Debug, Deserialize)]
pub struct MaterialImportRow {
    pub code: String,
    pub name: String,
    pub material_type: String,
    pub category_code: Option<String>,
    pub category_name: Option<String>,
    pub spec: Option<String>,
    pub base_unit_name: String,
    pub aux_unit_name: Option<String>,
    pub conversion_rate: Option<f64>,
    pub ref_cost_price: Option<i64>,
    pub sale_price: Option<i64>,
    pub safety_stock: Option<f64>,
    pub max_stock: Option<f64>,
    pub lot_tracking_mode: Option<String>,
    pub texture: Option<String>,
    pub color: Option<String>,
    pub surface_craft: Option<String>,
    pub length_mm: Option<f64>,
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub barcode: Option<String>,
    pub remark: Option<String>,
}

/// 期初库存导入行
#[derive(Debug, Deserialize)]
pub struct InitialInventoryImportRow {
    pub material_code: String,
    pub warehouse_code: String,
    pub quantity: f64,
    pub unit_cost_usd: i64,
    pub received_date: String,
    pub lot_no: Option<String>,
    pub supplier_batch_no: Option<String>,
    pub remark: Option<String>,
}

/// 导入结果
#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub created: u32,
    pub updated: u32,
    pub skipped: u32,
    pub errors: Vec<String>,
}

/// 物料导出行
#[derive(Debug, Serialize, FromRow)]
pub struct MaterialExportRow {
    pub code: String,
    pub name: String,
    pub material_type: String,
    pub category_code: Option<String>,
    pub category_name: Option<String>,
    pub spec: Option<String>,
    pub base_unit_name: String,
    pub aux_unit_name: Option<String>,
    pub conversion_rate: Option<f64>,
    pub ref_cost_price: i64,
    pub sale_price: i64,
    pub safety_stock: f64,
    pub max_stock: f64,
    pub lot_tracking_mode: String,
    pub texture: Option<String>,
    pub color: Option<String>,
    pub surface_craft: Option<String>,
    pub length_mm: Option<f64>,
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub barcode: Option<String>,
    pub remark: Option<String>,
    pub is_enabled: bool,
}

#[derive(Debug, FromRow)]
struct InitialInventoryResolvedRow {
    material_id: i64,
    warehouse_id: i64,
    lot_tracking_mode: String,
}

/// 构建备份文件名
fn build_backup_file_name(timestamp: &str) -> String {
    format!("cloudpivot-backup-{}.db", timestamp)
}

/// 校验导入数量
fn validate_import_quantity(quantity: f64) -> Result<(), AppError> {
    if quantity <= 0.0 {
        return Err(AppError::Business("导入数量必须大于 0".to_string()));
    }
    Ok(())
}

/// 获取当前 SQLite 主库文件路径
async fn get_db_path(pool: &PgPool) -> Result<PathBuf, AppError> {
    let db_path: String =
        sqlx::query_scalar("SELECT file FROM pragma_database_list WHERE name = 'main'")
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Database(format!("获取数据库路径失败: {}", e)))?;

    if db_path.trim().is_empty() {
        return Err(AppError::Database(
            "数据库路径为空，无法执行数据管理操作".to_string(),
        ));
    }

    Ok(PathBuf::from(db_path))
}

/// 获取备份目录
fn get_backup_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Database(format!("无法获取应用数据目录: {}", e)))?;
    Ok(app_data_dir.join("backups"))
}

/// 格式化文件修改时间
fn format_modified_time(path: &Path) -> Result<String, AppError> {
    let modified = fs::metadata(path)?.modified()?;
    let datetime: chrono::DateTime<Local> = modified.into();
    Ok(datetime.format("%Y-%m-%d %H:%M:%S").to_string())
}

/// 扫描备份历史
fn list_backup_files(backup_dir: &Path) -> Result<Vec<BackupFileInfo>, AppError> {
    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let mut backups = Vec::new();
    for entry in fs::read_dir(backup_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("db") {
            continue;
        }

        let metadata = fs::metadata(&path)?;
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();

        backups.push(BackupFileInfo {
            file_name,
            file_path: path.display().to_string(),
            size_bytes: metadata.len(),
            created_at: format_modified_time(&path)?,
        });
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

/// 校验备份文件名，避免路径穿越
fn resolve_backup_file(backup_dir: &Path, file_name: &str) -> Result<PathBuf, AppError> {
    if file_name.contains('/') || file_name.contains('\\') || !file_name.ends_with(".db") {
        return Err(AppError::Business("备份文件名不合法".to_string()));
    }

    let path = backup_dir.join(file_name);
    if !path.exists() {
        return Err(AppError::Business("备份文件不存在".to_string()));
    }
    Ok(path)
}

/// 删除 SQLite WAL/SHM 辅助文件，避免恢复后旧日志重新参与打开
fn remove_sqlite_sidecar_files(db_path: &Path) -> Result<(), AppError> {
    for suffix in ["-wal", "-shm"] {
        let sidecar_path = PathBuf::from(format!("{}{}", db_path.display(), suffix));
        if sidecar_path.exists() {
            fs::remove_file(sidecar_path)?;
        }
    }
    Ok(())
}

/// 使用备份文件替换主库文件
fn replace_database_file(source: &Path, db_path: &Path) -> Result<(), AppError> {
    remove_sqlite_sidecar_files(db_path)?;
    fs::copy(source, db_path).map_err(AppError::Io)?;
    remove_sqlite_sidecar_files(db_path)?;
    Ok(())
}

/// 解析物料类型
fn normalize_material_type(value: &str) -> Result<String, AppError> {
    match value.trim() {
        "raw" | "原材料" => Ok("raw".to_string()),
        "semi" | "半成品" => Ok("semi".to_string()),
        "finished" | "成品" => Ok("finished".to_string()),
        _ => Err(AppError::Business(format!("不支持的物料类型: {}", value))),
    }
}

/// 解析批次追踪模式
fn normalize_lot_tracking_mode(value: Option<&str>) -> Result<String, AppError> {
    match value.unwrap_or("none").trim() {
        "" | "none" | "不追踪" => Ok("none".to_string()),
        "optional" | "可选" => Ok("optional".to_string()),
        "required" | "必填" => Ok("required".to_string()),
        other => Err(AppError::Business(format!(
            "不支持的批次追踪模式: {}",
            other
        ))),
    }
}

/// 按编码或名称解析分类
async fn resolve_category_id(
    pool: &PgPool,
    row: &MaterialImportRow,
) -> Result<Option<i64>, AppError> {
    if let Some(code) = row
        .category_code
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
    {
        let id = sqlx::query_scalar::<_, i64>("SELECT id FROM categories WHERE code = ?")
            .bind(code)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Database(format!("查询分类失败: {}", e)))?;
        return id
            .map(Some)
            .ok_or_else(|| AppError::Business(format!("分类编码不存在: {}", code)));
    }

    if let Some(name) = row
        .category_name
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
    {
        let id = sqlx::query_scalar::<_, i64>("SELECT id FROM categories WHERE name = ?")
            .bind(name)
            .fetch_optional(pool)
            .await
            .map_err(|e| AppError::Database(format!("查询分类失败: {}", e)))?;
        return id
            .map(Some)
            .ok_or_else(|| AppError::Business(format!("分类名称不存在: {}", name)));
    }

    Ok(None)
}

/// 按名称或符号解析单位
async fn resolve_unit_id(pool: &PgPool, unit_name: &str) -> Result<i64, AppError> {
    let unit_name = unit_name.trim();
    if unit_name.is_empty() {
        return Err(AppError::Business("基础单位不能为空".to_string()));
    }

    sqlx::query_scalar::<_, i64>("SELECT id FROM units WHERE name = ? OR symbol = ?")
        .bind(unit_name)
        .bind(unit_name)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Database(format!("查询单位失败: {}", e)))?
        .ok_or_else(|| AppError::Business(format!("单位不存在: {}", unit_name)))
}

/// 获取数据管理状态
#[tauri::command]
pub async fn get_data_management_status(
    app: AppHandle,
    db: State<'_, DbState>,
) -> Result<DataManagementStatus, AppError> {
    let db_path = get_db_path(&db.pool).await?;
    let backup_dir = get_backup_dir(&app)?;
    fs::create_dir_all(&backup_dir)?;

    let backups = list_backup_files(&backup_dir)?;
    let last_backup_at = backups.first().map(|item| item.created_at.clone());
    let db_size_bytes = fs::metadata(&db_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);

    Ok(DataManagementStatus {
        db_path: db_path.display().to_string(),
        db_size_bytes,
        backup_dir: backup_dir.display().to_string(),
        last_backup_at,
        backups,
    })
}

/// 创建数据库备份
#[tauri::command]
pub async fn create_database_backup(
    app: AppHandle,
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
) -> Result<BackupFileInfo, AppError> {
    let backup_dir = get_backup_dir(&app)?;
    fs::create_dir_all(&backup_dir)?;

    sqlx::raw_sql("PRAGMA wal_checkpoint(FULL)")
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("执行 WAL 检查点失败: {}", e)))?;

    let timestamp = Local::now().format("%Y%m%d%H%M%S").to_string();
    let backup_path = backup_dir.join(build_backup_file_name(&timestamp));
    let backup_path_text = backup_path.display().to_string();

    sqlx::query("VACUUM main INTO ?")
        .bind(&backup_path_text)
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("创建数据库备份失败: {}", e)))?;

    write_log(
        &db.pool,
        OperationLogEntry {
            module: "settings".to_string(),
            action: "backup".to_string(),
            target_type: Some("database".to_string()),
            target_id: None,
            target_no: Some(backup_path_text.clone()),
            detail: "创建数据库备份".to_string(),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    let metadata = fs::metadata(&backup_path)?;
    Ok(BackupFileInfo {
        file_name: backup_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        file_path: backup_path_text,
        size_bytes: metadata.len(),
        created_at: format_modified_time(&backup_path)?,
    })
}

/// 恢复数据库备份
#[tauri::command]
pub async fn restore_database_backup(
    app: AppHandle,
    db: State<'_, DbState>,
    file_name: String,
) -> Result<(), AppError> {
    let backup_dir = get_backup_dir(&app)?;
    let source = resolve_backup_file(&backup_dir, &file_name)?;
    let db_path = get_db_path(&db.pool).await?;

    sqlx::raw_sql("PRAGMA wal_checkpoint(FULL)")
        .execute(&db.pool)
        .await
        .map_err(|e| AppError::Database(format!("恢复前执行 WAL 检查点失败: {}", e)))?;

    db.pool.close().await;
    replace_database_file(&source, &db_path)?;
    app.request_restart();

    Ok(())
}

/// 删除数据库备份
#[tauri::command]
pub async fn delete_database_backup(app: AppHandle, file_name: String) -> Result<(), AppError> {
    let backup_dir = get_backup_dir(&app)?;
    let backup_file = resolve_backup_file(&backup_dir, &file_name)?;
    fs::remove_file(backup_file)?;
    Ok(())
}

/// 导出物料主数据
#[tauri::command]
pub async fn export_materials(db: State<'_, DbState>) -> Result<Vec<MaterialExportRow>, AppError> {
    sqlx::query_as::<_, MaterialExportRow>(
        r#"
        SELECT m.code, m.name, m.material_type, c.code AS category_code, c.name AS category_name,
               m.spec, bu.name AS base_unit_name, au.name AS aux_unit_name,
               m.conversion_rate, m.ref_cost_price, m.sale_price, m.safety_stock, m.max_stock,
               m.lot_tracking_mode, m.texture, m.color, m.surface_craft,
               m.length_mm, m.width_mm, m.height_mm, m.barcode, m.remark, m.is_enabled
        FROM materials m
        LEFT JOIN categories c ON c.id = m.category_id
        JOIN units bu ON bu.id = m.base_unit_id
        LEFT JOIN units au ON au.id = m.aux_unit_id
        ORDER BY m.code ASC
        "#,
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| AppError::Database(format!("导出物料失败: {}", e)))
}

/// 导入物料主数据
#[tauri::command]
pub async fn import_materials(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    rows: Vec<MaterialImportRow>,
) -> Result<ImportResult, AppError> {
    if rows.is_empty() {
        return Ok(ImportResult {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: vec![],
        });
    }

    let mut errors = Vec::new();
    let mut seen_codes = HashSet::new();
    for (index, row) in rows.iter().enumerate() {
        let line_no = index + 2;
        if row.code.trim().is_empty() {
            errors.push(format!("第 {} 行：物料编码不能为空", line_no));
        }
        if row.name.trim().is_empty() {
            errors.push(format!("第 {} 行：物料名称不能为空", line_no));
        }
        if !seen_codes.insert(row.code.trim().to_string()) {
            errors.push(format!("第 {} 行：导入文件内物料编码重复", line_no));
        }
        if let Err(e) = normalize_material_type(&row.material_type) {
            errors.push(format!("第 {} 行：{}", line_no, e));
        }
        if let Err(e) = normalize_lot_tracking_mode(row.lot_tracking_mode.as_deref()) {
            errors.push(format!("第 {} 行：{}", line_no, e));
        }
    }

    if !errors.is_empty() {
        return Ok(ImportResult {
            created: 0,
            updated: 0,
            skipped: rows.len() as u32,
            errors,
        });
    }

    for (index, row) in rows.iter().enumerate() {
        let line_no = index + 2;
        let material_type = normalize_material_type(&row.material_type)?;
        let lot_tracking_mode = normalize_lot_tracking_mode(row.lot_tracking_mode.as_deref())?;
        let base_unit_id = match resolve_unit_id(&db.pool, &row.base_unit_name).await {
            Ok(id) => id,
            Err(e) => {
                errors.push(format!("第 {} 行：{}", line_no, e));
                continue;
            }
        };

        let existing_id = sqlx::query_scalar::<_, i64>("SELECT id FROM materials WHERE code = ?")
            .bind(row.code.trim())
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| AppError::Database(format!("查询物料编码失败: {}", e)))?;

        if let Some(id) = existing_id {
            if let Err(e) = material::ensure_material_core_fields_editable(
                &db.pool,
                id,
                &material_type,
                base_unit_id,
                Some(&lot_tracking_mode),
            )
            .await
            {
                errors.push(format!("第 {} 行：{}", line_no, e));
            }
        }
    }

    if !errors.is_empty() {
        return Ok(ImportResult {
            created: 0,
            updated: 0,
            skipped: rows.len() as u32,
            errors,
        });
    }

    let mut created = 0;
    let mut updated = 0;
    let mut tx = db.pool.begin().await?;

    for row in rows {
        let material_type = normalize_material_type(&row.material_type)?;
        let lot_tracking_mode = normalize_lot_tracking_mode(row.lot_tracking_mode.as_deref())?;
        let category_id = resolve_category_id(&db.pool, &row).await?;
        let base_unit_id = resolve_unit_id(&db.pool, &row.base_unit_name).await?;
        let aux_unit_id = if let Some(aux_unit_name) = row
            .aux_unit_name
            .as_ref()
            .map(|v| v.trim())
            .filter(|v| !v.is_empty())
        {
            Some(resolve_unit_id(&db.pool, aux_unit_name).await?)
        } else {
            None
        };

        let existing_id = sqlx::query_scalar::<_, i64>("SELECT id FROM materials WHERE code = ?")
            .bind(row.code.trim())
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("查询物料编码失败: {}", e)))?;

        if let Some(id) = existing_id {
            sqlx::query(
                r#"
                UPDATE materials SET
                    name = ?, material_type = ?, category_id = ?, spec = ?,
                    base_unit_id = ?, aux_unit_id = ?, conversion_rate = ?,
                    ref_cost_price = COALESCE(?, 0), sale_price = COALESCE(?, 0),
                    safety_stock = COALESCE(?, 0), max_stock = COALESCE(?, 0),
                    lot_tracking_mode = ?, texture = ?, color = ?, surface_craft = ?,
                    length_mm = ?, width_mm = ?, height_mm = ?, barcode = ?, remark = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                "#,
            )
            .bind(row.name.trim())
            .bind(&material_type)
            .bind(category_id)
            .bind(row.spec.as_deref())
            .bind(base_unit_id)
            .bind(aux_unit_id)
            .bind(row.conversion_rate)
            .bind(row.ref_cost_price)
            .bind(row.sale_price)
            .bind(row.safety_stock)
            .bind(row.max_stock)
            .bind(&lot_tracking_mode)
            .bind(row.texture.as_deref())
            .bind(row.color.as_deref())
            .bind(row.surface_craft.as_deref())
            .bind(row.length_mm)
            .bind(row.width_mm)
            .bind(row.height_mm)
            .bind(row.barcode.as_deref())
            .bind(row.remark.as_deref())
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("更新物料失败: {}", e)))?;
            updated += 1;
        } else {
            sqlx::query(
                r#"
                INSERT INTO materials (
                    code, name, material_type, category_id, spec, base_unit_id, aux_unit_id,
                    conversion_rate, ref_cost_price, sale_price, safety_stock, max_stock,
                    lot_tracking_mode, texture, color, surface_craft, length_mm, width_mm,
                    height_mm, barcode, remark, is_enabled, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), COALESCE(?, 0),
                          COALESCE(?, 0), COALESCE(?, 0), ?, ?, ?, ?, ?, ?, ?, ?, ?,
                          1, datetime('now'), datetime('now'))
                "#,
            )
            .bind(row.code.trim())
            .bind(row.name.trim())
            .bind(&material_type)
            .bind(category_id)
            .bind(row.spec.as_deref())
            .bind(base_unit_id)
            .bind(aux_unit_id)
            .bind(row.conversion_rate)
            .bind(row.ref_cost_price)
            .bind(row.sale_price)
            .bind(row.safety_stock)
            .bind(row.max_stock)
            .bind(&lot_tracking_mode)
            .bind(row.texture.as_deref())
            .bind(row.color.as_deref())
            .bind(row.surface_craft.as_deref())
            .bind(row.length_mm)
            .bind(row.width_mm)
            .bind(row.height_mm)
            .bind(row.barcode.as_deref())
            .bind(row.remark.as_deref())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Database(format!("创建物料失败: {}", e)))?;
            created += 1;
        }
    }

    tx.commit().await?;

    write_log(
        &db.pool,
        OperationLogEntry {
            module: "material".to_string(),
            action: "import".to_string(),
            target_type: Some("materials".to_string()),
            target_id: None,
            target_no: None,
            detail: format!("导入物料：新增 {} 条，更新 {} 条", created, updated),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(ImportResult {
        created,
        updated,
        skipped: 0,
        errors: vec![],
    })
}

/// 导入期初库存
#[tauri::command]
pub async fn import_initial_inventory(
    db: State<'_, DbState>,
    current_user: State<'_, CurrentUser>,
    rows: Vec<InitialInventoryImportRow>,
) -> Result<ImportResult, AppError> {
    if rows.is_empty() {
        return Ok(ImportResult {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: vec![],
        });
    }

    let mut errors = Vec::new();
    for (index, row) in rows.iter().enumerate() {
        let line_no = index + 2;
        if row.material_code.trim().is_empty() {
            errors.push(format!("第 {} 行：物料编码不能为空", line_no));
        }
        if row.warehouse_code.trim().is_empty() {
            errors.push(format!("第 {} 行：仓库编码不能为空", line_no));
        }
        if let Err(e) = validate_import_quantity(row.quantity) {
            errors.push(format!("第 {} 行：{}", line_no, e));
        }
        if row.unit_cost_usd < 0 {
            errors.push(format!("第 {} 行：单位成本不能为负数", line_no));
        }
        if row.received_date.trim().is_empty() {
            errors.push(format!("第 {} 行：入库日期不能为空", line_no));
        }
    }

    if !errors.is_empty() {
        return Ok(ImportResult {
            created: 0,
            updated: 0,
            skipped: rows.len() as u32,
            errors,
        });
    }

    let mut tx = db.pool.begin().await?;
    let mut created = 0;

    for row in rows {
        let resolved = sqlx::query_as::<_, InitialInventoryResolvedRow>(
            r#"
            SELECT m.id AS material_id, w.id AS warehouse_id, m.lot_tracking_mode
            FROM materials m
            JOIN warehouses w ON w.code = ?
            WHERE m.code = ?
            "#,
        )
        .bind(row.warehouse_code.trim())
        .bind(row.material_code.trim())
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Database(format!("查询物料和仓库失败: {}", e)))?
        .ok_or_else(|| {
            AppError::Business(format!(
                "物料或仓库不存在: {} / {}",
                row.material_code, row.warehouse_code
            ))
        })?;

        let (before_qty, after_qty) = inventory_ops::increase_inventory(
            &mut tx,
            resolved.material_id,
            resolved.warehouse_id,
            row.quantity,
            row.unit_cost_usd,
            &row.received_date,
        )
        .await?;

        let lot_id = if resolved.lot_tracking_mode != "none" {
            let lot_no = if let Some(lot_no) = row
                .lot_no
                .as_ref()
                .map(|v| v.trim())
                .filter(|v| !v.is_empty())
            {
                lot_no.to_string()
            } else {
                inventory_ops::generate_lot_no(&mut tx, &row.received_date).await?
            };

            Some(
                inventory_ops::create_inventory_lot(
                    &mut tx,
                    &lot_no,
                    resolved.material_id,
                    resolved.warehouse_id,
                    0,
                    None,
                    &row.received_date,
                    row.supplier_batch_no.as_deref(),
                    None,
                    row.quantity,
                    row.unit_cost_usd,
                )
                .await?,
            )
        } else {
            None
        };

        inventory_ops::record_transaction(
            &mut tx,
            &row.received_date,
            resolved.material_id,
            resolved.warehouse_id,
            lot_id,
            "other_in",
            row.quantity,
            before_qty,
            after_qty,
            row.unit_cost_usd,
            Some("initial_inventory"),
            None,
            None,
            Some("INIT"),
            row.remark.as_deref(),
            current_user.user_id(),
            &current_user.display_name(),
        )
        .await?;

        created += 1;
    }

    tx.commit().await?;

    write_log(
        &db.pool,
        OperationLogEntry {
            module: "inventory".to_string(),
            action: "import_initial".to_string(),
            target_type: Some("initial_inventory".to_string()),
            target_id: None,
            target_no: Some("INIT".to_string()),
            detail: format!("导入期初库存 {} 条", created),
            operator_user_id: Some(current_user.user_id()),
            operator_name: Some(current_user.display_name()),
        },
    )
    .await;

    Ok(ImportResult {
        created,
        updated: 0,
        skipped: 0,
        errors: vec![],
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{build_backup_file_name, replace_database_file, validate_import_quantity};

    #[test]
    fn build_backup_file_name_keeps_stable_prefix_and_extension() {
        let file_name = build_backup_file_name("20260429153045");

        assert_eq!(file_name, "cloudpivot-backup-20260429153045.db");
    }

    #[test]
    fn validate_import_quantity_rejects_zero_and_negative_values() {
        assert!(validate_import_quantity(1.0).is_ok());
        assert!(validate_import_quantity(0.0).is_err());
        assert!(validate_import_quantity(-1.0).is_err());
    }

    #[test]
    fn replace_database_file_removes_sidecar_files_and_copies_backup() {
        let test_dir = std::env::temp_dir().join(format!(
            "cloudpivot-restore-test-{}",
            chrono::Local::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
        ));
        fs::create_dir_all(&test_dir).expect("创建恢复测试目录失败");

        let backup_path = test_dir.join("backup.db");
        let db_path = test_dir.join("main.db");
        let wal_path = test_dir.join("main.db-wal");
        let shm_path = test_dir.join("main.db-shm");

        fs::write(&backup_path, b"backup").expect("写入备份测试文件失败");
        fs::write(&db_path, b"current").expect("写入主库测试文件失败");
        fs::write(&wal_path, b"wal").expect("写入 WAL 测试文件失败");
        fs::write(&shm_path, b"shm").expect("写入 SHM 测试文件失败");

        replace_database_file(&backup_path, &db_path).expect("替换数据库文件失败");

        assert_eq!(fs::read(&db_path).expect("读取主库测试文件失败"), b"backup");
        assert!(!wal_path.exists());
        assert!(!shm_path.exists());

        fs::remove_dir_all(&test_dir).expect("清理恢复测试目录失败");
    }
}
