import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import AppLayout from "./components/layout/AppLayout";
import Landing from "./routes/Landing";
import Login from "./routes/Login";
import Dashboard from "./routes/Dashboard";
import EventPage from "./routes/EventPage";
import EventForm from "./routes/EventForm";
import PublicLeaderboard from "./routes/PublicLeaderboard";
import PublicPollVote from "./routes/PublicPollVote";
import Profile from "./routes/Profile";
import AdminRoles from "./routes/AdminRoles";
import NotFound from "./routes/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireRole from "./components/RequireRole";
import { useTheme } from "./context/ThemeContext";

export default function App() {
    const { isDark, themeName } = useTheme();
    
    const getThemeClass = () => {
        if (themeName === 'sunset') {
            return isDark ? 'sunset-dark' : 'sunset-light'; // Ensure 'sunset-dark' corresponds to your hero.js definition
        } else if (themeName === 'coffee') {
            return isDark ? 'coffee-dark' : 'coffee-light'; // Ensure 'coffee-dark' corresponds to your hero.js definition
        } else if (themeName === 'fresh') {
            return isDark ? 'fresh-dark' : 'fresh-light'; // Ensure 'fresh-dark' corresponds to your hero.js definition
        }
        // 'modern' or fallback
        return isDark ? 'dark' : 'light';
    };

    return (
        <HeroUIProvider className={getThemeClass()}>
            <ToastProvider placement="top-right" />
            <BrowserRouter>
                <Routes>
                    <Route element={<AppLayout />}>
                        <Route path="/" element={<Landing />} />
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/events/new"
                            element={
                                <ProtectedRoute>
                                    <RequireRole
                                        allowedRoles={[
                                            "admin",
                                            "club_coordinator",
                                        ]}
                                    >
                                        <EventForm />
                                    </RequireRole>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/events/:id/edit"
                            element={
                                <ProtectedRoute>
                                    <EventForm />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/events/:id/leaderboard"
                            element={<PublicLeaderboard />}
                        />
                        <Route
                            path="/events/:id/vote"
                            element={<PublicPollVote />}
                        />
                        <Route path="/events/:id" element={<EventPage />} />
                        <Route
                            path="/profile"
                            element={
                                <ProtectedRoute>
                                    <Profile />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/roles"
                            element={
                                <ProtectedRoute>
                                    <RequireRole allowedRoles={["admin"]}>
                                        <AdminRoles />
                                    </RequireRole>
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/404" element={<NotFound />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
            </BrowserRouter>
        </HeroUIProvider>
    );
}
