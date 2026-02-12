export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-accent-primary rounded-sm flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-xl font-bold text-text-primary">SocQuery</span>
          </div>
          <p className="text-sm text-text-secondary">Agent Monitoring Platform</p>
        </div>

        <div className="bg-bg-secondary rounded-lg shadow-lg border border-border-primary p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
