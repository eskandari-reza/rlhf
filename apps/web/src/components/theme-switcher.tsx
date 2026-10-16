"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { id: "aurora", label: "Aurora" },
  { id: "nebula", label: "Nebula" },
  { id: "light", label: "Light" },
] as const;

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "light");
  }, []);

  function choose(id: string) {
    document.documentElement.dataset.theme = id;
    try {
      localStorage.setItem("theme", id);
    } catch {}
    setTheme(id);
  }

  return (
    <div
      dir="ltr"
      className="fixed bottom-4 right-4 z-50 flex gap-1 rounded-full border border-border bg-card p-1 shadow-md"
    >
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => choose(t.id)}
          className={
            "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
            (theme === t.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}