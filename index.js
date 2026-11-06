/**
 * Entry point for Node.js hosting panels (e.g., botkeep.cloud / Pterodactyl)
 * that default to running `node index.js`.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsxBin = path.resolve(__dirname, 'node_modules', '.bin', 'tsx');
const serverFile = path.resolve(__dirname, 'server.ts');

const child = spawn(tsxBin, [serverFile], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
