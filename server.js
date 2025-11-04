const express = require('express');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Plaid Client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'CashAI Backend API' });
});

// ✅ FIXED: Create Link Token with 6 months of historical data
app.post('/api/create_link_token', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    // CRITICAL LOGGING - These logs are essential for debugging
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 LINK TOKEN CREATION REQUEST');
    console.log('📝 Creating link token for user:', user_id);
    console.log('✅✅✅ CRITICAL: Requesting 6 months (180 days) of historical data with days_requested: 180');
    
    const linkTokenRequest = {
      user: {
        client_user_id: user_id || 'default_user',
      },
      client_name: 'CashAI',
      products: ['transactions'],  // ✅ Shows all accounts including credit cards
      country_codes: ['US'],
      language: 'en',
      transactions: {
        days_requested: 180  // ✅ CRITICAL FIX: Request 6 months (180 days) of historical data
      }
    };
    
    console.log('📋 Link token request configuration:');
    console.log('   - products:', linkTokenRequest.products);
    console.log('   - transactions.days_requested:', linkTokenRequest.transactions.days_requested);
    console.log('   - user.client_user_id:', linkTokenRequest.user.client_user_id);
    
    const linkTokenResponse = await plaidClient.linkTokenCreate(linkTokenRequest);
    
    console.log('✅✅✅ LINK TOKEN CREATED SUCCESSFULLY with days_requested: 180 (6 months)');
    console.log('✅ Token length:', linkTokenResponse.data.link_token?.length || 0);
    console.log('═══════════════════════════════════════════════════════════');
    
    res.json({ 
      link_token: linkTokenResponse.data.link_token 
    });
    
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ ERROR CREATING LINK TOKEN');
    console.error('❌ Error:', error.message);
    console.error('❌ Full error:', error);
    console.error('═══════════════════════════════════════════════════════════');
    res.status(500).json({ 
      error: 'Failed to create link token',
      details: error.message 
    });
  }
});

// Exchange public token for access token
app.post('/api/set_access_token', async (req, res) => {
  try {
    const { public_token } = req.body;
    
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }
    
    console.log('🔄 Exchanging public token for access token');
    
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });
    
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    
    console.log('✅ Access token exchanged successfully. Item ID:', itemId);
    
    res.json({
      access_token: accessToken,
      item_id: itemId,
    });
    
  } catch (error) {
    console.error('❌ Error exchanging public token:', error);
    res.status(500).json({ 
      error: 'Failed to exchange public token',
      details: error.message 
    });
  }
});

// Get accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const { access_token } = req.query;
    
    if (!access_token) {
      return res.status(400).json({ error: 'access_token is required' });
    }
    
    console.log('📊 Fetching accounts');
    
    const response = await plaidClient.accountsGet({
      access_token: access_token,
    });
    
    res.json({
      accounts: response.data.accounts,
      item: response.data.item,
    });
    
  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch accounts',
      details: error.message 
    });
  }
});

// ✅ FIXED: Get transactions with proper date range handling (6 months)
app.get('/api/transactions', async (req, res) => {
  try {
    const { access_token, start_date, end_date, count = 500, offset = 0 } = req.query;
    
    // Validate required parameters
    if (!access_token) {
      return res.status(400).json({ error: 'access_token is required' });
    }
    
    // ✅ CRITICAL FIX: Use the date range from query parameters
    // If not provided, default to 6 months
    let startDate = start_date;
    let endDate = end_date;
    
    if (!startDate || !endDate) {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 6);  // 6 months default
      
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
      
      console.log('📅 Using default date range (6 months):', startDate, 'to', endDate);
    } else {
      console.log('📅 Using provided date range:', startDate, 'to', endDate);
    }
    
    console.log(`📊 Fetching transactions: ${startDate} to ${endDate} (count: ${count}, offset: ${offset})`);
    
    // ✅ CRITICAL FIX: Pass start_date and end_date to Plaid's transactionsGet API
    // Note: count and offset must be nested in an options object
    const response = await plaidClient.transactionsGet({
      access_token: access_token,
      start_date: startDate,  // ✅ Must pass this from query params
      end_date: endDate,      // ✅ Must pass this from query params
      options: {
        count: parseInt(count),
        offset: parseInt(offset),
      }
    });
    
    const transactions = response.data.transactions || [];
    const totalTransactions = response.data.total_transactions || 0;
    
    console.log(`✅ Plaid returned ${transactions.length} transactions (total: ${totalTransactions}, offset: ${offset})`);
    
    // Log date range of returned transactions for debugging
    if (transactions.length > 0) {
      const dates = transactions.map(tx => tx.date).sort();
      console.log(`📅 Transaction date range returned: ${dates[0]} to ${dates[dates.length - 1]}`);
      
      // Calculate how many months of data we actually got
      const requestedStart = new Date(startDate);
      const requestedEnd = new Date(endDate);
      const actualStart = new Date(dates[0]);
      const actualEnd = new Date(dates[dates.length - 1]);
      
      const requestedMonths = (requestedEnd - requestedStart) / (1000 * 60 * 60 * 24 * 30);
      const actualMonths = (actualEnd - actualStart) / (1000 * 60 * 60 * 24 * 30);
      
      console.log(`⚠️ WARNING: Requested ${requestedMonths.toFixed(1)} months, but only got ${actualMonths.toFixed(1)} months of data`);
      
      if (actualMonths < requestedMonths * 0.8) {
        console.log(`⚠️⚠️⚠️ CRITICAL: Item was likely created before backend fix with days_requested: 180`);
        console.log(`⚠️⚠️⚠️ User needs to disconnect and reconnect bank to get full 6 months of data`);
      }
    } else {
      console.log(`⚠️ No transactions returned for date range: ${startDate} to ${endDate}`);
    }
    
    res.json({
      transactions: transactions,
      total_transactions: totalTransactions,
      accounts: response.data.accounts,
      item: response.data.item,
    });
    
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ ERROR FETCHING TRANSACTIONS');
    console.error('❌ Error message:', error.message);
    
    // Log full Plaid error response if available
    if (error.response?.data) {
      console.error('❌ Plaid error response:', JSON.stringify(error.response.data, null, 2));
      console.error('❌ Plaid error code:', error.response.data.error_code);
      console.error('❌ Plaid error type:', error.response.data.error_type);
      console.error('❌ Plaid error message:', error.response.data.error_message);
    }
    
    console.error('❌ Full error:', error);
    console.error('═══════════════════════════════════════════════════════════');
    
    // Check for PRODUCT_NOT_READY error
    if (error.response?.data?.error_code === 'PRODUCT_NOT_READY') {
      console.log('⏳ Plaid data not ready yet (PRODUCT_NOT_READY)');
      return res.status(202).json({ 
        error: 'PRODUCT_NOT_READY',
        error_code: 'PRODUCT_NOT_READY',
        message: 'Transaction data is still being processed. Please try again in a few moments.'
      });
    }
    
    // Return the actual status code from Plaid if available
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ 
      error: 'Failed to fetch transactions',
      error_code: error.response?.data?.error_code,
      error_type: error.response?.data?.error_type,
      error_message: error.response?.data?.error_message,
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CashAI Backend Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.PLAID_ENV || 'sandbox'}`);
  console.log(`✅ Ready to handle Plaid API requests`);
});

