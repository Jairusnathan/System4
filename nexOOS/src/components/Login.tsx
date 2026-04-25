'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Pill, Mail, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, X, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { User } from '../types';
import { storeAccessToken } from '@/lib/auth-client';
import { buildApiUrl } from '@/lib/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

type ResetStep = 'email' | 'code' | 'password';
type ResetStatusType = 'success' | 'error' | null;

type ForgotData = {
  email: string;
  verificationCode: string;
  newPassword: string;
  confirmPassword: string;
};

type ResetStatus = {
  type: ResetStatusType;
  message: string;
};

type LoginFormData = {
  email: string;
  password: string;
};

type ForgotPasswordVisibility = {
  new: boolean;
  confirm: boolean;
};

type LoginFieldIds = {
  email: string;
  primarySecret: string;
  rememberMe: string;
  forgotEmail: string;
  forgotCode: string;
  resetPrimarySecret: string;
  resetConfirmSecret: string;
};

const initialForgotData: ForgotData = {
  email: '',
  verificationCode: '',
  newPassword: '',
  confirmPassword: ''
};

const initialResetStatus: ResetStatus = { type: null, message: '' };
const initialForgotPasswordVisibility: ForgotPasswordVisibility = {
  new: false,
  confirm: false
};

const loginFieldIds: LoginFieldIds = {
  email: 'login-field-email',
  primarySecret: 'login-field-primary',
  rememberMe: 'login-field-remember',
  forgotEmail: 'reset-field-email',
  forgotCode: 'reset-field-code',
  resetPrimarySecret: 'reset-field-primary',
  resetConfirmSecret: 'reset-field-confirm',
};

async function postJson<TBody>(path: string, body: TBody) {
  const res = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();

  return { res, data };
}

function getResetButtonLabel(resetStep: ResetStep) {
  if (resetStep === 'email') {
    return 'Send Code';
  }

  if (resetStep === 'code') {
    return 'Verify Code';
  }

  return 'Update Password';
}

function isResetActionDisabled(
  resetStep: ResetStep,
  forgotData: ForgotData,
  isResetting: boolean
) {
  if (isResetting) {
    return true;
  }

  if (resetStep === 'email') {
    return !forgotData.email;
  }

  if (resetStep === 'code') {
    return forgotData.verificationCode.length !== 6;
  }

  return !forgotData.newPassword || !forgotData.confirmPassword;
}

function getResetStatusClasses(type: ResetStatusType) {
  return type === 'success'
    ? 'bg-blue-50 text-blue-800 border border-blue-100'
    : 'bg-red-50 text-red-800 border border-red-100';
}

function getResetStatusIcon(type: ResetStatusType) {
  return type === 'success'
    ? <CheckCircle2 className="w-5 h-5 shrink-0" />
    : <AlertCircle className="w-5 h-5 shrink-0" />;
}

function getPasswordFieldType(isVisible: boolean) {
  return isVisible ? 'text' : 'password';
}

function getPasswordToggleLabel(isVisible: boolean, visibleText: string, hiddenText: string) {
  return isVisible ? visibleText : hiddenText;
}

function PasswordToggleButton({
  isVisible,
  onToggle,
  visibleLabel,
  hiddenLabel,
  className,
  iconClassName,
}: Readonly<{
  isVisible: boolean;
  onToggle: () => void;
  visibleLabel: string;
  hiddenLabel: string;
  className: string;
  iconClassName: string;
}>) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={getPasswordToggleLabel(isVisible, visibleLabel, hiddenLabel)}
      className={className}
    >
      {isVisible ? <EyeOff className={iconClassName} /> : <Eye className={iconClassName} />}
    </button>
  );
}

function ResetStatusBanner({ resetStatus }: Readonly<{ resetStatus: ResetStatus }>) {
  if (!resetStatus.type) {
    return null;
  }

  return (
    <div
      className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-sm font-bold ${getResetStatusClasses(resetStatus.type)}`}
    >
      {getResetStatusIcon(resetStatus.type)}
      {resetStatus.message}
    </div>
  );
}

function ForgotPasswordModal({
  loginFieldIds,
  forgotData,
  resetStep,
  isResetting,
  showForgotPasswords,
  resetStatus,
  onClose,
  onForgotDataChange,
  onToggleForgotPassword,
  onResetAction,
  onResendCode,
}: Readonly<{
  loginFieldIds: LoginFieldIds;
  forgotData: ForgotData;
  resetStep: ResetStep;
  isResetting: boolean;
  showForgotPasswords: ForgotPasswordVisibility;
  resetStatus: ResetStatus;
  onClose: () => void;
  onForgotDataChange: (field: keyof ForgotData, value: string) => void;
  onToggleForgotPassword: (field: keyof ForgotPasswordVisibility) => void;
  onResetAction: () => void;
  onResendCode: () => void;
}>) {
  const showVerificationCode = resetStep !== 'email';
  const showPasswordFields = resetStep === 'password';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-2xl border border-slate-100 w-full max-w-lg relative"
      >
        <button
          onClick={onClose}
          className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <X className="w-6 h-6 text-slate-400" />
        </button>

        <div className="mb-8">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Reset Password</h3>
          <p className="text-slate-500 text-sm font-medium">
            Enter your email, verify the code we send, then choose a new password.
          </p>
        </div>

        <ResetStatusBanner resetStatus={resetStatus} />

        <div className="space-y-4">
          <div>
            <label htmlFor={loginFieldIds.forgotEmail} className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Email</label>
            <input
              id={loginFieldIds.forgotEmail}
              type="email"
              value={forgotData.email}
              onChange={(e) => onForgotDataChange('email', e.target.value)}
              placeholder="name@example.com"
              disabled={resetStep !== 'email' || isResetting}
              className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium disabled:opacity-70"
            />
          </div>

          {showVerificationCode && (
            <div>
              <label htmlFor={loginFieldIds.forgotCode} className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Verification Code</label>
              <input
                id={loginFieldIds.forgotCode}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={forgotData.verificationCode}
                onChange={(e) => onForgotDataChange('verificationCode', e.target.value.replaceAll(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                disabled={resetStep === 'password' || isResetting}
                className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium tracking-[0.3em] disabled:opacity-70"
              />
            </div>
          )}

          {showPasswordFields && (
            <>
              <div>
                <label htmlFor={loginFieldIds.resetPrimarySecret} className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">New Password</label>
                <div className="relative">
                  <input
                    id={loginFieldIds.resetPrimarySecret}
                    type={getPasswordFieldType(showForgotPasswords.new)}
                    value={forgotData.newPassword}
                    onChange={(e) => onForgotDataChange('newPassword', e.target.value)}
                    placeholder="........"
                    className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                  <PasswordToggleButton
                    isVisible={showForgotPasswords.new}
                    onToggle={() => onToggleForgotPassword('new')}
                    visibleLabel="Hide new password"
                    hiddenLabel="Show new password"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                    iconClassName="w-4 h-4"
                  />
                </div>
              </div>
              <div>
                <label htmlFor={loginFieldIds.resetConfirmSecret} className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-4">Confirm New Password</label>
                <div className="relative">
                  <input
                    id={loginFieldIds.resetConfirmSecret}
                    type={getPasswordFieldType(showForgotPasswords.confirm)}
                    value={forgotData.confirmPassword}
                    onChange={(e) => onForgotDataChange('confirmPassword', e.target.value)}
                    placeholder="........"
                    className="w-full px-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                  <PasswordToggleButton
                    isVisible={showForgotPasswords.confirm}
                    onToggle={() => onToggleForgotPassword('confirm')}
                    visibleLabel="Hide confirm password"
                    hiddenLabel="Show confirm password"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                    iconClassName="w-4 h-4"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onResetAction}
            disabled={isResetActionDisabled(resetStep, forgotData, isResetting)}
            className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isResetting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              getResetButtonLabel(resetStep)
            )}
          </button>

          {showVerificationCode && (
            <button
              type="button"
              onClick={onResendCode}
              disabled={isResetting}
              className="w-full py-3 text-sm font-black text-blue-700 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors disabled:opacity-70"
            >
              Resend Code
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LoginCard({
  formData,
  isLoading,
  error,
  showPassword,
  onSubmit,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onOpenForgotPassword,
  onGoHome,
  onGoToRegister,
}: Readonly<{
  formData: LoginFormData;
  isLoading: boolean;
  error: string;
  showPassword: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onOpenForgotPassword: () => void;
  onGoHome: () => void;
  onGoToRegister: () => void;
}>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-10 lg:p-16 rounded-[4rem] shadow-2xl border border-slate-100 w-full max-w-xl relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-2 bg-blue-500" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50" />

      <button
        type="button"
        onClick={onGoHome}
        className="flex items-center gap-2 mb-12 group justify-center w-full"
      >
        <div className="bg-blue-600 p-2 rounded-xl group-hover:rotate-12 transition-transform">
          <Pill className="w-6 h-6 text-white" />
        </div>
        <span className="text-3xl font-black text-slate-900 tracking-tight">PharmaQuick</span>
      </button>

      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Welcome Back!</h2>
        <p className="text-slate-500 font-medium">Sign in to your account to continue shopping.</p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label htmlFor={loginFieldIds.email} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              id={loginFieldIds.email}
              type="email"
              required
              value={formData.email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>
        </div>
        <div>
          <label htmlFor={loginFieldIds.primarySecret} className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-4">Password</label>
          <div className="relative">
            <input
              id={loginFieldIds.primarySecret}
              type={getPasswordFieldType(showPassword)}
              required
              value={formData.password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="........"
              className="w-full pl-14 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
            <PasswordToggleButton
              isVisible={showPassword}
              onToggle={onTogglePassword}
              visibleLabel="Hide password"
              hiddenLabel="Show password"
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              iconClassName="w-5 h-5"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-2">
          <label htmlFor={loginFieldIds.rememberMe} className="flex items-center gap-2 cursor-pointer group">
            <input id={loginFieldIds.rememberMe} type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Remember me</span>
          </label>
          <button
            type="button"
            onClick={onOpenForgotPassword}
            className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Forgot Password?
          </button>
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
              Sign In
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-12 pt-8 border-t border-slate-100 text-center">
        <p className="text-slate-500 font-bold">
          Don&apos;t have an account? <button onClick={onGoToRegister} className="text-blue-600 hover:text-blue-700 transition-colors font-black">Create Account</button>
        </p>
      </div>
    </motion.div>
  );
}

function useLoginForm({
  setView,
  setLoggedIn,
  setUser,
}: Readonly<{
  setView: (view: string) => void;
  setLoggedIn: () => void;
  setUser: (user: User | null) => void;
}>) {
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const updateFormField = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const togglePassword = () => {
    setShowPassword(prev => !prev);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { res, data } = await postJson('/api/auth/login', formData);

      if (res.ok) {
        storeAccessToken(data.token);
        setLoggedIn();
        setUser(data.user);
        setView('home');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    isLoading,
    error,
    showPassword,
    handleLogin,
    updateFormField,
    togglePassword,
  };
}

function useForgotPasswordFlow() {
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotData, setForgotData] = useState(initialForgotData);
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resetToken, setResetToken] = useState('');
  const [resetStatus, setResetStatus] = useState<ResetStatus>(initialResetStatus);
  const [isResetting, setIsResetting] = useState(false);
  const [showForgotPasswords, setShowForgotPasswords] = useState(initialForgotPasswordVisibility);

  const resetForgotPasswordState = () => {
    setForgotData(initialForgotData);
    setResetStep('email');
    setResetToken('');
    setResetStatus(initialResetStatus);
    setIsResetting(false);
    setShowForgotPasswords(initialForgotPasswordVisibility);
  };

  const closeForgotModal = () => {
    setIsForgotModalOpen(false);
    resetForgotPasswordState();
  };

  const openForgotModal = () => {
    resetForgotPasswordState();
    setIsForgotModalOpen(true);
  };

  const updateForgotData = (field: keyof ForgotData, value: string) => {
    setForgotData(prev => ({ ...prev, [field]: value }));
  };

  const toggleForgotPassword = (field: keyof ForgotPasswordVisibility) => {
    setShowForgotPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleResetAction = async () => {
    setIsResetting(true);
    setResetStatus({ type: null, message: '' });

    try {
      if (resetStep === 'email') {
        const { res, data } = await postJson('/api/auth/request-password-reset', {
          email: forgotData.email
        });

        if (res.ok) {
          setResetToken(data.resetToken);
          setResetStep('code');
          setResetStatus({ type: 'success', message: 'Verification code sent. Please check your email.' });
        } else {
          setResetStatus({ type: 'error', message: data.error || 'Failed to send verification code' });
        }

        return;
      }

      if (resetStep === 'code') {
        if (forgotData.verificationCode.length !== 6) {
          setResetStatus({ type: 'error', message: 'Please enter the 6-digit verification code.' });
          return;
        }

        const { res, data } = await postJson('/api/auth/verify-password-reset-code', {
          email: forgotData.email,
          verificationCode: forgotData.verificationCode,
          resetToken
        });

        if (res.ok) {
          setResetStep('password');
          setResetStatus({ type: 'success', message: 'Code accepted. You can now set a new password.' });
        } else {
          setResetStatus({ type: 'error', message: data.error || 'Invalid verification code' });
        }
        return;
      }

      if (forgotData.newPassword !== forgotData.confirmPassword) {
        setResetStatus({ type: 'error', message: 'New passwords do not match' });
        return;
      }

      if (forgotData.newPassword.length < 6) {
        setResetStatus({ type: 'error', message: 'Password must be at least 6 characters' });
        return;
      }

      const { res, data } = await postJson('/api/auth/update-password', {
        email: forgotData.email,
        verificationCode: forgotData.verificationCode,
        resetToken,
        newPassword: forgotData.newPassword
      });

      if (res.ok) {
        setResetStatus({ type: 'success', message: 'Password updated successfully!' });
        setTimeout(() => {
          closeForgotModal();
        }, 2000);
      } else {
        setResetStatus({ type: 'error', message: data.error || 'Failed to update password' });
      }
    } catch {
      setResetStatus({ type: 'error', message: 'An error occurred. Please try again.' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleResendCode = async () => {
    setIsResetting(true);
    setResetStatus({ type: null, message: '' });

    try {
      const { res, data } = await postJson('/api/auth/request-password-reset', {
        email: forgotData.email
      });

      if (res.ok) {
        setResetToken(data.resetToken);
        setResetStep('code');
        setForgotData(prev => ({
          ...prev,
          verificationCode: '',
          newPassword: '',
          confirmPassword: ''
        }));
        setResetStatus({ type: 'success', message: 'A new verification code has been sent.' });
      } else {
        setResetStatus({ type: 'error', message: data.error || 'Failed to resend code' });
      }
    } catch {
      setResetStatus({ type: 'error', message: 'Unable to resend code right now.' });
    } finally {
      setIsResetting(false);
    }
  };

  return {
    isForgotModalOpen,
    forgotData,
    resetStep,
    resetStatus,
    isResetting,
    showForgotPasswords,
    openForgotModal,
    closeForgotModal,
    updateForgotData,
    toggleForgotPassword,
    handleResetAction,
    handleResendCode,
  };
}

export default function Login() {
  const { setView, setLoggedIn, setUser } = useAppContext();
  const loginForm = useLoginForm({ setView, setLoggedIn, setUser });
  const forgotPasswordFlow = useForgotPasswordFlow();

  useBodyScrollLock(forgotPasswordFlow.isForgotModalOpen);

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 py-24">
      <LoginCard
        formData={loginForm.formData}
        isLoading={loginForm.isLoading}
        error={loginForm.error}
        showPassword={loginForm.showPassword}
        onSubmit={loginForm.handleLogin}
        onEmailChange={(value) => loginForm.updateFormField('email', value)}
        onPasswordChange={(value) => loginForm.updateFormField('password', value)}
        onTogglePassword={loginForm.togglePassword}
        onOpenForgotPassword={forgotPasswordFlow.openForgotModal}
        onGoHome={() => setView('home')}
        onGoToRegister={() => setView('register')}
      />

      {forgotPasswordFlow.isForgotModalOpen && (
        <ForgotPasswordModal
          loginFieldIds={loginFieldIds}
          forgotData={forgotPasswordFlow.forgotData}
          resetStep={forgotPasswordFlow.resetStep}
          isResetting={forgotPasswordFlow.isResetting}
          showForgotPasswords={forgotPasswordFlow.showForgotPasswords}
          resetStatus={forgotPasswordFlow.resetStatus}
          onClose={forgotPasswordFlow.closeForgotModal}
          onForgotDataChange={forgotPasswordFlow.updateForgotData}
          onToggleForgotPassword={forgotPasswordFlow.toggleForgotPassword}
          onResetAction={forgotPasswordFlow.handleResetAction}
          onResendCode={forgotPasswordFlow.handleResendCode}
        />
      )}
    </main>
  );
}
