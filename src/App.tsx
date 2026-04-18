import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/store/appStore";
import "@/lib/i18n";

import Index from "./pages/Index.tsx";
import Splash from "./pages/Splash";
import LanguageSelect from "./pages/LanguageSelect";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import AppShell from "./components/AppShell";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Schedule from "./pages/Schedule";
import Legal from "./pages/Legal";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-right" />
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/splash" element={<Splash />} />
            <Route path="/language" element={<LanguageSelect />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/app" element={<AppShell />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="legal" element={<Legal />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
