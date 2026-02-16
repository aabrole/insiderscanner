/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => [
    { source: "/predictions", destination: "/api/predictions" },
    { source: "/predictions.html", destination: "/api/predictions" },
    { source: "/", destination: "/api/predictions" },
  ],
};

module.exports = nextConfig;
