import express from 'express';
import { getInactiveFollows } from './api.js';
import './websocketAdapter.js';  // Add this line at the top

const app = express();
const port = 4210;

app.get('/api/inactive-follows', async (req, res) => {
  let { pubkey, months } = req.query;
  
  if (!pubkey || !months) {
    return res.status(400).json({ error: 'Both pubkey and months are required' });
  }

  console.log("API request pubkey and months:", pubkey, months);

  try {
    const result = await getInactiveFollows(pubkey, months);
    res.json(result);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});