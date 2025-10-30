require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const app = express();
const PORT = process.env.PORT || 8000; // Railway maps as needed

// Plaid configuration
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

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
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Health
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'CashAI Backend is running!' });
});

// Create Link Token — request up to 24 months for new links
app.post('/api/create_link_token', async (req, res) => {
  try {
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const request = {
      user: { client_user_id: user_id },
      client_name: 'CashAI',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      transactions: { days_requested: 730 }, // 24 months
    };

    const r = await plaidClient.linkTokenCreate(request);
    res.json(r.data);
  } catch (error) {
    console.error('❌ Error creating link token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange Public Token for Access Token
app.post('/api/set_access_token', async (req, res) => {
  try {
    const { public_token } = req.body || {};
    if (!public_token) return res.status(400).json({ error: 'public_token is required' });

    const r = await plaidClient.itemPublicTokenExchange({ public_token });
    res.json({
      access_token: r.data.access_token,
      item_id: r.data.item_id,
    });
  } catch (error) {
    console.error('❌ Error exchanging public token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to exchange public token' });
  }
});

// Get Accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const { access_token } = req.query;
    if (!access_token) return res.status(400).json({ error: 'access_token is required' });

    const r = await plaidClient.accountsGet({ access_token });
    res.json(r.data);
  } catch (error) {
    console.error('❌ Error fetching accounts:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get Transactions — pass through date range + pagination
app.get('/api/transactions', async (req, res) => {
  try {
    const {
      access_token,
      start_date,
      end_date,
      count = '500',
      offset = '0',
      account_id,
    } = req.query;

    if (!access_token) return res.status(400).json({ error: 'access_token is required' });
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required (yyyy-mm-dd)' });
    }

    const request = {
      access_token,
      start_date,
      end_date,
      options: {
        count: Number(count),
        offset: Number(offset),
        ...(account_id ? { account_ids: [account_id] } : {}),
      },
    };

    const r = await plaidClient.transactionsGet(request);

    // Normalize response the client expects
    res.json({
      transactions: r.data.transactions || [],
      total_transactions: r.data.total_transactions || 0,
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CashAI Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${PLAID_ENV}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
});
