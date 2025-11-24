import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: ['src/index.ts'],
  
  // Output formats: ESM and CJS
  format: ['esm', 'cjs'],
  
  // Generate TypeScript declaration files
  dts: true,
  
  // Generate source maps for debugging (but exclude from npm package)
  sourcemap: true,
  
  // Clean output directory before build
  clean: true,
  
  // Code splitting for better tree-shaking
  splitting: false,
  
  // Minification for smaller bundle size
  minify: true,
  
  // Target environment
  target: 'node20',
  
  // Output directory
  outDir: 'dist',
  
  // External dependencies (don't bundle - let users install them)
  external: ['disposable-email-domains', 'mailcheck'],
  
  // Don't bundle dependencies - they'll be installed separately
  // This reduces bundle size significantly
  
  // Tree shaking
  treeshake: true,
  
  // Skip node_modules (but noExternal overrides this for specific packages)
  skipNodeModulesBundle: true,
});

