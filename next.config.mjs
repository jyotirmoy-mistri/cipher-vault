import withPWAInit from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true, // নতুন আপডেট এলে পুরনো ক্যাশ জোর করে সরিয়ে দেবে
  clientsClaim: true,
  cleanupOutdatedCaches: true, // পুরনো ফালতু ক্যাশ অটো ডিলিট করবে
});

export default withPWA(nextConfig);
