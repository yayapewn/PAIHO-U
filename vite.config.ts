import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
        hmr: false,
      },
      plugins: [
        react(),
        {
          name: 'paiho-api-send-email',
          configureServer(server) {
            if (env.RESEND_API_KEY && !process.env.RESEND_API_KEY) {
              process.env.RESEND_API_KEY = env.RESEND_API_KEY;
            }
            if (env.RESEND_FROM_EMAIL && !process.env.RESEND_FROM_EMAIL) {
              process.env.RESEND_FROM_EMAIL = env.RESEND_FROM_EMAIL;
            }

            server.middlewares.use('/api/send-email', async (req, res) => {
              try {
                const mod = await server.ssrLoadModule('/api/send-email.ts');
                const chunks: Buffer[] = [];
                for await (const chunk of req) {
                  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                const rawBody = Buffer.concat(chunks).toString('utf8');
                let parsedBody: unknown = {};
                if (rawBody) {
                  try {
                    parsedBody = JSON.parse(rawBody);
                  } catch {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'INVALID_JSON', message: 'Invalid JSON request body.' }));
                    return;
                  }
                }
                const mockReq = {
                  method: req.method,
                  headers: req.headers,
                  body: parsedBody,
                };
                const mockRes = {
                  status(code: number) {
                    res.statusCode = code;
                    return {
                      json(payload: unknown) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(payload));
                      },
                    };
                  },
                };
                await mod.default(mockReq, mockRes);
              } catch (err) {
                console.error('[vite api/send-email]', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Failed to handle email request.' }));
              }
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
