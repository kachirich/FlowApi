import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-300 px-6 py-12 md:py-20 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
        
        <article className="prose prose-invert prose-emerald max-w-none prose-headings:text-slate-100 prose-a:text-emerald-400 hover:prose-a:text-emerald-300">
          <h1>Privacy Policy</h1>
          <p className="lead text-slate-400">Last updated: May 25, 2026</p>

          <h2>Data Collection</h2>
          <p>
            We collect basic authentication data (email, name) and technical routing metadata (IP addresses, user agents) 
            necessary for service delivery and fraud prevention.
          </p>

          <h2>Data Retention</h2>
          <p>
            Webhook payloads and routing logs are maintained temporarily based on your active tier (7 days for Free/Basic, 
            30 days for Pro, indefinite for Plus). You may request total erasure via your dashboard at any time.
          </p>

          <h2>Third-Party Sharing</h2>
          <p>
            We do not sell data. Data is only shared with subprocessors (e.g., Stripe, AWS) strictly for the purpose 
            of operating the FlowAPI infrastructure.
          </p>
        </article>
      </div>
    </div>
  );
}
