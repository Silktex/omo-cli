import Fuse from "fuse.js";
import type { AgentRole } from "../types.js";
import { AGENT_ROLES } from "../constants.js";

// Flatten aliases for fuzzy search
const searchItems = AGENT_ROLES.flatMap(role => [
  { role, term: role.key },
  ...role.aliases.map(alias => ({ role, term: alias })),
  { role, term: role.displayName.toLowerCase() },
]);

const fuse = new Fuse(searchItems, {
  keys: ["term"],
  threshold: 0.35,
  includeScore: true,
});

export function resolveRole(input: string): AgentRole | undefined {
  const lower = input.toLowerCase();
  // Exact key match first
  const exact = AGENT_ROLES.find(r => r.key === lower || r.aliases.includes(lower));
  if (exact) return exact;
  // Fuzzy match
  const results = fuse.search(lower);
  return results[0]?.item?.role;
}

export function getRoleByKey(key: string): AgentRole | undefined {
  return AGENT_ROLES.find(r => r.key === key);
}

export function getAllRoles(): AgentRole[] {
  return AGENT_ROLES;
}
