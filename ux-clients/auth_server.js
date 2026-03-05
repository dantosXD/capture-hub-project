const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');

const app = express();
const PORT = process.env.AUTH_PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// In-memory store for demonstration purposes
const users = {};
const challenges = {}; // Store challenges per user ID

const rpName = 'Capture Hub - Zero Trust UX';
const rpID = 'localhost';
const origin = `http://${rpID}:3000`; // Assuming Next.js app on 3000

// -----------------------------------------------------------------------------
// P5: Passkey Registration (Registration)
// -----------------------------------------------------------------------------
app.post('/api/auth/register-options', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    // Generate a mock user ID
    const userID = username;
    if (!users[userID]) {
        users[userID] = { id: userID, username, devices: [] };
    }

    const user = users[userID];

    const options = generateRegistrationOptions({
        rpName,
        rpID,
        userID: user.id,
        userName: user.username,
        timeout: 60000,
        attestationType: 'none',
        excludeCredentials: user.devices.map(dev => ({
            id: dev.credentialID,
            type: 'public-key',
            transports: dev.transports,
        })),
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred',
        },
    });

    challenges[user.id] = options.challenge;

    res.json(options);
});

app.post('/api/auth/register-verify', async (req, res) => {
    const { username, body } = req.body;
    const user = users[username];
    const expectedChallenge = challenges[username];

    if (!user || !expectedChallenge) {
        return res.status(400).json({ error: 'Registration session not found' });
    }

    try {
        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });

        if (verification.verified) {
            const { registrationInfo } = verification;
            user.devices.push({
                credentialPublicKey: registrationInfo.credentialPublicKey,
                credentialID: registrationInfo.credentialID,
                counter: registrationInfo.counter,
                transports: body.response.transports,
            });
            delete challenges[username];
            return res.json({ verified: true });
        }
    } catch (err) {
        console.error(err);
        return res.status(400).json({ error: err.message });
    }
});

// -----------------------------------------------------------------------------
// P5: Passkey Login (Authentication)
// -----------------------------------------------------------------------------
app.post('/api/auth/login-options', (req, res) => {
    const { username } = req.body;
    const user = users[username];

    if (!user) return res.status(404).json({ error: 'User not found' });

    const options = generateAuthenticationOptions({
        rpID,
        timeout: 60000,
        allowCredentials: user.devices.map(dev => ({
            id: dev.credentialID,
            type: 'public-key',
            transports: dev.transports,
        })),
        userVerification: 'preferred',
    });

    challenges[user.id] = options.challenge;

    res.json(options);
});

app.post('/api/auth/login-verify', async (req, res) => {
    const { username, body } = req.body;
    const user = users[username];
    const expectedChallenge = challenges[username];

    if (!user || !expectedChallenge) {
        return res.status(400).json({ error: 'Login session not found' });
    }

    // Find the device matching the credential ID
    const credentialIDToVerify = body.id;
    const authenticator = user.devices.find((dev) => dev.credentialID === credentialIDToVerify);

    if (!authenticator) {
        return res.status(400).json({ error: 'Authenticator not registered' });
    }

    try {
        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            authenticator: {
                credentialPublicKey: authenticator.credentialPublicKey,
                credentialID: authenticator.credentialID,
                counter: authenticator.counter,
                transports: authenticator.transports,
            }
        });

        if (verification.verified) {
            // Update counter
            authenticator.counter = verification.authenticationInfo.newCounter;
            delete challenges[username];
            return res.json({ verified: true, token: 'mock-zero-trust-jwt' });
        }
    } catch (err) {
        console.error(err);
        return res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`[Zero-Trust Auth API] Running on port ${PORT}`);
});
