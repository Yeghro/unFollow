# unFollow - Lightning Network Payment Integration

This project supports multiple Lightning Network payment systems for receiving tips and payments.

## Supported Payment Systems

### 1. LNbits
- Traditional LNbits server integration
- Requires LNbits URL and API key

### 2. GetAlby
- LNURL-p integration with GetAlby
- Requires Alby account ID

### 3. Coinos.io (NEW!)
- REST API integration with Coinos.io
- Requires Coinos API token

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# LNbits Configuration
LNBITS_URL=https://your-lnbits-instance.com
LNBITS_KEY=your-lnbits-api-key

# Coinos.io Configuration
COINOS_TOKEN=your-coinos-api-token

# Frontend Configuration (Vite environment variables)
VITE_PAYMENT_SYSTEM=getalby
VITE_ALBY_ACCOUNT_ID=your-alby-account-id  # Only needed for GetAlby payments
VITE_TIP_AMOUNTS=1000,5000,10000,20000

# Server Configuration
PORT=3210
```

## Coinos.io Setup

1. **Get API Token**: 
   - Sign up at https://coinos.io
   - Go to your account settings to get your API token
   - Or use the `/login` endpoint to authenticate

2. **Configure Environment**:
   - Add your Coinos API token to the `.env` file
   - Set `VITE_PAYMENT_SYSTEM=coinos` to use Coinos as the default
   - **Note**: Coinos.io uses API tokens, not account IDs like GetAlby

3. **API Endpoints**:
   - `/api/coinos-account` - Get account details and balance
   - `/api/create-invoice` - Create lightning invoices
   - `/api/check-payment/:hash?paymentSystem=coinos` - Check payment status

## Account ID vs API Token

- **GetAlby**: Uses an account ID (like "yeghro") for LNURL-p integration
- **Coinos.io**: Uses an API token for REST API authentication
- **LNbits**: Uses an API key for server authentication

The `VITE_ALBY_ACCOUNT_ID` environment variable is only used when `VITE_PAYMENT_SYSTEM=getalby`.

## Payment System Selection

The frontend can be configured to use any of the three payment systems:

- `getalby` - Uses GetAlby LNURL-p
- `lnbits` - Uses LNbits server
- `coinos` - Uses Coinos.io REST API

## Testing

To test the Coinos integration:

1. Set up your environment variables
2. Start the server: `node server.js`
3. Open the application in your browser
4. Try creating a tip using the Coinos payment system
5. Check the payment status using the Coinos API

## API Documentation

For detailed Coinos.io API documentation, visit: https://coinos.io/docs
