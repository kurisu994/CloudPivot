//! 原生菜单栏：构建、国际化、事件分发

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Wry,
};

const MENU_ABOUT: &str = "menu_about";
const MENU_CHECK_UPDATE: &str = "menu_check_update";

struct Labels {
    app_name: &'static str,
    edit: &'static str,
    help: &'static str,
    about: &'static str,
    check_update: &'static str,
}

fn get_labels(locale: &str) -> Labels {
    match locale {
        "en" => Labels {
            app_name: "CloudPivot IMS",
            edit: "Edit",
            help: "Help",
            about: "About CloudPivot IMS",
            check_update: "Check for Updates…",
        },
        "vi" => Labels {
            app_name: "CloudPivot IMS",
            edit: "Chỉnh sửa",
            help: "Trợ giúp",
            about: "Giới thiệu CloudPivot IMS",
            check_update: "Kiểm tra cập nhật…",
        },
        _ => Labels {
            app_name: "云枢",
            edit: "编辑",
            help: "帮助",
            about: "关于云枢",
            check_update: "检查更新…",
        },
    }
}

/// 根据语言构建完整菜单栏
pub fn build_menu(app: &AppHandle, locale: &str) -> tauri::Result<Menu<Wry>> {
    let labels = get_labels(locale);

    // macOS 应用菜单（About / Services / Hide / Quit 由系统处理）
    let app_menu = Submenu::with_items(
        app,
        labels.app_name,
        true,
        &[
            &PredefinedMenuItem::about(app, None, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    // 编辑菜单（保留系统快捷键）
    let edit_menu = Submenu::with_items(
        app,
        labels.edit,
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    // 帮助菜单
    let help_menu = Submenu::with_items(
        app,
        labels.help,
        true,
        &[
            &MenuItem::with_id(app, MENU_ABOUT, labels.about, true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                MENU_CHECK_UPDATE,
                labels.check_update,
                true,
                None::<&str>,
            )?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &edit_menu, &help_menu])
}

/// 处理自定义菜单项点击
pub fn handle_menu_event(app: &AppHandle, event: &tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        MENU_ABOUT => {
            let _ = app.emit("open-about-dialog", ());
        }
        MENU_CHECK_UPDATE => {
            let _ = app.emit("menu-check-update", ());
        }
        _ => {}
    }
}

/// 前端切换语言时重建菜单
#[tauri::command]
pub fn set_menu_locale(app: AppHandle, locale: String) -> Result<(), String> {
    let menu = build_menu(&app, &locale).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}
