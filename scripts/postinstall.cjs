const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

// При установке backend передаём NODE_TLS_REJECT_UNAUTHORIZED=0, чтобы
// better-sqlite3 (prebuild-install / node-gyp) мог скачать файлы при корпоративном сертификате
const backendEnv = { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' };

console.log('Installing backend dependencies...');
execSync('npm install', { cwd: path.join(root, 'backend'), stdio: 'inherit', env: backendEnv });

console.log('Installing frontend dependencies...');
execSync('npm install', { cwd: path.join(root, 'frontend'), stdio: 'inherit' });
