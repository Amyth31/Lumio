"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { PomodoroTimer } from "@/components/timer/pomodoro";

const T = {
  bg: "#0c0c0d",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f1ed",
  textMuted: "#8a8a86",
};

const COLLAPSE_KEY = "lumio-sidebar-collapsed";
const MOBILE_BREAKPOINT = 768;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [timerVisible, setTimerVisible] = useState(false);
  const [time, setTime] = useState("");
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    const savedCollapsed = localStorage.getItem(COLLAPSE_KEY);
    if (savedCollapsed) setCollapsed(savedCollapsed === "true");

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);

    function updateClock() {
      const now = new Date();
      setTime(
        [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map((n) => String(n).padStart(2, "0"))
          .join(":")
      );
    }
    updateClock();
    const id = setInterval(updateClock, 1000);

    return () => {
      mql.removeEventListener("change", onChange);
      clearInterval(id);
    };
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  }

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: T.bg,
      color: T.text,
      overflow: "hidden",
    }}>
      <Sidebar
        onTimerClick={() => setTimerVisible((v) => !v)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        isMobile={isMobile}
      />

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        minWidth: 0,
      }}>
        {/* Top bar */}
        <div style={{
          height: "44px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px 0 12px",
          gap: "16px",
          flexShrink: 0,
          background: T.bg,
        }}>
          {isMobile ? (
            <button
              onClick={() => setMobileOpen(true)}
              style={{
                width: "34px", height: "34px", borderRadius: "8px",
                background: "transparent", border: "none", color: T.text,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : <span />}

          {mounted && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.58rem",
              color: T.textMuted,
              letterSpacing: "0.08em",
            }}>
              {time}
            </span>
          )}
        </div>

        <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {children}
        </main>
      </div>

      <PomodoroTimer visible={timerVisible} onClose={() => setTimerVisible(false)} />
    </div>
  );
}