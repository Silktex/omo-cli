import { existsSync, readFileSync, renameSync, watch, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as jsonc from "jsonc-parser";
import type { OhMyOpenCodeConfig } from "../types.js";
import { OH_MY_OPENCODE_PATH } from "../constants.js";

export function readOhMyConfig(path = OH_MY_OPENCODE_PATH): OhMyOpenCodeConfig {
  if (!existsSync(path)) return { agents: {}, categories: {} };
  const raw = readFileSync(path, "utf8");
  const errors: jsonc.ParseError[] = [];
  const parsed = jsonc.parse(raw, errors);
  if (errors.length) throw new Error(`JSONC parse errors in ${path}: ${errors.map(e => e.error).join(", ")}`);
  return parsed as OhMyOpenCodeConfig;
}

export function readOhMyConfigRaw(path = OH_MY_OPENCODE_PATH): string {
  if (!existsSync(path)) return "{}";
  try { return readFileSync(path, "utf8"); } catch { return "{}"; }
}

/**
 * Atomically update a single model field in oh-my-opencode.json.
 * Uses jsonc-parser applyEdits — preserves all comments and formatting.
 */
export function setModelInConfig(
  section: "agents" | "categories",
  roleKey: string,
  modelValue: string,
  path = OH_MY_OPENCODE_PATH,
): void {
  const raw = readOhMyConfigRaw(path);
  const jsonPath: jsonc.JSONPath = [section, roleKey, "model"];
  const edits = jsonc.modify(raw, jsonPath, modelValue, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
  });
  const updated = jsonc.applyEdits(raw, edits);
  atomicWrite(path, updated);
  signalOpenCode();
}

export function setFullConfig(config: OhMyOpenCodeConfig, path = OH_MY_OPENCODE_PATH): void {
  atomicWrite(path, JSON.stringify(config, null, 2) + "\n");
  signalOpenCode();
}

function atomicWrite(path: string, content: string): void {
  const dir = dirname(path);
  const tmp = join(dir, `.omoctl-tmp-${process.pid}`);
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, path);
}

function signalOpenCode(): void {
  try {
    Bun.spawnSync(["pkill", "-HUP", "opencode"], { stderr: "ignore", stdout: "ignore" });
  } catch { /* opencode may not be running */ }
}

export function watchOhMyConfig(
  callback: (config: OhMyOpenCodeConfig) => void,
  path = OH_MY_OPENCODE_PATH,
): () => void {
  const watcher = watch(path, () => {
    try { callback(readOhMyConfig(path)); } catch { /* ignore parse errors during rapid writes */ }
  });
  return () => watcher.close();
}

export function getCurrentModel(
  section: "agents" | "categories",
  roleKey: string,
  path = OH_MY_OPENCODE_PATH,
): string | undefined {
  const config = readOhMyConfig(path);
  return section === "agents"
    ? config.agents?.[roleKey]?.model
    : config.categories?.[roleKey]?.model;
}

export function getAllAssignments(path = OH_MY_OPENCODE_PATH): Record<string, string> {
  const config = readOhMyConfig(path);
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.agents ?? {})) result[k] = v.model;
  for (const [k, v] of Object.entries(config.categories ?? {})) result[k] = v.model;
  return result;
}
