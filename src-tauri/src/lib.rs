mod commands;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Listener, Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Gate that lets a close/quit through once the frontend has confirmed.
    let allow_exit = Arc::new(AtomicBool::new(false));

    let window_flag = allow_exit.clone();
    let setup_flag = allow_exit.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Window close (Cmd-W / red traffic-light button): defer to the frontend.
        .on_window_event(move |window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !window_flag.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.emit("app-close-requested", ());
                }
            }
        })
        // Our custom Quit item (see menu below) routes here instead of the
        // native macOS `terminate:`, which would bypass every guard.
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "quit" {
                let _ = app.emit("app-close-requested", ());
            }
        })
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(tauri::Theme::Dark));
            }

            // Build a custom menu so Quit (Cmd+Q) goes through our save guard.
            // macOS's predefined Quit calls `terminate:`, which tao cannot
            // cancel, so RunEvent::ExitRequested never gets a chance to prevent
            // it. A normal menu item with a "quit" id avoids that entirely.
            let handle = app.handle();
            let quit = MenuItem::with_id(handle, "quit", "Quit i18n Bonsai", true, Some("CmdOrCtrl+Q"))?;
            let app_menu = Submenu::with_items(
                handle,
                "i18n Bonsai",
                true,
                &[
                    &PredefinedMenuItem::about(handle, None, Some(AboutMetadata::default()))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::hide(handle, None)?,
                    &PredefinedMenuItem::hide_others(handle, None)?,
                    &PredefinedMenuItem::show_all(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &quit,
                ],
            )?;
            // Edit menu keeps the standard text-editing shortcuts working.
            let edit_menu = Submenu::with_items(
                handle,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(handle, None)?,
                    &PredefinedMenuItem::redo(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, None)?,
                    &PredefinedMenuItem::copy(handle, None)?,
                    &PredefinedMenuItem::paste(handle, None)?,
                    &PredefinedMenuItem::select_all(handle, None)?,
                ],
            )?;
            let window_menu = Submenu::with_items(
                handle,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(handle, None)?,
                    &PredefinedMenuItem::maximize(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::close_window(handle, None)?,
                ],
            )?;
            let menu = Menu::with_items(handle, &[&app_menu, &edit_menu, &window_menu])?;
            app.set_menu(menu)?;

            // When the frontend confirms the discard (or there's nothing to
            // save), open the gate and trigger the exit, which then passes the
            // guards above cleanly.
            let exit_handle = app.handle().clone();
            app.listen_any("confirm-exit", move |_| {
                setup_flag.store(true, Ordering::SeqCst);
                exit_handle.exit(0);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_translation_group,
            commands::translation_write_file,
            commands::translation_write_files,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    // Safety net for any other exit path (e.g. system logout): also defer.
    app.run(move |app_handle, event| {
        if let RunEvent::ExitRequested { api, .. } = event {
            if !allow_exit.load(Ordering::SeqCst) {
                api.prevent_exit();
                let _ = app_handle.emit("app-close-requested", ());
            }
        }
    });
}
