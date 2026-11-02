"use client";

// Tombol ganti tema terang/gelap (tersimpan di localStorage)

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Ganti tema"
      title={dark ? "Mode terang" : "Mode gelap"}
      className="rounded-lg border border-border px-2.5 py-1.5 text-sm transition-colors hover:bg-accent-soft"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
