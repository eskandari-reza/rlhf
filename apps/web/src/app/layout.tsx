import type { Metadata } from "next";
import "./globals.css";
import ThemeSwitcher from "@/components/theme-switcher";

export const metadata: Metadata = {
  title: "RLHF",
  description: "RLHF monorepo web application",
};

// قبل از نمایش صفحه تم ذخیره‌شده را اعمال می‌کند تا رنگ نپرد
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="aurora"||t==="nebula"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <ThemeSwitcher />
      </body>
    </html>
  );
}