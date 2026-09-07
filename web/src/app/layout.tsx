import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Campus Guardian | See. Understand. Protect.",
  description:
    "Transform campus surveillance into intelligent safety intelligence. AI Campus Guardian helps institutions detect events, understand situations, assess risk, and respond faster.",
  keywords: [
    "campus safety",
    "AI surveillance",
    "campus security",
    "intelligent monitoring",
    "risk assessment",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "ACG Field",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "AI Campus Guardian",
    description: "From Passive CCTV to Proactive AI-Powered Campus Safety",
    type: "website",
  },
};

const themeBootScript = `
(function(){
  try {
    var key = "acg-theme";
    var t = localStorage.getItem(key);
    if (t !== "day" && t !== "night") {
      t = window.matchMedia("(prefers-color-scheme: light)").matches ? "day" : "night";
    }
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.classList.toggle("dark", t === "night");
    document.documentElement.classList.toggle("light", t === "day");
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "night");
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased theme-transition`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
