import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function OtpModal({ isOpen, onClose, email, onSuccess }) {
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSendCode = async () => {
    if (timer > 0) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to send OTP');
      }
      
      setTimer(60);
      showToast('success', 'Verification code sent!');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length < 6) {
      showToast('error', 'Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Invalid verification code');
      }
      
      showToast('success', 'Code verified successfully!');
      if (onSuccess) onSuccess(data);
      setTimeout(() => {
        onClose();
        setCode('');
      }, 1500);
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="relative z-10 w-full max-w-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800/60 bg-surface-raised/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-sm animate-in zoom-in-95 duration-200">
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-2">Security Verification</h2>
        <p className="text-gray-400 text-sm mb-6">
          Enter the 6-digit verification code for <span className="font-medium text-gray-200">{email || 'your account'}</span>.
        </p>

        <div className="space-y-4">
          <div>
            <input
              type="text"
              maxLength="6"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-4 text-center text-3xl tracking-[0.5em] text-white placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSendCode}
              disabled={timer > 0 || isLoading}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                timer > 0 || isLoading
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {isLoading && timer === 0 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : timer > 0 ? (
                `Resend in ${timer}s`
              ) : (
                'Send Code'
              )}
            </button>
            <button
              onClick={handleVerifyCode}
              disabled={isLoading || code.length < 6}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:text-blue-200 text-white py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
            >
              {isLoading && code.length >= 6 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 bg-gray-900 border border-gray-800">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span className="text-sm font-medium text-white">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
