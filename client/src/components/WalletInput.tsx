import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface WalletInputProps {
  onSubmit: (addresses: string[]) => void;
  onUploadProgress: (progress: number) => void;
  isProcessing: boolean;
}

export function WalletInput({ onSubmit, onUploadProgress, isProcessing }: WalletInputProps) {
  const [input, setInput] = useState("");
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

    const formData = new FormData();
    formData.append('file', file);

    try {
      onUploadProgress(0);

      // Setup WebSocket connection for progress updates
      const ws = new WebSocket(`ws://${window.location.host}`);

      ws.onmessage = (event) => {
        const update = JSON.parse(event.data);
        if (update.type === 'upload') {
          onUploadProgress(update.progress);
          if (update.progress === 100 && update.addresses) {
            setInput(update.addresses.join('\n'));
            ws.close();
          }
        }
      };

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error('File processing failed');
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your file. Please try again.",
        variant: "destructive"
      });
      onUploadProgress(0);
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
        />
        <div className="flex gap-4">
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !input.trim()}
            className="flex-1"
          >
            Check Balances
          </Button>
          <Button
            variant="outline"
            className="relative"
            disabled={isProcessing}
          >
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}