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

const client = new PlaidApi(configuration);

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
app.post('/api/accounts', async (req, res) => {
  try {
    console.log('📊 Fetching accounts for access token');
    
    const request = {
      access_token: req.body.access_token,
    };

    const accountsResponse = await client.accountsGet(request);
    
    console.log('✅ Accounts fetched successfully');
    res.json(accountsResponse.data);
  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch accounts',
      details: error.message 
    });
  }
});

// Get Transactions
app.post('/api/transactions', async (req, res) => {
  try {
    console.log('💳 Fetching transactions for access token');
    
    const request = {
      access_token: req.body.access_token,
      start_date: req.body.start_date || '2024-01-01',
      end_date: req.body.end_date || new Date().toISOString().split('T')[0],
    };

    const transactionsResponse = await client.transactionsGet(request);
    
    console.log('✅ Transactions fetched successfully');
    res.json(transactionsResponse.data);
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CashAI Backend running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.PLAID_ENV || 'sandbox'}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
});
