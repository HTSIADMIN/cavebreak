import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: the parent folder has its own lockfile, so Next would
  // otherwise infer the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
