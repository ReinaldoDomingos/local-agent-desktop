mod commands;
mod service_manager;

const HUB_PRODUCTION_URL: &str = "https://local-agent-view.pages.dev/";

use commands::{
    get_services_setup_status, get_services_status, restart_service, setup_services, start_service,
    stop_service,
};

#[tauri::command]
fn open_hub() -> Result<(), String> {
    tauri_plugin_opener::open_url(HUB_PRODUCTION_URL, None::<&str>)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_services_status,
            get_services_setup_status,
            setup_services,
            start_service,
            stop_service,
            restart_service,
            open_hub
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o Local Agent Desktop");
}
