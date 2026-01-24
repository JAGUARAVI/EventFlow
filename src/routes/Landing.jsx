import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Landing() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-default-500">
        Loading…
      </div>
    );
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-default-50 to-default-100 dark:from-default-950 dark:to-default-900">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex flex-col items-center text-center gap-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-default-500">DesignBattles</p>
            <h1 className="text-4xl md:text-5xl font-bold">Run live competitions with confidence</h1>
            <p className="text-default-500 max-w-xl mx-auto">
              Brackets, leaderboards, judges, and live polls—everything you need to power creative battle events.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/login" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground">Sign in</Link>
            <Link to="/dashboard" className="px-5 py-2 rounded-lg border border-default-300">Go to dashboard</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          <div className="p-5 rounded-xl border border-default-200 dark:border-default-700 bg-white/60 dark:bg-default-900/60">
            <h3 className="font-semibold mb-1">Live scoring</h3>
            <p className="text-sm text-default-500">Update scores in real-time with judge controls and audit logs.</p>
          </div>
          <div className="p-5 rounded-xl border border-default-200 dark:border-default-700 bg-white/60 dark:bg-default-900/60">
            <h3 className="font-semibold mb-1">Brackets & formats</h3>
            <p className="text-sm text-default-500">Single elimination, round robin, and Swiss brackets supported.</p>
          </div>
          <div className="p-5 rounded-xl border border-default-200 dark:border-default-700 bg-white/60 dark:bg-default-900/60">
            <h3 className="font-semibold mb-1">Audience polls</h3>
            <p className="text-sm text-default-500">Collect live votes and award points to teams instantly.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
