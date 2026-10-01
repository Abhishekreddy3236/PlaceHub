import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminVerifyOTP() {
  const location = useLocation();
  const [maskedEmail] = useState(location.state?.maskedEmail || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/verify-reset-otp', { email: 'admin@placehub.com', otp });
      toast.success('OTP verified!');
      navigate('/admin/reset-password', { state: { otp } });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!maskedEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-500">No session found. Please request a password reset first.</p>
          <Link to="/admin/forgot-password" className="text-blue-600 font-medium hover:underline mt-2 inline-block">
            Admin Forgot Password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verify OTP</h1>
          <p className="text-slate-500 mt-2">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-slate-900">{maskedEmail}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Enter OTP</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              className="w-full input text-center text-2xl tracking-[0.5em] font-mono py-3"
              placeholder="000000"
            />
            <p className="text-xs text-slate-400 mt-2 text-center">Code expires in 5 minutes</p>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full mt-6 btn-primary text-sm"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
      </div>
    </div>
  );
}
