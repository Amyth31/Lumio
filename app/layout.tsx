import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumio — AI Study Companion",
  description: "Upload documents. Chat with your notes. Generate flashcards and quizzes instantly.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}