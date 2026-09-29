import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // chokidar is a real runtime dep (vault watcher); keep it out of the bundle.
  serverExternalPackages: ["chokidar"],
  devIndicators: false,
  poweredByHeader: false,
  // App locale (localhost uniquement) — pas de headers de sécurité publics nécessaires,
  // mais on garde noindex par hygiène si jamais exposée.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
