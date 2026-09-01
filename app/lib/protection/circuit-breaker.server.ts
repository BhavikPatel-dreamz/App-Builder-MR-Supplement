import { getRedisClient } from "../redis-cache.server";
import { protectionConfig } from "./config.server";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitOpenError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Shopify circuit breaker is open.");
    this.name = "CircuitOpenError";
  }
}

type LocalCircuit = {
  state: CircuitState;
  failures: number;
  openedAt: number;
  halfOpenAttempts: number;
};

const localCircuit: LocalCircuit = {
  state: "CLOSED",
  failures: 0,
  openedAt: 0,
  halfOpenAttempts: 0,
};

const CB_KEY = "cb:shopify:storefront";

async function redisGetState(): Promise<{ failures: number; openedAt: number } | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(CB_KEY);
    if (!raw) return { failures: 0, openedAt: 0 };
    return JSON.parse(raw) as { failures: number; openedAt: number };
  } catch {
    return null;
  }
}

async function redisSetState(failures: number, openedAt: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(
      CB_KEY,
      JSON.stringify({ failures, openedAt }),
      "EX",
      Math.ceil(protectionConfig.circuitBreaker.openMs / 1000) + 60,
    );
  } catch {
    /* ignore */
  }
}

function localState(now: number): CircuitState {
  if (localCircuit.state === "OPEN") {
    if (now - localCircuit.openedAt >= protectionConfig.circuitBreaker.openMs) {
      localCircuit.state = "HALF_OPEN";
      localCircuit.halfOpenAttempts = 0;
    }
  }
  return localCircuit.state;
}

/**
 * Assert Shopify calls are allowed. Throws CircuitOpenError when open.
 */
export async function assertCircuitClosed(): Promise<CircuitState> {
  const now = Date.now();
  const remote = await redisGetState();

  if (remote && remote.openedAt > 0) {
    const elapsed = now - remote.openedAt;
    if (elapsed < protectionConfig.circuitBreaker.openMs) {
      const retryAfter = Math.ceil(
        (protectionConfig.circuitBreaker.openMs - elapsed) / 1000,
      );
      throw new CircuitOpenError(retryAfter);
    }
  }

  const state = localState(now);
  if (state === "OPEN") {
    const retryAfter = Math.ceil(
      (protectionConfig.circuitBreaker.openMs - (now - localCircuit.openedAt)) / 1000,
    );
    throw new CircuitOpenError(Math.max(retryAfter, 1));
  }

  return state;
}

export async function recordShopifySuccess(): Promise<void> {
  localCircuit.state = "CLOSED";
  localCircuit.failures = 0;
  localCircuit.halfOpenAttempts = 0;
  await redisSetState(0, 0);
}

export async function recordShopifyFailure(): Promise<void> {
  const now = Date.now();
  localCircuit.failures += 1;

  const remote = await redisGetState();
  const failures =
    (remote?.failures ?? 0) + 1 >= protectionConfig.circuitBreaker.failureThreshold
      ? protectionConfig.circuitBreaker.failureThreshold
      : (remote?.failures ?? 0) + 1;

  if (
    localCircuit.failures >= protectionConfig.circuitBreaker.failureThreshold ||
    failures >= protectionConfig.circuitBreaker.failureThreshold
  ) {
    localCircuit.state = "OPEN";
    localCircuit.openedAt = now;
    await redisSetState(failures, now);
    console.error(
      `[circuit-breaker] OPEN after ${failures} failures — pausing Shopify calls for ${protectionConfig.circuitBreaker.openMs}ms`,
    );
    return;
  }

  await redisSetState(failures, remote?.openedAt ?? 0);
}

export function getCircuitStateForDiagnostics(): CircuitState {
  return localCircuit.state;
}
