import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Enable React Fast Refresh in development
      fastRefresh: mode === 'development',
      // Include JSX runtime optimizations
      jsxRuntime: 'automatic'
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/contexts': path.resolve(__dirname, './src/contexts')
    },
  },
  server: {
    port: 3000,
    open: true,
    // Enable HMR for better development experience
    hmr: true
  },
  build: {
    // Optimize build output
    target: 'es2020',
    minify: mode === 'production' ? 'esbuild' : false, // Use esbuild instead of terser for now
    sourcemap: mode === 'development',
    
    // Production performance optimizations
    cssMinify: mode === 'production',
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    cssCodeSplit: true, // Split CSS into separate files for better caching
    
    // Chunk splitting strategy for better caching
    rollupOptions: {
      external: mode === 'production' ? ['msw'] : [],
      output: {
        manualChunks: (id) => {
          // Create separate chunks for better caching
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('react-icons')) {
              return 'ui-vendor';
            }
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'form-vendor';
            }
            if (id.includes('swr') || id.includes('cross-fetch') || id.includes('date-fns')) {
              return 'utils-vendor';
            }
            return 'vendor';
          }
          
          // Split application code by feature
          if (id.includes('/components/')) {
            return 'components';
          }
          if (id.includes('/pages/')) {
            return 'pages';
          }
          if (id.includes('/services/')) {
            return 'services';
          }
        },
        // Consistent chunk naming for better caching
        chunkFileNames: mode === 'production' ? 'js/[name]-[hash].js' : 'js/[name].js',
        entryFileNames: mode === 'production' ? 'js/[name]-[hash].js' : 'js/[name].js',
        assetFileNames: ({ name }) => {
          if (/\.(gif|jpe?g|png|svg|webp)$/.test(name ?? '')) {
            return mode === 'production' ? 'images/[name]-[hash][extname]' : 'images/[name][extname]';
          }
          if (/\.css$/.test(name ?? '')) {
            return mode === 'production' ? 'css/[name]-[hash][extname]' : 'css/[name][extname]';
          }
          return mode === 'production' ? 'assets/[name]-[hash][extname]' : 'assets/[name][extname]';
        }
      }
    },
    
    // Production optimizations (esbuild handles console/debugger removal)
    ...(mode === 'production' && {
      esbuild: {
        drop: ['console', 'debugger'],
        legalComments: 'none', // Remove license comments for smaller bundles
      },
      // Enable compression for better performance
      reportCompressedSize: true,
      // Tree shaking optimizations
      minify: true,
    }),
    
    // Warn on large chunks
    chunkSizeWarningLimit: 1000
  },
  
  // Define global variables for better tree shaking
  define: {
    __DEV__: mode === 'development',
    __PROD__: mode === 'production'
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react'
    ],
    // Exclude MSW from optimization in development
    exclude: mode === 'development' ? ['msw'] : []
  },
  
  assetsInclude: ['**/*.md'],
}))
