import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentIds = [], title = "New Chat" } = await request.json();

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .insert({ user_id: user.id, title })
    .select()
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Link documents to session if any provided
  if (documentIds.length > 0) {
    const rows = documentIds.map((docId: string) => ({
      session_id: session.id,
      document_id: docId,
    }));

    const { error: linkError } = await supabase
      .from("chat_session_documents")
      .insert(rows);

    if (linkError) {
      console.error("Failed to link documents:", linkError);
    }
  }

  return NextResponse.json({ sessionId: session.id });
}