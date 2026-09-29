import { AsyncLocalStorage } from "node:async_hooks";

const operatorAls = new AsyncLocalStorage<string>();

const EMAIL_TO_NAME: Record<string, string> = {};

const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

/** Mappe l'email Cloudflare Access vers le prénom d'écriture (`updated-by`). */
export function operatorNameFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const mapped = EMAIL_TO_NAME[normalized];
  if (mapped) return mapped;
  const local = normalized.split("@")[0] ?? "";
  if (!local) return email.trim();
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Valeur ALS du request en cours, si `runWithOperator` a posé un nom. */
export function getRequestOperatorName(): string | undefined {
  return operatorAls.getStore();
}

function accessEmail(req: Request): string | undefined {
  const fromGet = req.headers.get(ACCESS_EMAIL_HEADER)?.trim();
  if (fromGet) return fromGet;
  for (const [key, value] of req.headers.entries()) {
    if (key.toLowerCase() === ACCESS_EMAIL_HEADER) {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

/**
 * Pose le nom d'opérateur pour la durée de `fn` (header Access, casse ignorée).
 * Sans header : `fn` tourne sans ALS — getOperatorName reste inchangé.
 */
export function runWithOperator<T>(req: Request, fn: () => T): T {
  const email = accessEmail(req);
  if (!email) return fn();
  return operatorAls.run(operatorNameFromEmail(email), fn);
}
