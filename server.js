require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const app = express();
const PORT = process.env.PORT || 8000; // Default to 8000, Railway will map to 8080

// Plaid Configuration
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox'; // Default to sandbox

let plaidClient;

try {
    const configuration = new Configuration({
        basePath: PlaidEnvironments[PLAID_ENV],
        baseOptions: {
            headers: {
                'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
                'PLAID-SECRET': PLAID_SECRET,
            },
        },
    });
    plaidClient = new PlaidApi(configuration);
    console.log(`🌍 Plaid Environment: ${PLAID_ENV}`);
} catch (error) {
    console.error('❌ Failed to initialize Plaid client:', error);
    process.exit(1); // Exit if Plaid client can't be initialized
}

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'CashAI Backend is running!' });
});

// Create Link Token
app.post('/api/create_link_token', async (req, res) => {
    try {
        const { user_id } = req.body;
        if (!user_id) {
            return res.status(400).json({ error: 'user_id is required' });
        }

        console.log(`Creating link token for user: ${user_id}`);

        const request = {
            user: {
                client_user_id: user_id,
            },
            client_name: 'CashAI',
            products: ['transactions'],  // Changed: removed 'auth' to allow credit cards // Removed 'accounts' - not a valid product
            country_codes: ['US'],
            language: 'en',
        };

        const createTokenResponse = await plaidClient.linkTokenCreate(request);
        console.log('✔ Link token created successfully');
        res.json(createTokenResponse.data);
    } catch (error) {
        console.error('❌ Error creating link token:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to create link token', details: error.response ? error.response.data : error.message });
    }
});

// Exchange Public Token for Access Token
app.post('/api/set_access_token', async (req, res) => {
    try {
        const { public_token } = req.body;
        if (!public_token) {
            return res.status(400).json({ error: 'public_token is required' });
        }

        console.log('Exchanging public token for access token');

        const request = {
            public_token: public_token,
        };

        const accessTokenResponse = await plaidClient.itemPublicTokenExchange(request);
        console.log('✔ Public token exchanged successfully');
        res.json({
            access_token: accessTokenResponse.data.access_token,
            item_id: accessTokenResponse.data.item_id,
        });
    } catch (error) {
        console.error('❌ Error exchanging public token:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to exchange public token', details: error.response ? error.response.data : error.message });
    }
});

// Get Accounts
app.get('/api/accounts', async (req, res) => {
    try {
        const { access_token } = req.query;
        if (!access_token) {
            return res.status(400).json({ error: 'access_token is required' });
        }

        const request = {
            access_token: access_token,
        };

        const accountsResponse = await plaidClient.accountsGet(request);
        res.json(accountsResponse.data);
    } catch (error) {
        console.error('❌ Error fetching accounts:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch accounts', details: error.response ? error.response.data : error.message });
    }
});

// Get Transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const { access_token, start_date, end_date } = req.query;
        if (!access_token || !start_date || !end_date) {
            return res.status(400).json({ error: 'access_token, start_date, and end_date are required' });
        }

        const request = {
            access_token: access_token,
            start_date: start_date,
            end_date: end_date,
        };

        const transactionsResponse = await plaidClient.transactionsGet(request);
        res.json(transactionsResponse.data);
    } catch (error) {
        console.error('❌ Error fetching transactions:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch transactions', details: error.response ? error.response.data : error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 CashAI Backend running on port ${PORT}`);
    console.log(`🌍 Environment: ${PLAID_ENV}`);
    console.log(`📱 Health check: http://localhost:${PORT}/health`);
});
