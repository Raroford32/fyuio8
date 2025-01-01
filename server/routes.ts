import type { Express } from "express";
import { createServer, type Server } from "http";
import fileUpload from "express-fileupload";
import { createReadStream, unlink } from "fs";
import { WebSocketServer } from "ws";
import readline from "readline";
import crypto from 'crypto';

interface ProgressUpdate {
  type: 'upload' | 'processing';
  progress: number;
  total?: number;
  completed?: number;
  addresses?: string[];
}

function validateAndDeriveAddress(privateKey: string): string | null {
  // Remove '0x' prefix if present
  const cleanKey = privateKey.toLowerCase().replace('0x', '');

  // Check if it's a valid 64-character hex string
  if (!/^[0-9a-f]{64}$/.test(cleanKey)) {
    return null;
  }

  try {
    // Hash the private key immediately after validation
    const hash = crypto.createHash('sha256').update(cleanKey).digest('hex');
    // Only return derived address format
    return `0x${hash.slice(0, 40)}`;
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

  // File upload endpoint
  app.post('/api/upload', async (req, res) => {
    console.log('Upload request received');
    try {
      if (!req.files || !req.files.file) {
        console.error('No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const file = req.files.file as fileUpload.UploadedFile;
      console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);

      if (file.size === 0) {
        console.error('Empty file uploaded');
        return res.status(400).json({ error: 'Empty file uploaded' });
      }

      const filePath = file.tempFilePath;
      const addresses: string[] = [];
      let invalidKeys = 0;

      // Create read stream for the file
      const fileStream = createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let lineCount = 0;
      let processedLines = 0;

      // First count total lines
      console.log('Counting total lines...');
      for await (const _ of rl) {
        lineCount++;
        if (lineCount % 100000 === 0) {
          console.log(`Counted ${lineCount} lines...`);
        }
      }
      console.log(`Total lines: ${lineCount}`);

      // Reset stream for processing
      fileStream.destroy();
      const newFileStream = createReadStream(filePath);
      const newRl = readline.createInterface({
        input: newFileStream,
        crlfDelay: Infinity
      });

      // Process lines and send progress updates
      console.log('Starting line processing...');
      for await (const line of newRl) {
        const privateKey = line.trim();
        if (privateKey) {
          const address = validateAndDeriveAddress(privateKey);
          if (address) {
            addresses.push(address);
          } else {
            invalidKeys++;
          }
        }
        processedLines++;

        // Broadcast progress every 1000 lines or at 100%
        if (processedLines % 1000 === 0 || processedLines === lineCount) {
          const progress = Math.floor((processedLines / lineCount) * 100);
          console.log(`Processing progress: ${progress}%`);

          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              const update: ProgressUpdate = {
                type: 'upload',
                progress,
                total: lineCount,
                completed: processedLines,
                addresses: processedLines === lineCount ? addresses : undefined
              };
              client.send(JSON.stringify(update));
            }
          });
        }
      }

      console.log('File processing complete');
      console.log(`Processed ${lineCount} lines, found ${invalidKeys} invalid keys`);

      // Delete temp file using ES modules
      if (file.tempFilePath) {
        try {
          await new Promise<void>((resolve, reject) => {
            unlink(file.tempFilePath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (err) {
          console.error('Error deleting temp file:', err);
        }
      }

      res.json({ 
        success: true, 
        addresses,
        stats: {
          total: lineCount,
          valid: addresses.length,
          invalid: invalidKeys
        }
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Error processing file', details: error.message });
    }
  });

  return httpServer;
}