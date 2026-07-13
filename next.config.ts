import type { NextConfig } from "next";

// Deliberately not NEXT_PUBLIC_: this stays server-side. The browser always
// talks to this app's own /api/* and Next forwards it here, so the backend
// origin never reaches client code and can differ per environment without a
// rebuild of the client bundle.
const backendOrigin = (
  process.env.BACKEND_ORIGIN ?? "http://localhost:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
