import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import RadarPage from "@/pages/radar";
import Dossiers from "@/pages/dossiers";
import DossierDetail from "@/pages/dossier";
import ReviewQueuePage from "@/pages/review-queue";
import BattleCardsPage from "@/pages/battle-cards";
import SignalsPage from "@/pages/signals";
import Login from "@/pages/login";

const queryClient = new QueryClient();

function Protected() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/radar" component={RadarPage} />
        <Route path="/dossiers" component={Dossiers} />
        <Route path="/dossiers/:id" component={DossierDetail} />
        <Route path="/review-queue" component={ReviewQueuePage} />
        <Route path="/battle-cards" component={BattleCardsPage} />
        <Route path="/battle-cards/:orgId" component={BattleCardsPage} />
        <Route path="/signals" component={SignalsPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route component={Protected} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
