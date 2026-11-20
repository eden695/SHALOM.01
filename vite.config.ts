import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function collectDistFiles(dir: string, baseDir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDistFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, fullPath).split(path.sep).join('/');
      if (
        rel === 'sw.js' ||
        rel === '404.html' ||
        entry.name === '.nojekyll' ||
        rel.endsWith('.map') ||
        entry.name === '.DS_Store'
      ) {
        continue;
      }
      results.push(rel);
    }
  }
  return results;
}

function shalomOfflinePrecachePlugin(): Plugin {
  return {
    name: 'shalom-offline-precache',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const swPath = path.join(distDir, 'sw.js');
      if (!fs.existsSync(distDir) || !fs.existsSync(swPath)) {
        return;
      }

      const relFiles = collectDistFiles(distDir, distDir).sort();
      const hash = crypto.createHash('sha256');
      for (const rel of relFiles) {
        hash.update(rel);
        hash.update(fs.readFileSync(path.join(distDir, rel)));
      }
      const versionHash = hash.digest('hex').slice(0, 12);
      const precacheUrls = ['./', ...relFiles.map((rel) => `./${rel}`)];
      const formattedList = precacheUrls.map((u) => `  ${JSON.stringify(u)}`).join(',\n');

      let swSource = fs.readFileSync(swPath, 'utf8');
      swSource = swSource.replace('__SHALOM_CACHE_VERSION__', versionHash);
      swSource = swSource.replace(
        /\/\* __SHALOM_PRECACHE_START__ \*\/[\s\S]*?\/\* __SHALOM_PRECACHE_END__ \*\//,
        `/* __SHALOM_PRECACHE_START__ */\n${formattedList}\n  /* __SHALOM_PRECACHE_END__ */`
      );
      fs.writeFileSync(swPath, swSource, 'utf8');
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    define: {
      __SHALOM_APP_VERSION__: JSON.stringify('2.5.0'),
      __SHALOM_BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
    },
    plugins: [react(), tailwindcss(), shalomOfflinePrecachePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
