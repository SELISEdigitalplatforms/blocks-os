/// <reference types="vite/client" />
import fs from "fs";
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from 'vite'
import type { InlineConfig } from "vitest/node";
import { getRuntimeEnv } from "./app/lib/runtime-env";

function resolveDevHttps(): { cert: Buffer; key: Buffer } | undefined {
  const certPath = process.env.OS_SSL_CERT;
  const keyPath = process.env.OS_SSL_KEY;

  if (!certPath || !keyPath) {
    console.warn(
      "[dev-https] OS_SSL_CERT / OS_SSL_KEY not set — serving HTTP.",
    );
    return undefined;
  }
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.warn(
      `[dev-https] cert/key file missing (cert=${certPath}, key=${keyPath}) — serving HTTP.`,
    );
    return undefined;
  }
  return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'BLOCKS_')

  const apiProxyTarget = getRuntimeEnv('BLOCKS_OS_BASE_URL', env)
  const iamProxyTarget =
    getRuntimeEnv('BLOCKS_IAM_BASE_URL') ||
    'https://dev-iam.blocksdevelopers.com'
  const httpsConfig = resolveDevHttps()

  return {
    envPrefix: ['BLOCKS_'],
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './app'),
        '@blocks-idp': path.resolve(__dirname, './app/idp'),
        '@blocks-lmt': path.resolve(__dirname, './app/cross-modules/lmt'),
        '@blocks-storage': path.resolve(
          __dirname,
          './app/cross-modules/storage',
        ),
        '@blocks-communication': path.resolve(
          __dirname,
          './app/cross-modules/communication',
        ),
        '@blocks-identifier': path.resolve(
          __dirname,
          './app/cross-modules/identifier',
        ),
        '@blocks-localization': path.resolve(
          __dirname,
          './app/cross-modules/localization',
        ),
        '@blocks-utilities': path.resolve(
          __dirname,
          './app/cross-modules/utilities',
        ),
        '@blocks-ai': path.resolve(__dirname, './app/cross-modules/ai'),
      },
    },
    build: {
      outDir: '../server/Api/wwwroot',
      emptyOutDir: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./app/test-utils/vitest.setup.ts'],
      coverage: {
        all: true,
        provider: 'v8',
        include: ['app/**/*.{ts,tsx}'],
        exclude: [
          'app/**/*.test.*',
          'app/**/*.spec.*',
          'app/**/*.d.ts',
          'app/**/main.tsx',
          'app/**/vite-env.d.ts',
          '**/components/ui/**',
          'app/**/*.stories.*',
          '**/__generated__/**',
          '**/*.gen.*',
          'app/**/test-utils/**',
          'app/**/__mocks__/**',
        ],
      },
      alias: {
        '@': path.resolve(__dirname, './app'),
        '@blocks-idp': path.resolve(__dirname, './app/idp'),
        '@blocks-lmt': path.resolve(__dirname, './app/cross-modules/lmt'),
        '@blocks-storage': path.resolve(
          __dirname,
          './app/cross-modules/storage',
        ),
        '@blocks-communication': path.resolve(
          __dirname,
          './app/cross-modules/communication',
        ),
        '@blocks-identifier': path.resolve(
          __dirname,
          './app/cross-modules/identifier',
        ),
        '@blocks-localization': path.resolve(
          __dirname,
          './app/cross-modules/localization',
        ),
        '@blocks-utilities': path.resolve(
          __dirname,
          './app/cross-modules/utilities',
        ),
        '@blocks-ai': path.resolve(__dirname, './app/cross-modules/ai'),
      },
    } as InlineConfig,
    server: {
      host: true,
      port: 5000,
      strictPort: true,
      https: httpsConfig,
      allowedHosts: [
        'dev-cloud.seliseblocks.com',
        'localhost',
        '.seliseblocks.com',
        '.blocksdevelopers.com',
      ],
      proxy: {
        '/dev-iam-proxy': {
          target: iamProxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/dev-iam-proxy/, ''),
        },
        '/dev-idp-proxy': {
          target: iamProxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/dev-idp-proxy/, ''),
        },
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/cloudbuild': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/idp': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/identifier': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/communication': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/cloudconfiguration': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uilm': { target: apiProxyTarget, changeOrigin: true, secure: false },
        '/utilities': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/lmt': { target: apiProxyTarget, changeOrigin: true, secure: false },
        '/mfa': { target: apiProxyTarget, changeOrigin: true, secure: false },
        '/alert': { target: apiProxyTarget, changeOrigin: true, secure: false },
        '/blocksai-api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/studio': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uds': { target: apiProxyTarget, changeOrigin: true, secure: false },
      },
    },
  }
})
