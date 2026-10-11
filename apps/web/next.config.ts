import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rlhf/db", "@rlhf/shared", "@rlhf/ui"],
};

export default nextConfig;