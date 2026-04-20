'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Pill, Mail, ArrowRight, AlertCircle, Loader2, User, Eye, EyeOff, CheckCircle2, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { storeAccessToken } from '@/lib/auth-client';
import { buildApiUrl } from '@/lib/api';
import { normalizePhilippinePhone, PH_PHONE_MESSAGE } from '@/lib/phone';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

type RegisterStep = 'form' | 'verify';

type RegisterFormData = {
  fullName: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
  password: string;
  confirmPassword: string;
};

type RegisterFieldIds = {
  fullName: string;
  phone: string;
  email: string;
  birthday: string;
  gender: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: string;
  verificationCode: string;
};

type RegisterBrandButtonProps = Readonly<{
  onClick: () => void;
}>;

type RegisterStatusMessageProps = Readonly<{
  tone: 'error' | 'success';
  message: string;
}>;

type RegisterFormSectionProps = Readonly<{
  fieldIds: RegisterFieldIds;
  formData: RegisterFormData;
  isLoading: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  setFormData: React.Dispatch<React.SetStateAction<RegisterFormData>>;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  setShowConfirmPassword: React.Dispatch<React.SetStateAction<boolean>>;
}>;

type RegisterVerificationSectionProps = Readonly<{
  fieldIds: RegisterFieldIds;
  email: string;
  isLoading: boolean;
  verificationCode: string;
  setVerificationCode: React.Dispatch<React.SetStateAction<string>>;
  onResendCode: () => void;
}>;

type AccountCreatedModalProps = Readonly<{
  email: string;
  onContinue: () => void;
}>;

function RegisterBrandButton({ onClick }: RegisterBrandButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-12 flex w-full items-center justify-center gap-2 group"
    >
      <div className="bg-blue-600 p-2 rounded-xl group-hover:rotate-12 transition-transform">
        <Pill className="w-6 h-6 text-white" />
      </div>
      <span className="text-3xl font-black text-slate-900 tracking-tight">PharmaQuick</span>
    </button>
  );
}

function RegisterStatusMessage({
  tone,
  message,
}: RegisterStatusMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
        tone === 'error'
          ? 'bg-red-50 border border-red-100 text-red-600'
          : 'bg-blue-50 border border-blue-100 text-blue-700'
      }`}
    >
      {tone === 'error' ? (
        <AlertCircle className="w-5 h-5 shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 shrink-0" />
      )}
      {message}
    </div>
  );
}

function RegisterFormSection({
  fieldIds,
  formData,
  isLoading,
  showPassword,
  showConfirmPassword,
  setFormData,
  setShowPassword,
  setShowConfirmPassword,
}: RegisterFormSectionProps) {
  return (
    <>
      <div>
        <label htmlFor={fieldIds.fullName} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Full Name</label>
        <div className="relative">
          <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            id={fieldIds.fullName}
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="Juan Dela Cruz"
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
        </div>
      </div>
      <div>
        <label htmlFor={fieldIds.phone} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Phone Number</label>
        <div className="relative">
          <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            id={fieldIds.phone}
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="09123456789 or +639123456789"
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
        </div>
      </div>
      <div>
        <label htmlFor={fieldIds.email} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            id={fieldIds.email}
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="name@example.com"
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor={fieldIds.birthday} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Birthday</label>
          <div className="relative">
            <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              id={fieldIds.birthday}
              type="date"
              required
              value={formData.birthday}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-500"
            />
          </div>
        </div>
        <div>
          <label htmlFor={fieldIds.gender} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Gender</label>
          <div className="relative">
            <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <select
              id={fieldIds.gender}
              required
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-500 appearance-none"
            >
              <option value="" disabled>
                Select gender
              </option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor={fieldIds.password} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Password</label>
          <div className="relative">
            <input
              id={fieldIds.password}
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="........"
              className="w-full pl-14 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor={fieldIds.confirmPassword} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Confirm Password</label>
          <div className="relative">
            <input
              id={fieldIds.confirmPassword}
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="........"
              className="w-full pl-14 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      <div className="px-2">
        <label htmlFor={fieldIds.agreeToTerms} className="flex items-center gap-2 cursor-pointer group">
          <input id={fieldIds.agreeToTerms} type="checkbox" required className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm font-bold text-slate-500 group-hover:text-slate-700 transition-colors">I agree to the Terms of Service and Privacy Policy</span>
        </label>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <>
            Create Account
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </button>
    </>
  );
}

function RegisterVerificationSection({
  fieldIds,
  email,
  isLoading,
  verificationCode,
  setVerificationCode,
  onResendCode,
}: RegisterVerificationSectionProps) {
  return (
    <>
      <div className="rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4">
        <p className="text-sm font-black text-blue-800">Check your email</p>
        <p className="mt-1 text-sm text-blue-700">
          We sent a 6-digit verification code to <span className="font-bold">{email}</span>.
        </p>
      </div>

      <div>
        <label htmlFor={fieldIds.verificationCode} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Verification Code</label>
        <input
          id={fieldIds.verificationCode}
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Enter 6-digit code"
          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium tracking-[0.3em]"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || verificationCode.length !== 6}
        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <>
            Verify Email
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onResendCode}
        disabled={isLoading}
        className="w-full py-3 text-sm font-black text-blue-700 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors disabled:opacity-70"
      >
        Resend Code
      </button>
    </>
  );
}

function AccountCreatedModal({
  email,
  onContinue,
}: AccountCreatedModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-[2rem] border border-blue-100 bg-white p-8 shadow-2xl"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <CheckCircle2 className="h-8 w-8 text-blue-600" />
        </div>

        <div className="mt-6 text-center">
          <h3 className="text-2xl font-black text-slate-900">Account Successfully Created</h3>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            Welcome to PharmaQuick. Your account is ready, and we&apos;ve also sent a welcome email to{' '}
            <span className="font-bold text-slate-800">{email}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-8 w-full rounded-2xl bg-blue-600 py-4 text-lg font-black text-white transition-all hover:bg-blue-700"
        >
          Continue to Home
        </button>
      </motion.div>
    </div>
  );
}

export default function Register() {
  const { setView, setLoggedIn, setUser } = useAppContext();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthday: '',
    gender: '',
    password: '',
    confirmPassword: ''
  });
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAccountCreatedModal, setShowAccountCreatedModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const registerFieldIds = {
    fullName: 'register-full-name',
    phone: 'register-phone',
    email: 'register-email',
    birthday: 'register-birthday',
    gender: 'register-gender',
    password: 'register-pass-input',
    confirmPassword: 'register-pass-confirm-input',
    agreeToTerms: 'register-agree-terms',
    verificationCode: 'register-verification-code',
  } as const;

  useBodyScrollLock(showAccountCreatedModal);

  const submitRegistrationRequest = async (normalizedPhone: string) => {
    const res = await fetch(buildApiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: formData.fullName,
        email: formData.email,
        phone: normalizedPhone,
        birthday: formData.birthday,
        gender: formData.gender,
        password: formData.password
      })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    setRegistrationToken(data.registrationToken);
    setRegisterStep('verify');
    setVerificationCode('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    const normalizedPhone = normalizePhilippinePhone(formData.phone);
    if (!normalizedPhone) {
      setError(PH_PHONE_MESSAGE);
      setIsLoading(false);
      return;
    }

    try {
      setFormData((prev) => ({ ...prev, phone: normalizedPhone }));
      await submitRegistrationRequest(normalizedPhone);
      setSuccessMessage('Check your email for the 6-digit verification code to finish creating your account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    if (verificationCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(buildApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          birthday: formData.birthday,
          gender: formData.gender,
          password: formData.password,
          verificationCode,
          registrationToken
        })
      });
      const data = await res.json();

      if (res.ok) {
        storeAccessToken(data.token);
        setLoggedIn();
        setUser(data.user);
        setShowAccountCreatedModal(true);
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const normalizedPhone = normalizePhilippinePhone(formData.phone);

      if (!normalizedPhone) {
        throw new Error(PH_PHONE_MESSAGE);
      }

      await submitRegistrationRequest(normalizedPhone);
      setSuccessMessage('A new verification code has been sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend the verification code right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountCreatedContinue = () => {
    setShowAccountCreatedModal(false);
    setView('home');
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 lg:p-16 rounded-[4rem] shadow-2xl border border-slate-100 w-full max-w-xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50" />

        <RegisterBrandButton onClick={() => setView('home')} />

        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">
            {registerStep === 'form' ? 'Create Account' : 'Verify Your Email'}
          </h2>
          <p className="text-slate-500 font-medium">
            {registerStep === 'form'
              ? 'Join us for a better healthcare experience.'
              : 'Enter the code we sent to finish creating your account.'}
          </p>
        </div>

        <RegisterStatusMessage tone="error" message={error} />
        <RegisterStatusMessage tone="success" message={successMessage} />

        {registerStep === 'form' ? (
          <form onSubmit={handleRegister} className="space-y-6">
            <RegisterFormSection
              fieldIds={registerFieldIds}
              formData={formData}
              isLoading={isLoading}
              showPassword={showPassword}
              showConfirmPassword={showConfirmPassword}
              setFormData={setFormData}
              setShowPassword={setShowPassword}
              setShowConfirmPassword={setShowConfirmPassword}
            />
          </form>
        ) : (
          <form onSubmit={handleVerifyEmail} className="space-y-6">
            <RegisterVerificationSection
              fieldIds={registerFieldIds}
              email={formData.email}
              isLoading={isLoading}
              verificationCode={verificationCode}
              setVerificationCode={setVerificationCode}
              onResendCode={handleResendCode}
            />
          </form>
        )}

        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-slate-500 font-bold">
            Already have an account? <button onClick={() => setView('login')} className="text-blue-600 hover:text-blue-700 transition-colors">Sign In</button>
          </p>
        </div>
      </motion.div>

      {showAccountCreatedModal && (
        <AccountCreatedModal email={formData.email} onContinue={handleAccountCreatedContinue} />
      )}
    </main>
  );
}
