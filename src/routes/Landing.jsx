import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button, Card, CardBody } from "@heroui/react";
import { Trophy, Users, BarChart3, ArrowRight } from "lucide-react";

export default function Landing() {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-default-500">
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-sunset-blue/20 via-background to-sunset-purple/20 dark:from-sunset-blue/10 dark:to-sunset-purple/10 -z-10" />

                <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
                    <div className="flex flex-col items-center text-center gap-8 max-w-4xl mx-auto">
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <div className="inline-flex px-3 py-1 rounded-full border border-sunset-orange/30 bg-sunset-orange/10 text-sunset-orange text-xs font-medium uppercase tracking-wider mb-2">
                                Event Management Reimagined
                            </div>
                            <h1 className="
                                text-5xl md:text-7xl font-bold tracking-tight
                                bg-clip-text text-transparent
                                bg-gradient-to-r
                                from-[#4f46e5] to-[#ec4899]
                                dark:from-[#fb923c] dark:to-[#ec4899]">
                                Run live competitions <br />
                                with confidence
                            </h1>
                            <p className="text-lg md:text-xl text-default-500 max-w-2xl mx-auto leading-relaxed">
                                Brackets, leaderboards, judges, and live
                                polls—everything you need to power creative
                                hackathons, sports tournaments, or battle
                                events.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                            <Button
                                as={Link}
                                to="/login"
                                size="lg"
                                color="primary"
                                className="font-semibold shadow-lg shadow-sunset-blue/20"
                                endContent={<ArrowRight className="w-4 h-4" />}
                            >
                                Get Started
                            </Button>
                            <Button
                                as={Link}
                                to="/dashboard"
                                size="lg"
                                variant="bordered"
                                className="font-medium"
                            >
                                View Dashboard
                            </Button>
                        </div>
                    </div>

                    {/* Feature Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24">
                        <Card className="border-none bg-white/50 dark:bg-default-100/50 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300">
                            <CardBody className="p-8 gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-sunset-blue/10 text-sunset-blue flex items-center justify-center">
                                    <Trophy className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-2">
                                        Live Scoring
                                    </h3>
                                    <p className="text-default-500 leading-relaxed">
                                        Update scores in real-time with
                                        dedicated judge controls, audit logs,
                                        and automatic leaderboard updates.
                                    </p>
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="border-none bg-white/50 dark:bg-default-100/50 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300">
                            <CardBody className="p-8 gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-sunset-purple/10 text-sunset-purple flex items-center justify-center">
                                    <BarChart3 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-2">
                                        Brackets & Formats
                                    </h3>
                                    <p className="text-default-500 leading-relaxed">
                                        Flexible tournament structures. Single
                                        elimination, round robin, and Swiss
                                        brackets fully supported.
                                    </p>
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="border-none bg-white/50 dark:bg-default-100/50 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300">
                            <CardBody className="p-8 gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-sunset-pink/10 text-sunset-pink flex items-center justify-center">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-2">
                                        Audience Polls
                                    </h3>
                                    <p className="text-default-500 leading-relaxed">
                                        Engage the crowd. Collect live votes via
                                        QR codes or links and award points to
                                        teams instantly.
                                    </p>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
