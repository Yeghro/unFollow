# unFollow - Lightning Network Payment Integration

This project supports multiple Lightning Network payment systems for receiving tips and payments.

## Supported Payment Systems

### 1. LNbits
- Traditional LNbits server integration
- Requires LNbits URL and API key
- Set `PAYMENT_SYSTEM=lnbits` in `.env`

### 2. Coinos.io
- REST API integration with Coinos.io
- Requires Coinos API token and username
- Set `PAYMENT_SYSTEM=coinos` in `.env`

## Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

- `PAYMENT_SYSTEM` — server-side payment provider selection (default: `coinos`)
- `PORT` — server listen port (default: `3210`)
- `COINOS_TOKEN` / `COINOS_USERNAME` — required when `PAYMENT_SYSTEM=coinos`
- `LNBITS_URL` / `LNBITS_KEY` — required when `PAYMENT_SYSTEM=lnbits`

All payment system configuration is server-side. The client always calls the local API; no payment choice is baked into the frontend build.

## Coinos.io Setup

1. **Get API Token**:
   - Sign up at https://coinos.io
   - Go to your account settings to get your API token
   - Or use the `/login` endpoint to authenticate

2. **Configure Environment**:
   - Add your `COINOS_TOKEN` and `COINOS_USERNAME` to `.env`
   - Set `PAYMENT_SYSTEM=coinos` in `.env`
   - **Note**: Coinos.io uses an API token for auth, and a username in the invoice request body

3. **API Endpoints**:
   - `POST /api/create-invoice` — Create a lightning invoice (body: `{ amount }`)
   - `GET /api/check-payment/:id` — Check payment status, where `:id` is the `id` field from the `create-invoice` response — the coinos invoice UUID (not a payment hash)

## Account ID vs API Token

- **Coinos.io**: Uses an API token for auth, and a username in the invoice body
- **LNbits**: Uses an API key for server authentication

## Payment System Selection

The server reads `PAYMENT_SYSTEM` at runtime. There is no client-side payment system variable — the frontend always calls the local server API (`/api/create-invoice`). Changing `PAYMENT_SYSTEM` requires no rebuild.

- `lnbits` — Uses LNbits server
- `coinos` — Uses Coinos.io REST API

## Testing

To test the Coinos integration:

1. Set `PAYMENT_SYSTEM=coinos`, `COINOS_TOKEN`, and `COINOS_USERNAME` in `.env`
2. Start the server: `node server.js`
3. Open the application in your browser
4. Try creating a tip — the client will call `/api/create-invoice` and display a Lightning invoice QR
5. Check payment status using `GET /api/check-payment/:id` with the `id` from the create response

## API Documentation

For detailed Coinos.io API documentation, visit: https://coinos.io/docs
