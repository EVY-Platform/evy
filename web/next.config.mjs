/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// output: "standalone",

	experimental: {
		reactCompiler: { compilationMode: "all" },
	},
};

export default nextConfig;
