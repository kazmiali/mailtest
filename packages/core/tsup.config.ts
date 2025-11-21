import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: ['src/index.ts'],
  
  // Output formats: ESM and CJS
  format: ['esm', 'cjs'],
  
  // Generate TypeScript declaration files
  dts: true,
  
  // Generate source maps for debugging
  sourcemap: true,
  
  // Clean output directory before build
  clean: true,
  
  // Code splitting for better tree-shaking
  splitting: false,
  
  // Minification (disabled for better debugging in v1.0)
  minify: false,
  
  // Target environment
  target: 'node20',
  
  // Output directory
  outDir: 'dist',
  
  // External dependencies (don't bundle)
  external: [],
  
  // Tree shaking
  treeshake: true,
  
  // Skip node_modules
  skipNodeModulesBundle: true,
});

