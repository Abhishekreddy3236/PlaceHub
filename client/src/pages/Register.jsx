import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { requestOtp, verifyOtp as verifyOtpRequest, registerStudent, getRegistrationStatus } from '../services/authService';
import { getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import { SCHOOLS } from '../utils/constants';
import Logo from '../components/ui/Logo';
import { HiOutlineLockClosed, HiOutlineRefresh } from 'react-icons/hi';
import Loader from '../components/common/Loader';

export default function Register() {
  const location = useLocation();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    school: '',
    rollNumber: '',
    admissionId: '',
    graduationYear: '',
  });
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const submittingRef = useRef(false);

  // Registration Status State
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(null);

  const navigate = useNavigate();

  const checkStatus = useCallback(async () => {
    setPageLoading(true);
    setPageError(false);
    try {
      const response = await getRegistrationStatus();
      setRegistrationEnabled(response.data?.data?.registrationEnabled ?? true);
    } catch (error) {
      setPageError(true);
    } finally {
      setPageLoading(false);
    }
  }, []);

  const generateYears = () => {
    const baseStart = 2026;
    const currentYear = new Date().getFullYear();
    const start = Math.max(baseStart, currentYear);
    const end = start + 10;

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const isStrongPassword = (value) => {
    const password = String(value || '');
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  };

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    const st = location.state;

    if (st?.formData) {
      setForm(st.formData);
    }

    if (st?.email) {
      setForm((prev) => ({
        ...prev,
        email: prev.email || st.email
      }));
    }

    if (st?.registrationOtpVerified === true) {
      setOtpVerified(true);
    }
  }, [location.state]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const sendOtp = async () => {
    const email = String(form.email || '').trim();
    if (!email || !email.includes('@')) {
      toast.error('Enter an email address');
      return;
    }

    setOtpLoading(true);
    try {
      await requestOtp(email);
      navigate('/verify-otp', {
        state: {
          email: email,
          fromRegister: true,
          formData: form
        }
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!otpVerified) {
      toast.error('Verify your email OTP first');
      return;
    }

    const email = String(form.email || '').trim();
    if (!email || !email.includes('@')) {
      toast.error('Enter an email address');
      return;
    }

    if (!form.school) {
      toast.error('Please select a school');
      return;
    }

    if (!isStrongPassword(form.password)) {
      toast.error('Password must be at least 8 characters and include uppercase, lowercase, and a number');
      return;
    }

    if (!form.rollNumber || !form.admissionId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setShowConfirmation(true);
  };

  const confirmRegistration = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setShowConfirmation(false);
    setSubmitLoading(true);
    const email = String(form.email || '').trim();
    try {
      await registerStudent({
        ...form,
        email,
      });
      toast.success('Account created. You can sign in.');
      navigate('/login');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Registration failed'));
    } finally {
      submittingRef.current = false;
      setSubmitLoading(false);
    }
  };

  const formDisabled = !otpVerified;

  if (pageLoading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-12">
        <Loader />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12 text-center">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <HiOutlineRefresh className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-2">Connection Error</h1>
          <p className="text-slate-600 mb-8 text-sm">Failed to verify registration status. Please check your connection.</p>
          <button onClick={checkStatus} className="btn-primary w-full flex justify-center items-center gap-2">
            <HiOutlineRefresh className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!registrationEnabled) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#FAFAFA] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans antialiased selection:bg-zinc-200 overflow-hidden">
        <div className="w-full max-w-[460px] mx-auto flex flex-col items-center">
          {/* Logo */}
          <div className="mb-10 flex justify-center w-full">
            <Logo className="h-12 sm:h-14 w-auto block object-contain translate-x-[14%]" />
          </div>

          <div className="bg-white w-full rounded-2xl border border-zinc-200/70 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)] p-8 sm:p-10 text-center flex flex-col items-center">

            <div className="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-200/60 shadow-sm flex items-center justify-center mb-6">
              <HiOutlineLockClosed className="w-8 h-8 text-zinc-700" strokeWidth={1.5} />
            </div>

            <h1 className="text-center w-full text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-4">
              Registrations Closed
            </h1>

            <div className="text-center w-full text-base sm:text-lg text-zinc-600 font-medium leading-relaxed max-w-[340px] mx-auto mb-8">
              <p>Student registrations are temporarily unavailable.</p>
              <p className="mt-3 text-[14.5px] sm:text-[15.5px] text-zinc-600 font-normal">
                We're not accepting new student registrations at the moment. Please check back later or contact Placement Cell for assistance.
              </p>
            </div>

            <div className="flex justify-center w-full">
              <Link
                to="/login"
                className="btn-primary flex items-center justify-center gap-2 px-8 py-3 text-sm sm:text-base w-full shadow-sm"
              >
                &larr; Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10 md:py-14 overflow-hidden bg-white md:bg-slate-900">

      <div
        className="hidden md:block absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/woxsen-campus.webp')" }}
      />
      <div className="hidden md:block absolute inset-0 z-0 bg-black/15" />

      {/* Register Card */}
      <div className="relative z-10 w-full max-w-[540px] mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-slate-900/5 overflow-hidden">
        {/* Top Logo Header Section with Soft Blue Background */}
        <div className="bg-[#F0F6FF] py-3.5 sm:py-4 px-6 flex items-center justify-center border-b border-blue-100/60">
          <Link to="/" className="inline-flex items-center justify-center mx-auto focus:outline-none">
            <Logo className="h-10 sm:h-11 w-auto block translate-x-[13.5%]" />
          </Link>
        </div>

        <div className="p-6 sm:p-8 md:p-10 space-y-6 text-left">
          <div className="mb-8 flex flex-col items-center justify-center w-full text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-center w-full">
              Create your account
            </h1>
            <p className="text-slate-600 mt-1.5 text-[15px] sm:text-base font-medium text-center w-full">
              Verify your email, then complete your profile
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="text"
              name="email"
              value={form.email}
              onChange={handleChange}
              disabled={otpVerified}
              required
              autoComplete="email"
              className="w-full input text-sm disabled:bg-slate-50"
              placeholder="Enter your Woxsen email address"
            />
            <p className="text-xs text-slate-400 mt-1"></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sendOtp}
                disabled={otpLoading || otpVerified}
                className="btn-secondary text-sm disabled:opacity-60"
              >
                {otpLoading ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          </div>


          <form onSubmit={handleSubmit} className="border-t border-slate-200 pt-6">
            <div className="grid sm:grid-cols-2 gap-5 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  disabled={formDisabled}
                  className="w-full input text-sm disabled:bg-slate-50"
                  placeholder="Enter your full name"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  disabled={formDisabled}
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full input text-sm disabled:bg-slate-50"
                  placeholder="••••••••"
                />
                <p className="text-xs text-slate-400 mt-1">Min 8 chars, uppercase, lowercase, number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">School</label>
                <select
                  name="school"
                  value={form.school}
                  onChange={handleChange}
                  required
                  disabled={formDisabled}
                  className="w-full input text-sm disabled:bg-slate-50"
                >
                  <option value="" disabled>Select your school</option>
                  {SCHOOLS.map((school) => (
                    <option key={school} value={school}>{school}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Graduation Year</label>
                <select
                  name="graduationYear"
                  value={form.graduationYear}
                  onChange={handleChange}
                  required
                  disabled={formDisabled}
                  className="w-full input text-sm disabled:bg-slate-50"
                >
                  <option value="" disabled>Select graduation year</option>
                  {generateYears().map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Roll Number</label>
                <input
                  type="text"
                  name="rollNumber"
                  value={form.rollNumber}
                  onChange={handleChange}
                  required
                  disabled={formDisabled}
                  className="w-full input text-sm disabled:bg-slate-50"
                  placeholder="e.g., 23WUXXXXXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Admission ID</label>
                <input
                  type="text"
                  name="admissionId"
                  value={form.admissionId}
                  onChange={handleChange}
                  required
                  disabled={formDisabled}
                  className="w-full input text-sm disabled:bg-slate-50"
                  placeholder="Enter your 5-digit Admission ID"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitLoading || formDisabled}
              className="w-full btn-primary text-sm disabled:opacity-60"
            >
              {submitLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-slate-100 text-center w-full">
            <p className="text-md text-slate-700">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 text-left max-h-[90dvh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Confirm Registration</h3>

            <p className="text-sm text-slate-600 mb-4">
              Please review your details carefully. You <span className="font-semibold text-slate-900">cannot</span> change these 4 fields after your account is created:
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200/60 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">School</span>
                <span className="text-sm font-semibold text-slate-800">{form.school}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Graduation Year</span>
                <span className="text-sm font-semibold text-slate-800">{form.graduationYear}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Roll Number</span>
                <span className="text-sm font-semibold text-slate-800">{form.rollNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Admission ID</span>
                <span className="text-sm font-semibold text-slate-800">{form.admissionId}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={confirmRegistration}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
