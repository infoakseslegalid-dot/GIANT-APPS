import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sembunyikan indikator dev Next.js (badge "N Issues" pojok layar). Hanya
  // relevan saat `next dev`; pada production build memang tidak pernah muncul.
  devIndicators: false,
};

export default nextConfig;
