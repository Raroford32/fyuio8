import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, AlertTriangle } from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { storage, WalletData } from "../lib/storage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface WalletInputProps {
  onSubmit: (addresses: string[]) => void;
  onUploadProgress: (progress: number) => void;
  isProcessing: boolean;
}

export function WalletInput({ onSubmit, onUploadProgress, isProcessing }: WalletInputProps) {
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const walletsWithBalance = useRef<WalletData[]>([]);

  const handleSubmit = () => {
    const addresses = input
      .split(/[\n,]/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);

    if (addresses.length === 0) {
      toast({
        title: "No Addresses Found",
        description: "Please enter at least one valid address",
        variant: "destructive"
      });
      return;
    }

    onSubmit(addresses);
  };

  const processFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      onUploadProgress(0);
      walletsWithBalance.current = [];

      // Close existing WebSocket connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Setup WebSocket connection for progress updates
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}`);
      wsRef.current = ws;

      let wsConnected = false;
      const wsTimeout = setTimeout(() => {
        if (!wsConnected) {
          ws.close();
          throw new Error('WebSocket connection timeout');
        }
      }, 5000);

      ws.onopen = () => {
        console.log('WebSocket connection established');
        wsConnected = true;
        clearTimeout(wsTimeout);
      };

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (update.type === 'wallet-update') {
            onUploadProgress(update.progress);

            // Process wallets with balance
            if (update.wallets && update.wallets.length > 0) {
              const newWallets = update.wallets.map(w => ({
                address: w.address,
                balance: w.balance,
                checked: true
              }));

              walletsWithBalance.current = [
                ...walletsWithBalance.current,
                ...newWallets
              ];

              // Update storage with new wallets
              storage.saveProgress(walletsWithBalance.current);

              // Update textarea with all addresses that have balance
              setInput(walletsWithBalance.current.map(w => w.address).join('\n'));
            }

            if (update.progress === 100) {
              ws.close();
              const totalBalance = walletsWithBalance.current.reduce(
                (sum, w) => sum + Number(w.balance), 
                0
              ).toFixed(4);

              toast({
                title: "Processing Complete",
                description: `Found ${walletsWithBalance.current.length} wallets with balance. Total: ${totalBalance} ETH`,
              });
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Lost connection to the server. Please try again.",
          variant: "destructive"
        });
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        wsRef.current = null;
      };

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error('File processing failed');
      }

      if (result.stats) {
        toast({
          title: "Processing Stats",
          description: `Processed ${result.stats.total} entries: ${result.stats.valid} valid, ${result.stats.invalid} invalid`,
        });
      }

    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "There was an error uploading your file. Please try again.",
        variant: "destructive"
      });
      onUploadProgress(0);
      setInput("");
      walletsWithBalance.current = [];
      storage.clearProgress();
    } finally {
      setIsUploading(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size === 0) {
      toast({
        title: "Invalid File",
        description: "The selected file is empty.",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    setShowSecurityWarning(true);
    e.target.value = ''; // Reset input
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Enter Ethereum Private Keys</span>
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Found wallets with balance will be automatically saved and displayed. Private keys are only used to derive addresses and are never stored.
            </p>
          </div>
          <Textarea
            placeholder="Enter private keys (one per line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[200px] mb-4 font-mono"
            disabled={isUploading}
          />
          <div className="flex gap-4">
            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !input.trim() || isUploading}
              className="flex-1"
            >
              Check Balances
            </Button>
            <Button
              variant="outline"
              className="relative"
              disabled={isProcessing || isUploading}
            >
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isProcessing || isUploading}
              />
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showSecurityWarning} onOpenChange={setShowSecurityWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Security Warning</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">
                This file contains private keys. Please be aware:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Private keys are only used to derive addresses</li>
                <li>Keys are processed securely in memory</li>
                <li>Only addresses with balance will be saved</li>
                <li>All temporary data is immediately destroyed</li>
              </ul>
              <p className="mt-2 font-medium">
                Do you want to continue with the file upload?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedFile(null);
              setShowSecurityWarning(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (selectedFile) {
                processFile(selectedFile);
              }
              setSelectedFile(null);
              setShowSecurityWarning(false);
            }}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}