import type { NextConfig } from 'next';
import { execSync } from 'node:child_process';

// The commit this bundle was built from, inlined so a browser error report can
// name the build it came from. Never throws — a build must not fail because git
// is unavailable.
function releaseSha(): string {
  if (process.env.NEXT_PUBLIC_RELEASE_SHA) return process.env.NEXT_PUBLIC_RELEASE_SHA;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_RELEASE_SHA: releaseSha() },
  agentRules: false,

  // The engine ships as TypeScript SOURCE, not compiled JS. That is what makes
  // "always latest" instant — no publish step, and the types you typecheck
  // against are exactly the ones that ship.
  transpilePackages: ['@lumilab/engine'],

  // @lumilab/engine is a `file:` dependency, so node_modules holds a SYMLINK to
  // /home/claudeuser/lumilab-engine — outside this project. Turbopack refuses to
  // compile anything above its root, which surfaced as "Module not found: Can't
  // resolve '@lumilab/engine/runtime'" even though TypeScript resolved it fine.
  // Next's own docs require pointing root at the common parent of the app and
  // its linked packages. It widens filesystem watching, which is acceptable here
  // and only matters in development.
  turbopack: { root: '/home/claudeuser' },

  // Blue/green deploy: the live server serves one slot while a build writes the
  // other, so a failed build can never corrupt the running site.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // pdf-parse pulls in pdfjs, which loads a SEPARATE worker file at runtime.
  // Bundling rewrites that import to a chunk path which is never emitted, so
  // every statement upload failed with
  //   Cannot find module '.next/server/chunks/pdf.worker.mjs'
  // while passing under plain `node`, where nothing is bundled. Leaving these
  // external keeps them resolving out of node_modules the way pdfjs expects.
  // kanoapp learned this on 2026-08-26 — it broke 95 orders in one cron run and
  // captured zero — and this app reproduced it exactly by copying that config
  // without this line.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],

  // Same memory mitigation kanoapp uses — this droplet runs several Node apps
  // and swap is chronically busy. Trades compile time for lower peak memory.
  experimental: { webpackMemoryOptimizations: true },

  // Escape hatch for the memory-tight box; correctness still enforced by
  // `tsc --noEmit` separately.
  typescript: { ignoreBuildErrors: process.env.NEXT_SKIP_TYPECHECK === '1' },
};

export default nextConfig;
