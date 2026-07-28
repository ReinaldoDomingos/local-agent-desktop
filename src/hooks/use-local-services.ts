import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SERVICE_DEFINITIONS,
  type LocalService,
  type ServiceAction,
  type ServiceStatus,
} from "../services/service-model";

export type { ServiceAction, ServiceId, ServiceStatus, ServiceTransition } from "../services/service-model";

export type ServicesSetupStatus = {
  configured: boolean;
  workspaceFound: boolean;
  message: string | null;
};

type UseLocalServicesResult = {
  services: LocalService[];
  setup: ServicesSetupStatus | null;
  isLoading: boolean;
  isConfiguring: boolean;
  transitions: Partial<Record<string, ServiceAction>>;
  error: string | null;
  refresh: () => Promise<void>;
  configureServices: () => Promise<void>;
  runAction: (service: string, action: ServiceAction) => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Ocorreu um erro inesperado.";
}

export function useLocalServices(): UseLocalServicesResult {
  const [statusById, setStatusById] = useState<Record<string, ServiceStatus>>({});
  const [setup, setSetup] = useState<ServicesSetupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [transitions, setTransitions] = useState<Partial<Record<string, ServiceAction>>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statuses, setupStatus] = await Promise.all([
        invoke<ServiceStatus[]>("get_services_status"),
        invoke<ServicesSetupStatus>("get_services_setup_status"),
      ]);
      setStatusById(Object.fromEntries(statuses.map((status) => [status.id, status])));
      setSetup(setupStatus);
    } catch (cause) {
      setError(toErrorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const configureServices = useCallback(async () => {
    setIsConfiguring(true);
    setError(null);
    try {
      setSetup(await invoke<ServicesSetupStatus>("setup_services"));
      await refresh();
    } catch (cause) {
      setError(toErrorMessage(cause));
    } finally {
      setIsConfiguring(false);
    }
  }, [refresh]);

  const runAction = useCallback(async (service: string, action: ServiceAction) => {
    setTransitions((current) => ({ ...current, [service]: action }));
    setError(null);
    try {
      await invoke(`${action}_service`, { service });
      await refresh();
    } catch (cause) {
      setError(toErrorMessage(cause));
    } finally {
      setTransitions((current) => {
        const next = { ...current };
        delete next[service];
        return next;
      });
    }
  }, [refresh]);

  const services = useMemo(
    () => SERVICE_DEFINITIONS.map((definition) => ({
      ...definition,
      status: statusById[definition.id] ?? null,
    })),
    [statusById],
  );

  return {
    services,
    setup,
    isLoading,
    isConfiguring,
    transitions,
    error,
    refresh,
    configureServices,
    runAction,
  };
}
