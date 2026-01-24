import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HeroUIProvider, ToastProvider } from '@heroui/react';
import AppLayout from './components/layout/AppLayout';
import Landing from './routes/Landing';
import Login from './routes/Login';
import Dashboard from './routes/Dashboard';
import EventPage from './routes/EventPage';
import EventForm from './routes/EventForm';
import PublicLeaderboard from './routes/PublicLeaderboard';
import PublicPollVote from './routes/PublicPollVote';
import Profile from './routes/Profile';
import NotFound from './routes/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import RequireRole from './components/RequireRole';

export default function App() {
  return (
    <HeroUIProvider>
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
                  <RequireRole allowedRoles={['admin', 'club_coordinator']}>
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
            <Route path="/events/:id/leaderboard" element={<PublicLeaderboard />} />
            <Route path="/events/:id/vote" element={<PublicPollVote />} />
            <Route path="/events/:id" element={<EventPage />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
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
