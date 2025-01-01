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

  // File upload middleware with detailed error handling
  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    abortOnLimit: false,
    debug: true, // Enable debug mode for detailed logging
  }));

  // Create WebSocket server with custom upgrade handling
  const wss = new WebSocketServer({ 
    noServer: true,
    perMessageDeflate: false
  });

  // Handle WebSocket upgrade requests
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      // Skip Vite HMR connections
      if (request.headers['sec-websocket-protocol']?.includes('vite-hmr')) {
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
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
        const address = line.trim();
        if (address) {
          addresses.push(address);
        }
        processedLines++;

        // Broadcast progress to all clients every 1000 lines or at 100%
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
      res.json({ success: true, addresses });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Error processing file', details: error.message });
    }
  });

  return httpServer;
}