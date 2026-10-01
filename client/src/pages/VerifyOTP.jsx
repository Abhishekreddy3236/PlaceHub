import OTPVerificationForm from '../components/common/OTPVerificationForm';

export default function VerifyOTP() {
  return (
    <OTPVerificationForm
      title="Verify your email"
      buttonText="Verify Email"
      apiEndpoint="/auth/verify-otp"
      resendOtpEndpoint="/auth/request-otp"
      successRedirect="/register"
      successMessage="Email verified. Complete registration, then sign in."
      fallbackRedirect="/register"
      fallbackMessage="No email found. Please register first."
      registrationFlow={true}
      storageKey="otp_email_register"
    />
  );
}
