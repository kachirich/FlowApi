import React from 'react';

/**
 * Post-checkout celebration modal.
 *
 * Distinct from UpgradeModal.jsx (which is the *feature-gate* paywall prompt).
 * This one fires after a successful Stripe checkout once the plan flip has
 * been confirmed, and chains into the tier-aware tour so the newly-unlocked
 * features get pointed out immediately.
 */
const PLAN_PERKS = {
  basic: ['3-attempt retries', '7-day log retention', 'Round-robin routing'],
  pro: ['Custom headers', 'Broadcast routing', '100-attempt retries', '30-day log retention'],
  plus: ['Everything in Pro', 'Unlimited log retention', 'Enterprise retry tiers', 'Priority support'],
};

export default function CheckoutSuccessModal({ user, onClose, onStartTour }) {
  const perks = PLAN_PERKS[user?.plan_type] || [];
  const raw = user?.last_name || user?.first_name || 'there';
  const display = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-zinc-900 p-8 text-center shadow-2xl">
        <div className="mb-3 text-4xl">⚡</div>
        <h2 className="mb-1 text-2xl font-bold text-white">
          Welcome to {user?.plan_type?.toUpperCase()}, {display}
        </h2>
        <p className="mb-6 text-sm text-zinc-400">Your new features are live right now.</p>
        <ul className="mb-8 space-y-2 text-left">
          {perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-zinc-200">
              <span className="text-amber-400">✓</span> {p}
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button
            onClick={() => {
              onClose();
              onStartTour();
            }}
            className="flex-1 rounded-lg bg-amber-500 py-2.5 font-semibold text-black transition-colors hover:bg-amber-400"
          >
            Show me around →
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-zinc-300 transition-colors hover:text-white"
          >
            I'll explore myself
          </button>
        </div>
      </div>
    </div>
  );
}
