'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authApi, setAccessToken, setRefreshToken, ApiError } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register(email, password, name);
      setAccessToken(res.access_token);
      setRefreshToken(res.refresh_token);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">
        Create an account
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Start monitoring your agents
      </p>

      {error && (
        <div className="mb-4 p-3 bg-accent-danger/10 border border-accent-danger/20 rounded-[var(--radius-sm)] text-[13px] text-accent-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-text-primary mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="SocQuery Team"
            className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-text-primary mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-text-primary mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="8+ characters"
            className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-text-primary mb-1.5">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Re-enter password"
            className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-accent-primary hover:bg-accent-primary-hover text-white text-[14px] font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-text-secondary">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-accent-primary hover:text-accent-primary-hover font-medium"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
