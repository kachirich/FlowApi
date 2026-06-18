import { Check, Zap, CalendarCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Pricing({ setActiveTab }) {
  const { user } = useAuth() || {};
  const planType = user?.tier || user?.plan_type || "sandbox";

  const pricingTiers = [
    {
      name: "Sandbox (Free)",
      price: "$0",
      period: "/month",
      description: "Perfect for testing the pipe.",
      features: [
        "Up to 500 requests/day",
        "1 Active Destination Route",
        "Standard Rate Limiting",
        "No Retry Queue (Instant Fail)"
      ],
      buttonText: "Current Plan",
      isPopular: false,
      targetRoute: null
    },
    {
      name: "Growth",
      price: "$99",
      period: "/month",
      description: "For growing lead brokers.",
      features: [
        "Up to 10,000 requests/day",
        "Up to 5 Destination Routes",
        "Redis Edge Authentication",
        "Standard Retry Queue (3x)"
      ],
      buttonText: "Request Early Access",
      isPopular: true,
      targetRoute: "consulting"
    },
    {
      name: "Enterprise",
      price: "$249",
      period: "/month",
      description: "For high-volume agencies.",
      features: [
        "Up to 100,000 requests/day",
        "Unlimited Destinations",
        "Unbreakable Exponential Backoff",
        "Dedicated High-Throughput Lanes"
      ],
      buttonText: "Book Setup Call",
      isPopular: false,
      targetRoute: "consulting"
    }
  ];

  if (planType === "enterprise") {
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
          You are currently on our highest tier, <span className="text-yellow-400 font-bold">Enterprise</span>. 
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-center items-stretch max-w-5xl mx-auto">
        {pricingTiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col p-8 rounded-2xl border ${
              tier.isPopular ? "border-emerald-500/50 bg-surface-raised" : "border-slate-800/60 bg-surface"
            }`}
          >
            {tier.isPopular && (
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
                <span className="text-slate-400 font-medium">{tier.period}</span>
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
                onClick={() => {
                  if (tier.targetRoute) {
                    setActiveTab(tier.targetRoute);
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
                  tier.isPopular
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
                    : "bg-white hover:bg-slate-200 text-black"
                }`}
              >
                <CalendarCheck className="h-4 w-4" />
                {tier.buttonText}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
