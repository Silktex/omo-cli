import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Profile } from "../types.js";
import { PROFILES_PATH } from "../constants.js";

function loadProfiles(path = PROFILES_PATH): Record<string, Profile> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function saveProfiles(profiles: Record<string, Profile>, path = PROFILES_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(profiles, null, 2) + "\n");
}

export function listProfiles(path = PROFILES_PATH): Profile[] {
  return Object.values(loadProfiles(path));
}

export function getProfile(name: string, path = PROFILES_PATH): Profile | undefined {
  return loadProfiles(path)[name];
}

export function saveProfile(name: string, assignments: Record<string, string>, path = PROFILES_PATH): Profile {
  const profiles = loadProfiles(path);
  const now = new Date().toISOString();
  const profile: Profile = {
    name,
    assignments,
    createdAt: profiles[name]?.createdAt ?? now,
    updatedAt: now,
  };
  profiles[name] = profile;
  saveProfiles(profiles, path);
  return profile;
}

export function deleteProfile(name: string, path = PROFILES_PATH): boolean {
  const profiles = loadProfiles(path);
  if (!profiles[name]) return false;
  delete profiles[name];
  saveProfiles(profiles, path);
  return true;
}
