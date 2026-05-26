import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
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
          <h1>Terms of Service</h1>
          <p className="lead text-slate-400">Last updated: May 25, 2026</p>

          <h2>Data Conduit Liability</h2>
          <p>
            FlowAPI functions strictly as a data routing conduit. We do not inspect, modify, or assume liability for the 
            contents of the payloads transmitted through our infrastructure.
          </p>

          <h2>Prohibited Data</h2>
          <p>
            Users are strictly prohibited from transmitting highly sensitive personal data (e.g., SSN, PHI, PCI-DSS) 
            unless explicitly authorized under an Enterprise agreement.
          </p>

          <h2>SLA Definitions</h2>
          <p>
            We guarantee 99.9% uptime for Pro and Plus tiers. Outages exceeding this threshold will be compensated 
            with prorated platform credits upon written request.
          </p>
        </article>
      </div>
    </div>
  );
}
