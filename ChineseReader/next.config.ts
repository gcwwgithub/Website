import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const githubPagesPath = "/Website/ChineseReader/out";

const createConfig = (phase: string): NextConfig => ({
  ...(phase === PHASE_DEVELOPMENT_SERVER ? {} : {
    basePath: githubPagesPath,
    assetPrefix: githubPagesPath,
  }),
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
});

export default createConfig;
