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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [timerVisible, setTimerVisible] = useState(false);
  const [time, setTime] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: T.bg,
      color: T.text,
      overflow: "hidden",
    }}>
      <Sidebar onTimerClick={() => setTimerVisible((v) => !v)} />

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Top bar */}
        <div style={{
          height: "44px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 24px",
          gap: "16px",
          flexShrink: 0,
          background: T.bg,
        }}>
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