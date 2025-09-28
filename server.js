const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Plaid Configuration
const configuration = new Configuration({
  basePath: process.env.PLAID_ENV === 'production' 
    ? PlaidEnvironments.production 
    : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'CashAI Backend is running!' });
});

// Create Link Token
app.post('/api/create_link_token', async (req, res) => {
  try {
    console.log('📱 Creating link token for user:', req.body.user_id);
    
    const request = {
      user: {
        client_user_id: req.body.user_id || 'cashai-user',
      },
      client_name: 'CashAI',
         products: ['transactions', 'auth'], // Removed 'accounts' - not a valid product
      country_codes: ['US'],
      language: 'en',
    };

    const createTokenResponse = await client.linkTokenCreate(request);
    
    console.log('✅ Link token created successfully');
    res.json(createTokenResponse.data);
  } catch (error) {
    console.error('❌ Error creating link token:', error);
    res.status(500).json({ 
      error: 'Failed to create link token',
      details: error.message 
    });
  }
});

// Exchange Public Token for Access Token
app.post('/api/set_access_token', async (req, res) => {
  try {
    console.log('🔄 Exchanging public token for access token');
    
    const request = {
      public_token: req.body.public_token,
    };

    const exchangeResponse = await client.itemPublicTokenExchange(request);
    
    console.log('✅ Public token exchanged successfully');
    res.json({
      access_token: exchangeResponse.data.access_token,
      item_id: exchangeResponse.data.item_id,
    });
  } catch (error) {
    console.error('❌ Error exchanging public token:', error);
    res.status(500).json({ 
      error: 'Failed to exchange public token',
      details: error.message 
    });
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CashAI Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.PLAID_ENV || 'sandbox'}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
});
