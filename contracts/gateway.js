// gateway.js
// A basic Unified Gateway implementing the strangler fig pattern.
// In P1, this routes 100% of traffic to the legacy Next.js application.

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.GATEWAY_PORT || 8080;

// Legacy app runs on port 3000 by default
const LEGACY_APP_URL = process.env.LEGACY_APP_URL || 'http://localhost:3000';

// In the future (P4), we will add conditional routing logic here to redirect 
// specific unified traffic to the new serverless microservices.
// For now, route everything to legacy.

app.use('/', createProxyMiddleware({
  target: LEGACY_APP_URL,
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    // Add unified gateway tracking header
    proxyReq.setHeader('x-unified-gateway', 'true');
    proxyReq.setHeader('x-route-target', 'legacy');
  }
}));

app.listen(PORT, () => {
  console.log(`[Unified Gateway] Listening on port ${PORT}`);
  console.log(`[Unified Gateway] Routing 100% of traffic to Legacy App at ${LEGACY_APP_URL}`);
});
