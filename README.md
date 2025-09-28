# CashAI Backend

Production-ready backend for CashAI app with Plaid integration.

## Features

- ✅ Plaid Link Token creation
- ✅ Public token exchange
- ✅ Account data fetching
- ✅ Transaction history
- ✅ Production ready
- ✅ CORS enabled for iOS app

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=production
PORT=8000
```

3. Start the server:
```bash
npm start
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/create_link_token` - Create Plaid link token
- `POST /api/set_access_token` - Exchange public token
- `POST /api/accounts` - Get account data
- `POST /api/transactions` - Get transaction history

## Deployment

Ready for deployment to:
- Railway
- Heroku
- Vercel
- AWS
- Google Cloud
