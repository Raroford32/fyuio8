import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useState } from "react";

interface WalletInputProps {
  onSubmit: (addresses: string[]) => void;
  onUploadProgress: (progress: number) => void;
  isProcessing: boolean;
}

export function WalletInput({ onSubmit, onUploadProgress, isProcessing }: WalletInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const addresses = input
      .split(/[\n,]/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
    onSubmit(addresses);
  };

  const processChunk = async (
    file: File,
    start: number,
    chunkSize: number,
    accumulator: string
  ): Promise<string> => {
    const chunk = file.slice(start, start + chunkSize);
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsText(chunk);
    });

    const newAccumulator = accumulator + text;
    const progress = Math.min(100, (start + chunkSize) / file.size * 100);
    onUploadProgress(progress);

    if (start + chunkSize < file.size) {
      return processChunk(file, start + chunkSize, chunkSize, newAccumulator);
    }

    return newAccumulator;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onUploadProgress(0);
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

    try {
      const result = await processChunk(file, 0, CHUNK_SIZE, "");
      setInput(result);
      onUploadProgress(100);
    } catch (error) {
      console.error('Error reading file:', error);
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