export type ServiceId = "worker" | "observer";

export type ServiceState =
  | "STOPPED"
  | "STARTING"
  | "RUNNING"
  | "STOPPING"
  | "FAILED";

export type ServiceAction = "start" | "stop" | "restart";

export type ServiceTransition = ServiceAction;

export type ServiceStatus = {
  id: ServiceId;
  unit: string;
  installed: boolean;
  state: ServiceState;
  pid: number | null;
  uptimeSeconds: number | null;
  message: string | null;
};

export type LocalService = {
  id: ServiceId;
  name: string;
  description: string;
  status: ServiceStatus | null;
};

export const SERVICE_DEFINITIONS: ReadonlyArray<Omit<LocalService, "status">> = [
  {
    id: "worker",
    name: "Worker",
    description: "Executa as tarefas do Local Agent e expõe sua API local.",
  },
  {
    id: "observer",
    name: "Observer",
    description: "Acompanha a fila de tarefas e notifica o worker.",
  },
];

export function canStartService(service: ServiceStatus): boolean {
  return service.installed && (service.state === "STOPPED" || service.state === "FAILED");
}

export function canStopService(service: ServiceStatus): boolean {
  return service.installed && service.state === "RUNNING";
}

export function getStartableServices(services: ServiceStatus[]): ServiceId[] {
  return services.filter(canStartService).map((service) => service.id);
}

export function getStoppableServices(services: ServiceStatus[]): ServiceId[] {
  return services.filter(canStopService).map((service) => service.id);
}

export function isServiceBusy(
  serviceId: ServiceId,
  transitions: Partial<Record<ServiceId, unknown>>,
  bulkAction: unknown | null,
): boolean {
  return bulkAction !== null || serviceId in transitions;
}
