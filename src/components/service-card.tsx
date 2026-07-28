import {
  canStartService,
  canStopService,
  type LocalService,
  type ServiceAction,
  type ServiceId,
  type ServiceTransition,
} from "../services/service-model";

interface ServiceCardProps {
  service: LocalService;
  transition: ServiceTransition | null;
  onAction: (service: ServiceId, action: ServiceAction) => Promise<void>;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "-";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

export function ServiceCard({ service, transition, onAction }: ServiceCardProps) {
  const status = service.status;
  const busy = transition !== null;
  const running = status?.state === "RUNNING";
  const canStart = status ? canStartService(status) : false;
  const canStop = status ? canStopService(status) : false;

  return (
    <article className={`service-card service-card--${(status?.state ?? "STOPPED").toLowerCase()}`}>
      <div className="service-card__header">
        <div>
          <span
            className={`status-dot status-${(status?.state ?? "STOPPED").toLowerCase()}`}
          />
          <h2>{service.name}</h2>
        </div>
        <strong className="service-state">{status?.state ?? "NÃO CONFIGURADO"}</strong>
      </div>

      <p>{service.description}</p>

      <dl className="service-details">
        <div>
          <dt>Unit</dt>
          <dd>{status?.unit ?? "-"}</dd>
        </div>
        <div>
          <dt>PID</dt>
          <dd>{status?.pid ?? "-"}</dd>
        </div>
        <div>
          <dt>Ativo há</dt>
          <dd>{formatUptime(status?.uptimeSeconds ?? null)}</dd>
        </div>
      </dl>

      {status?.message && <p className="service-message">{status.message}</p>}

      <div className="service-actions">
        <button
          type="button"
          disabled={busy || !canStart}
          onClick={() => void onAction(service.id, "start")}
        >
          {transition === "start" ? "Iniciando..." : "Iniciar"}
        </button>
        <button
          type="button"
          disabled={busy || !canStop}
          onClick={() => void onAction(service.id, "stop")}
        >
          {transition === "stop" ? "Parando..." : "Parar"}
        </button>
        <button
          type="button"
          disabled={busy || !running}
          onClick={() => void onAction(service.id, "restart")}
        >
          {transition === "restart" ? "Reiniciando..." : "Reiniciar"}
        </button>
      </div>
    </article>
  );
}
