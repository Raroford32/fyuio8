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

interface ResultsTableProps {
  wallets: WalletData[];
}

export function ResultsTable({ wallets }: ResultsTableProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Results</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/2">Address</TableHead>
              <TableHead className="w-1/4 text-right">Balance (ETH)</TableHead>
              <TableHead className="w-1/4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wallets.map((wallet, i) => (
              <TableRow key={i} className={wallet.error ? 'bg-red-50/50 dark:bg-red-950/50' : ''}>
                <TableCell className="font-mono text-sm">{wallet.address}</TableCell>
                <TableCell className="text-right">
                  {wallet.balance ? (
                    <span className={Number(wallet.balance) > 0 ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                      {wallet.balance}
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  {wallet.error ? (
                    <span className="text-red-500 text-sm">{wallet.error}</span>
                  ) : wallet.checked ? (
                    <span className="text-green-500 text-sm">Checked</span>
                  ) : (
                    <span className="text-yellow-500 text-sm">Pending</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}