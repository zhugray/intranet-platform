'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Mail, Lock, ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const sendOtpMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/auth/send-otp', { email, purpose: 'reset_password' }),
    onSuccess: () => {
      setError('');
      setStep(2);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to send code. Please check your email.');
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/auth/verify-otp', { email, code: otp, purpose: 'reset_password' }),
    onSuccess: () => {
      setError('');
      setStep(3);
    },
    onError: (err: any) => {
      setError(err.message || 'Invalid or expired verification code');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/auth/reset-password', { email, code: otp, newPassword }),
    onSuccess: () => {
      setDone(true);
    },
    onError: (err: any) => {
      setError(err.message || 'Reset failed. Please try again.');
    },
  });

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) return setError('Please enter your company email');
    sendOtpMutation.mutate();
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) return setError('Please enter the 6-digit code');
    verifyOtpMutation.mutate();
  };

  const handleStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters');
    if (!/[A-Z]/.test(newPassword)) return setError('Password must contain at least 1 uppercase letter');
    if (!/[0-9]/.test(newPassword)) return setError('Password must contain at least 1 number');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    resetMutation.mutate();
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold text-gray-900">Password Reset Successful</h2>
          <p className="mt-2 text-sm text-gray-500">You can now sign in with your new password</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <span className="text-xl font-bold text-white">IN</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-1 text-sm text-gray-500">Verify your company email to reset</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Company Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@company.com"
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={sendOtpMutation.isPending}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {sendOtpMutation.isPending ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div>
                <p className="mb-3 text-sm text-gray-600">
                  Code sent to <span className="font-medium text-gray-900">{email}</span>
                </p>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  6-Digit Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-center text-lg tracking-widest outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={verifyOtpMutation.isPending}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {verifyOtpMutation.isPending ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="space-y-4">
              <p className="text-sm text-gray-600">
                Set a new password for <span className="font-medium text-gray-900">{email}</span>
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, uppercase & number"
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={resetMutation.isPending}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-gray-500">
            Remember it?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
