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
} from "@heroui/react";
import { useAuth } from "../hooks/useAuth";
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
        signInWithPhoneOtp,
        signInWithEmailPassword,
        signUpWithEmailPassword,
    } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState("signin"); // or 'signup'

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

    const onEmailPasswordSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const fn =
            mode === "signin"
                ? signInWithEmailPassword
                : signUpWithEmailPassword;

        const { error: err } = await fn(email.trim(), password);
        setLoading(false);

        if (err) {
            setError(err.message);
            return;
        }

        navigate("/");
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sunset-blue/10 via-background to-sunset-purple/10">
            <Card className="w-full max-w-md shadow-2xl border-none bg-white/80 dark:bg-default-50/80 backdrop-blur-xl">
                <CardHeader className="flex flex-col gap-2 items-center justify-center pt-8 pb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sunset-blue to-sunset-pink flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-2 invert dark:invert-0">
                        E
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-default-500">
                        {mode === "signin" ? "Welcome Back" : "Create Account"}
                    </h1>
                    <p className="text-sm text-default-500">
                        {mode === "signin"
                            ? "Sign in to access your dashboard"
                            : "Join EventFlow to manage your events"}
                    </p>
                </CardHeader>

                <CardBody className="px-8 pb-8">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm border border-danger/20">
                            {error}
                        </div>
                    )}

                    <Tabs
                        aria-label="Login method"
                        fullWidth
                        className="mb-6"
                        color="primary"
                        variant="solid"
                    >
                        <Tab key="password" title="Email & Password">
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

                        <Tab key="phone" title="Phone">
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
                        </Tab>
                    </Tabs>
                </CardBody>
            </Card>

            <div className="absolute bottom-4 text-center text-xs text-default-400">
                &copy; {new Date().getFullYear()} EventFlow. All rights
                reserved.
            </div>
        </div>
    );
}
