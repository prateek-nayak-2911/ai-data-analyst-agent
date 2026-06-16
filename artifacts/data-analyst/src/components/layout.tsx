import React from "react";
import { Link, useLocation } from "wouter";
import { 
  BarChart2, 
  MessageSquare, 
  Upload, 
  FileText, 
  Moon, 
  Sun,
  Database,
  LayoutDashboard,
  LogOut,
  Zap
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  const match = location.match(/\/(analysis|chat|advanced)\/([^\/]+)/);
  const currentDatasetId = match ? match[2] : null;

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/", label: "Upload & Datasets", icon: Upload },
    { 
      href: currentDatasetId ? `/analysis/${currentDatasetId}` : "#", 
      label: "Analysis", 
      icon: BarChart2,
      disabled: !currentDatasetId
    },
    { 
      href: currentDatasetId ? `/chat/${currentDatasetId}` : "#", 
      label: "AI Chat", 
      icon: MessageSquare,
      disabled: !currentDatasetId
    },
    { 
      href: currentDatasetId ? `/advanced/${currentDatasetId}` : "#", 
      label: "Advanced Analytics", 
      icon: Zap,
      disabled: !currentDatasetId
    },
    { href: "/reports", label: "Reports", icon: FileText },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col justify-between hidden md:flex shrink-0">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-8 px-2">
            <Database className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">DataAgent</span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = 
                item.href === "/"
                  ? location === "/"
                  : item.href !== "#" && (location === item.href || location.startsWith(item.href));
              
              if (item.disabled) {
                return (
                  <div key={item.label} className="flex items-center gap-3 px-3 py-2 text-muted-foreground opacity-50 cursor-not-allowed rounded-md">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                );
              }
              
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                    isActive 
                      ? "bg-sidebar-primary/10 text-sidebar-primary" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}>
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-sidebar-border space-y-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start gap-2"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-auto py-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className="text-xs font-medium truncate w-full text-left">{displayName}</span>
                    <span className="text-[10px] text-muted-foreground truncate w-full text-left">{user.email}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-52">
                <Link href="/dashboard">
                  <DropdownMenuItem className="cursor-pointer gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
