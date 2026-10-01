import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = String(email || '').trim();
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('Enter a valid email');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: trimmed });
      toast.success('OTP sent to your email');
      navigate('/verify-reset-otp', { state: { email: trimmed } });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full max-w-[460px] mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5 p-6 sm:p-8 md:p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Forgot Password?</h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base">Enter your email and we&apos;ll send you an OTP to reset your password.</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5 text-left">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full input text-sm"
              placeholder="Enter your registered email address"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 btn-primary text-sm font-medium py-2.5"
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center w-full">
          <p className="text-sm text-slate-600">
            Remember your password?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
