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
          <p className="lead text-slate-400">Last updated: May 28, 2026</p>

          <h2>1. Information We Collect</h2>
          <p>
            FlowAPI collects data necessary to operate our secure webhook routing and API management engine. This includes:
          </p>
          <ul>
            <li><strong>Account Credentials:</strong> Email addresses and basic contact information provided during registration or Google OAuth login.</li>
            <li><strong>Routing Metadata:</strong> Technical parameters including IP addresses, delivery speeds, payload sizes, HTTP methods, and status codes of destinations.</li>
            <li><strong>Payload Inspection:</strong> Temporary transit storage of JSON request bodies required to perform filtering, rate-limiting, and delivery checks.</li>
          </ul>

          <h2>2. Data Compliance (GDPR, CCPA & TCPA)</h2>
          <p>
            As a data processor, FlowAPI routes payloads at the direction of our users (the data controllers). You are solely responsible 
            for securing appropriate consents from your end leads before passing their data to our servers. We do not sell, rent, 
            or distribute routed payloads to third parties for marketing or any other external purpose.
          </p>

          <h2>3. Permanent Data Deletion Protocol</h2>
          <p>
            We strictly enforce a permanent right-to-be-forgotten policy:
          </p>
          <ul>
            <li><strong>Log Retention:</strong> Request delivery logs and payload histories are retained temporarily for diagnostic purposes based on your subscription tier (7 days for Free/Basic, 30 days for Pro, and customizable for Enterprise).</li>
            <li><strong>Account Erasure:</strong> Upon initiating account deletion in the Control Panel, all records associated with your account—including active API keys, webhook destinations, and historical routing logs—are permanently and irreversibly destroyed from our active database systems. Backup storage purges automatically within 30 days.</li>
          </ul>

          <h2>4. Third-Party Subprocessors</h2>
          <p>
            We share metadata only with cloud services and payment vendors (e.g., Stripe, Redis Labs, AWS, and Resend) strictly to provide and secure our service infrastructure.
          </p>
        </article>
      </div>
    </div>
  );
}
