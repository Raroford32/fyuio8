import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useState } from "react";

interface WalletInputProps {
  onSubmit: (addresses: string[]) => void;
  isProcessing: boolean;
}

export function WalletInput({ onSubmit, isProcessing }: WalletInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const addresses = input
      .split(/[\n,]/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
    onSubmit(addresses);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInput(text);
    };
    reader.readAsText(file);
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
