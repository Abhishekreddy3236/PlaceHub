import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import toast from 'react-hot-toast';

export default function OTPVerificationForm({
  title = "Verify OTP",
  buttonText = "Verify Email",
  apiEndpoint,
  resendOtpEndpoint,
  successRedirect,
  successMessage,
  fallbackRedirect,
  fallbackMessage = "No email found. Please start over.",
  registrationFlow = false,
  storageKey = "otp_email"
}) {
  const location = useLocation();
  const navigate = useNavigate();

  // State handling for email (Refresh-safe)
  const [email] = useState(() => {
    const locEmail = location.state?.email;
    if (locEmail) {
      sessionStorage.setItem(storageKey, locEmail);
      return locEmail;
    }
    return sessionStorage.getItem(storageKey) || '';
  });

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Timers
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300 seconds)
  const [resendCooldown, setResendCooldown] = useState(60); // 60 seconds
  const timerRef = useRef(null);
  const resendTimerRef = useRef(null);

  const startTimers = () => {
    setTimeLeft(300);
    setResendCooldown(60);

    if (timerRef.current) clearInterval(timerRef.current);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (email) {
      startTimers();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(apiEndpoint, { email, otp });
      toast.success(successMessage);

      // Clear sessionStorage on success
      sessionStorage.removeItem(storageKey);

      const stateObj = {
        email,
        ...(registrationFlow && {
          registrationOtpVerified: true,
          formData: location.state?.formData
        }),
        ...(!registrationFlow && {
          otp
        })
      };

      navigate(successRedirect, { state: stateObj });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post(resendOtpEndpoint, { email });
      toast.success('OTP sent to your email');
      setOtp(''); // Clear current input

      // Only reset resendCooldown, DO NOT reset main expiry timer
      setResendCooldown(60);
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
      resendTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(resendTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // ONLY reset main expiry timer if it is already fully expired to prevent deadlock
      if (timeLeft <= 0) {
        setTimeLeft(300);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to resend OTP'));
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // If no email exists in state or sessionStorage, show fallback
  if (!email) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-500">{fallbackMessage}</p>
          <Link to={fallbackRedirect} className="text-blue-600 font-medium hover:underline mt-2 inline-block">
            Go back
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = timeLeft === 0;
  const isSubmitDisabled = loading || otp.length !== 6 || isExpired;

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full max-w-[460px] mx-auto bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5 p-6 sm:p-8 md:p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-slate-900 break-all">{email}</span>
          </p>
          <p className="text-slate-700 mt-3 text-sm sm:text-sm">
            Please check your spam/junk or other folders if you don't see it in your inbox.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5 text-left">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-slate-700">Enter OTP</label>
              <span className={`text-xs font-medium ${isExpired ? 'text-red-500' : 'text-slate-500'}`}>
                {isExpired ? 'Expired' : `Expires in ${formatTime(timeLeft)}`}
              </span>
            </div>

            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              maxLength={6}
              disabled={isExpired || loading}
              className="w-full input text-center text-2xl tracking-[0.5em] font-mono py-3 disabled:opacity-50"
              placeholder="000000"
            />

            {isExpired && (
              <p className="text-sm text-red-500 mt-2 text-center font-medium">
                OTP expired, please request a new one
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full mt-6 btn-primary text-sm font-medium py-2.5 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : buttonText}
          </button>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center w-full">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className="text-sm text-blue-600 font-medium hover:underline disabled:text-slate-500 disabled:no-underline disabled:cursor-not-allowed transition-colors"
            >
              {resending ? 'Sending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
