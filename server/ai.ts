import { exec } from "child_process";

export function runAI(prompt: string) {
  return new Promise((resolve, reject) => {
    exec(`claude "${prompt}"`, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout);
    });
  });
}