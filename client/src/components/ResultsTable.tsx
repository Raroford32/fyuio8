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
              <TableHead>Address</TableHead>
              <TableHead>Balance (ETH)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wallets.map((wallet, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono">{wallet.address}</TableCell>
                <TableCell>{wallet.balance || '-'}</TableCell>
                <TableCell>
                  {wallet.error ? (
                    <span className="text-red-500">{wallet.error}</span>
                  ) : wallet.checked ? (
                    <span className="text-green-500">Checked</span>
                  ) : (
                    <span className="text-yellow-500">Pending</span>
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
