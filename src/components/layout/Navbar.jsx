import { Link, useLocation } from "react-router-dom";
import {
    Navbar as HeroNavbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Avatar,
    Button,
    Switch,
} from "@heroui/react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../context/ThemeContext";
import {
    Sun,
    Moon,
    LayoutDashboard,
    User,
    LogOut,
    Settings,
} from "lucide-react";

export default function Navbar() {
    const { user, profile, signOut } = useAuth();
    const { isDark, setDark } = useTheme();
    const location = useLocation();

    const displayName = profile?.display_name || user?.email || "User";
    const avatarUrl = profile?.avatar_url || "";

    const isActive = (path) => location.pathname === path;

    return (
        <HeroNavbar
            isBordered
            maxWidth="xl"
            className="bg-background/70 backdrop-blur-lg sticky top-0 z-50"
            classNames={{
                item: [
                    "flex",
                    "relative",
                    "h-full",
                    "items-center",
                    "data-[active=true]:after:content-['']",
                    "data-[active=true]:after:absolute",
                    "data-[active=true]:after:bottom-0",
                    "data-[active=true]:after:left-0",
                    "data-[active=true]:after:right-0",
                    "data-[active=true]:after:h-[2px]",
                    "data-[active=true]:after:rounded-[2px]",
                    "data-[active=true]:after:bg-primary",
                ],
            }}
        >
            <NavbarBrand as={Link} to="/" className="gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sunset-blue to-sunset-pink flex items-center justify-center text-white font-bold text-xl shadow-lg invert dark:invert-0">
                    E
                </div>
                <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-default-500">
                    EventFlow
                </span>
            </NavbarBrand>

            <NavbarContent justify="end" className="gap-4">
                {user && (
                    <NavbarItem isActive={isActive("/dashboard")}>
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-2 text-sm font-medium ${isActive("/dashboard") ? "text-primary" : "text-default-500 hover:text-foreground transition-colors"}`}
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                    </NavbarItem>
                )}

                <NavbarItem>
                    <Switch
                        isSelected={isDark}
                        onValueChange={setDark}
                        size="sm"
                        color="secondary"
                        thumbIcon={({ isSelected, className }) =>
                            isSelected ? (
                                <Moon className={className} />
                            ) : (
                                <Sun className={className} />
                            )
                        }
                    />
                </NavbarItem>

                {user ? (
                    <Dropdown placement="bottom-end">
                        <DropdownTrigger>
                            <Avatar
                                isBordered
                                as="button"
                                className="transition-transform"
                                color="primary"
                                name={displayName.charAt(0).toUpperCase()}
                                size="sm"
                                src={avatarUrl}
                            />
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label="Profile Actions"
                            variant="flat"
                        >
                            <DropdownItem key="profile" className="h-14 gap-2">
                                <p className="font-semibold">Signed in as</p>
                                <p className="font-semibold text-primary truncate max-w-[200px]">
                                    {user.email}
                                </p>
                            </DropdownItem>
                            <DropdownItem
                                key="dashboard"
                                href="/dashboard"
                                startContent={
                                    <LayoutDashboard className="w-4 h-4" />
                                }
                            >
                                Dashboard
                            </DropdownItem>
                            <DropdownItem
                                key="settings"
                                href="/profile"
                                startContent={<User className="w-4 h-4" />}
                            >
                                My Profile
                            </DropdownItem>
                            {profile?.role === "admin" && (
                                <DropdownItem
                                    key="roles"
                                    href="/admin/roles"
                                    startContent={
                                        <Settings className="w-4 h-4" />
                                    }
                                >
                                    Manage Roles
                                </DropdownItem>
                            )}
                            <DropdownItem
                                key="logout"
                                color="danger"
                                onPress={signOut}
                                startContent={<LogOut className="w-4 h-4" />}
                            >
                                Log Out
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                ) : (
                    <NavbarItem>
                        <Button
                            as={Link}
                            to="/login"
                            color="primary"
                            variant="shadow"
                            className="font-semibold"
                        >
                            Sign In
                        </Button>
                    </NavbarItem>
                )}
            </NavbarContent>
        </HeroNavbar>
    );
}
