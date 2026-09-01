import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Kanban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../lib/api";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  if (user) return null;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Selamat datang kembali!");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      <div className="hidden lg:flex flex-col justify-between w-[46%] bg-[#026aa7] p-12 text-white relative overflow-hidden">
        <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-[#0079bf] opacity-60" />
        <div className="absolute right-24 top-24 w-40 h-40 rounded-full bg-[#4BBF6B] opacity-20" />
        <div className="absolute right-40 bottom-40 w-24 h-24 rounded-lg bg-[#F5CD47] opacity-20 rotate-12" />
        <div className="flex items-center gap-3 relative z-10">
          <Kanban size={28} />
          <span className="font-heading font-bold text-2xl tracking-tight">ALI Workspace</span>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="font-heading text-4xl font-bold leading-tight">
            Kelola seluruh pekerjaan legalitas dalam satu papan.
          </h1>
          <p className="text-white/80 text-base leading-relaxed max-w-md">
            Board, list, kartu, checklist, lampiran, dan kolaborasi real-time untuk tim CS, Admin Draf, Pajak, Perizinan, dan Desain.
          </p>
          <div className="flex gap-3">
            {["#4BBF6B", "#F5CD47", "#E56910", "#9F8FEF"].map((c) => (
              <span key={c} className="w-10 h-2 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <p className="text-white/50 text-xs relative z-10">Sistem manajemen kerja internal ALI</p>
      </div>

      <div className="flex-1 flex items-center justify-center bg-[#F4F5F7] p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 stagger-item" data-testid="login-card">
          <div className="flex items-center gap-2 mb-2 lg:hidden">
            <Kanban size={22} className="text-[#026aa7]" />
            <span className="font-heading font-bold text-xl text-[#172B4D]">ALI Workspace</span>
          </div>
          <h2 className="font-heading text-xl font-bold text-[#172B4D]">Masuk ke akun Anda</h2>
          <p className="text-sm text-[#44546F] mt-1 mb-6">Gunakan email dan kata sandi yang diberikan admin.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#44546F] uppercase tracking-wide">Email</label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@ali.id"
                className="mt-1 w-full h-10 px-3 rounded-lg border border-[#DFE1E6] bg-white text-sm text-[#172B4D] outline-none focus:ring-2 focus:ring-[#0C66E4] focus:border-transparent transition-shadow"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#44546F] uppercase tracking-wide">Kata Sandi</label>
              <input
                data-testid="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full h-10 px-3 rounded-lg border border-[#DFE1E6] bg-white text-sm text-[#172B4D] outline-none focus:ring-2 focus:ring-[#0C66E4] focus:border-transparent transition-shadow"
              />
            </div>
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white font-semibold text-sm transition-colors active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Masuk
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
