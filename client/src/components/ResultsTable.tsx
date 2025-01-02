import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletData } from "../lib/storage";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

interface ResultsTableProps {
  wallets: WalletData[];
}

export function ResultsTable({ wallets }: ResultsTableProps) {
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle>Wallet Balances</CardTitle>
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
              {wallets.map((wallet, i) => (
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