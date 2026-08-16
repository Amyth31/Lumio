"use client";

import { useState, useEffect, useRef } from "react";

const MODES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

// ---- shared tokens (mirrors landing/login/sidebar/dashboard/flashcards/notes/quiz/youtube) ----
const T = {
  bg: "#0c0c0d",
  surface: "#131314",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f1ed",
  textMuted: "#8a8a86",
  red: "#f87171",
};

export function PomodoroTimer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"focus" | "short" | "long" | "custom">("focus");
  const [seconds, setSeconds] = useState(MODES.focus);
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 80 });
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("10");
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  function playAlarm() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current = ctx;
      const playBeep = (startTime: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      };
      playBeep(ctx.currentTime);
      playBeep(ctx.currentTime + 0.5);
      playBeep(ctx.currentTime + 1.0);
    } catch (e) {
      console.warn("Audio not supported", e);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Lumio Timer", { body: "Time's up! Take a break." });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setRunning(false);
            playAlarm();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  function switchMode(m: "focus" | "short" | "long") {
    setMode(m);
    setSeconds(MODES[m]);
    setRunning(false);
    setShowCustomInput(false);
  }

  function applyCustomTime() {
    const mins = Math.max(1, Math.min(180, parseInt(customMinutes) || 10));
    setMode("custom");
    setSeconds(mins * 60);
    setRunning(false);
    setShowCustomInput(false);
  }

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      left: pos.x,
      top: pos.y,
      zIndex: 200,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: "16px",
      padding: "20px",
      width: "220px",
      boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
    }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", cursor: "move" }}
        onMouseDown={(e) => {
          dragging.current = true;
          offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
      >
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", letterSpacing: "0.16em", textTransform: "uppercase", color: T.textMuted }}>
          Timer
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}>×</button>
      </div>

      <div style={{ display: "flex", gap: "5px", marginBottom: "8px" }}>
        {(["focus", "short", "long"] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            style={{
              flex: 1, padding: "6px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: "0.55rem",
              border: `1px solid ${mode === m ? T.text : T.border}`,
              color: mode === m ? T.text : T.textMuted,
              background: mode === m ? "rgba(255,255,255,0.06)" : "transparent",
              cursor: "pointer", borderRadius: "999px", transition: "all 0.2s ease",
            }}
          >
            {m === "focus" ? "25m" : m === "short" ? "5m" : "15m"}
          </button>
        ))}
        <button
          onClick={() => setShowCustomInput((v) => !v)}
          style={{
            flex: 1, padding: "6px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "0.55rem",
            border: `1px solid ${mode === "custom" ? T.text : T.border}`,
            color: mode === "custom" ? T.text : T.textMuted,
            background: mode === "custom" ? "rgba(255,255,255,0.06)" : "transparent",
            cursor: "pointer", borderRadius: "999px", transition: "all 0.2s ease",
          }}
        >
          ⚙
        </button>
      </div>

      {showCustomInput && (
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          <input
            type="number"
            min="1"
            max="180"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="mins"
            style={{
              flex: 1,
              background: T.bg,
              border: `1px solid ${T.border}`,
              color: T.text,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              padding: "6px 10px",
              borderRadius: "8px",
              outline: "none",
            }}
          />
          <button
            onClick={applyCustomTime}
            style={{
              padding: "6px 12px",
              background: T.text,
              border: "none",
              color: T.bg,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.58rem",
              fontWeight: 700,
              cursor: "pointer",
              borderRadius: "999px",
            }}
          >
            SET
          </button>
        </div>
      )}

      <div style={{
        textAlign: "center",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "2.4rem",
        fontWeight: 700,
        color: seconds === 0 ? T.red : T.text,
        margin: "12px 0",
        letterSpacing: "0.04em",
      }}>
        {mins}:{secs}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => setRunning(r => !r)}
          disabled={seconds === 0}
          style={{
            flex: 1, padding: "9px",
            background: seconds === 0 ? T.surface : T.text,
            border: `1px solid ${seconds === 0 ? T.border : "transparent"}`,
            color: seconds === 0 ? T.textMuted : T.bg,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", cursor: seconds === 0 ? "not-allowed" : "pointer",
            borderRadius: "999px",
            transition: "opacity 0.2s ease",
          }}
        >
          {running ? "PAUSE" : "START"}
        </button>
        <button
          onClick={() => {
            const baseSeconds = mode === "custom" ? Math.max(1, Math.min(180, parseInt(customMinutes) || 10)) * 60 : MODES[mode];
            setSeconds(baseSeconds);
            setRunning(false);
          }}
          style={{
            padding: "9px 12px", background: "transparent",
            border: `1px solid ${T.border}`, color: T.textMuted,
            cursor: "pointer", fontSize: "0.8rem", borderRadius: "999px",
          }}
        >
          ↺
        </button>
      </div>
    </div>
  );
}