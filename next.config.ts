import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sembunyikan indikator dev Next.js (badge "N Issues" pojok layar). Hanya
  // relevan saat `next dev`; pada production build memang tidak pernah muncul.
  devIndicators: false,

  // pdf-parse (ekstraksi teks PDF untuk Asisten AI mode Groq) memuat pdfjs-dist
  // + binding native @napi-rs/canvas — jangan di-bundle, pakai require Node biasa.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],

  // Image Docker produksi mem-build dengan NEXT_OUTPUT_STANDALONE=true supaya
  // Next menghasilkan .next/standalone — hanya file yang benar-benar dipakai,
  // jadi runner tidak perlu membawa seluruh node_modules. Dijaga env agar
  // `yarn build` di mesin lokal tetap berperilaku persis seperti sebelumnya.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true"
    ? { output: "standalone" as const }
    : {}),
};

export default nextConfig;
