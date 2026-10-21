import 'dotenv/config';
import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['backend/server.js'], { stdio: 'inherit', env: { ...process.env, HOST: '127.0.0.1', PORT: '8000' } }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--', '--watch'], { stdio: 'inherit' }),
];

function stop() { for (const child of processes) if (!child.killed) child.kill(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of processes) child.on('exit', code => { if (code && code !== 0) process.exitCode = code; });
