import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { ServiceCard } from "../components/service-card";
import { useLocalServices, type ServiceId } from "../hooks/use-local-services";
import {
  getStartableServices,
  getStoppableServices,
  type ServiceStatus,
} from "../services/service-model";

export function ServicesPage() {
  const {
    services,
    setup,
    isLoading,
    isConfiguring,
    transitions,
    error,
    refresh,
    configureServices,
    runAction,
  } = useLocalServices();
  const [bulkAction, setBulkAction] = useState<"start" | "stop" | null>(null);
  const [stopAllOpen, setStopAllOpen] = useState(false);

  const statuses = services
    .map((service) => service.status)
    .filter((status): status is ServiceStatus => status !== null);

  async function runForAll(serviceIds: ServiceId[], action: "start" | "stop") {
    setBulkAction(action);
    try {
      for (const serviceId of serviceIds) {
        await runAction(serviceId, action);
      }
    } finally {
      setBulkAction(null);
    }
  }

  async function startAll() {
    await runForAll(getStartableServices(statuses), "start");
  }

  function stopAll() {
    const running = getStoppableServices(statuses);
    if (running.length === 0) return;
    setStopAllOpen(true);
  }

  async function confirmStopAll() {
    setStopAllOpen(false);
    await runForAll(getStoppableServices(statuses), "stop");
  }

  useEffect(() => {
    if (!stopAllOpen) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setStopAllOpen(false);
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [stopAllOpen]);

  async function openHub() {
    try {
      await invoke<void>("open_hub");
    } catch (cause) {
      console.error("Falha ao abrir o Hub", cause);
    }
  }

  const busy =
    bulkAction !== null ||
    Object.keys(transitions).length > 0 ||
    isConfiguring;

  const runningCount = statuses.filter((status) => status.state === "RUNNING").length;
  const configuredCount = services.filter((service) => service.status?.installed).length;

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className="eyebrow">Local Agent Desktop</span>
          </div>
          <h1>Serviços locais</h1>
          <p>Controle seguro do Worker e do Observer via systemd --user.</p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => void refresh()}
          disabled={busy}
        >
          Atualizar
        </button>
      </header>

      <section className="overview" aria-label="Resumo dos serviços">
        <div>
          <span className="overview__label">Em execução</span>
          <strong>{runningCount}<small> / {services.length}</small></strong>
        </div>
        <div>
          <span className="overview__label">Configurados</span>
          <strong>{configuredCount}<small> / {services.length}</small></strong>
        </div>
        <div className="overview__hint">
          <span className="pulse" aria-hidden="true" />
          Monitoramento automático a cada 5 segundos
        </div>
      </section>

      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}

      {setup && !setup.configured && (
        <section className="setup-banner">
          <div>
            <h2>Configuração necessária</h2>
            <p>{setup.message}</p>
          </div>
          <button
            type="button"
            onClick={() => void configureServices()}
            disabled={busy || !setup.workspaceFound}
          >
            {isConfiguring ? "Configurando..." : "Configurar serviços"}
          </button>
        </section>
      )}

      {isLoading && !setup && (
        <div className="loading-banner" role="status">Consultando os serviços locais...</div>
      )}

      <section className="toolbar" aria-label="Ações coletivas">
        <button
          type="button"
          onClick={() => void startAll()}
          disabled={busy || getStartableServices(statuses).length === 0}
        >
          {bulkAction === "start" ? "Iniciando..." : "Iniciar todos"}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => void stopAll()}
          disabled={busy || getStoppableServices(statuses).length === 0}
        >
          {bulkAction === "stop" ? "Parando..." : "Parar todos"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void openHub()}
          disabled={busy}
        >
          Abrir Hub
        </button>
      </section>

      <section className="service-grid">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            transition={transitions[service.id] ?? null}
            onAction={runAction}
          />
        ))}
      </section>

      {stopAllOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setStopAllOpen(false);
          }}
        >
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stop-modal-title"
            aria-describedby="stop-modal-description"
          >
            <div className="confirm-modal__icon" aria-hidden="true">!</div>
            <div className="confirm-modal__content">
              <span className="eyebrow">Ação coletiva</span>
              <h2 id="stop-modal-title">Parar serviços ativos?</h2>
              <p id="stop-modal-description">
                Os serviços abaixo serão encerrados agora. O sistema poderá iniciá-los novamente
                conforme a configuração do systemd.
              </p>
              <ul className="confirm-modal__services">
                {services
                  .filter((service) => service.status?.state === "RUNNING")
                  .map((service) => <li key={service.id}>{service.name}</li>)}
              </ul>
            </div>
            <div className="confirm-modal__actions">
              <button type="button" className="secondary" onClick={() => setStopAllOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="danger" onClick={() => void confirmStopAll()}>
                Parar serviços
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
