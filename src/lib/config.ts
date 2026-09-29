import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { getRequestOperatorName } from "./operator";

/**
 * Résolution de la config machine (version solo).
 * - Vault : TORCH_VAULT_ROOT > ~/.config/torch/vault-root (écrit par l'installeur)
 * - Dossier Torch dans le vault : TORCH_ZONE (chemin relatif) > « Torch »
 * - Réglages : ~/.config/torch/torch.env (KEY=VALUE), jamais dans le vault.
 */

const TORCH_CONFIG_DIR = path.join(homedir(), ".config", "torch");

let cachedVaultRoot: string | null = null;
let cachedAssetsRoot: string | null = null;
let cachedEnv: Record<string, string> | null = null;

export function getVaultRoot(): string {
  if (cachedVaultRoot) return cachedVaultRoot;

  const fromEnv = process.env.TORCH_VAULT_ROOT;
  if (fromEnv && fromEnv.trim()) {
    cachedVaultRoot = path.resolve(fromEnv.trim());
    return cachedVaultRoot;
  }

  const vaultRootFile = path.join(TORCH_CONFIG_DIR, "vault-root");
  if (!existsSync(vaultRootFile)) {
    throw new Error(
      `Vault introuvable : ni TORCH_VAULT_ROOT ni ${vaultRootFile}. ` +
        `Relance « Installer Torch.command ».`,
    );
  }
  cachedVaultRoot = readFileSync(vaultRootFile, "utf8").trim();
  return cachedVaultRoot;
}

export function getTorchZone() {
  const root = getVaultRoot();
  const relative = getSetting("TORCH_ZONE")?.trim() || "Torch";
  const zone = path.join(root, relative);
  return {
    zone,
    contentDir: path.join(zone, "Content"),
    configDir: path.join(zone, "_Config"),
    targetsFile: path.join(zone, "_Config", "Targets.md"),
  };
}

/**
 * Nom du vault dans Obsidian, pour les liens `obsidian://open`. Par défaut le
 * nom du dossier du vault : c'est ce qu'Obsidian affiche tant qu'on ne l'a pas
 * renommé. Surcharge : TORCH_OBSIDIAN_VAULT dans torch.env.
 */
export function getObsidianVaultName(): string {
  return getSetting("TORCH_OBSIDIAN_VAULT")?.trim() || path.basename(getVaultRoot());
}

/** Prénom qui signe les écritures (`updated-by`) : TORCH_OPERATOR dans torch.env. */
export function getOperatorName(): string | null {
  const fromAls = getRequestOperatorName();
  if (fromAls?.trim()) return fromAls.trim();
  const fromEnv = getSetting("TORCH_OPERATOR");
  return fromEnv?.trim() || null;
}

/** Sous-dossier des images de posts, relatif à la racine des assets. */
export const THUMBNAILS_DIR = "Images";

/**
 * Racine des images de posts : TORCH_ASSETS_ROOT > `<dossier Torch>/_Assets`.
 * Les images restent dans le vault, à côté des fiches.
 */
export function getAssetsRoot(): string | null {
  if (cachedAssetsRoot) return cachedAssetsRoot;

  const fromEnv = getSetting("TORCH_ASSETS_ROOT");
  cachedAssetsRoot =
    fromEnv && fromEnv.trim()
      ? path.resolve(fromEnv.trim())
      : path.join(getTorchZone().zone, "_Assets");
  return cachedAssetsRoot;
}

/** Lit ~/.config/torch/torch.env (KEY=VALUE, lignes # ignorées). */
export function getTorchEnv(): Record<string, string> {
  if (cachedEnv) return cachedEnv;
  const file = path.join(TORCH_CONFIG_DIR, "torch.env");
  const env: Record<string, string> = {};
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  cachedEnv = env;
  return env;
}

export function getSetting(key: string): string | undefined {
  return process.env[key] ?? getTorchEnv()[key];
}

/** Tests uniquement : invalide les caches module. */
export function resetConfigCache() {
  cachedVaultRoot = null;
  cachedAssetsRoot = null;
  cachedEnv = null;
}
