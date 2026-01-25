import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import RadiantPatches from "./RadiantPatches";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative">
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-background via-default-50 to-background dark:from-background dark:via-content1/5 dark:to-background pointer-events-none" />
      <RadiantPatches />
      <Navbar />
      <main className="flex-1 w-full relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
