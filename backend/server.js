import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupDatabase } from './database.js';
import OpenAI from 'openai';
import axios from 'axios'; 
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'local'}` });
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const gaiaNode = new OpenAI({
    baseURL: process.env.GAIA_NODE_URL,
    apiKey: process.env.GAIA_API_KEY,
});

// Initialize Blockfrost Client
const blockfrost = new BlockFrostAPI({
    projectId: process.env.BLOCKFROST_API_KEY,
    isTestnet: process.env.CARDANO_NETWORK === 'preprod',
});

let db;

(async () => {
  const dbFilename = process.env.DATABASE_FILENAME || './database.db';
  db = await setupDatabase(dbFilename);
})();

// API Endpoints
app.post('/api/summarize-cip', async (req, res) => {
    const { cipNumber, walletAddress } = req.body;

    if (!cipNumber || !walletAddress) {
        return res.status(400).json({ error: 'CIP number and wallet address are required.' });
    }

    // --- Credit checking logic remains exactly the same ---
    let user = await db.get('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
    if (!user) {
        await db.run('INSERT INTO users (wallet_address) VALUES (?)', [walletAddress]);
        user = { credits_remaining: 500 };
    }
    if (user.credits_remaining <= 0) {
        return res.status(402).json({ error: 'Payment required.' });
    }
    // --- End of credit check ---

    try {
        const cipContentUrl = `https://raw.githubusercontent.com/cardano-foundation/CIPs/refs/heads/master/${cipNumber}/README.md`;
        const response = await axios.get(cipContentUrl);
        const cipContent = response.data;

        const tokenCount = estimateTokens(cipContent);
        const CONTEXT_LIMIT = 8192;
        // Use a safe buffer (e.g., ~7000 tokens for the content) to allow for the prompt text
        const SAFE_LIMIT = 7500; 

        let finalSummary = '';

        if (tokenCount <= SAFE_LIMIT) {
            console.log(`[INFO] CIP ${cipNumber} is small enough (${tokenCount} tokens). Using single summary.`);
            const systemPrompt = "You are an expert Cardano analyst. Your task is to summarize the provided text from a Cardano Improvement Proposal (CIP) in simple, easy-to-understand language for a general audience. Your summary should be around 200 words and focus on the problem the CIP solves and its proposed solution.";
            const userPrompt = `Please summarize the following content from ${cipNumber}:\n\n---\n\n${cipContent}`;

            const chatCompletion = await gaiaNode.chat.completions.create({
                model: process.env.GAIA_MODEL_NAME,
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            });
            finalSummary = chatCompletion.choices[0].message.content;
        } 
        else {
            console.log(`[INFO] CIP ${cipNumber} is too large (${tokenCount} tokens). Using chunking strategy.`);

            const chunkSize = SAFE_LIMIT * 3; // Use fewer characters than tokens for safety
            const chunkOverlap = 500;
            const chunks = [];
            for (let i = 0; i < cipContent.length; i += chunkSize - chunkOverlap) {
                chunks.push(cipContent.substring(i, i + chunkSize));
            }

            const mapSystemPrompt = "You are part of a summarization pipeline. Summarize the following segment of a technical document. Focus on the key points, specifications, and rationale. This is an intermediate step, not the final summary.";
            
            const chunkSummariesPromises = chunks.map(chunk => 
                gaiaNode.chat.completions.create({
                    model: process.env.GAIA_MODEL_NAME,
                    messages: [{ role: "system", content: mapSystemPrompt }, { role: "user", content: chunk }],
                })
            );
            
            const chunkSummariesResponses = await Promise.all(chunkSummariesPromises);
            const chunkSummaries = chunkSummariesResponses.map(response => response.choices[0].message.content).join('\n\n---\n\n');

            // REDUCE Step: Create a final summary from the chunk summaries
            const reduceSystemPrompt = "You are a master synthesizer. You will be given a series of partial summaries from a single large technical document. Your task is to synthesize these pieces into a single, cohesive, and easy-to-understand summary of around 200 words for a general audience.";
            const reduceUserPrompt = `Please synthesize the following partial summaries into a final summary:\n\n${chunkSummaries}`;
            
            const finalCompletion = await gaiaNode.chat.completions.create({
                model: process.env.GAIA_MODEL_NAME,
                messages: [{ role: "system", content: reduceSystemPrompt }, { role: "user", content: reduceUserPrompt }],
            });
            finalSummary = finalCompletion.choices[0].message.content;
        }

        // Decrement user's credits ONCE, after all work is done.
        await db.run('UPDATE users SET credits_remaining = credits_remaining - 1 WHERE wallet_address = ?', [walletAddress]);
        
        res.json({ title: `Summary for ${cipNumber}`, summary: finalSummary });

    } catch (error) {
        if (error.isAxiosError && error.response && error.response.status === 404) {
            return res.status(404).json({ error: `Could not find content for ${cipNumber}. Please check the number and format.` });
        }
        console.error("Error during summarization:", error);
        res.status(500).json({ error: 'Failed to generate summary. The AI node may be experiencing issues.' });
    }
});

// app.post('/api/confirm-payment', async (req, res) => {
//     const { walletAddress, txHash } = req.body;
//     const creditsToAdd = 1500;
//     // !! IMPORTANT !!
//     // In a real production app, you would use a service like Blockfrost or Koios here
//     // to verify the txHash on-chain to ensure the payment was real.
//     // For this project, we will trust the client's confirmation for simplicity.
//     console.log(`Received payment confirmation for ${walletAddress} with txHash ${txHash}`);
    
//     await db.run(
//       'UPDATE users SET credits_remaining = credits_remaining + ?, credits_purchased = credits_purchased + ? WHERE wallet_address = ?', 
//       [creditsToAdd, creditsToAdd, walletAddress]
//     );
    
//     res.json({ success: true, message: `${creditsToAdd} credits added.` });
// });

// 1. Get CIP data (Mocked Gaia Node)
// app.get('/api/cip/:cipNumber', (req, res) => {
//   const { cipNumber } = req.params;
//   const data = cipData[cipNumber];

//   if (data) {
//     res.json(data);
//   } else {
//     res.status(404).json({ error: 'CIP not found' });
//   }
// });

// 2. Submit a vote
app.post('/api/vote', async (req, res) => {
  const { walletAddress, cipNumber, voteChoice } = req.body;
  if (!walletAddress || !cipNumber || !voteChoice) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await db.run(
      'INSERT INTO votes (wallet_address, cip_number, vote_choice) VALUES (?, ?, ?)',
      [walletAddress, cipNumber, voteChoice]
    );
    res.status(201).json({ success: true, id: result.lastID });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'User has already voted on this CIP' });
    }
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

app.post('/api/confirm-payment', async (req, res) => {
    const { walletAddress, txHash } = req.body;
    if (!txHash) {
        return res.status(400).json({ error: 'Transaction hash is required.' });
    }

    try {
        // 1. Prevent Replay Attacks: Check if txHash has already been claimed
        const existingTx = await db.get('SELECT tx_hash FROM claimed_transactions WHERE tx_hash = ?', [txHash]);
        if (existingTx) {
            return res.status(409).json({ error: 'This transaction has already been used to claim credits.' });
        }

        // 2. Fetch Transaction Details from Blockfrost
        // We use txsUtxos as it clearly shows all outputs.
        const txInfo = await blockfrost.txsUtxos(txHash);

        const paymentAddress = process.env.PAYMENT_WALLET_ADDRESS;
        const requiredAmount = process.env.VITE_PAYMENT_AMOUNT; // In Lovelace
        
        // 3. Verify the Payment
        let paymentVerified = false;
        // Iterate through all outputs of the transaction
        for (const output of txInfo.outputs) {
            // Check if an output was sent to our treasury address
            if (output.address === paymentAddress) {
                // Find the lovelace amount in that output
                const lovelaceAmount = output.amount.find(amt => amt.unit === 'lovelace');
                // Check if the amount is sufficient
                if (lovelaceAmount && BigInt(lovelaceAmount.quantity) >= BigInt(requiredAmount)) {
                    paymentVerified = true;
                    break; // Found a valid payment, no need to check other outputs
                }
            }
        }

        // 4. Grant Credits if Verified
        if (paymentVerified) {
            const creditsToAdd = 1500;
            // First, record the transaction hash so it cannot be used again
            await db.run('INSERT INTO claimed_transactions (tx_hash) VALUES (?)', [txHash]);

            // Then, add the credits to the user's account
            await db.run(
                'UPDATE users SET credits_remaining = credits_remaining + ?, credits_purchased = credits_purchased + ? WHERE wallet_address = ?',
                [creditsToAdd, creditsToAdd, walletAddress]
            );
            
            console.log(`SUCCESS: Credits granted for txHash ${txHash}`);
            return res.json({ success: true, message: `${creditsToAdd} credits added successfully.` });
        } else {
            // If the loop completes and no valid payment was found
            return res.status(400).json({ error: 'Payment not found in transaction. Please verify the amount and recipient address.' });
        }

    } catch (error) {
        // Handle errors from Blockfrost (e.g., tx not found)
        if (error.status === 404) {
            return res.status(404).json({ error: 'Transaction not found. Please wait a moment for it to appear on the blockchain and try again.' });
        }
        console.error('Blockfrost API Error:', error);
        return res.status(500).json({ error: 'Failed to verify transaction with the blockchain provider.' });
    }
});

// Get leaderboard data
app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT wallet_address, COUNT(id) as votes, COUNT(id) as points
      FROM votes
      GROUP BY wallet_address
      ORDER BY points DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

// Get dashboard data for a specific user
app.get('/api/dashboard/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    // Get voting history
    const votingHistory = await db.all(
      'SELECT cip_number, vote_choice, timestamp FROM votes WHERE wallet_address = ? ORDER BY timestamp DESC',
      [walletAddress]
    );

    // Get total votes/points
    const stats = await db.get(
      'SELECT COUNT(id) as totalVotes, COUNT(id) as governancePoints FROM votes WHERE wallet_address = ?',
      [walletAddress]
    );

    // Get rank
    const leaderboard = await db.all(`
      SELECT wallet_address, COUNT(id) as points
      FROM votes
      GROUP BY wallet_address
      ORDER BY points DESC
    `);
    const rank = leaderboard.findIndex(v => v.wallet_address === walletAddress) + 1;

    res.json({
      ...stats,
      leaderboardRank: rank > 0 ? rank : 'N/A',
      votingHistory,
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

// Get all votes for a user (to check for double voting on the client)
app.get('/api/votes/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    try {
        const votes = await db.all('SELECT cip_number, vote_choice FROM votes WHERE wallet_address = ?', [walletAddress]);
        res.json(votes);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/credits/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;

    let user = await db.get('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
    if (!user) {
        // If user doesn't exist, create them with free credits
        await db.run('INSERT INTO users (wallet_address) VALUES (?)', [walletAddress]);
        user = { credits_remaining: 500, credits_purchased: 0 }; 
    }

    const freeCredits = 100;
    const totalCredits = freeCredits + user.credits_purchased;
    const consumedCredits = totalCredits - user.credits_remaining;

    res.json({
        remaining: user.credits_remaining,
        consumed: consumedCredits,
        total: totalCredits
    });
});

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
  console.log(`Using environment: ${process.env.NODE_ENV || 'local'}`);
});