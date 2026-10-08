import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not advertise the framework in a response header.
  poweredByHeader: false,
  // pg and pglite use Node-only features, keep them out of the bundle.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nobody else may embed the game or the stats page in a frame.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
