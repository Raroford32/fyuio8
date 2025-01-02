import type { Express } from "express";
import { createServer, type Server } from "http";
import fileUpload from "express-fileupload";
import { createReadStream, unlink } from "fs";
import { WebSocketServer } from "ws";
import readline from "readline";
import Web3 from 'web3';

const web3 = new Web3('https://eth.llamarpc.com');
const CHUNK_SIZE = 50; // Reduced chunk size for real-time balance checking

interface WalletUpdate {
  address: string;
  balance: string;
}

interface ProgressUpdate {
  type: 'wallet-update';
  progress: number;
  total?: number;
  completed?: number;
  wallets?: WalletUpdate[];
  error?: string;
}

async function deriveAddressAndCheckBalance(privateKey: string): Promise<WalletUpdate | null> {
  try {
    // Remove '0x' prefix if present and clean the key
    const cleanKey = privateKey.trim().toLowerCase().replace('0x', '');

    // Check if it's a valid 64-character hex string
    if (!/^[0-9a-f]{64}$/.test(cleanKey)) {
      return null;
    }

    // Create account from private key and get address
    const account = web3.eth.accounts.privateKeyToAccount('0x' + cleanKey);
    const address = account.address;

    // Check balance
    const balance = await web3.eth.getBalance(address);
    const ethBalance = web3.utils.fromWei(balance, 'ether');

    return {
      address,
      balance: (+ethBalance).toFixed(4)
    };
  } catch (error) {
    console.error('Error processing key:', error);
    return null;
  }
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    limits: { fileSize: 500 * 1024 * 1024 },
    abortOnLimit: false,
    debug: true,
  }));

  const wss = new WebSocketServer({ 
    noServer: true,
    perMessageDeflate: false
  });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      if (request.headers['sec-websocket-protocol']?.includes('vite-hmr')) {
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('WebSocket error:', error);
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.on('error', (error) => console.error('WebSocket error:', error));
    ws.on('close', () => console.log('WebSocket client disconnected'));
  });

  app.post('/api/upload', async (req, res) => {
    console.log('Upload request received');
    let fileStream = null;
    let rl = null;

    try {
      if (!req.files || !req.files.file) {
        throw new Error('No file uploaded');
      }

      const file = req.files.file as fileUpload.UploadedFile;
      console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);

      if (file.size === 0) {
        throw new Error('Empty file uploaded');
      }

      fileStream = createReadStream(file.tempFilePath);
      rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
        highWaterMark: 1024 * 1024
      });

      let lineCount = 0;
      let processedLines = 0;
      let currentChunk: WalletUpdate[] = [];
      let validWallets = 0;
      let invalidCount = 0;

      // Count total lines first
      for await (const _ of rl) {
        lineCount++;
      }

      // Reset stream for processing
      fileStream.destroy();
      fileStream = createReadStream(file.tempFilePath);
      rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
        highWaterMark: 1024 * 1024
      });

      // Process lines in chunks
      for await (const line of rl) {
        const privateKey = line.trim();
        if (privateKey) {
          const wallet = await deriveAddressAndCheckBalance(privateKey);
          if (wallet) {
            currentChunk.push(wallet);
            validWallets++;
          } else {
            invalidCount++;
          }
        }
        processedLines++;

        // Send updates for each chunk or at 100%
        if (currentChunk.length >= CHUNK_SIZE || processedLines === lineCount) {
          const progress = Math.floor((processedLines / lineCount) * 100);
          console.log(`Processing progress: ${progress}%`);

          // Only send wallets with balance
          const walletsWithBalance = currentChunk.filter(w => Number(w.balance) > 0);

          // Broadcast progress to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              const update: ProgressUpdate = {
                type: 'wallet-update',
                progress,
                total: lineCount,
                completed: processedLines,
                wallets: walletsWithBalance
              };
              client.send(JSON.stringify(update));
            }
          });

          // Clear chunk after sending
          currentChunk = [];

          // Free up memory periodically
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Clean up
      rl.close();
      fileStream.destroy();

      // Delete temp file
      await new Promise<void>((resolve, reject) => {
        unlink(file.tempFilePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({ 
        success: true,
        stats: {
          total: lineCount,
          valid: validWallets,
          invalid: invalidCount
        }
      });
    } catch (error: any) {
      console.error('Upload error:', error);

      // Clean up on error
      if (rl) rl.close();
      if (fileStream) fileStream.destroy();

      // Try to delete temp file if it exists
      if (req.files?.file) {
        const file = req.files.file as fileUpload.UploadedFile;
        try {
          await new Promise<void>((resolve) => {
            unlink(file.tempFilePath, () => resolve());
          });
        } catch (unlinkError) {
          console.error('Error deleting temp file:', unlinkError);
        }
      }

      res.status(500).json({ 
        error: 'Error processing file', 
        details: error.message 
      });
    }
  });

  return httpServer;
}