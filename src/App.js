import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/lib/theme";
import "@/lib/i18n";
import { setLocale } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { RealtimeProvider } from "@/context/RealtimeContext";
import { AiAssistantProvider } from "@/context/AiAssistantContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/views/Login";
import Dashboard from "@/views/Dashboard";
import BoardView from "@/views/BoardView";
import MyWork from "@/views/MyWork";
import AllWork from "@/views/AllWork";
import AdminPanel from "@/views/AdminPanel";
import BankData from "@/views/BankData";
import GlobalHari from "@/views/GlobalHari";
import GlobalSkor from "@/views/GlobalSkor";
import Calendar from "@/views/Calendar";
import Reports from "@/views/Reports";
import AiChat from "@/views/AiChat";
import Archive from "@/views/Archive";

/** Terapkan preferensi tema & bahasa milik user yang login. */
function PrefsSync() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  useEffect(() => {
    if (!user) return;
    if (user.theme) setTheme(user.theme); // 'light' | 'dark' | 'system'
    if (user.locale) setLocale(user.locale);
  }, [user, setTheme]);
  return null;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0079bf]" data-testid="loading-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white font-heading font-semibold">Memuat ALI Workspace…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <AuthProvider>
      <PrefsSync />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <RealtimeProvider>
                  <AiAssistantProvider>
                    <AppLayout />
                  </AiAssistantProvider>
                </RealtimeProvider>
              </Protected>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/board/:boardId" element={<BoardView />} />
            <Route path="/my-work" element={<MyWork />} />
            <Route path="/work" element={<AllWork />} />
            <Route path="/bank-data" element={<BankData />} />
            <Route path="/bank-data/:divisionId" element={<BankData />} />
            <Route path="/global/hari" element={<GlobalHari />} />
            <Route path="/global/skor" element={<GlobalSkor />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/arsip" element={<Archive />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/ai" element={<AiChat />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
