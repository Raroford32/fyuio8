import type { Express } from "express";
import { createServer } from "http";
import fileUpload from "express-fileupload";
import { createReadStream } from "fs";
import { WebSocketServer } from "ws";
import readline from "readline";

interface ProgressUpdate {
  type: 'upload' | 'processing';
  progress: number;
  total?: number;
  completed?: number;
  addresses?: string[];
}

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // File upload middleware
  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  }));

  // Create WebSocket server with custom upgrade handling
  const wss = new WebSocketServer({ 
    noServer: true,
    perMessageDeflate: false
  });

  // Handle WebSocket upgrade requests
  httpServer.on('upgrade', (request, socket, head) => {
    // Skip Vite HMR connections
    if (request.headers['sec-websocket-protocol']?.includes('vite-hmr')) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // WebSocket connection handling
  wss.on('connection', (ws) => {
    ws.on('error', console.error);
  });

  // File upload endpoint
  app.post('/api/upload', async (req, res) => {
    try {
      if (!req.files || !req.files.file) {
        return res.status(400).send('No file uploaded');
      }

      const file = req.files.file;
      const filePath = (file as fileUpload.UploadedFile).tempFilePath;
      const addresses: string[] = [];

      // Create read stream for the file
      const fileStream = createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let lineCount = 0;
      let processedLines = 0;

      // First count total lines
      for await (const _ of rl) {
        lineCount++;
      }

      // Reset stream for processing
      fileStream.destroy();
      const newFileStream = createReadStream(filePath);
      const newRl = readline.createInterface({
        input: newFileStream,
        crlfDelay: Infinity
      });

      // Process lines and send progress updates
      for await (const line of newRl) {
        const address = line.trim();
        if (address) {
          addresses.push(address);
        }
        processedLines++;

        // Broadcast progress to all clients every 1000 lines or at 100%
        if (processedLines % 1000 === 0 || processedLines === lineCount) {
          wss.clients.forEach(client => {
            if (client.readyState === 1) {
              const update: ProgressUpdate = {
                type: 'upload',
                progress: Math.floor((processedLines / lineCount) * 100),
                total: lineCount,
                completed: processedLines,
                addresses: processedLines === lineCount ? addresses : undefined
              };
              client.send(JSON.stringify(update));
            }
          });
        }
      }

      res.json({ success: true, addresses });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).send('Error processing file');
    }
  });

  return httpServer;
}