import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  ),
  title: "Git City - Your GitHub as a 3D City",
  description:
    "Explore GitHub users as buildings in a 3D pixel art city. Fly through the city and discover developers.",
  openGraph: {
    title: "Git City - Your GitHub as a 3D City",
    description:
      "Explore GitHub users as buildings in a 3D pixel art city. Fly through the city and discover developers.",
    siteName: "Git City",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@samuelrizzondev",
    site: "@samuelrizzondev",
  },
  authors: [{ name: "Samuel Rizzon", url: "https://x.com/samuelrizzondev" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Silkscreen&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg font-pixel text-warm">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
