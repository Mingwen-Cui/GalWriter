import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

const arkImageProxy = (): Plugin => ({
  name: 'ark-image-proxy',
  configureServer(server) {
    server.middlewares.use('/api/ark-image', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks).toString('utf8');
        const upstream = await fetch(
          'https://ark.cn-beijing.volces.com/api/v3/images/generations',
          {
            method: 'POST',
            headers: {
              'Content-Type': req.headers['content-type'] || 'application/json',
              ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
            },
            body,
          },
        );
        const responseText = await upstream.text();

        res.statusCode = upstream.status;
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        res.end(responseText);
      } catch (error) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    });
  },
});

export default defineConfig(() => {
  return {
    // NOTE: 使用相对路径，确保应用加载本地文件时资源引用正确
    base: './',
    assetsInclude: ['**/*.lottie'],
    plugins: [arkImageProxy(), react(), tailwindcss()],
    clearScreen: false,
    esbuild: {
      target: 'esnext',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      cors: true,
    },
    build: {
      // Tauri WebView and the web demo both target modern runtimes; keeping modern output
      // avoids esbuild 0.28 trying to downlevel dynamic chunks it no longer transforms.
      target: 'esnext',
      // 针对 Tauri 桌面应用，本地加载速度极快，无需过分担忧 500kb 限制
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-flow': ['@xyflow/react'],
            'vendor-icons': ['lucide-react'],
            'vendor-ai': ['@google/genai'],
            'vendor-zip': ['jszip'],
            'vendor-storage': ['idb'],
          },
        },
      },
    },
    envPrefix: ['VITE_', 'TAURI_'],
  };
});
