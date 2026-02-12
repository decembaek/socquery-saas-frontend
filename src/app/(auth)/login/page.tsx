'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authApi, setAccessToken, setRefreshToken, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login(email, password);
      setAccessToken(res.access_token);
      setRefreshToken(res.refresh_token);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">
        Log in to SocQuery
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Enter your credentials to continue
      </p>

      {error && (
        <div className="mb-4 p-3 bg-accent-danger/10 border border-accent-danger/20 rounded-[var(--radius-sm)] text-[13px] text-accent-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
            autoComplete="email"
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
            placeholder="Enter password"
            autoComplete="current-password"
            className="w-full h-10 px-3 text-[14px] bg-bg-primary border border-border-primary rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-accent-primary hover:bg-accent-primary-hover text-white text-[14px] font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="text-accent-primary hover:text-accent-primary-hover font-medium"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
