import OTPVerificationForm from '../components/common/OTPVerificationForm';

export default function VerifyResetOTP() {
  return (
    <OTPVerificationForm
      title="Verify OTP"
      buttonText="Verify OTP"
      apiEndpoint="/auth/verify-reset-otp"
      resendOtpEndpoint="/auth/forgot-password"
      successRedirect="/reset-password"
      successMessage="OTP verified!"
      fallbackRedirect="/forgot-password"
      fallbackMessage="No email found. Please request a password reset first."
      registrationFlow={false}
      storageKey="otp_email_reset"
    />
  );
}
