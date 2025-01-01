import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface WalletInputProps {
  onSubmit: (addresses: string[]) => void;
  onUploadProgress: (progress: number) => void;
  isProcessing: boolean;
}

export function WalletInput({ onSubmit, onUploadProgress, isProcessing }: WalletInputProps) {
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const handleSubmit = () => {
    const addresses = input
      .split(/[\n,]/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
    onSubmit(addresses);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      onUploadProgress(0);

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
          if (update.type === 'upload') {
            onUploadProgress(update.progress);
            if (update.progress === 100 && update.addresses) {
              setInput(update.addresses.join('\n'));
              ws.close();
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

    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "There was an error uploading your file. Please try again.",
        variant: "destructive"
      });
      onUploadProgress(0);
    } finally {
      setIsUploading(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      // Clean up input field
      e.target.value = '';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Enter Ethereum Addresses</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Enter addresses (one per line or comma-separated)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[200px] mb-4"
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
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={isProcessing || isUploading}
            />
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload File'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}