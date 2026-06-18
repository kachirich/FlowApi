import { useState, useEffect } from "react";
import { Bell, BellOff, Lock, Save, Loader2, CheckCircle2 } from "lucide-react";
import apiClient from "../utils/api";
import toast from "react-hot-toast";

const TYPE_META = {
  feature_announcement: {
    label: "Feature Announcements",
    description: "New features, improvements, and product updates",
    icon: "🚀",
  },
  onboarding: {
    label: "Onboarding Emails",
    description: "Getting-started tips sent during your first week",
    icon: "👋",
  },
  usage_alert: {
    label: "Usage Alerts",
    description: "Notifications at 80% and 100% of your monthly quota",
    icon: "⚡",
  },
  delivery_failure: {
    label: "Delivery Failure Alerts",
    description: "Notified when a lead exhausts all retry attempts",
    icon: "🔴",
  },
  billing_alert: {
    label: "Billing Alerts",
    description: "Payment failures, trial endings, and subscription changes",
    icon: "💳",
  },
  weekly_digest: {
    label: "Weekly Digest",
    description: "A Monday summary of your lead activity over the past 7 days",
    icon: "📊",
  },
};

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient
      .get("/api/notifications/preferences")
      .then(({ data }) => setPrefs(data.preferences || []))
      .catch(() => toast.error("Failed to load notification preferences"))
      .finally(() => setLoading(false));
  }, []);

  function toggle(type) {
    setPrefs(prev =>
      prev.map(p => p.type === type ? { ...p, enabled: !p.enabled } : p)
    );
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const { data } = await apiClient.put("/api/notifications/preferences", { preferences: prefs });
      setPrefs(data.preferences || prefs);
      setSaved(true);
      toast.success("Preferences saved");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8 px-4 md:px-0">
      <div className="flex items-center gap-3 border-b border-slate-800/60 pb-4">
        <Bell className="h-5 w-5 text-indigo-400" />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">Notification Preferences</h2>
          <p className="text-xs text-slate-500 mt-0.5">Choose which emails FlowGateway sends to you</p>
        </div>
      </div>

      <div className="space-y-3">
        {prefs.map(pref => {
          const meta = TYPE_META[pref.type] || { label: pref.type, description: "", icon: "📧" };
          return (
            <div
              key={pref.type}
              className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/60 px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{meta.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    {meta.label}
                    {pref.locked && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        <Lock className="h-2.5 w-2.5" /> Always on
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
                </div>
              </div>

              <button
                onClick={() => !pref.locked && toggle(pref.type)}
                disabled={pref.locked}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  pref.enabled ? "bg-indigo-600" : "bg-slate-700"
                } ${pref.locked ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-checked={pref.enabled}
                role="switch"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    pref.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {prefs.some(p => !p.locked) && (
        <div className="flex justify-end pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "Saved" : "Save Preferences"}
          </button>
        </div>
      )}

      <p className="text-[11px] text-slate-600 text-center pt-2">
        You can also unsubscribe from any email type via the link at the bottom of each notification.
        Billing alerts cannot be disabled as they contain critical account information.
      </p>
    </div>
  );
}
