import { Switch, Route } from "wouter";
import WalletChecker from "./pages/WalletChecker";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={WalletChecker} />
      </Switch>
      <Toaster />
    </>
  );
}

export default App;
