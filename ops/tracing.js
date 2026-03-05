const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Configure OpenTelemetry to export spans to Zipkin (simulating OTel Collector)
const exporter = new ZipkinExporter({
    url: process.env.ZIPKIN_URL || 'http://localhost:9411/api/v2/spans',
    serviceName: process.env.OTEL_SERVICE_NAME || 'capture-hub-unknown',
});

const sdk = new NodeSDK({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'capture-hub-unknown',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        'deployment.environment': process.env.NODE_ENV || 'development'
    }),
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()] // Auto-instruments Express, HTTP, Postgres, etc.
});

// Initialize the SDK
sdk.start();

console.log(`[OpenTelemetry] Tracing initialized for ${process.env.OTEL_SERVICE_NAME || 'capture-hub-unknown'}`);

// Handle graceful shutdown
process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => console.log('Tracing terminated'))
        .catch((error) => console.log('Error terminating tracing', error))
        .finally(() => process.exit(0));
});

module.exports = sdk;
