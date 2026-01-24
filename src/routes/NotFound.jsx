import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-default-500">Page not found.</p>
      <Link to="/" className="text-primary underline">Go home</Link>
    </div>
  );
}
