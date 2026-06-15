import React from "react";
import { Link, useLocation } from "wouter";
import { 
  BarChart2, 
  MessageSquare, 
  Upload, 
  FileText, 
  Moon, 
  Sun,
  Database
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  // Extract ID from /analysis/:id or /chat/:id
  const match = location.match(/\/(analysis|chat)\/([^\/]+)/);
  const currentDatasetId = match ? match[2] : null;

  const navItems = [
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
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              
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
        <div className="p-4 border-t border-sidebar-border">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start gap-2"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {children}
      </main>
    </div>
  );
}
