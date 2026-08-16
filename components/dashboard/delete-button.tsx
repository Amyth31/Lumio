"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteButton({
  documentId,
  storagePath,
}: {
  documentId: string;
  storagePath: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 3000);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, storagePath }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch {
      console.error("Delete failed");
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={`shrink-0 p-1 transition-colors ${
        confirm
          ? "text-red-400 hover:text-red-300"
          : "text-neutral-700 hover:text-red-400"
      }`}
      title={confirm ? "Click again to confirm" : "Delete"}
    >
      {deleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}