import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import toast from 'react-hot-toast';
import { handleApiResponse } from '../../utils/apiHandler';

export default function AdminForgotPassword() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: 'admin@placehub.com' });
      const data = handleApiResponse(response);
      toast.success('OTP sent to admin email');
      navigate('/admin/verify-reset-otp', { state: { maskedEmail: data.maskedEmail } });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Admin Password Reset</h1>
          <p className="text-slate-500 mt-2">Click below to receive a password reset OTP on the registered admin email.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="text-center mb-4">
            <p className="text-sm text-slate-600">A reset OTP will be sent to the admin email address.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary text-sm"
          >
            {loading ? 'Sending OTP...' : 'Send Reset OTP'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-6">
          Remember your password?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
