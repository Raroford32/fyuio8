import type { Express } from "express";
import { createServer } from "http";

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);
  return httpServer;
}
