/**
 * Fixes tight 1500ms timeout on Windows for powershell process birth check in @iwsdk/vite-plugin-dev.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetFile = path.resolve(__dirname, '../node_modules/@iwsdk/vite-plugin-dev/dist/index.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes('timeout: 1500')) {
    content = content.replaceAll(
      `        else if (process.platform === 'win32') {
            value =
                execFileSync('powershell.exe', [
                    '-NoProfile',
                    '-NonInteractive',
                    '-Command',
                    \`(Get-Process -Id \${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks\`,
                ], {
                    encoding: 'utf8',
                    timeout: 1500,
                    stdio: ['ignore', 'pipe', 'ignore'],
                }).trim() || null;
        }`,
      `        else if (process.platform === 'win32') {
            try {
                value =
                    execFileSync('powershell.exe', [
                        '-NoProfile',
                        '-NonInteractive',
                        '-Command',
                        \`(Get-Process -Id \${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks\`,
                    ], {
                        encoding: 'utf8',
                        timeout: 8000,
                        stdio: ['ignore', 'pipe', 'ignore'],
                    }).trim() || null;
            } catch {
                value = \`\${Date.now()}\`;
            }
        }`
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[HandDeck] Successfully patched @iwsdk/vite-plugin-dev process timeout.');
  }
}
