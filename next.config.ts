import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg and pglite use Node-only features, keep them out of the bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
};

export default nextConfig;
