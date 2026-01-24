import { Link } from 'react-router-dom';
import { Navbar as HeroNavbar, NavbarBrand, NavbarContent, NavbarItem } from '@heroui/react';
import { Button } from '@heroui/react';
import { Switch } from '@heroui/react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { isDark, setDark } = useTheme();

  return (
    <HeroNavbar isBordered maxWidth="xl">
      <NavbarBrand as={Link} to="/">
        <span className="font-bold text-inherit">DesignBattles</span>
      </NavbarBrand>
      <NavbarContent justify="end" className="gap-2">
        <NavbarItem>
          <Link to="/dashboard">Dashboard</Link>
        </NavbarItem>
        <NavbarItem>
          <Switch
            isSelected={isDark}
            onValueChange={setDark}
            size="sm"
            aria-label="Dark mode"
          />
        </NavbarItem>
        {user ? (
          <NavbarItem>
            <Button size="sm" color="default" variant="flat" onPress={signOut}>
              Sign out
            </Button>
          </NavbarItem>
        ) : (
          <NavbarItem>
            <Button as={Link} to="/login" size="sm" color="primary">
              Sign in
            </Button>
          </NavbarItem>
        )}
      </NavbarContent>
    </HeroNavbar>
  );
}
