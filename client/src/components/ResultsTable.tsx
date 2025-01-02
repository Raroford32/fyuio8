import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WalletData } from "../lib/storage";
import { AlertCircle, CheckCircle, Clock, Download } from "lucide-react";

interface ResultsTableProps {
  wallets: WalletData[];
}

export function ResultsTable({ wallets }: ResultsTableProps) {
  // Sort wallets by balance in descending order
  const sortedWallets = [...wallets].sort((a, b) => {
    // Handle cases where balance might be undefined or error cases
    const balanceA = a.balance ? Number(a.balance) : -1;
    const balanceB = b.balance ? Number(b.balance) : -1;
    return balanceB - balanceA;
  });

  const handleExport = () => {
    // Filter wallets with balance
    const walletsWithBalance = sortedWallets.filter(w => w.balance && Number(w.balance) > 0);

    // Create CSV content
    const csvContent = [
      'Address,Balance (ETH)', // CSV header
      ...walletsWithBalance.map(wallet => 
        `${wallet.address},${wallet.balance}`
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `ethereum-wallets-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Wallet Balances</CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleExport}
          disabled={!sortedWallets.some(w => w.balance && Number(w.balance) > 0)}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-1/2">Wallet Address</TableHead>
                <TableHead className="w-1/4 text-right">Balance (ETH)</TableHead>
                <TableHead className="w-1/4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedWallets.map((wallet) => (
                <TableRow 
                  key={wallet.address} 
                  className={wallet.error ? 'bg-red-50/50 dark:bg-red-950/50' : ''}
                >
                  <TableCell className="font-mono text-sm break-all">
                    {wallet.address}
                  </TableCell>
                  <TableCell className="text-right">
                    {wallet.balance ? (
                      <span className={
                        Number(wallet.balance) > 0 
                          ? 'text-green-600 dark:text-green-400 font-medium' 
                          : ''
                      }>
                        {wallet.balance}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {wallet.error ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="text-red-500 text-sm">{wallet.error}</span>
                        </>
                      ) : wallet.checked ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-green-500 text-sm">Checked</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 text-yellow-500" />
                          <span className="text-yellow-500 text-sm">Pending</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}