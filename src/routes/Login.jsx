import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
    Tabs,
    Tab,
    Input,
    Button,
    Card,
    CardBody,
    CardHeader,
    Image
} from "@heroui/react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { Mail, Lock, Phone, ArrowRight, UserPlus, LogIn } from "lucide-react";

export default function Login() {
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [emailSent, setEmailSent] = useState(false);
    const [phoneSent, setPhoneSent] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const {
        signInWithEmailOtp,
        // signInWithPhoneOtp,
        signInWithEmailPassword,
        signUpWithEmailPassword,
    } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState("signin"); // 'signin', 'signup', 'forgot_password'

    const onEmailSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const { error: err } = await signInWithEmailOtp(email.trim());
        setLoading(false);
        if (err) {
            setError(err.message || "Failed to send magic link");
            return;
        }
        setEmailSent(true);
    };

    const onForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const { error: err } = await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
                redirectTo: `${window.location.origin}/profile`,
            },
        );
        setLoading(false);
        if (err) {
            setError(err.message);
            return;
        }
        setEmailSent(true); // Reuse this state to show success message
    };

    const onPhoneSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const { error: err } = await signInWithPhoneOtp(phone.trim());
        setLoading(false);
        if (err) {
            setError(err.message || "Failed to send OTP");
            return;
        }
        setPhoneSent(true);
    };

    const [signupSent, setSignupSent] = useState(false);

    const onEmailPasswordSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const fn =
            mode === "signin"
                ? signInWithEmailPassword
                : signUpWithEmailPassword;

        const { data, error: err } = await fn(email.trim(), password);
        setLoading(false);

        if (err) {
            // Handle "user already exists" error with a friendlier message
            if (mode === "signup" && (
                err.message?.toLowerCase().includes("already registered") ||
                err.message?.toLowerCase().includes("already exists") ||
                err.message?.toLowerCase().includes("user already")
            )) {
                setError("A user with this email already exists. Please sign in instead.");
            } else {
                setError(err.message);
            }
            return;
        }

        // Check if user already exists (Supabase returns empty identities array for existing users)
        if (mode === "signup" && data?.user?.identities?.length === 0) {
            setError("A user with this email already exists. Please sign in instead.");
            return;
        }

        if (mode === "signup") {
            setSignupSent(true);
        } else {
            navigate("/");
        }
    };

    const renderHeader = () => {
        if (mode === "forgot_password") {
            return {
                title: "Reset Password",
                subtitle: "Enter your email to receive recovery instructions",
            };
        }
        return {
            title: mode === "signin" ? "Welcome Back" : "Create Account",
            subtitle:
                mode === "signin"
                    ? "Sign in to access your dashboard"
                    : "Join EventFlow to manage your events",
        };
    };

    const header = renderHeader();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sunset-blue/10 via-background to-sunset-purple/10">
            <Card className="w-full max-w-md shadow-2xl border-none bg-white/80 dark:bg-default-100/80 backdrop-blur-xl">
                <CardHeader className="flex flex-col gap-2 items-center justify-center pt-8 pb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sunset-blue to-sunset-pink flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-2">
                        <Image
                            src="/EventFlow.svg"
                            alt="EventFlow Logo"
                        />
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-default-500">
                        {header.title}
                    </h1>
                    <p className="text-sm text-default-500">
                        {header.subtitle}
                    </p>
                </CardHeader>

                <CardBody className="px-8 pb-8">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/20">
                            {error}
                        </div>
                    )}

                    {mode === "forgot_password" ? (
                        emailSent ? (
                            <div className="text-center space-y-4">
                                <div className="p-4 bg-success/10 text-success rounded-xl flex flex-col items-center justify-center gap-2">
                                    <Mail size={32} />
                                    <p className="font-semibold">
                                        Check your email
                                    </p>
                                </div>
                                <p className="text-sm text-default-500">
                                    We've sent a password reset link to{" "}
                                    <strong>{email}</strong>
                                </p>
                                <Button
                                    variant="flat"
                                    onPress={() => {
                                        setMode("signin");
                                        setEmailSent(false);
                                    }}
                                    fullWidth
                                >
                                    Back to Sign In
                                </Button>
                            </div>
                        ) : (
                            <form
                                onSubmit={onForgotPasswordSubmit}
                                className="space-y-4"
                            >
                                <Input
                                    label="Email Address"
                                    placeholder="Enter your email"
                                    value={email}
                                    onValueChange={setEmail}
                                    startContent={
                                        <Mail className="text-default-400" />
                                    }
                                    variant="bordered"
                                    isRequired
                                    type="email"
                                />
                                <Button
                                    color="primary"
                                    type="submit"
                                    isLoading={loading}
                                    fullWidth
                                    className="bg-gradient-to-r from-sunset-blue to-sunset-purple shadow-lg shadow-sunset-purple/20"
                                >
                                    Send Reset Link
                                </Button>
                                <Button
                                    variant="light"
                                    onPress={() => setMode("signin")}
                                    fullWidth
                                >
                                    Cancel
                                </Button>
                            </form>
                        )
                    ) : (
                        <Tabs
                            aria-label="Login options"
                            className="bg-transparent"
                            classNames={{
                                tabList: "bg-default-100/50 p-1 w-full",
                                cursor: "bg-background shadow-sm",
                                tab: "h-9",
                                panel: "pt-4",
                            }}
                        >
                        <Tab key="password" title="Email & Password">
                            {signupSent ? (
                                <div className="text-center py-8 space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-success/10 text-success mx-auto flex items-center justify-center">
                                        <Mail className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold">
                                            Confirm your email
                                        </h3>
                                        <p className="text-default-500 text-sm mt-1">
                                            We've sent a confirmation email to{" "}
                                            <span className="font-medium text-foreground">
                                                {email}
                                            </span>
                                        </p>
                                        <p className="text-default-400 text-xs mt-2">
                                            Please check your inbox and click the link to activate your account.
                                        </p>
                                    </div>
                                    <Button
                                        variant="light"
                                        color="primary"
                                        onPress={() => {
                                            setSignupSent(false);
                                            setMode("signin");
                                        }}
                                        className="mt-2"
                                    >
                                        Back to Sign In
                                    </Button>
                                </div>
                            ) : (
                            <form
                                onSubmit={onEmailPasswordSubmit}
                                className="flex flex-col gap-4 mt-2"
                            >
                                <Input
                                    type="email"
                                    label="Email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onValueChange={setEmail}
                                    isRequired
                                    startContent={
                                        <Mail className="w-4 h-4 text-default-400" />
                                    }
                                    variant="bordered"
                                />

                                <Input
                                    type="password"
                                    label="Password"
                                    placeholder="••••••••"
                                    value={password}
                                    onValueChange={setPassword}
                                    isRequired
                                    startContent={
                                        <Lock className="w-4 h-4 text-default-400" />
                                    }
                                    variant="bordered"
                                />

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        className="text-xs text-primary hover:underline outline-none"
                                        onClick={() =>
                                            setMode("forgot_password")
                                        }
                                    >
                                        Forgot password?
                                    </button>
                                </div>

                                <Button
                                    type="submit"
                                    color="primary"
                                    isLoading={loading}
                                    fullWidth
                                    className="mt-2 font-semibold shadow-lg shadow-primary/20"
                                    endContent={
                                        mode === "signin" ? (
                                            <ArrowRight className="w-4 h-4 ml-1" />
                                        ) : (
                                            <UserPlus className="w-4 h-4 ml-1" />
                                        )
                                    }
                                >
                                    {mode === "signin" ? "Sign In" : "Sign Up"}
                                </Button>

                                <div className="div flex items-center justify-center gap-2 mt-2">
                                    <span className="text-sm text-default-500">
                                        {mode === "signin"
                                            ? "Don't have an account?"
                                            : "Already have an account?"}
                                    </span>
                                    <button
                                        type="button"
                                        className="text-sm font-semibold text-primary hover:underline outline-none"
                                        onClick={() =>
                                            setMode(
                                                mode === "signin"
                                                    ? "signup"
                                                    : "signin",
                                            )
                                        }
                                    >
                                        {mode === "signin"
                                            ? "Sign up"
                                            : "Sign in"}
                                    </button>
                                </div>
                            </form>
                            )}
                        </Tab>

                        <Tab key="magic" title="Magic Link">
                            {emailSent ? (
                                <div className="text-center py-8 space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-success/10 text-success mx-auto flex items-center justify-center">
                                        <Mail className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold">
                                            Check your inbox
                                        </h3>
                                        <p className="text-default-500 text-sm mt-1">
                                            We've sent a magic link to{" "}
                                            <span className="font-medium text-foreground">
                                                {email}
                                            </span>
                                        </p>
                                    </div>
                                    <Button
                                        variant="light"
                                        color="primary"
                                        onPress={() => setEmailSent(false)}
                                        className="mt-2"
                                    >
                                        Try another email
                                    </Button>
                                </div>
                            ) : (
                                <form
                                    onSubmit={onEmailSubmit}
                                    className="flex flex-col gap-4 mt-2"
                                >
                                    <p className="text-sm text-default-500 mb-2">
                                        We'll email you a magic link for a
                                        password-free sign in.
                                    </p>
                                    <Input
                                        type="email"
                                        label="Email address"
                                        placeholder="you@example.com"
                                        value={email}
                                        onValueChange={setEmail}
                                        isRequired
                                        startContent={
                                            <Mail className="w-4 h-4 text-default-400" />
                                        }
                                        variant="bordered"
                                    />
                                    <Button
                                        type="submit"
                                        color="secondary"
                                        isLoading={loading}
                                        fullWidth
                                        className="mt-2 font-semibold shadow-lg shadow-secondary/20"
                                    >
                                        Send Magic Link
                                    </Button>
                                </form>
                            )}
                        </Tab>

                        {/*<Tab key="phone" title="Phone">
                            {phoneSent ? (
                                <div className="text-center py-8">
                                    <p className="text-success mb-2 font-medium">
                                        OTP Sent!
                                    </p>
                                    <p className="text-default-500 text-sm">
                                        Check your messages for the code.
                                    </p>
                                    <Button
                                        variant="light"
                                        size="sm"
                                        onPress={() => setPhoneSent(false)}
                                        className="mt-4"
                                    >
                                        Edit number
                                    </Button>
                                </div>
                            ) : (
                                <form
                                    onSubmit={onPhoneSubmit}
                                    className="flex flex-col gap-4 mt-2"
                                >
                                    <p className="text-sm text-default-500 mb-2">
                                        Receive a one-time password via SMS.
                                    </p>
                                    <Input
                                        type="tel"
                                        label="Phone number"
                                        placeholder="+1234567890"
                                        value={phone}
                                        onValueChange={setPhone}
                                        isRequired
                                        startContent={
                                            <Phone className="w-4 h-4 text-default-400" />
                                        }
                                        variant="bordered"
                                    />
                                    <Button
                                        type="submit"
                                        color="primary"
                                        isLoading={loading}
                                        fullWidth
                                        className="mt-2 font-semibold"
                                    >
                                        Send OTP
                                    </Button>
                                </form>
                            )}
                        </Tab>*/}
                    </Tabs>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
