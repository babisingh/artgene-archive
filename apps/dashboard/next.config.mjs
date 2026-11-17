/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },
  async redirects() {
    // Canonical host is the bare domain; send www visitors there, keeping the path.
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.artgene-archive.org" }],
        destination: "https://artgene-archive.org/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
