"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      document.documentElement.classList.add("light");
      setIsLight(true);
    }
  }, []);

  function toggle() {
    if (isLight) {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
      setIsLight(false);
    } else {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
      setIsLight(true);
    }
  }

  return (
    <button
      onClick={toggle}
      title={isLight ? "Switch to dark" : "Switch to light"}
      style={{
        width: "40px",
        height: "22px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "11px",
        cursor: "pointer",
        position: "relative",
        transition: "all 0.3s",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute",
        width: "14px",
        height: "14px",
        background: "var(--accent)",
        borderRadius: "50%",
        top: "3px",
        left: "3px",
        transition: "transform 0.3s",
        transform: isLight ? "translateX(18px)" : "translateX(0)",
        display: "block",
      }} />
    </button>
  );
}