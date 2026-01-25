import { useState, useEffect } from "react";
import {
  Input,
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  addToast,
  Avatar,
  Divider,
} from "@heroui/react";
import {
  User,
  Mail,
  Shield,
  LogOut,
  Save,
  KeyRound,
  Edit3,
  Activity,
  Trophy,
  Users,
  Gavel,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

export default function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!profile);

  // Password update state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Analytics state
  const [stats, setStats] = useState({
    eventsOrganized: 0,
    teamsRegistered: 0,
    eventsJudged: 0,
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || "");
      setLoading(false);
      fetchStats();
    }
  }, [profile]);

  const fetchStats = async () => {
    if (!user?.id) return;
    try {
      const { count: eventsOrganized } = await supabase
        .from("events")
        .select("*", { count: "exact" })
        .eq("created_by", user.id);

      const { count: teamsRegistered } = await supabase
        .from("teams")
        .select("*", { count: "exact" })
        .eq("created_by", user.id);

      const { count: eventsJudged } = await supabase
        .from("event_judges")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      setStats({
        eventsOrganized: eventsOrganized || 0,
        teamsRegistered: teamsRegistered || 0,
        eventsJudged: eventsJudged || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      addToast({
        title: "Save failed",
        description: error.message,
        severity: "danger",
      });
      return;
    }
    await refreshProfile();
    addToast({ title: "Profile updated", severity: "success" });
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      addToast({
        title: "Passwords do not match",
        severity: "warning",
      });
      return;
    }
    if (newPassword.length < 6) {
      addToast({
        title: "Password too short",
        description: "Must be at least 6 characters",
        severity: "warning",
      });
      return;
    }

    setUpdatingPassword(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    setUpdatingPassword(false);

    if (error) {
      addToast({
        title: "Update failed",
        description: error.message,
        severity: "danger",
      });
    } else {
      addToast({ title: "Password updated", severity: "success" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSendResetLink = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/profile`,
    });
    setSendingReset(false);

    if (error) {
      addToast({
        title: "Failed to send link",
        description: error.message,
        severity: "danger",
      });
    } else {
      setResetLinkSent(true);
      addToast({
        title: "Reset link sent",
        description: "Check your email for the password reset link",
        severity: "success",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-default-50/50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-default-500">
              Manage your account settings and preferences
            </p>
          </div>
          <Button
            color="danger"
            variant="flat"
            startContent={<LogOut size={16} />}
            onPress={signOut}
          >
            Sign out
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: User Card */}
          <div className="md:col-span-1 space-y-6">
            <Card className="p-4">
              <CardBody className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <Avatar
                    src={avatarUrl}
                    name={displayName || user.email}
                    className="w-24 h-24 text-2xl"
                    isBordered
                    color="primary"
                  />
                  {profile?.role === "admin" && (
                    <div className="absolute -bottom-2 -right-2 bg-primary text-white text-xs px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                      <Shield size={12} />
                      Admin
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {displayName || "User"}
                  </h2>
                  <p className="text-default-500 text-sm break-all">
                    {user.email}
                  </p>
                </div>
                <div className="w-full pt-4 border-t border-default-100 flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-default-500">Role</span>
                    <span className="font-medium capitalize">
                      {profile?.role || "Viewer"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-default-500">User ID</span>
                    <code className="cursor-pointer text-xs bg-default-100 px-1 py-0.5 rounded" onClick={() => {
                      navigator.clipboard.writeText(user.id);
                      addToast({ title: "User ID copied to clipboard", severity: "success" });
                    }} >
                      {user.id.slice(0, 8)}...
                    </code>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Analytics Card */}
            <Card className="p-4">
              <CardBody className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2 text-default-500">
                  <Activity size={18} />
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    Activity
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary text-white rounded-md">
                        <Users size={16} />
                      </div>
                      <span className="text-sm font-medium">
                        Teams Registered
                      </span>
                    </div>
                    <span className="text-lg font-bold">
                      {stats.teamsRegistered}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary text-white rounded-md">
                        <Trophy size={16} />
                      </div>
                      <span className="text-sm font-medium">
                        Events Organized
                      </span>
                    </div>
                    <span className="text-lg font-bold">
                      {stats.eventsOrganized}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-warning text-white rounded-md">
                        <Gavel size={16} />
                      </div>
                      <span className="text-sm font-medium">Events Judged</span>
                    </div>
                    <span className="text-lg font-bold">
                      {stats.eventsJudged}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Right Column: Forms */}
          <div className="md:col-span-2 space-y-6">
            {/* Edit Profile */}
            <Card>
              <CardHeader className="flex gap-3 px-6 pt-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <User size={20} />
                </div>
                <div className="flex flex-col">
                  <p className="text-md font-bold">Account Details</p>
                  <p className="text-small text-default-500">
                    Update your public profile information
                  </p>
                </div>
              </CardHeader>
              <Divider />
              <CardBody className="gap-4 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Display Name"
                    placeholder="Enter your name"
                    value={displayName}
                    onValueChange={setDisplayName}
                    variant="bordered"
                    startContent={
                      <User size={16} className="text-default-400" />
                    }
                  />
                  <Input
                    label="Avatar URL"
                    placeholder="https://..."
                    value={avatarUrl}
                    onValueChange={setAvatarUrl}
                    variant="bordered"
                    startContent={
                      <Edit3 size={16} className="text-default-400" />
                    }
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <Button
                    color="primary"
                    onPress={handleSaveProfile}
                    isLoading={saving}
                    startContent={<Save size={16} />}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader className="flex gap-3 px-6 pt-6">
                <div className="p-2 bg-warning/10 rounded-lg text-warning">
                  <KeyRound size={20} />
                </div>
                <div className="flex flex-col">
                  <p className="text-md font-bold">Security</p>
                  <p className="text-small text-default-500">
                    Manage your password and security settings
                  </p>
                </div>
              </CardHeader>
              <Divider />
              <CardBody className="gap-6 p-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground/80">
                    Change Password
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="New Password"
                        placeholder="••••••••"
                        type="password"
                        value={newPassword}
                        onValueChange={setNewPassword}
                        variant="bordered"
                      />
                      <Input
                        label="Confirm Password"
                        placeholder="••••••••"
                        type="password"
                        value={confirmPassword}
                        onValueChange={setConfirmPassword}
                        variant="bordered"
                      />
                    </div>
                  </div>
                  <Button
                    onPress={handleUpdatePassword}
                    isLoading={updatingPassword}
                    isDisabled={
                      !newPassword || !confirmPassword
                    }
                    variant="flat"
                    color="primary"
                    size="sm"
                  >
                    Update Password
                  </Button>
                </div>

                <Divider className="my-2" />

                <div className="flex flex-col sm:flex-row justify-between items-center bg-warning/5 p-4 rounded-lg gap-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">
                      Reset via Email
                    </h4>
                    <p className="text-xs text-default-500 max-w-xs">
                      Send a secure link to {user.email} to reset your password.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    color="warning"
                    size="sm"
                    onPress={handleSendResetLink}
                    isLoading={sendingReset}
                    isDisabled={resetLinkSent}
                  >
                    {resetLinkSent ? "Link Sent" : "Send Reset Link"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
