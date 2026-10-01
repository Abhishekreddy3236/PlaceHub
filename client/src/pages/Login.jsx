import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { getAuthenticatedHomePath } from '../utils/rbac';
import Logo from '../components/ui/Logo';
export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { loginWithCredentials, loginLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await loginWithCredentials(identifier, password);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Welcome back!');
    navigate(getAuthenticatedHomePath(data.user));
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10 md:py-14 overflow-hidden bg-white md:bg-slate-900">
      {/* Desktop/Tablet Campus Background Image */}
      <div
        className="hidden md:block absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/woxsen-campus.webp')" }}
      />
      <div className="hidden md:block absolute inset-0 z-0 bg-black/15" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[460px] mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-slate-900/5 overflow-hidden">

        <div className="bg-[#F0F6FF] py-3.5 sm:py-4 px-6 flex items-center justify-center border-b border-blue-100/60">
          <Link to="/" className="inline-flex items-center justify-center mx-auto focus:outline-none">
            <Logo className="h-10 sm:h-11 w-auto block translate-x-[13.5%]" />
          </Link>
        </div>

        <div className="p-6 sm:p-8 md:p-10">
          <div className="mb-8 flex flex-col items-center justify-center w-full text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-center w-full">
              Welcome back
            </h1>
            <p className="text-slate-600 mt-1.5 text-[15px] sm:text-base font-medium text-center w-full">
              Sign in to your PlaceHub account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-5 text-left">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email or Username</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full input text-sm"
                placeholder="Enter your Woxsen email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full input text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-6 btn-primary text-sm font-medium py-2.5"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="mt-4 flex items-center justify-between">
              <Link to="/forgot-password" className="text-sm text-blue-600 font-medium hover:underline">
                Forgot Password?
              </Link>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center w-full">
            <p className="text-sm text-slate-700">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-blue-600 font-semibold hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

