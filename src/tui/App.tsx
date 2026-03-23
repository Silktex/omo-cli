import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { getAllAssignments } from "../core/ohmy.js";
import { getLatestSnapshot } from "../db/queries.js";
import { pollAllProviders } from "../providers/poller.js";
import type { ProviderSnapshot, Provider } from "../types.js";
import { AGENT_ROLES, PROVIDER_INFO, REFRESH_INTERVAL_MS } from "../constants.js";
import { DashboardView } from "./views/Dashboard.js";
import { PlansView } from "./views/Plans.js";
import { TrendsView } from "./views/Trends.js";
import { RolesView } from "./views/Roles.js";
import { ProxyView } from "./views/Proxy.js";

export type ViewId = 1 | 2 | 3 | 4 | 5;

export interface AppState {
  view: ViewId;
  assignments: Record<string, string>;
  snapshots: Record<Provider, ProviderSnapshot | null>;
  loading: boolean;
  lastRefresh: Date | null;
}

export function App({ refreshInterval = REFRESH_INTERVAL_MS }: { refreshInterval?: number }) {
  const { exit } = useApp();

  const [state, setState] = useState<AppState>({
    view: 1,
    assignments: {},
    snapshots: { alibaba: null, minimax: null, zai: null },
    loading: true,
    lastRefresh: null,
  });

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    const [assignments, snapshots] = await Promise.all([
      Promise.resolve(getAllAssignments()),
      pollAllProviders().catch(() => ({ alibaba: null, minimax: null, zai: null } as Record<Provider, ProviderSnapshot | null>)),
    ]);
    setState(s => ({
      ...s,
      assignments,
      snapshots: snapshots as Record<Provider, ProviderSnapshot | null>,
      loading: false,
      lastRefresh: new Date(),
    }));
  }, []);

  // Initial load + polling
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  // Keyboard navigation
  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) { exit(); return; }
    if (input === "1") setState(s => ({ ...s, view: 1 }));
    if (input === "2") setState(s => ({ ...s, view: 2 }));
    if (input === "3") setState(s => ({ ...s, view: 3 }));
    if (input === "4") setState(s => ({ ...s, view: 4 }));
    if (input === "5") setState(s => ({ ...s, view: 5 }));
    if (input === "r") refresh();
  });

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const viewNames: Record<ViewId, string> = {
    1: "Dashboard", 2: "Plans", 3: "Trends", 4: "Roles", 5: "Proxy",
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">omoctl</Text>
        <Text color="gray">  •  oh-my-openagent control plane  •  </Text>
        <Text color="gray">{now}</Text>
        {state.loading && <Text color="yellow">  ⟳ refreshing…</Text>}
      </Box>

      {/* View content */}
      <Box flexDirection="column" flexGrow={1}>
        {state.view === 1 && <DashboardView state={state} />}
        {state.view === 2 && <PlansView state={state} />}
        {state.view === 3 && <TrendsView state={state} />}
        {state.view === 4 && <RolesView state={state} onAssignmentsChanged={refresh} />}
        {state.view === 5 && <ProxyView />}
      </Box>

      {/* Footer / tab bar */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        {([1, 2, 3, 4, 5] as ViewId[]).map(v => (
          <Text key={v} color={state.view === v ? "cyan" : "gray"} bold={state.view === v}>
            {state.view === v ? `[${v}]${viewNames[v]} ` : `[${v}]${viewNames[v]} `}
          </Text>
        ))}
        <Text color="gray">  [r]Refresh  [q]Quit</Text>
      </Box>
    </Box>
  );
}
