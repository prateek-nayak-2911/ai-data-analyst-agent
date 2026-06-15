import React from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useListDatasets } from "@workspace/api-client-react";
import { useListReports } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, BarChart3, MessageSquare, FileText, 
  Database, TrendingUp, Clock, User
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: datasets = [] } = useListDatasets();
  const { data: reports = [] } = useListReports();

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const recentDatasets = [...datasets].slice(0, 5);
  const recentReports = [...reports].slice(0, 3);

  const stats = [
    { label: "Datasets", value: datasets.length, icon: Database, href: "/" },
    { label: "Reports", value: reports.length, icon: FileText, href: "/reports" },
    { label: "Total Rows", value: datasets.reduce((s, d) => s + (d.rowCount ?? 0), 0).toLocaleString(), icon: TrendingUp, href: "/" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {displayName} 👋</h1>
            <p className="text-muted-foreground text-sm mt-1">{user?.email}</p>
          </div>
          <Link href="/">
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Dataset
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href}>
                <Card className="border-border bg-card hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/">
              <Card className="border-border bg-card hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <Upload className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Upload & Analyze</p>
                    <p className="text-xs text-muted-foreground">CSV or Excel files</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/reports">
              <Card className="border-border bg-card hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">View Reports</p>
                    <p className="text-xs text-muted-foreground">Generated PDF reports</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Recent Datasets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Project History</h2>
            <Link href="/">
              <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </div>
          {recentDatasets.length === 0 ? (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No datasets yet. Upload your first CSV or Excel file to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentDatasets.map((dataset) => (
                <Card key={dataset.id} className="border-border bg-card hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 rounded bg-primary/10 shrink-0">
                          <Database className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{dataset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {dataset.rowCount?.toLocaleString()} rows · {dataset.columnCount} cols
                            {dataset.uploadedAt ? ` · ${formatDistanceToNow(new Date(dataset.uploadedAt), { addSuffix: true })}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Link href={`/analysis/${dataset.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                            <BarChart3 className="w-3 h-3" />
                            Analyze
                          </Button>
                        </Link>
                        <Link href={`/chat/${dataset.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                            <MessageSquare className="w-3 h-3" />
                            Chat
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Reports */}
        {recentReports.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Reports</h2>
              <Link href="/reports">
                <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
              </Link>
            </div>
            <div className="space-y-2">
              {recentReports.map((report) => (
                <Card key={report.id} className="border-border bg-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded bg-primary/10 shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{report.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {report.datasetName}
                          {report.createdAt ? ` · ${formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}` : ""}
                        </p>
                      </div>
                    </div>
                    {report.downloadUrl && (
                      <a href={report.downloadUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0 ml-3">
                          Download
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
