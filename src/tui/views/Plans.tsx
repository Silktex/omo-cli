import React from "react";
import { Box, Text } from "ink";
import type { AppState } from "../App.js";
import type { Provider, ProviderSnapshot } from "../../types.js";
import { PROVIDER_INFO } from "../../constants.js";

export function PlansView({ state }: { state: AppState }) {
  const providers: Provider[] = ["alibaba", "minimax", "zai"];

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan" underline>Provider Coding Plans</Text>
      <Box flexDirection="row" gap={2} marginTop={1} flexWrap="wrap">
        {providers.map(p => (
          <PlanPanel key={p} provider={p} snapshot={state.snapshots[p]} />
        ))}
      </Box>
    </Box>
  );
}

function PlanPanel({ provider, snapshot }: { provider: Provider; snapshot: ProviderSnapshot | null }) {
  const info = PROVIDER_INFO[provider];

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" padding={1} width={48}>
      <Text bold color="cyan">{info.name.toUpperCase()}</Text>
      {snapshot?.planName && <Text color="gray">Plan: {snapshot.planName}</Text>}
      <Text color="gray">{"─".repeat(44)}</Text>

      {!snapshot ? (
        <Text color="gray" dimColor>No data — run `omoctl plans` to fetch</Text>
      ) : snapshot.error ? (
        <Text color="red">⚠ {snapshot.error}</Text>
      ) : (
        <>
          <Box>
            <Text color="gray" bold>{"Metric".padEnd(6)}</Text>
            <Text color="gray" bold>{"Used".padEnd(14)}</Text>
            <Text color="gray" bold>{"Limit".padEnd(14)}</Text>
            <Text color="gray" bold>Pct</Text>
          </Box>

          {renderRow("RPM", snapshot.rpmUsed, snapshot.rpmLimit)}
          {renderRow("RPD", snapshot.rpdUsed, snapshot.rpdLimit)}
          {renderRow("TPM", snapshot.tpmUsed, snapshot.tpmLimit, true)}
          {renderRow("TPD", snapshot.tpdUsed, snapshot.tpdLimit, true)}

          <Text color="gray">{"─".repeat(44)}</Text>

          {snapshot.spendToday != null && (
            <Text>Spend today:  <Text color="white">${snapshot.spendToday.toFixed(2)}</Text></Text>
          )}
          {snapshot.spendMonth != null && (
            <Text>Spend month:  <Text color="white">${snapshot.spendMonth.toFixed(2)}</Text></Text>
          )}
          {snapshot.quotaResetsAt && (
            <Text color="gray" dimColor>
              Quota resets: {new Date(snapshot.quotaResetsAt).toLocaleString()}
            </Text>
          )}
          {snapshot.isEstimated && (
            <Text color="yellow">~ estimated (API unavailable)</Text>
          )}
        </>
      )}
    </Box>
  );
}

function renderRow(label: string, used?: number, limit?: number, big = false) {
  if (used == null && limit == null) return null;
  const fmt = (n?: number) => n == null ? "—" : big ? (n / 1000).toFixed(0) + "k" : n.toLocaleString();
  const pct = used != null && limit != null && limit > 0
    ? Math.min(100, Math.round(used / limit * 100))
    : null;
  const color = pct == null ? "gray" : pct >= 90 ? "red" : pct >= 75 ? "yellow" : "green";

  return (
    <Box key={label}>
      <Text>{label.padEnd(6)}</Text>
      <Text>{fmt(used).padEnd(14)}</Text>
      <Text>{fmt(limit).padEnd(14)}</Text>
      {pct != null && <Text color={color}>{pct}%</Text>}
    </Box>
  );
}
