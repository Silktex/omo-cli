import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { AppState } from "../App.js";
import { AGENT_ROLES, MODEL_REGISTRY } from "../../constants.js";
import { setModelInConfig } from "../../core/ohmy.js";
import { resolveModelString } from "../../core/registry.js";
import { resolveRole } from "../../core/roles.js";

type Mode = "list" | "picker";

export function RolesView({ state, onAssignmentsChanged }: { state: AppState; onAssignmentsChanged: () => void }) {
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const roles = AGENT_ROLES;
  const filteredModels = query
    ? MODEL_REGISTRY.filter(m =>
        m.alias.includes(query.toLowerCase()) ||
        m.modelId.toLowerCase().includes(query.toLowerCase()) ||
        m.provider.includes(query.toLowerCase())
      )
    : MODEL_REGISTRY;

  useInput((input, key) => {
    if (mode === "list") {
      if (input === "j" || key.downArrow) setCursor(c => Math.min(c + 1, roles.length - 1));
      if (input === "k" || key.upArrow) setCursor(c => Math.max(c - 1, 0));
      if (input === "e" || key.return) { setMode("picker"); setQuery(""); setMessage(null); }
    } else {
      if (key.escape) { setMode("list"); setQuery(""); }
      if (key.return && filteredModels.length > 0) {
        const role = roles[cursor];
        const model = filteredModels[0];
        try {
          const resolved = resolveRole(role.key);
          if (resolved) {
            const { modelString } = resolveModelString(model.alias);
            setModelInConfig(resolved.section, resolved.key, modelString);
            setMessage(`✓ ${role.displayName} → ${modelString}`);
            onAssignmentsChanged();
          }
        } catch (err: unknown) {
          setMessage(`✗ ${err instanceof Error ? err.message : String(err)}`);
        }
        setMode("list");
        setQuery("");
      }
    }
  });

  if (mode === "picker") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Select model for <Text color="white">{roles[cursor]?.displayName}</Text></Text>
        <Text color="gray" dimColor>Type to search • Enter to confirm • Esc to cancel</Text>
        <Box borderStyle="single" borderColor="cyan" padding={1} marginTop={1}>
          <Text color="gray">{">"} </Text>
          <TextInput value={query} onChange={setQuery} placeholder="model alias or name…" />
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {filteredModels.slice(0, 8).map((m, i) => (
            <Box key={m.alias} paddingX={2}>
              <Text color={i === 0 ? "cyan" : "gray"} bold={i === 0}>
                {i === 0 ? "▶ " : "  "}
                {m.alias.padEnd(22)}
                {m.provider.padEnd(10)}
                {m.tier.padEnd(8)}
                {m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k ctx` : ""}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan" underline>Agent Roles</Text>
      <Text color="gray" dimColor>j/k navigate  •  e or Enter to edit model  •  q to quit</Text>

      {message && <Text color={message.startsWith("✓") ? "green" : "red"}>{message}</Text>}

      <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray">
        <Box paddingX={1}>
          <Text color="gray" bold>{"Role".padEnd(24)}</Text>
          <Text color="gray" bold>{"Section".padEnd(12)}</Text>
          <Text color="gray" bold>Current Model</Text>
        </Box>
        {roles.map((role, i) => {
          const model = state.assignments[role.key];
          const selected = i === cursor;
          return (
            <Box key={role.key} paddingX={1}>
              <Text color={selected ? "white" : "cyan"} bold={selected}>
                {(selected ? "▶ " : "  ") + role.key.padEnd(22)}
              </Text>
              <Text color={selected ? "white" : "gray"}>{role.section.padEnd(12)}</Text>
              <Text color={selected ? "white" : undefined}>{model ?? kleur("gray", "(not set)")}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function kleur(color: string, text: string): string {
  return text; // fallback — ink handles color via props
}
