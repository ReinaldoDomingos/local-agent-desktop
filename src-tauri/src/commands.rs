use crate::service_manager::{self, ServiceId, ServiceStatus, ServicesSetupStatus};

#[tauri::command]
pub fn get_services_status() -> Result<Vec<ServiceStatus>, String> {
    [ServiceId::Worker, ServiceId::Observer]
        .into_iter()
        .map(service_manager::get_status)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_services_setup_status() -> ServicesSetupStatus {
    service_manager::setup_status()
}

#[tauri::command]
pub fn setup_services() -> Result<ServicesSetupStatus, String> {
    service_manager::setup_services().map_err(|error| error.to_string())
}

fn parse_service(service: &str) -> Result<ServiceId, String> {
    ServiceId::parse(service).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn start_service(service: String) -> Result<(), String> {
    service_manager::start(parse_service(&service)?).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn stop_service(service: String) -> Result<(), String> {
    service_manager::stop(parse_service(&service)?).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn restart_service(service: String) -> Result<(), String> {
    service_manager::restart(parse_service(&service)?).map_err(|error| error.to_string())
}
