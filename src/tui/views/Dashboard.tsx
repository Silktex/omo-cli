import React from "react";
import { Box, Text } from "ink";
import type { AppState } from "../App.js";
import { PROVIDER_INFO } from "../../constants.js";
import type { Provider } from "../../types.js";
import { ProviderCard } from "../components/ProviderCard.js";

export function DashboardView({ state }: { state: AppState }) {
  const providers: Provider[] = ["alibaba", "minimax", "zai"];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Provider row */}
      <Box flexDirection="row" gap={1} marginBottom={1}>
        {providers.map(p => (
          <ProviderCard key={p} provider={p} snapshot={state.snapshots[p]} />
        ))}
      </Box>

      {/* Agent roles table */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text bold color="white">AGENT ROLES</Text>
        <Box>
          <Text color="gray">{"Role".padEnd(22)}</Text>
          <Text color="gray">{"Model".padEnd(40)}</Text>
          <Text color="gray">Status</Text>
        </Box>
        {Object.entries(state.assignments).slice(0, 10).map(([role, model]) => (
          <Box key={role}>
            <Text color="cyan">{role.padEnd(22)}</Text>
            <Text>{model.padEnd(40)}</Text>
            <Text color="gray">idle</Text>
          </Box>
        ))}
      </Box>

      {state.lastRefresh && (
        <Text color="gray" dimColor>
          Last refresh: {state.lastRefresh.toISOString().slice(11, 19)}
        </Text>
      )}
    </Box>
  );
}
