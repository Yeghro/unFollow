import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const LNBITS_URL = process.env.LNBITS_URL;
const LNBITS_KEY = process.env.LNBITS_KEY;
const COINOS_TOKEN = process.env.COINOS_TOKEN; // Add Coinos API token

// Add this new endpoint for Getalby support
app.get('/api/fetch-lnurl-params/:albyAccountId', async (req, res) => {
  try {
    const { albyAccountId } = req.params;
    const url = `https://getalby.com/lnurlp/${encodeURIComponent(albyAccountId)}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching LNURL params:', error);
    res.status(500).json({ error: 'Failed to fetch LNURL params' });
  }
});

// Add new endpoint for Coinos account details
app.get('/api/coinos-account', async (req, res) => {
  try {
    if (!COINOS_TOKEN) {
      return res.status(400).json({ error: 'Coinos API token not configured' });
    }

    const response = await axios.get('https://coinos.io/api/me', {
      headers: {
        'Authorization': `Bearer ${COINOS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Coinos account:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch Coinos account details' });
  }
});

// Modify the create-invoice endpoint to handle LNbits, Getalby, and Coinos
app.post('/api/create-invoice', async (req, res) => {
  try {
    const { amount, paymentSystem, albyAccountId } = req.body;
    
    console.log('Received request:', { amount, paymentSystem });

    if (paymentSystem === 'lnbits') {
      const response = await axios.post(
        `${LNBITS_URL}/api/v1/payments`,
        {
          out: false,
          amount: amount,
          memo: 'LNbits Payment'
        },
        {
          headers: { 'X-Api-Key': LNBITS_KEY }
        }
      );

      res.json(response.data);
    } else if (paymentSystem === 'getalby') {
      // Fetch LNURL params
      const paramsResponse = await axios.get(
        `https://getalby.com/lnurlp/${encodeURIComponent(albyAccountId)}`
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
    } else if (paymentSystem === 'coinos') {
      // Create Coinos lightning invoice
      if (!COINOS_TOKEN) {
        throw new Error('Coinos API token not configured');
      }

      const response = await axios.post(
        'https://coinos.io/api/invoice',
        {
          invoice: {
            amount: amount,
            type: 'lightning'
          }
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
        paymentHash: response.data.hash,    // Coinos uses 'hash' field for payment hash
        uid: response.data.uid,             // Coinos unique identifier
        amount: response.data.amount,
        currency: response.data.currency
      });
    } else {
      throw new Error('Invalid payment system');
    }
  } catch (error) {
    console.error('Error creating invoice:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to create invoice', details: error.message });
  }
});

app.get('/api/check-payment/:paymentHash', async (req, res) => {
  try {
    const { paymentHash } = req.params;
    const { paymentSystem } = req.query; // Add payment system parameter

    if (paymentSystem === 'coinos') {
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
      const paid = response.data.received >= response.data.amount;
      res.json({ paid, received: response.data.received, expected: response.data.amount });
    } else {
      // Default to LNbits for backward compatibility
      const response = await axios.get(`${LNBITS_URL}/api/v1/payments/${paymentHash}`, {
        headers: { 'X-Api-Key': LNBITS_KEY }
      });
      res.json({ paid: response.data.paid });
    }
  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

const PORT = process.env.PORT || 3210;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
