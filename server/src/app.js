import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import openapiDocument from './openapi/openapi.js';
import { notFound, errorHandler } from './middleware/error.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(currentDir, '../../client/dist');
const clientIndexHtml = path.join(clientDistDir, 'index.html');

const defaultHelmet = helmet();
const docsHelmet = helmet({ contentSecurityPolicy: false });

function helmetForRequest(req, res, next) {
  const isDocs =
    req.path === '/api/docs' || req.path.startsWith('/api/docs/');
  return (isDocs ? docsHelmet : defaultHelmet)(req, res, next);
}

function corsOptions() {
  const allowedOrigins = env.clientOrigins || [];
  const allowAll = allowedOrigins.includes('*');

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowAll || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmetForRequest);
  app.use(cors(corsOptions()));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  if (!env.isTest) {
    app.use(morgan('dev'));
  }

  app.get('/api/openapi.json', (req, res) => {
    res.json(openapiDocument);
  });

  app.use(
    '/api/docs',
    swaggerUi.serveWithOptions({ redirect: false }),
    swaggerUi.setup(openapiDocument, {
      customSiteTitle: 'Record Over Rhetoric API',
      swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
    }),
  );

  app.use('/api', apiRouter);

  if (env.isProd && existsSync(clientDistDir)) {
    app.use(
      express.static(clientDistDir, {
        index: false,
        maxAge: '1h',
      }),
    );

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      if (!req.accepts('html') || !existsSync(clientIndexHtml)) {
        next();
        return;
      }
      res.sendFile(clientIndexHtml, (err) => {
        if (err) next(err);
      });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export { apiRouter };
export default createApp;
