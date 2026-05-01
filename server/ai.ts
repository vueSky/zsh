import { execFile, spawn } from "child_process";

const AI_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

// 完整输出模式（兜底）
export function runAI(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "claude",
      ["-p", prompt],
      { timeout: AI_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) return reject(stderr || err.message);
        resolve(stdout);
      },
    );
  });
}

// 流式输出：每收到一段 stdout 就回调 onChunk
export function streamAI(
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["-p", prompt]);
    let settled = false;

    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };

    const abort = () => {
      proc.kill();
      done(new Error("aborted"));
    };

    const timer = setTimeout(abort, AI_TIMEOUT_MS);
    signal?.addEventListener("abort", abort);

    proc.stdout.on("data", (chunk: Buffer) => {
      if (!settled) onChunk(chunk.toString());
    });

    proc.on("close", (code) => {
      if (settled) return;
      code === 0 ? done() : done(new Error(`claude exited with code ${code}`));
    });

    proc.on("error", (err) => done(err));
  });
}
