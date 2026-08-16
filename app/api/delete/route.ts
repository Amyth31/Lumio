import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId, storagePath } = await request.json();

  // verify ownership
  const { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // delete from storage
  await supabase.storage.from("pdfs").remove([storagePath]);

  // delete from DB (cascades to chunks, summaries, flashcards, quizzes, messages)
  await supabase.from("documents").delete().eq("id", documentId);

  // decrement pdf count
  await supabase.rpc("decrement_pdf_count", { user_id: user.id });

  return NextResponse.json({ success: true });
}