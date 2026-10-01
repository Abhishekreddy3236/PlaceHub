import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import api, { getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const location = useLocation();
  const [email] = useState(location.state?.email || '');
  const [otp] = useState(location.state?.otp || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, password });
      toast.success('Password reset successfully! You can now login.');
      window.location.replace('/login');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Password reset failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!email || !otp) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-500">Invalid session. Please start the password reset process again.</p>
          <Link to="/forgot-password" className="text-blue-600 font-medium hover:underline mt-2 inline-block">
            Forgot Password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full max-w-[460px] mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5 p-6 sm:p-8 md:p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Reset Password</h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base">Create a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5 text-left">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full input text-sm"
              placeholder="••••••••"
            />
            <p className="text-xs text-slate-400 mt-1">Min 8 chars, with uppercase, lowercase & number</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full input text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 btn-primary text-sm font-medium py-2.5"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
