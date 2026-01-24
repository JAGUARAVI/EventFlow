import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">DesignBattles</h1>
      <p className="text-default-500">Event management, leaderboards, and live updates.</p>
      <Link to="/login" className="text-primary underline">Sign in</Link>
      <Link to="/dashboard" className="text-primary underline">Dashboard</Link>
    </div>
  );
}
