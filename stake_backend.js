const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const STAKE_API_KEY = '91c38146b015aad84d792490ca6f58d7d3926eb14a08c59f2713d1dd55007c420902b3dc7fbfe4e5c4cb602d6541cc36';

app.use(cors());
app.use(bodyParser.json());

function generateMineBoard(serverSeed, clientSeed, nonce, mineCount) {
  const tiles = Array.from({ length: 25 }, (_, i) => i);
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hash = hmac.digest('hex');

  const numbers = [];
  for (let i = 0; i < hash.length; i += 4) {
    const slice = hash.slice(i, i + 4);
    const num = parseInt(slice, 16);
    if (!isNaN(num)) numbers.push(num % 25);
  }

  const mines = [];
  for (let num of numbers) {
    if (!mines.includes(num)) {
      mines.push(num);
      if (mines.length === mineCount) break;
    }
  }

  return tiles.filter(t => !mines.includes(t));
}

app.post('/predict', async (req, res) => {
  const { stakeId } = req.body;
  if (!stakeId) return res.status(400).json({ error: 'Missing stakeId' });

  try {
    const response = await axios.post(
      'https://api.stake.com/graphql',
      {
        operationName: 'GetGameById',
        variables: { id: stakeId },
        query: `
        query GetGameById($id: ID!) {
          game(id: $id) {
            id
            mines {
              client_seed
              server_seed {
                seed
              }
              nonce
              mine_count
            }
          }
        }`
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${STAKE_API_KEY}`
        }
      }
    );

    const game = response.data.data.game.mines;
    const { client_seed, server_seed, nonce, mine_count } = game;
    const safeTiles = generateMineBoard(server_seed.seed, client_seed, nonce, mine_count);

    res.json({ safeTiles, mineCount: mine_count });
  } catch (err) {
    console.error(err?.response?.data || err);
    res.status(500).json({ error: 'Failed to fetch prediction data' });
  }
});

app.listen(PORT, () => {
  console.log(`Stake backend server running on port ${PORT}`);
});