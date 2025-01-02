import type { Express } from "express";
import { createServer, type Server } from "http";
import fileUpload from "express-fileupload";
import { createReadStream, unlink } from "fs";
import { WebSocketServer } from "ws";
import readline from "readline";
import Web3 from 'web3';

const web3 = new Web3();
const CHUNK_SIZE = 1000; // Process 1000 lines at a time

interface ProgressUpdate {
  type: 'upload' | 'processing';
  progress: number;
  total?: number;
  completed?: number;
  addresses?: string[];
  error?: string;
}

function deriveAddress(privateKey: string): string | null {
  try {
    // Remove '0x' prefix if present and clean the key
    const cleanKey = privateKey.trim().toLowerCase().replace('0x', '');

    // Check if it's a valid 64-character hex string
    if (!/^[0-9a-f]{64}$/.test(cleanKey)) {
      return null;
    }

    // Create account from private key and get address
    const account = web3.eth.accounts.privateKeyToAccount('0x' + cleanKey);
    return account.address;
  } catch {
    return null;
  }
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // File upload middleware with detailed error handling
  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    abortOnLimit: false,
    debug: true,
  }));

  // Create WebSocket server with custom upgrade handling
  const wss = new WebSocketServer({ 
    noServer: true,
    perMessageDeflate: false
  });

  // Handle WebSocket upgrade requests
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

  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.on('error', (error) => console.error('WebSocket error:', error));
    ws.on('close', () => console.log('WebSocket client disconnected'));
  });

  // File upload endpoint with chunked processing
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

      // Create read stream and line interface
      fileStream = createReadStream(file.tempFilePath);
      rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
        highWaterMark: 1024 * 1024 // 1MB buffer
      });

      let lineCount = 0;
      let processedLines = 0;
      let currentChunk: string[] = [];
      let validAddresses: string[] = [];
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
          const address = deriveAddress(privateKey);
          if (address) {
            currentChunk.push(address);
            validAddresses.push(address);
          } else {
            invalidCount++;
          }
        }
        processedLines++;

        // Send updates for each chunk or at 100%
        if (currentChunk.length >= CHUNK_SIZE || processedLines === lineCount) {
          const progress = Math.floor((processedLines / lineCount) * 100);
          console.log(`Processing progress: ${progress}%`);

          // Broadcast progress to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              const update: ProgressUpdate = {
                type: 'upload',
                progress,
                total: lineCount,
                completed: processedLines,
                addresses: currentChunk
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
          valid: validAddresses.length,
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