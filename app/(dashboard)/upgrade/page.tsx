import { createClient } from "@/lib/supabase/server";

export default async function UpgradePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user!.id)
    .single();

  const isPremium = profile?.plan === "premium";

  return (
    <div className="p-8 max-w-2xl">
      <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Plans</p>
      <h1 className="text-3xl font-bold text-white mb-8">Upgrade to Premium</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border border-neutral-800 p-6 space-y-4">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest">Current</p>
            <h2 className="text-xl font-bold text-white mt-1">Free</h2>
            <p className="text-3xl font-bold text-white mt-2">
              ₹0<span className="text-sm font-normal text-neutral-400">/mo</span>
            </p>
          </div>
          <ul className="space-y-2 text-sm text-neutral-400">
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 4 PDFs per day</li>
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 20 AI chats per day</li>
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Summaries, Flashcards, Quiz</li>
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Pomodoro timer</li>
            <li className="flex items-center gap-2"><span className="text-neutral-600">✗</span> 10MB max file size</li>
          </ul>
          <div className="border border-neutral-700 px-4 py-2 text-center text-sm text-neutral-500">
            Current Plan
          </div>
        </div>

        <div className="border border-cyan-500/50 p-6 space-y-4 relative">
          <div className="absolute top-3 right-3">
            <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 uppercase tracking-widest">
              Popular
            </span>
          </div>
          <div>
            <p className="text-xs text-cyan-400 uppercase tracking-widest">Upgrade</p>
            <h2 className="text-xl font-bold text-white mt-1">Premium</h2>
            <p className="text-3xl font-bold text-white mt-2">
              ₹199<span className="text-sm font-normal text-neutral-400">/mo</span>
            </p>
          </div>
          <ul className="space-y-2 text-sm text-neutral-400">
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Unlimited PDFs</li>
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Unlimited AI chats</li>
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Summaries, Flashcards, Quiz</li>
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Pomodoro timer</li>
            <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 50MB max file size</li>
          </ul>

          {isPremium ? (
            <div className="bg-cyan-500/10 border border-cyan-500/30 px-4 py-2 text-center text-sm text-cyan-400">
              Active Plan
            </div>
          ) : (
            <a
              href="https://razorpay.me"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-cyan-500 hover:bg-cyan-600 text-black text-sm font-bold text-center px-4 py-2 transition-colors uppercase tracking-widest"
            >
              Pay with Razorpay
            </a>
          )}
        </div>
      </div>

      <div className="mt-8 border border-neutral-800 p-4">
        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">Payment Methods</p>
        <p className="text-sm text-neutral-400">
          We accept UPI, Debit/Credit Cards, Net Banking via Razorpay. After payment, contact us at{" "}
          <span className="text-cyan-400">support@lumio.app</span> with your transaction ID to activate premium.
        </p>
        <p className="text-xs text-neutral-600 mt-2">
          Automated billing coming soon. Currently manual activation within 24 hours.
        </p>
      </div>
    </div>
  );
}