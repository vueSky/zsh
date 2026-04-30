import { spawn } from "node-pty";

export function createTerminal(onData: (data: string) => void) {
  const shell = process.env.SHELL || "bash";

  const term = spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env,
  });

  term.onData(onData);

  return term;
}