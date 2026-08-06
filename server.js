import express from 'express';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 2); // trust first proxy (nginx/Cloudflare) for rate-limiting
app.use(express.json({ limit: '10kb' }));
app.use(express.static(join(__dirname, 'public')));

// Rate limit invoice creation — 10 requests per minute per IP
app.post('/api/create-invoice', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
}));

const LNBITS_URL = process.env.LNBITS_URL;
const LNBITS_KEY = process.env.LNBITS_KEY;
const COINOS_TOKEN = process.env.COINOS_TOKEN;
const COINOS_USERNAME = process.env.COINOS_USERNAME;
const PAYMENT_SYSTEM = process.env.PAYMENT_SYSTEM || 'lnbits';
const ALBY_ACCOUNT_ID = process.env.ALBY_ACCOUNT_ID;
const PORT = process.env.PORT || 3210;

// Modify the create-invoice endpoint to handle LNbits, Getalby, and Coinos
app.post('/api/create-invoice', async (req, res) => {
  try {
    const { amount } = req.body;

    console.log('Received request for invoice creation:', { amount });

    // Validate amount server-side
    if (!amount || amount < 1000 || amount > 100000) {
      console.log('Invalid amount:', amount);
      return res.status(400).json({ error: 'Invalid amount' });
    }

    console.log('Using payment system:', PAYMENT_SYSTEM);

    if (PAYMENT_SYSTEM === 'lnbits') {
      console.log('LNbits URL:', LNBITS_URL);
      console.log('LNbits Key:', LNBITS_KEY ? 'Set' : 'Not set');
      const response = await axios.post(
        `${LNBITS_URL}/api/v1/payments`,
        {
          out: false,
          amount: amount,
          memo: 'unFollow Tips'
        },
        {
          headers: { 'X-Api-Key': LNBITS_KEY }
        }
      );

      // Normalize LNbits' snake_case response to the shape the client expects
      return res.json({
        paymentRequest: response.data.payment_request,
        paymentHash: response.data.payment_hash
      });
    } else if (PAYMENT_SYSTEM === 'getalby') {
      // Fetch LNURL params
      const paramsResponse = await axios.get(
        `https://getalby.com/lnurlp/${encodeURIComponent(ALBY_ACCOUNT_ID)}`
      );
      
      // Get callback URL and append amount
      const callbackUrl = new URL(paramsResponse.data.callback);
      callbackUrl.searchParams.append("amount", amount * 1000); // Convert sats to millisats
      
      // Request invoice
      const invoiceResponse = await axios.get(callbackUrl.toString());
      
      // Return standardized response
      res.json({
        paymentRequest: invoiceResponse.data.pr,
        paymentHash: invoiceResponse.data.verify,
        successAction: invoiceResponse.data.successAction
      });
    } else if (PAYMENT_SYSTEM === 'coinos') {
      // Create Coinos lightning invoice
      if (!COINOS_TOKEN) {
        throw new Error('Coinos API token not configured');
      }
      if (!COINOS_USERNAME) {
        throw new Error('Coinos username not configured');
      }

      const response = await axios.post(
        'https://coinos.io/api/invoice',
        {
          invoice: {
            amount: amount,
            type: 'lightning'
          },
          user: { username: COINOS_USERNAME }
        },
        {
          headers: {
            'Authorization': `Bearer ${COINOS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Return standardized response for Coinos
      res.json({
        paymentRequest: response.data.text, // Coinos returns payment request in 'text' field
        paymentHash: response.data.id,       // Coinos indexes invoice:<uuid>
        amount: response.data.amount,
        currency: response.data.currency
      });
    } else {
      throw new Error('Invalid payment system');
    }
  } catch (error) {
    console.error('Error creating invoice:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to create invoice'
    });
  }
});

app.get('/api/check-payment/:paymentHash', async (req, res) => {
  try {
    const { paymentHash } = req.params;

    // Validate payment hash format
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(paymentHash)) {
      return res.status(400).json({ error: 'Invalid payment hash' });
    }

    // Use env as source of truth (req.query.paymentSystem is legacy)
    const ps = PAYMENT_SYSTEM;

    console.log('Checking payment status for hash:', paymentHash);

    if (ps === 'coinos') {
      // Check Coinos payment status
      if (!COINOS_TOKEN) {
        return res.status(400).json({ error: 'Coinos API token not configured' });
      }

      const response = await axios.get(`https://coinos.io/api/invoice/${paymentHash}`, {
        headers: {
          'Authorization': `Bearer ${COINOS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      // Coinos returns received amount, check if it matches the expected amount
      const received = Number(response.data.received);
      const expected = Number(response.data.amount);
      const paid = Number.isFinite(received) && Number.isFinite(expected) && expected > 0 && received >= expected;
      res.setHeader('Content-Type', 'application/json');
      res.json({ paid, received: response.data.received, expected: response.data.amount });
    } else {
      // Default to LNbits for backward compatibility
      const response = await axios.get(
        `${LNBITS_URL}/api/v1/payments/${paymentHash}`,
        {
          headers: {
            'X-Api-Key': LNBITS_KEY,
            'Accept': 'application/json'
          }
        }
      );

      // Ensure we're sending JSON response
      res.setHeader('Content-Type', 'application/json');
      res.json({
        paid: response.data.paid,
        preimage: response.data.preimage
      });
    }
  } catch (error) {
    console.error('Error checking payment:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
