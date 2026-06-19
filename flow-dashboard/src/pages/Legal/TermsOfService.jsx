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
          <p className="lead text-slate-400">Last updated: May 28, 2026</p>

          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using FlowAPI ("the Service", "we", "us", "our"), a real-time lead routing and webhook management platform, 
            you agree to be bound by these Terms of Service. If you are entering into these terms on behalf of a company or other legal entity, 
            you represent that you have the authority to bind such entity.
          </p>

          <h2>2. Acceptable Use & Data Ownership</h2>
          <p>
            <strong>Data Ownership:</strong> You retain all rights, title, and ownership of any lead payloads, data structures, or other information 
            routed through our Service. FlowAPI claims no ownership over your intellectual property or transactional data.
          </p>
          <p>
            <strong>Prohibited Payload Activities:</strong> You are strictly forbidden from routing, transmitting, or processing payloads that:
          </p>
          <ul>
            <li>Are illegal, fraudulent, or designed to commit malicious activities (such as distribution of malware or phishing).</li>
            <li>Violate privacy, communication, or marketing laws, including but not limited to the Telephone Consumer Protection Act (TCPA), CAN-SPAM Act, and General Data Protection Regulation (GDPR).</li>
            <li>Contain highly sensitive personal info (e.g., PCI-DSS cardholder data, HIPAA-protected health information, or Social Security numbers) without prior written enterprise authorization.</li>
          </ul>
          <p>
            <strong>Right to Terminate:</strong> We reserve the right to audit payload schemas and traffic logs. Any account found routing illegal, non-compliant, or malicious data will be subject to immediate, permanent, and unconditional termination without notice.
          </p>

          <h2>3. Limitation of Liability ("AS IS" Provision)</h2>
          <p>
            FlowAPI provides its routing infrastructure and platform strictly on an <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> basis. 
            We make no warranties, express or implied, regarding system uptime, processing delays, or delivery success.
          </p>
          <p>
            To the maximum extent permitted by applicable law, FlowAPI, its founders, employees, and affiliates shall not be liable for any 
            indirect, incidental, special, consequential, or exemplary damages. This includes, without limitation, liability for:
          </p>
          <ul>
            <li><strong>Lost Revenue or Profits:</strong> Any financial loss resulting from delayed, dropped, or failed delivery of leads.</li>
            <li><strong>Dropped Leads:</strong> Any failures in routing, mapping, or queuing that lead to lost data.</li>
            <li><strong>Third-Party CRM Downtime:</strong> Downtime, rate-limiting, or connection failures on target systems (such as GoHighLevel, Salesforce, custom endpoints, or HubSpot).</li>
          </ul>
          <p>
            It is your sole responsibility to configure client-side retries and fallback endpoints to safeguard mission-critical integrations.
          </p>

          <h2>4. Destination Configuration Responsibility</h2>
          <p>
            You are solely responsible for configuring and maintaining active delivery destinations. FlowAPI is not liable for leads lost
            due to missing, inactive, or misconfigured destinations. Leads that cannot be delivered are logged in your Webhook Logs
            dashboard for auditing.
          </p>

          <h2>5. Data Deletion Protocol</h2>
          <p>
            <strong>Irreversible Destruction:</strong> When you initiate the deletion of your account through the Control Panel, FlowAPI permanently, 
            completely, and irreversibly destroys all associated data from our active production PostgreSQL databases. This includes:
          </p>
          <ul>
            <li>All active inbound API keys and associated cryptographic hashes.</li>
            <li>All configured outbound webhook destinations and connection parameters.</li>
            <li>All historical request, delivery, and error logs stored in our systems.</li>
          </ul>
          <p>
            Once account deletion is triggered, this data cannot be recovered, restored, or re-associated. Transient backups will naturally cycle out and purge within 30 days.
          </p>
        </article>
      </div>
    </div>
  );
}
