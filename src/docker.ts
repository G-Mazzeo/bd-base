import { spawn } from 'node:child_process';

/** Ejecuta `docker compose ...` heredando stdio. Resuelve con el exit code. */
export function compose(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', ...args], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Igual que `compose`, pero captura stdout en vez de imprimirlo. */
export function composeCapture(args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['compose', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout }));
  });
}
