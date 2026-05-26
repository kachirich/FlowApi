import React, { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PricingCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Extract user safely from AuthContext
  const auth = useAuth();
  const userEmail = auth?.user?.email || '';

  const handleUpgrade = async () => {
    if (!userEmail) {
      setError('You must be logged in to upgrade.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth?.token ? { 'Authorization': `Bearer ${auth.token}` } : {})
        },
        body: JSON.stringify({ userEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to initialize checkout');
      }

      if (data.url) {
        // Redirect seamlessly to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned from server.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message);
      setIsLoading(false); // Only stop loading if it fails. If successful, keep loading while redirecting.
    }
  };

  const features = [
    'Unlimited API Requests',
    'Advanced Redis Analytics',
    'Zero-Trust Security Shield',
    'Custom Subdomains',
  ];

  return (
    <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      <div className="p-6 border-b border-gray-800 bg-gray-900/50">
        <h3 className="text-2xl font-bold text-white mb-1">FlowAPI Premium</h3>
        <p className="text-gray-400 text-sm mb-4">Start your 3-Day Free Trial today.</p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold text-white">$49</span>
          <span className="text-gray-400">/mo</span>
        </div>
      </div>
      
      <div className="p-6 flex-1 flex flex-col">
        <ul className="space-y-4 mb-8 flex-1">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
              <span className="text-gray-300 text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-950/50 p-3 rounded-lg border border-red-900">
            {error}
          </div>
        )}

        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Redirecting...</span>
            </>
          ) : (
            <span>Upgrade Now</span>
          )}
        </button>
      </div>
    </div>
  );
}
