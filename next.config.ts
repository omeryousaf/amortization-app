import type { NextConfig } from "next";

// Dev-only. The server binds to 0.0.0.0, but Next.js only trusts localhost
// and that bind address. A browser on another LAN node uses this machine's
// private IP as the origin, which otherwise gets a 403 on /_next resources.
const privateLanOrigins = [
  "10.*.*.*",
  "192.168.*.*",
  ...Array.from({ length: 16 }, (_, index) => `172.${16 + index}.*.*`),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: privateLanOrigins,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
