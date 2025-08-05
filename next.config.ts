import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    allowedDevOrigins: ["127.0.0.1:3000", "localhost:3000"],
  },
};

export default nextConfig;
