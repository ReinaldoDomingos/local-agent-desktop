import { describe, expect, it } from "vitest";
import {
  canStartService,
  canStopService,
  getStartableServices,
  getStoppableServices,
  isServiceBusy,
} from "./service-model";
import type { ServiceStatus } from "./service-model";

const service = (
  id: ServiceStatus["id"],
  state: ServiceStatus["state"],
  installed = true,
): ServiceStatus => ({
  id,
  unit: `local-agent-${id}.service`,
  installed,
  state,
  pid: state === "RUNNING" ? 4321 : null,
  uptimeSeconds: state === "RUNNING" ? 120 : null,
  message: state === "FAILED" ? "Falha simulada" : null,
});

const services: ServiceStatus[] = [
  service("worker", "STOPPED"),
  service("observer", "RUNNING"),
];

describe("service model", () => {
  it("permite iniciar apenas serviços parados ou com falha", () => {
    expect(canStartService(service("worker", "STOPPED"))).toBe(true);
    expect(canStartService(service("worker", "FAILED"))).toBe(true);
    expect(canStartService(service("worker", "STARTING"))).toBe(false);
    expect(canStartService(service("worker", "STOPPING"))).toBe(false);
    expect(canStartService(service("worker", "RUNNING"))).toBe(false);
  });

  it("não permite iniciar serviço não instalado", () => {
    expect(canStartService(service("worker", "STOPPED", false))).toBe(false);
  });

  it("permite parar apenas serviços em execução", () => {
    expect(canStopService(service("worker", "RUNNING"))).toBe(true);
    expect(canStopService(service("worker", "STOPPED"))).toBe(false);
  });

  it("lista apenas serviços que podem ser iniciados", () => {
    expect(getStartableServices([
      ...services,
      service("worker", "STARTING"),
      service("observer", "STOPPING"),
    ])).toEqual(["worker"]);
  });

  it("inclui serviços com falha na ação coletiva de iniciar", () => {
    expect(getStartableServices([service("observer", "FAILED")])).toEqual(["observer"]);
  });

  it("lista apenas serviços que podem ser parados", () => {
    expect(getStoppableServices(services)).toEqual(["observer"]);
  });

  it("considera transição individual como estado ocupado", () => {
    expect(isServiceBusy("worker", { worker: "start" }, null)).toBe(true);
    expect(isServiceBusy("observer", { worker: "start" }, null)).toBe(false);
  });

  it("considera ação coletiva como estado ocupado para todos", () => {
    expect(isServiceBusy("worker", {}, "stop")).toBe(true);
    expect(isServiceBusy("observer", {}, "stop")).toBe(true);
  });
});
