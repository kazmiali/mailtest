import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/fixtures/',
        'vitest.config.ts',
        'tsup.config.ts',
      ],
      // Target: 90%+ coverage (temporarily set to current levels)
      thresholds: {
        lines: 89,
        functions: 90,
        branches: 78,
        statements: 89,
      },
    },
    
    // Test file patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    
    // Exclude patterns
    exclude: ['node_modules', 'dist', '**/fixtures/**'],
    
    // Test timeout (ms)
    testTimeout: 10000,
    
    // Hook timeout (ms)
    hookTimeout: 10000,
    
    // Watch mode
    watch: false,
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@mailtest/core': resolve(__dirname, './src/index.ts'),
    },
  },
});

