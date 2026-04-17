import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import openapi from '../openapi.json';

const router = Router();

router.get('/openapi.json', (_req, res) => {
  res.json(openapi);
});

// Swagger UI needs inline scripts/styles; index.ts relaxes CSP for /api/docs.
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapi, {
    customSiteTitle: '1300.io API docs',
  }),
);

export default router;
