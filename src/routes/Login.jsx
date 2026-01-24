import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, Tab, Input, Button } from '@heroui/react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    signInWithEmailOtp,
    signInWithPhoneOtp,
    signInWithEmailPassword,
    signUpWithEmailPassword,
  } = useAuth();
  const navigate = useNavigate();

  const onEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signInWithEmailOtp(email.trim());
    setLoading(false);
    if (err) {
      setError(err.message || 'Failed to send magic link');
      return;
    }
    setEmailSent(true);
  };

  const onPhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signInWithPhoneOtp(phone.trim());
    setLoading(false);
    if (err) {
      setError(err.message || 'Failed to send OTP');
      return;
    }
    setPhoneSent(true);
  };

  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin'); // or 'signup'

  const onEmailPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fn =
      mode === 'signin'
        ? signInWithEmailPassword
        : signUpWithEmailPassword;

    const { error: err } = await fn(email.trim(), password);
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    navigate('/');
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center">Sign in</h1>
        {error && <p className="text-danger text-sm text-center">{error}</p>}
        <Tabs aria-label="Login method" fullWidth>
          <Tab key="password" title="Email + Password">
            <form onSubmit={onEmailPasswordSubmit} className="flex flex-col gap-3 pt-2">
              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onValueChange={setEmail}
                isRequired
              />

              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onValueChange={setPassword}
                isRequired
              />

              <Button type="submit" color="primary" isLoading={loading} fullWidth>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>

              <p className="text-center text-sm text-default-500">
                {mode === 'signin' ? 'No account?' : 'Already vibing here?'}{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    setMode(mode === 'signin' ? 'signup' : 'signin')
                  }
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </form>
          </Tab>
          <Tab key="email" title="Email">
            <form onSubmit={onEmailSubmit} className="flex flex-col gap-3 pt-2">
              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onValueChange={setEmail}
                isRequired
                isDisabled={emailSent}
              />
              {emailSent ? (
                <p className="text-success text-sm">Check your email for the magic link.</p>
              ) : (
                <Button type="submit" color="primary" isLoading={loading} fullWidth>
                  Send magic link
                </Button>
              )}
            </form>
          </Tab>
          <Tab key="phone" title="Phone">
            <form onSubmit={onPhoneSubmit} className="flex flex-col gap-3 pt-2">
              <Input
                type="tel"
                label="Phone"
                placeholder="+1234567890"
                value={phone}
                onValueChange={setPhone}
                isRequired
                isDisabled={phoneSent}
              />
              {phoneSent ? (
                <p className="text-success text-sm">Check your phone for the OTP.</p>
              ) : (
                <Button type="submit" color="primary" isLoading={loading} fullWidth>
                  Send OTP
                </Button>
              )}
            </form>
          </Tab>
        </Tabs>
        <p className="text-center text-default-500 text-sm">
          <button type="button" onClick={() => navigate('/')} className="underline">
            Back to home
          </button>
        </p>
      </div>
    </div>
  );
}
