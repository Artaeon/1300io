const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapi = require('../openapi.json');

const router = express.Router();

// Raw spec
router.get('/openapi.json', (req, res) => {
  res.json(openapi);
});

// Interactive UI. Swagger UI needs inline styles/scripts so it'd fail
// under our strict CSP — serve it from a subpath with its own CSP
// relaxation applied by the swagger-ui-express serve middleware.
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: '1300.io API docs',
}));

module.exports = router;
