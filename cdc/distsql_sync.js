const { Kafka } = require('kafkajs');
const { Client } = require('pg');
const avro = require('avsc');
const path = require('path');
const fs = require('fs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const SCHEMA_PATH = path.join(__dirname, '../contracts/capture_item_created.avsc');
const DB_CONN = process.env.DATABASE_URL || 'postgresql://capturehub:capturehub_password@localhost:5432/capturehub_distsql';

// Load Avro schema
const schemaDef = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
const type = avro.Type.forSchema(schemaDef);

const kafka = new Kafka({
    clientId: 'distsql-consumer',
    brokers: [KAFKA_BROKER],
});
const consumer = kafka.consumer({ groupId: 'distsql-sync-group' });

const pgClient = new Client({ connectionString: DB_CONN });

async function initDb() {
    await pgClient.connect();
    console.log('Connected to PostgreSQL (DistSQL)');

    // Create table if not exists (Basic schema replication in PostgreSQL)
    await pgClient.query(`
    CREATE TABLE IF NOT EXISTS CaptureItem (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(50),
      title TEXT,
      source_url TEXT,
      created_at TIMESTAMP
    )
  `);
}

async function start() {
    await initDb();
    await consumer.connect();
    await consumer.subscribe({ topic: 'capture_hub.events.CaptureItemCreated', fromBeginning: true });

    console.log('Started listening to Event Mesh for syncing to DistSQL...');

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const payload = type.fromBuffer(message.value);
                console.log(`Received event for item ${payload.id}, syncing to DB...`);

                await pgClient.query(`
          INSERT INTO CaptureItem (id, type, title, source_url, created_at)
          VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))
          ON CONFLICT (id) DO UPDATE SET
            type = EXCLUDED.type,
            title = EXCLUDED.title,
            source_url = EXCLUDED.source_url
        `, [
                    payload.id,
                    payload.type,
                    payload.title,
                    payload.source_url,
                    payload.created_at
                ]);

                console.log(`Successfully synced item ${payload.id} to DistSQL.`);
            } catch (err) {
                console.error('Error processing message:', err);
            }
        },
    });
}

start().catch(console.error);
