import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { RealtimeProvider } from "@/context/RealtimeContext";
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

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0079bf]" data-testid="loading-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white font-heading font-semibold">Memuat ALI Workspace...</p>
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
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <RealtimeProvider>
                  <AppLayout />
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
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
