import { spawn } from "node-pty";
import { execSync } from "child_process";

const SESSION = "mdc";

function hasTmux(): boolean {
  try {
    execSync("which tmux", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const USE_TMUX = hasTmux();
if (!USE_TMUX) console.warn("⚠️  tmux not found — sessions will not persist across reconnects");

export function createTerminal(onData: (data: string) => void) {
  const [cmd, args] = USE_TMUX
    ? ["tmux", ["new-session", "-A", "-s", SESSION]]
    : [process.env.SHELL || "bash", []];

  const term = spawn(cmd, args, {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: { ...process.env, TERM: "xterm-color" },
  });

  term.onData(onData);
  return term;
}
