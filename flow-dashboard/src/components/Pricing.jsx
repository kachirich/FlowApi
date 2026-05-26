import { Check, Zap, CalendarCheck, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const SUPPORT_EMAIL = "support.flowapi@gmail.com";

const planRank = { free: 0, basic: 1, pro: 2, plus: 3 };

export default function Pricing({ setActiveTab }) {
  const { user } = useAuth() || {};
  const planType = user?.plan_type || "free";
  const userEmail = user?.email || "";

  const tiers = [
    {
      id: "basic",
      name: "Basic",
      price: "$29",
      description: "Perfect for individuals and small projects.",
      features: ["Up to 1,000 requests/mo", "Community Support", "Basic Analytics", "7-day log retention"],
      buttonText: "Request Early Access",
      action: () => setActiveTab("consulting"),
      icon: CalendarCheck,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$99",
      description: "For professional developers and growing teams.",
      features: ["Up to 50,000 requests/mo", "Priority Email Support", "Advanced Analytics", "30-day log retention", "Custom Webhooks"],
      buttonText: "Request Early Access",
      action: () => setActiveTab("consulting"),
      icon: CalendarCheck,
      popular: true,
    },
    {
      id: "plus",
      name: "Enterprise Plus",
      price: "$249",
      description: "Custom architecture and dedicated infrastructure.",
      features: ["Unlimited requests", "24/7 Phone Support", "Custom Integrations", "Unlimited log retention", "Dedicated Account Manager"],
      buttonText: "Book Setup Call",
      action: () => setActiveTab("consulting"),
      icon: CalendarCheck,
    },
  ];

  if (planType === "plus") {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-yellow-400/30 bg-surface-raised text-yellow-400 drop-shadow-xl animate-pulse">
            <Zap className="h-10 w-10" />
          </div>
        </div>
        <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-500 mb-4 tracking-wide">
          ✨ Max Tier Unlocked
        </h2>
        <p className="text-slate-300 text-lg max-w-xl mb-8 leading-relaxed">
          You are currently on our highest tier, <span className="text-yellow-400 font-bold">Enterprise Plus</span>. 
          Your workspace is running on dedicated high-performance infrastructure with unlimited scalability.
        </p>
        <div className="p-6 rounded-2xl border border-slate-800/80 bg-surface-raised/50 max-w-lg mb-8 backdrop-blur-md">
          <p className="text-slate-400 text-sm leading-relaxed">
            Thank you for partnering with us as an <span className="text-yellow-400 font-semibold">Enterprise Architect</span>. 
            We are honored to power your high-volume lead pipelines.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("dashboard")}
          className="px-6 py-3 rounded-xl font-bold bg-white text-black hover:bg-slate-200 transition-all shadow-lg"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const filteredTiers = tiers.filter(tier => planRank[tier.id] > planRank[planType]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-slate-100 mb-4">Transparent Pricing</h2>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Scale your API gateway seamlessly. All paid plans are activated via white-glove onboarding during our Early Access period.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider">
          <Zap className="h-3 w-3" />
          Early Access — Manual Onboarding
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-center items-stretch gap-8">
        {filteredTiers.map((tier) => (
          <div
            key={tier.id}
            className={`w-full md:w-[350px] relative flex flex-col p-8 rounded-2xl border ${
              tier.popular ? "border-emerald-500/50 bg-surface-raised" : "border-slate-800/60 bg-surface"
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  <Zap className="h-3 w-3" /> Most Popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-100 mb-2">{tier.name}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-extrabold text-white">{tier.price}</span>
                <span className="text-slate-400 font-medium">/month</span>
              </div>
              <p className="text-sm text-slate-400">{tier.description}</p>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              {tier.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                  <Check className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <button
                onClick={tier.action}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
                  tier.popular
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                    : "bg-white hover:bg-slate-200 text-black"
                }`}
              >
                <tier.icon className="h-4 w-4" />
                {tier.buttonText}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
