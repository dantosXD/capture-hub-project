const { Kafka } = require('kafkajs');
const sqlite3 = require('sqlite3').verbose();
const avro = require('avsc');
const path = require('path');
const fs = require('fs');

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const DB_PATH = path.join(__dirname, '../prisma/dev.db');
const SCHEMA_PATH = path.join(__dirname, '../contracts/capture_item_created.avsc');

// Load Avro schema
const schemaDef = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
const type = avro.Type.forSchema(schemaDef);

// Setup Kafka client
const kafka = new Kafka({
    clientId: 'cdc-streamer',
    brokers: [KAFKA_BROKER],
});
const producer = kafka.producer();

// Connect to SQLite DB
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening dev.db:', err.message);
    } else {
        console.log('Connected to legacy dev.db');
    }
});

let lastCheckedTime = null;

async function fetchLatestAndStream() {
    const query = lastCheckedTime
        ? `SELECT * FROM CaptureItem WHERE createdAt > ? ORDER BY createdAt ASC`
        : `SELECT * FROM CaptureItem ORDER BY createdAt DESC LIMIT 10`;

    const params = lastCheckedTime ? [lastCheckedTime] : [];

    db.all(query, params, async (err, rows) => {
        if (err) {
            console.error('DB query error:', err.message);
            return;
        }

        if (rows && rows.length > 0) {
            // If first run, just set the checkout time to the earliest of the batch, 
            // but if we are simulating CDC, we want to broadcast them.
            // Usually CDC tracks the highest watermark.

            console.log(`Found ${rows.length} new items to stream to Kafka.`);

            try {
                await producer.connect();

                for (const row of rows) {
                    // Map to Avro structure
                    const eventPayload = {
                        id: row.id,
                        type: row.type || 'unknown',
                        title: row.title || 'Untitled',
                        source_url: row.sourceUrl || null,
                        created_at: new Date(row.createdAt).getTime()
                    };

                    const buffer = type.toBuffer(eventPayload);

                    await producer.send({
                        topic: 'capture_hub.events.CaptureItemCreated',
                        messages: [
                            { key: row.id, value: buffer },
                        ],
                    });

                    console.log(`Streamed item ${row.id} to Kafka topic`);
                }
            } catch (e) {
                console.error('Error streaming to Kafka:', e);
            }

            // Update watermark
            // The results are ordered by createdAt ASC if we used the first branch, 
            // but DESC LIMIT 10 if second. Let's find the max date.
            const maxDate = new Date(Math.max(...rows.map(r => new Date(r.createdAt).getTime()))).toISOString();
            lastCheckedTime = maxDate;
        }
    });
}

async function start() {
    setInterval(fetchLatestAndStream, 5000);
    console.log('CDC Polling adapter started...');
}

start();
