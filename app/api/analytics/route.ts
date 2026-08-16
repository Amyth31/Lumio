import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Total docs
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, status, created_at, page_count")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Total chat sessions
  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Total messages
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at, session_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, pdf_count, chat_count, created_at")
    .eq("id", user.id)
    .single();

  const totalDocs = docs?.length ?? 0;
  const readyDocs = docs?.filter((d) => d.status === "ready").length ?? 0;
  const totalSessions = sessions?.length ?? 0;
  const totalMessages = messages?.filter((m) => m.role === "user").length ?? 0;

  // Messages per day (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  const messagesPerDay = last7Days.map((date) => ({
    date,
    count: messages?.filter((m) =>
      m.role === "user" && m.created_at.startsWith(date)
    ).length ?? 0,
  }));

  // Study streak (consecutive days with messages)
  const activeDays = new Set(
    messages
      ?.filter((m) => m.role === "user")
      .map((m) => m.created_at.split("T")[0])
  );

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (activeDays.has(dateStr)) streak++;
    else if (i > 0) break;
  }

  // Most discussed topics (from session titles)
  const topSessions = (sessions ?? [])
    .slice(0, 5)
    .map((s) => s.title)
    .filter((t) => t !== "New Chat");

  return NextResponse.json({
    totalDocs,
    readyDocs,
    totalSessions,
    totalMessages,
    messagesPerDay,
    streak,
    topSessions,
    plan: profile?.plan ?? "free",
    memberSince: profile?.created_at,
    recentDocs: (docs ?? []).slice(0, 4),
  });
}