import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ACCEPTED_MIME_TYPES } from "@/lib/pdf/extract-router";

const FREE_DOC_LIMIT = 4;
const PREMIUM_DOC_LIMIT = 10;
const FREE_MAX_SIZE = 10 * 1024 * 1024;
const PREMIUM_MAX_SIZE = 50 * 1024 * 1024;
const FREE_BATCH_LIMIT = 4;
const PREMIUM_BATCH_LIMIT = 10;

function istDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Reset daily usage if it's a new day (IST)
  await supabase.rpc("reset_daily_usage", { p_user_id: user.id });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, pdf_count, usage_date")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "free";
  const pdfCount = profile?.pdf_count ?? 0;
  const maxSize = plan === "premium" ? PREMIUM_MAX_SIZE : FREE_MAX_SIZE;
  const batchLimit = plan === "premium" ? PREMIUM_BATCH_LIMIT : FREE_BATCH_LIMIT;
  const dailyLimit = plan === "premium" ? PREMIUM_DOC_LIMIT : FREE_DOC_LIMIT;

  if (files.length > batchLimit) {
    return NextResponse.json(
      { error: `You can upload max ${batchLimit} files at once on your plan.` },
      { status: 400 }
    );
  }

  if (pdfCount + files.length > dailyLimit) {
    return NextResponse.json(
      { error: `Daily limit: ${dailyLimit} documents/day. You have ${dailyLimit - pdfCount} remaining today.` },
      { status: 403 }
    );
  }

  const results: { documentId: string; fileName: string }[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      errors.push(`${file.name}: unsupported file type`);
      continue;
    }

    if (file.size > maxSize) {
      errors.push(`${file.name}: too large (max ${maxSize / (1024 * 1024)}MB)`);
      continue;
    }

    const fileExt = file.name.split(".").pop() || "pdf";
    const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("pdfs")
      .upload(fileName, fileBuffer, { contentType: file.type });

    if (uploadError) {
      errors.push(`${file.name}: storage upload failed`);
      continue;
    }

    const { data: document, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        title: file.name.replace(/\.(pdf|docx|pptx)$/i, ""),
        storage_path: fileName,
        status: "processing",
        file_type: file.type,
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error(`DB INSERT ERROR for ${file.name}:`, dbError);
      errors.push(`${file.name}: ${dbError?.message || "database error"}`);
      continue;
    }

    results.push({ documentId: document.id, fileName: file.name });
  }

  if (results.length > 0) {
    await supabase
      .from("profiles")
      .update({
        pdf_count: pdfCount + results.length,
        usage_date: istDateString(), // IST date set karo har upload pe
      })
      .eq("id", user.id);
  }

  return NextResponse.json({ results, errors, success: results.length > 0 });
}