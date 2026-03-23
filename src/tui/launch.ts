import { render } from "ink";
import React from "react";
import { App } from "./App.js";

export function launchTui(opts: { refreshInterval?: number } = {}): void {
  const { waitUntilExit } = render(
    React.createElement(App, { refreshInterval: opts.refreshInterval }),
    { exitOnCtrlC: true },
  );
  waitUntilExit().then(() => process.exit(0)).catch(() => process.exit(1));
}
