import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';

function classicScriptPlugin(): Plugin {
  return {
    name: 'classic-script',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script\s+type="module"\s+crossorigin\s+src=/g, '<script src=')
        .replace(/<script\s+type="module"\s+src=/g, '<script src=')
        .replace(/\s+crossorigin(?=\s|>)/g, '');
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  base: './',
  plugins: [classicScriptPlugin()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
      output: {
        format: 'iife',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
