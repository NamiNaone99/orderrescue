import localFont from "next/font/local";

export const sarabun = localFont({
  src: [
    { path: "./Sarabun-Regular.woff2", weight: "400", style: "normal" },
    { path: "./Sarabun-Medium.woff2", weight: "500", style: "normal" },
    { path: "./Sarabun-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./Sarabun-Bold.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-sans",
  adjustFontFallback: "Arial",
});
