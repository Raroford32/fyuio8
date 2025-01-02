import { useState, useEffect } from "react";
import { WalletInput } from "../components/WalletInput";
import { ProgressDisplay } from "../components/ProgressDisplay";
import { ResultsTable } from "../components/ResultsTable";
import { web3Client } from "../lib/web3Client";
import { storage, type WalletData } from "../lib/storage";
import { useToast } from "@/hooks/use-toast";

const BATCH_SIZE = 5; // Process 5 wallets at a time
const RETRY_DELAY = 1000; // 1 second initial delay
const MAX_RETRIES = 3;

export default function WalletChecker() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const savedProgress = storage.loadProgress();
    if (savedProgress) {
      setWallets(savedProgress);
      toast({
        title: "Progress Restored",
        description: "Previous session data has been loaded"
      });
    }
  }, []);

  const processPrivateKey = async (privateKey: string, retries = 0): Promise<WalletData | null> => {
    try {
      const result = await web3Client.processPrivateKey(privateKey);
      if (!result) {
        return {
          address: privateKey, // Store original key for reference
          error: "Invalid private key format",
          checked: true
        };
      }
      return {
        address: result.address,
        balance: result.balance,
        checked: true
      };
    } catch (error) {
      if (retries < MAX_RETRIES) {
        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retries)));
        return processPrivateKey(privateKey, retries + 1);
      }
      return {
        address: privateKey,
        error: "Failed to process private key after multiple attempts",
        checked: true
      };
    }
  };

  const processBatch = async (privateKeys: string[]) => {
    const results = await Promise.all(
      privateKeys.map(key => processPrivateKey(key))
    );

    setWallets(current => {
      // Filter out null results and add new wallets
      const validResults = results.filter((r): r is WalletData => r !== null);
      const updated = [...current, ...validResults];

      // Save progress, focusing on wallets with balance
      const walletsWithBalance = updated.filter(w => w.balance && Number(w.balance) > 0);
      storage.saveProgress(walletsWithBalance);

      return updated;
    });
  };

  const handleSubmit = async (privateKeys: string[]) => {
    // Reset any previous state
    storage.clearProgress();

    setWallets([]);
    setIsProcessing(true);
    setUploadProgress(100); // File processing complete

    try {
      // Process private keys in batches
      for (let i = 0; i < privateKeys.length; i += BATCH_SIZE) {
        const batch = privateKeys.slice(i, i + BATCH_SIZE);
        await processBatch(batch);
      }

      const walletsWithBalance = wallets.filter(w => w.balance && Number(w.balance) > 0);
      const totalBalance = walletsWithBalance
        .reduce((sum, w) => sum + Number(w.balance || 0), 0)
        .toFixed(4);

      toast({
        title: "Processing Complete",
        description: `Found ${walletsWithBalance.length} wallets with balance. Total: ${totalBalance} ETH`
      });
    } catch (error) {
      toast({
        title: "Processing Error",
        description: "Failed to process some private keys",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const completed = wallets.filter(w => w.checked).length;
  const errors = wallets.filter(w => w.error).length;

  // Calculate total progress including both upload and processing
  const processProgress = wallets.length ? (completed / wallets.length) * 100 : 0;
  const totalProgress = isProcessing ? 
    (uploadProgress * 0.2 + processProgress * 0.8) : // Weight upload as 20% of total progress
    uploadProgress;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <WalletInput 
          onSubmit={handleSubmit} 
          onUploadProgress={setUploadProgress}
          isProcessing={isProcessing} 
        />

        {(wallets.length > 0 || uploadProgress > 0) && (
          <>
            <ProgressDisplay
              total={wallets.length || 100}
              completed={completed}
              errors={errors}
            />
            {wallets.length > 0 && <ResultsTable wallets={wallets} />}
          </>
        )}
      </div>
    </div>
  );
}