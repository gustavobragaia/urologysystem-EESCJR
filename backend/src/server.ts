import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './lib/env';
import { globalRateLimit } from './middleware/rateLimit.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { swaggerSpec } from './swagger/config';
import authRoutes from './routes/auth.routes';
import pacientesRoutes from './routes/pacientes.routes';
import examesRoutes from './routes/exames.routes';
import coletaRoutes from './routes/coleta.routes';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
const allowedOrigins = [env.FRONTEND_URL, env.FRONTEND_URL.replace('://', '://www.')];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(globalRateLimit);

// Swagger (apenas em dev)
if (env.ENABLE_SWAGGER) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log(`📖 Swagger disponível em http://localhost:${env.PORT}/api/docs`);
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/exames', examesRoutes);
app.use('/api/coleta', coletaRoutes);

// Error handler global
app.use(errorMiddleware);

app.listen(env.PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${env.PORT}`);
  console.log(`   NODE_ENV: ${env.NODE_ENV}`);
});

export default app;
