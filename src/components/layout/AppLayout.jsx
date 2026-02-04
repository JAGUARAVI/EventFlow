import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import RadiantPatches from "./RadiantPatches";
import PWAInstallPrompt from "../PWAInstallPrompt";
import { Link } from "@heroui/react";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-background via-default-50 to-background dark:from-background dark:via-content1/5 dark:to-background pointer-events-none" />
      <RadiantPatches />
      <Navbar />
      <main className="flex-1 w-full relative z-10">
        <Outlet />
      </main>
      <footer className="w-full py-4 text-center text-sm text-default-500 relative z-10">
        Made with ☕ by <Link isExternal showAnchorIcon href="https://github.com/JAGUARAVI/EventFlow">Team U+2800</Link> during HackIIIT
      </footer>
      <PWAInstallPrompt />
    </div>
  );
}
