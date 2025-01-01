import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProgressDisplayProps {
  total: number;
  completed: number;
  errors: number;
}

export function ProgressDisplay({ total, completed, errors }: ProgressDisplayProps) {
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={progress} className="mb-4" />
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{total}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold text-green-500">{completed}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Errors</div>
            <div className="text-2xl font-bold text-red-500">{errors}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
