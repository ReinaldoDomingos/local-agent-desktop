use serde::Serialize;
use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    process::Command,
};
use thiserror::Error;

const START_SERVICE_SCRIPT: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/scripts/start-managed-service.sh"
);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServiceId {
    Worker,
    Observer,
}

impl ServiceId {
    pub fn parse(value: &str) -> Result<Self, ServiceManagerError> {
        match value {
            "worker" => Ok(Self::Worker),
            "observer" => Ok(Self::Observer),
            _ => Err(ServiceManagerError::InvalidService(value.to_owned())),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Worker => "worker",
            Self::Observer => "observer",
        }
    }

    pub fn unit(self) -> &'static str {
        match self {
            Self::Worker => "local-agent-worker.service",
            Self::Observer => "local-agent-observer.service",
        }
    }

    fn module_dir(self) -> &'static str {
        match self {
            Self::Worker => "local-agent-worker",
            Self::Observer => "local-agent-observer",
        }
    }

    fn description(self) -> &'static str {
        match self {
            Self::Worker => "Local Agent Worker",
            Self::Observer => "Local Agent Observer",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ServiceState {
    Stopped,
    Starting,
    Running,
    Stopping,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStatus {
    pub id: String,
    pub unit: String,
    pub installed: bool,
    pub state: ServiceState,
    pub pid: Option<u32>,
    pub uptime_seconds: Option<u64>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServicesSetupStatus {
    pub configured: bool,
    pub workspace_found: bool,
    pub message: Option<String>,
}

#[derive(Debug, Error, PartialEq, Eq, Clone)]
pub enum ServiceManagerError {
    #[error("Serviço inválido: {0}")]
    InvalidService(String),
    #[error("Falha ao executar systemctl: {0}")]
    Systemctl(String),
    #[error("Não foi possível localizar o workspace do Local Agent")]
    WorkspaceNotFound,
    #[error("Diretório do serviço não encontrado: {0}")]
    ServiceDirectoryNotFound(String),
    #[error("Artefato compilado não encontrado: {0}. Execute npm run build no módulo.")]
    BuildArtifactNotFound(String),
    #[error("Arquivo .nvmrc não encontrado: {0}")]
    NodeVersionFileNotFound(String),
    #[error("Script de inicialização do serviço não encontrado: {0}")]
    ServiceStartScriptNotFound(String),
    #[error("Falha ao configurar os serviços: {0}")]
    Setup(String),
}

trait SystemctlRunner {
    fn run(&self, args: &[&str]) -> Result<String, ServiceManagerError>;
}

struct CommandSystemctlRunner;

impl SystemctlRunner for CommandSystemctlRunner {
    fn run(&self, args: &[&str]) -> Result<String, ServiceManagerError> {
        let output = Command::new("systemctl")
            .arg("--user")
            .args(args)
            .output()
            .map_err(|error| ServiceManagerError::Systemctl(error.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            return Err(ServiceManagerError::Systemctl(if stderr.is_empty() {
                format!("systemctl terminou com status {}", output.status)
            } else {
                stderr
            }));
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
    }
}

fn parse_properties(output: &str) -> HashMap<&str, &str> {
    output
        .lines()
        .filter_map(|line| line.split_once('='))
        .collect()
}

fn interpret_state(active: &str) -> ServiceState {
    match active {
        "active" => ServiceState::Running,
        "activating" => ServiceState::Starting,
        "deactivating" => ServiceState::Stopping,
        "inactive" => ServiceState::Stopped,
        "failed" => ServiceState::Failed,
        _ => ServiceState::Failed,
    }
}

fn current_monotonic_micros() -> Option<u64> {
    let mut time = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    let result = unsafe { libc::clock_gettime(libc::CLOCK_MONOTONIC, &mut time) };
    (result == 0 && time.tv_sec >= 0 && time.tv_nsec >= 0).then(|| {
        (time.tv_sec as u64)
            .saturating_mul(1_000_000)
            .saturating_add((time.tv_nsec as u64) / 1_000)
    })
}

fn calculate_uptime_seconds(active: Option<u64>, current: Option<u64>) -> Option<u64> {
    current?
        .checked_sub(active?)
        .map(|micros| micros / 1_000_000)
}

fn compose_status(service: ServiceId, output: &str, now: Option<u64>) -> ServiceStatus {
    let properties = parse_properties(output);
    let load_state = properties.get("LoadState").copied().unwrap_or("not-found");
    let installed = load_state != "not-found";
    let active = properties.get("ActiveState").copied().unwrap_or("unknown");
    let substate = properties.get("SubState").copied().unwrap_or("unknown");
    let result = properties.get("Result").copied().unwrap_or("success");
    let restarting_after_failure =
        active == "activating" && substate == "auto-restart" && result != "success";
    let state = if installed {
        if restarting_after_failure {
            ServiceState::Failed
        } else {
            interpret_state(active)
        }
    } else {
        ServiceState::Stopped
    };
    let pid = properties
        .get("MainPID")
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|pid| *pid > 0);
    let active_enter = properties
        .get("ActiveEnterTimestampMonotonic")
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0);
    let uptime_seconds = matches!(state, ServiceState::Running)
        .then(|| calculate_uptime_seconds(active_enter, now))
        .flatten();
    let message = if !installed {
        Some("Serviço ainda não configurado.".to_owned())
    } else if matches!(state, ServiceState::Failed) {
        Some(format!(
            "ActiveState={active}; SubState={substate}; Result={result}"
        ))
    } else {
        None
    };

    ServiceStatus {
        id: service.as_str().to_owned(),
        unit: service.unit().to_owned(),
        installed,
        state,
        pid,
        uptime_seconds,
        message,
    }
}

fn get_status_with(
    runner: &impl SystemctlRunner,
    service: ServiceId,
    now: Option<u64>,
) -> Result<ServiceStatus, ServiceManagerError> {
    let output = runner.run(&[
        "show",
        service.unit(),
        "--property",
        "LoadState",
        "--property",
        "ActiveState",
        "--property",
        "SubState",
        "--property",
        "MainPID",
        "--property",
        "ActiveEnterTimestampMonotonic",
        "--property",
        "Result",
    ])?;
    Ok(compose_status(service, &output, now))
}

pub fn get_status(service: ServiceId) -> Result<ServiceStatus, ServiceManagerError> {
    get_status_with(&CommandSystemctlRunner, service, current_monotonic_micros())
}

pub fn start(service: ServiceId) -> Result<(), ServiceManagerError> {
    CommandSystemctlRunner
        .run(&["start", service.unit()])
        .map(|_| ())
}

pub fn stop(service: ServiceId) -> Result<(), ServiceManagerError> {
    CommandSystemctlRunner
        .run(&["stop", service.unit()])
        .map(|_| ())
}

pub fn restart(service: ServiceId) -> Result<(), ServiceManagerError> {
    CommandSystemctlRunner
        .run(&["restart", service.unit()])
        .map(|_| ())
}

fn home_dir() -> Result<PathBuf, ServiceManagerError> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| ServiceManagerError::Setup("Variável HOME não definida.".to_owned()))
}

fn has_modules(path: &Path) -> bool {
    [ServiceId::Worker, ServiceId::Observer]
        .into_iter()
        .all(|service| path.join(service.module_dir()).is_dir())
}

fn find_workspace() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(path) = env::var("LOCAL_AGENT_WORKSPACE") {
        candidates.push(PathBuf::from(path));
    }

    if let Ok(current) = env::current_dir() {
        candidates.extend(current.ancestors().map(Path::to_path_buf));
    }

    if let Ok(home) = home_dir() {
        candidates.push(home.join("workspace/estudo/local-agent"));
    }

    candidates.into_iter().find(|path| has_modules(path))
}

fn unit_directory() -> Result<PathBuf, ServiceManagerError> {
    Ok(home_dir()?.join(".config/systemd/user"))
}

fn unit_path(service: ServiceId) -> Result<PathBuf, ServiceManagerError> {
    Ok(unit_directory()?.join(service.unit()))
}

fn quote_exec_arg(path: &Path) -> String {
    format!("\"{}\"", path.display().to_string().replace('"', "\\\""))
}

fn unit_path_value(path: &Path) -> Result<String, ServiceManagerError> {
    let value = path.display().to_string();
    if value.contains(['\n', '\r']) {
        return Err(ServiceManagerError::Setup(
            "Caminho inválido para unit do systemd.".to_owned(),
        ));
    }
    Ok(value)
}

fn build_entrypoint(service: ServiceId, workspace: &Path) -> Result<PathBuf, ServiceManagerError> {
    let module = workspace.join(service.module_dir());
    let entrypoint_candidates: &[&str] = match service {
        ServiceId::Worker => &["dist/index.js"],
        ServiceId::Observer => &["dist/src/index.js", "dist/index.js"],
    };
    entrypoint_candidates
        .iter()
        .map(|candidate| module.join(candidate))
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            ServiceManagerError::BuildArtifactNotFound(
                entrypoint_candidates
                    .iter()
                    .map(|candidate| module.join(candidate).display().to_string())
                    .collect::<Vec<_>>()
                    .join(" ou "),
            )
        })
}

fn start_script_path() -> Result<PathBuf, ServiceManagerError> {
    let path = PathBuf::from(START_SERVICE_SCRIPT);
    if path.is_file() {
        Ok(path)
    } else {
        Err(ServiceManagerError::ServiceStartScriptNotFound(
            path.display().to_string(),
        ))
    }
}

fn node_version_file(service: ServiceId, workspace: &Path) -> Result<PathBuf, ServiceManagerError> {
    let path = workspace.join(service.module_dir()).join(".nvmrc");
    if path.is_file() {
        Ok(path)
    } else {
        Err(ServiceManagerError::NodeVersionFileNotFound(
            path.display().to_string(),
        ))
    }
}

fn unit_content(service: ServiceId, workspace: &Path) -> Result<String, ServiceManagerError> {
    let module = workspace.join(service.module_dir());
    if !module.is_dir() {
        return Err(ServiceManagerError::ServiceDirectoryNotFound(
            module.display().to_string(),
        ));
    }

    let _node_version_file = node_version_file(service, workspace)?;
    let _entrypoint = build_entrypoint(service, workspace)?;
    let start_script = start_script_path()?;

    let env_file = module.join(".env");
    let env_line = env_file
        .is_file()
        .then(|| unit_path_value(&env_file).map(|path| format!("EnvironmentFile={path}\n")))
        .transpose()?
        .unwrap_or_default();

    Ok(format!(
        "[Unit]\nDescription={}\nAfter=network-online.target\nWants=network-online.target\nStartLimitIntervalSec=30\nStartLimitBurst=3\n\n[Service]\nType=simple\nWorkingDirectory={}\n{}ExecStart=/bin/bash {} {}\nRestart=on-failure\nRestartSec=3\nTimeoutStopSec=15\nKillSignal=SIGTERM\n\n[Install]\nWantedBy=default.target\n",
        service.description(),
        unit_path_value(&module)?,
        env_line,
        quote_exec_arg(&start_script),
        quote_exec_arg(&module),
    ))
}

pub fn setup_status() -> ServicesSetupStatus {
    let workspace_found = find_workspace().is_some();
    let configured = [ServiceId::Worker, ServiceId::Observer]
        .into_iter()
        .all(|service| {
            unit_path(service)
                .map(|path| path.is_file())
                .unwrap_or(false)
        });
    let message = if !workspace_found {
        Some(
            "Workspace do Local Agent não encontrado. Defina LOCAL_AGENT_WORKSPACE antes de configurar."
                .to_owned(),
        )
    } else if !configured {
        Some("Os serviços ainda precisam ser configurados para systemd --user.".to_owned())
    } else {
        None
    };

    ServicesSetupStatus {
        configured,
        workspace_found,
        message,
    }
}

pub fn setup_services() -> Result<ServicesSetupStatus, ServiceManagerError> {
    let workspace = find_workspace().ok_or(ServiceManagerError::WorkspaceNotFound)?;
    let directory = unit_directory()?;
    fs::create_dir_all(&directory)
        .map_err(|error| ServiceManagerError::Setup(error.to_string()))?;

    for service in [ServiceId::Worker, ServiceId::Observer] {
        fs::write(unit_path(service)?, unit_content(service, &workspace)?)
            .map_err(|error| ServiceManagerError::Setup(error.to_string()))?;
    }

    CommandSystemctlRunner.run(&["daemon-reload"])?;
    for service in [ServiceId::Worker, ServiceId::Observer] {
        CommandSystemctlRunner.run(&["enable", service.unit()])?;
    }

    Ok(setup_status())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct StubRunner {
        result: Result<String, ServiceManagerError>,
    }

    impl SystemctlRunner for StubRunner {
        fn run(&self, _args: &[&str]) -> Result<String, ServiceManagerError> {
            self.result.clone()
        }
    }

    #[test]
    fn accepts_only_fixed_services() {
        assert_eq!(
            ServiceId::parse("worker").unwrap().unit(),
            "local-agent-worker.service"
        );
        assert_eq!(
            ServiceId::parse("observer").unwrap().unit(),
            "local-agent-observer.service"
        );
        assert!(ServiceId::parse("../worker").is_err());
    }

    #[test]
    fn interprets_states() {
        assert_eq!(interpret_state("active"), ServiceState::Running);
        assert_eq!(interpret_state("inactive"), ServiceState::Stopped);
        assert_eq!(interpret_state("failed"), ServiceState::Failed);
    }

    #[test]
    fn composes_missing_unit_as_not_installed() {
        let status = compose_status(
            ServiceId::Worker,
            "LoadState=not-found\nActiveState=inactive\nSubState=dead\nMainPID=0\n",
            None,
        );
        assert!(!status.installed);
        assert_eq!(status.state, ServiceState::Stopped);
    }

    #[test]
    fn reports_failed_auto_restart_instead_of_starting_forever() {
        let status = compose_status(
            ServiceId::Observer,
            "LoadState=loaded\nActiveState=activating\nSubState=auto-restart\nResult=exit-code\nMainPID=0\n",
            None,
        );
        assert_eq!(status.state, ServiceState::Failed);
        assert!(status.message.unwrap().contains("Result=exit-code"));
    }

    #[test]
    fn calculates_uptime() {
        assert_eq!(
            calculate_uptime_seconds(Some(12_000_000), Some(42_500_000)),
            Some(30)
        );
        assert_eq!(
            calculate_uptime_seconds(Some(42_500_000), Some(12_000_000)),
            None
        );
    }

    #[test]
    fn propagates_runner_errors() {
        let runner = StubRunner {
            result: Err(ServiceManagerError::Systemctl("erro".to_owned())),
        };
        assert!(get_status_with(&runner, ServiceId::Worker, None).is_err());
    }

    #[test]
    fn generates_systemd_units_that_use_nvm_wrapper() {
        let base = std::env::temp_dir().join(format!(
            "local-agent-desktop-unit-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock before unix epoch")
                .as_nanos()
        ));
        let worker = base.join("local-agent-worker");
        let observer = base.join("local-agent-observer");

        std::fs::create_dir_all(&worker).expect("failed to create worker dir");
        std::fs::create_dir_all(&observer).expect("failed to create observer dir");
        std::fs::write(worker.join(".nvmrc"), "26.3.0\n").expect("failed to write worker nvmrc");
        std::fs::write(observer.join(".nvmrc"), "26.3.0\n")
            .expect("failed to write observer nvmrc");
        std::fs::create_dir_all(worker.join("dist")).expect("failed to create worker dist dir");
        std::fs::write(worker.join("dist/index.js"), "console.log('ok');\n")
            .expect("failed to write worker dist file");

        let unit = unit_content(ServiceId::Worker, &base).expect("failed to build unit");

        assert!(unit.contains("ExecStart=/bin/bash"));
        assert!(unit.contains("start-managed-service.sh"));
        assert!(unit.contains(&worker.display().to_string()));
        assert!(!unit.contains("dist/index.js"));

        std::fs::remove_dir_all(&base).ok();
    }
}
