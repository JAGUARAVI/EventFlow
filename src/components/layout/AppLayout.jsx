import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

export default function AppLayout() {
    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1 w-full bg-gradient-to-br from-background via-default-50 to-background dark:from-background dark:via-content1/5 dark:to-background">
                <Outlet />
            </main>
        </div>
    );
}
