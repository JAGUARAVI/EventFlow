import { Link } from 'react-router-dom';
import { Navbar as HeroNavbar, NavbarBrand, NavbarContent, NavbarItem, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Avatar, Button, Switch, Modal, ModalContent, ModalHeader, ModalBody, useDisclosure } from '@heroui/react';
import { Palette } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import ThemeBuilder from '../ThemeBuilder';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { isDark, setDark } = useTheme();
  const { isOpen: isThemeOpen, onOpen: onThemeOpen, onClose: onThemeClose } = useDisclosure();

  const displayName = profile?.display_name || user?.email || 'User';
  const avatarUrl = profile?.avatar_url || '';

  return (
    <>
      <HeroNavbar isBordered maxWidth="xl">
        <NavbarBrand as={Link} to="/">
          <span className="font-bold text-inherit">DesignBattles</span>
        </NavbarBrand>
        <NavbarContent justify="end" className="gap-2">
          <NavbarItem>
            <Link to="/dashboard">Dashboard</Link>
          </NavbarItem>
          <NavbarItem>
            <Button
              size="sm"
              variant="light"
              isIconOnly
              onPress={onThemeOpen}
              aria-label="Customize theme"
            >
              <Palette size={20} />
            </Button>
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
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" variant="flat" className="flex items-center gap-2">
                  <Avatar src={avatarUrl || undefined} name={displayName} size="sm" />
                  <span className="hidden sm:inline">{displayName}</span>
                </Button>
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownItem as={Link} to="/profile">
                  Profile
                </DropdownItem>
                <DropdownItem color="danger" onPress={signOut}>
                  Sign out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          ) : (
            <NavbarItem>
              <Button as={Link} to="/login" size="sm" color="primary">
                Sign in
              </Button>
            </NavbarItem>
          )}
        </NavbarContent>
      </HeroNavbar>

      <Modal isOpen={isThemeOpen} onClose={onThemeClose} size="lg">
        <ModalContent>
          <ModalHeader>Customize Theme</ModalHeader>
          <ModalBody>
            <ThemeBuilder />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
