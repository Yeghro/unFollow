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

// Modify the create-invoice endpoint to handle both LNbits and Getalby
app.post('/api/create-invoice', async (req, res) => {
  try {
    const { amount, paymentSystem } = req.body;
    
    console.log('Received request:', { amount, paymentSystem });

    if (paymentSystem === 'lnbits') {
      console.log('LNbits URL:', LNBITS_URL);
      console.log('LNbits Key:', LNBITS_KEY ? 'Set' : 'Not set');

      // Ensure amount is a number and convert to integer
      const amountInSats = parseInt(amount, 10);
      if (isNaN(amountInSats) || amountInSats <= 0) {
        throw new Error('Invalid amount');
      }

      const response = await axios.post(`${LNBITS_URL}/api/v1/payments`, {
        out: false,
        amount: amountInSats,
        memo: "Tip Payment"
      }, {
        headers: { 'X-Api-Key': LNBITS_KEY }
      });

      console.log('LNbits response:', response.data);

      res.json({ paymentRequest: response.data.payment_request, paymentHash: response.data.payment_hash });
    } else if (paymentSystem === 'getalby') {
      const response = await axios.get(callbackUrl);
      res.json(response.data);
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
    const response = await axios.get(`${LNBITS_URL}/api/v1/payments/${paymentHash}`, {
      headers: { 'X-Api-Key': LNBITS_KEY }
    });
    res.json({ paid: response.data.paid });
  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

const PORT = process.env.PORT || 3210;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
