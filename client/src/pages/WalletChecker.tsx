import { useState, useEffect } from "react";
import { WalletInput } from "../components/WalletInput";
import { ProgressDisplay } from "../components/ProgressDisplay";
import { ResultsTable } from "../components/ResultsTable";
import { web3Client } from "../lib/web3Client";
import { storage, type WalletData } from "../lib/storage";
import { useToast } from "@/hooks/use-toast";

const BATCH_SIZE = 5;
const RETRY_DELAY = 1000;
const MAX_RETRIES = 3;

export default function WalletChecker() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const processWallet = async (wallet: WalletData, retries = 0): Promise<WalletData> => {
    try {
      const balance = await web3Client.getBalance(wallet.address);
      return { ...wallet, balance, checked: true };
    } catch (error) {
      if (retries < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retries)));
        return processWallet(wallet, retries + 1);
      }
      return { 
        ...wallet, 
        error: "Failed to fetch balance", 
        checked: true 
      };
    }
  };

  const processBatch = async (batch: WalletData[]) => {
    const results = await Promise.all(batch.map(wallet => processWallet(wallet)));
    setWallets(current => {
      const updated = [...current];
      results.forEach(result => {
        const index = updated.findIndex(w => w.address === result.address);
        if (index !== -1) {
          updated[index] = result;
        }
      });
      storage.saveProgress(updated);
      return updated;
    });
  };

  const handleSubmit = async (addresses: string[]) => {
    const validWallets = addresses.map(address => ({
      address,
      checked: false
    }));

    setWallets(validWallets);
    setIsProcessing(true);

    for (let i = 0; i < validWallets.length; i += BATCH_SIZE) {
      const batch = validWallets.slice(i, i + BATCH_SIZE);
      await processBatch(batch);
    }

    setIsProcessing(false);
    toast({
      title: "Processing Complete",
      description: "All wallet balances have been checked"
    });
  };

  const completed = wallets.filter(w => w.checked).length;
  const errors = wallets.filter(w => w.error).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <WalletInput onSubmit={handleSubmit} isProcessing={isProcessing} />
        
        {wallets.length > 0 && (
          <>
            <ProgressDisplay
              total={wallets.length}
              completed={completed}
              errors={errors}
            />
            <ResultsTable wallets={wallets} />
          </>
        )}
      </div>
    </div>
  );
}
