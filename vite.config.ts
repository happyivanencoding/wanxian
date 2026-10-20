import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createDirectorMiddleware, readDirectorKey } from './server/director.ts';

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const env = loadEnv(mode, root, 'STARTLUX_');
  const apiKey = readDirectorKey({
    STARTLUX_API_KEY: process.env.STARTLUX_API_KEY ?? env.STARTLUX_API_KEY,
    STARTLUX_KEY_FILE: process.env.STARTLUX_KEY_FILE ?? env.STARTLUX_KEY_FILE,
  }, root);
  const plugin: Plugin = {
    name: 'wanxian-local-director',
    configureServer(server) { server.middlewares.use(createDirectorMiddleware({ apiKey })); },
    configurePreviewServer(server) { server.middlewares.use(createDirectorMiddleware({ apiKey })); },
  };
  return { plugins: [plugin] };
});
