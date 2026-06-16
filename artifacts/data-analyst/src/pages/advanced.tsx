import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Loader2, ArrowLeft, TrendingUp, AlertTriangle, Grid3x3,
  FileText, Download, RefreshCw, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

const BASE = "/api";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

const CHART_COLORS = { actual: "#00E5FF", fitted: "#6366f1", forecast: "#a78bfa", anomaly: "#ef4444", normal: "#00E5FF" };

// ──── Correlation Heatmap ─────────────────────────────────────────────────────
function CorrelationHeatmap({ columns, matrix }: { columns: string[]; matrix: any[] }) {
  const getColor = (v: number | null) => {
    if (v === null) return "#1e293b";
    const abs = Math.abs(v);
    if (v > 0) return `rgba(0,229,255,${0.1 + abs * 0.9})`;
    return `rgba(239,68,68,${0.1 + abs * 0.9})`;
  };
  const cellMap: Record<string, number | null> = {};
  matrix.forEach((m) => { cellMap[`${m.x}||${m.y}`] = m.value; });

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Column headers */}
        <div className="flex ml-24">
          {columns.map((c) => (
            <div key={c} className="w-16 shrink-0 text-center text-[10px] text-muted-foreground truncate px-0.5 py-1 -rotate-45 origin-bottom-left h-16 flex items-end">
              {c}
            </div>
          ))}
        </div>
        {/* Rows */}
        {columns.map((rowCol) => (
          <div key={rowCol} className="flex items-center">
            <div className="w-24 shrink-0 text-[10px] text-muted-foreground truncate text-right pr-2">{rowCol}</div>
            {columns.map((colCol) => {
              const val = cellMap[`${rowCol}||${colCol}`] ?? null;
              return (
                <div
                  key={colCol}
                  className="w-16 h-10 shrink-0 flex items-center justify-center text-[10px] font-mono border border-background/20 cursor-default transition-opacity hover:opacity-80"
                  style={{ backgroundColor: getColor(val) }}
                  title={`${rowCol} ↔ ${colCol}: ${val?.toFixed(3) ?? "N/A"}`}
                >
                  {val !== null ? val.toFixed(2) : "—"}
                </div>
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 ml-24 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: "rgba(239,68,68,0.8)" }} /> Strong negative
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: "rgba(30,41,59,1)" }} /> ~0
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: "rgba(0,229,255,0.8)" }} /> Strong positive
          </div>
        </div>
      </div>
    </div>
  );
}

// ──── Main Page ───────────────────────────────────────────────────────────────
export default function AdvancedPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // Forecasting state
  const [forecastCol, setForecastCol] = useState<string>("");
  const [forecastPeriods, setForecastPeriods] = useState(10);
  const [submittedForecast, setSubmittedForecast] = useState({ col: "", periods: 10 });

  // Anomaly state
  const [anomalyCol, setAnomalyCol] = useState<string>("");
  const [anomalyMethod, setAnomalyMethod] = useState("iqr");
  const [submittedAnomaly, setSubmittedAnomaly] = useState({ col: "", method: "iqr" });

  // Exec report state
  const [reportTitle, setReportTitle] = useState("");
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  // Queries
  const forecastParams = new URLSearchParams();
  if (submittedForecast.col) forecastParams.set("column", submittedForecast.col);
  forecastParams.set("periods", String(submittedForecast.periods));

  const anomalyParams = new URLSearchParams();
  if (submittedAnomaly.col) anomalyParams.set("column", submittedAnomaly.col);
  anomalyParams.set("method", submittedAnomaly.method);

  const { data: forecast, isLoading: loadingForecast, error: forecastError } = useQuery({
    queryKey: ["forecast", id, submittedForecast.col, submittedForecast.periods],
    queryFn: () => apiFetch(`/datasets/${id}/forecast?${forecastParams}`),
    enabled: !!id,
  });

  const { data: anomalies, isLoading: loadingAnomalies, error: anomalyError } = useQuery({
    queryKey: ["anomalies", id, submittedAnomaly.col, submittedAnomaly.method],
    queryFn: () => apiFetch(`/datasets/${id}/anomalies?${anomalyParams}`),
    enabled: !!id,
  });

  const { data: correlation, isLoading: loadingCorr, error: corrError } = useQuery({
    queryKey: ["correlation", id],
    queryFn: () => apiFetch(`/datasets/${id}/correlation`),
    enabled: !!id,
  });

  const execReportMutation = useMutation({
    mutationFn: () => apiFetch(`/datasets/${id}/executive-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: reportTitle || undefined }),
    }),
    onSuccess: (data) => {
      setGeneratedReport(data);
      toast.success("Executive report generated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const numericCols: string[] = forecast?.availableColumns ?? anomalies?.availableColumns ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/analysis/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Advanced Analytics</h1>
            <p className="text-muted-foreground text-sm">Forecasting · Anomaly Detection · Correlation · Executive Reports</p>
          </div>
        </div>

        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="forecast" className="gap-2 text-xs sm:text-sm">
              <TrendingUp className="w-4 h-4" /> Forecasting
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-2 text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4" /> Anomalies
            </TabsTrigger>
            <TabsTrigger value="correlation" className="gap-2 text-xs sm:text-sm">
              <Grid3x3 className="w-4 h-4" /> Correlation
            </TabsTrigger>
            <TabsTrigger value="executive" className="gap-2 text-xs sm:text-sm">
              <FileText className="w-4 h-4" /> Exec Report
            </TabsTrigger>
          </TabsList>

          {/* ── Forecasting ─────────────────────────────────────────── */}
          <TabsContent value="forecast" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Time Series Forecasting
                </CardTitle>
                <CardDescription>Linear trend + seasonal decomposition with confidence intervals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Column</Label>
                    <Select value={forecastCol} onValueChange={setForecastCol}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Auto-select" />
                      </SelectTrigger>
                      <SelectContent>
                        {numericCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Forecast Periods</Label>
                    <Input
                      type="number" min={1} max={50}
                      value={forecastPeriods}
                      onChange={(e) => setForecastPeriods(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                  <Button
                    onClick={() => setSubmittedForecast({ col: forecastCol, periods: forecastPeriods })}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Run Forecast
                  </Button>
                </div>

                {loadingForecast && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
                {forecastError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
                    {(forecastError as Error).message}
                  </div>
                )}
                {forecast && !loadingForecast && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <Badge variant="outline">Column: {forecast.column}</Badge>
                      <Badge variant="outline">Method: {forecast.method}</Badge>
                      <Badge variant="outline">R²: {forecast.r2}</Badge>
                      <Badge variant="outline">Slope: {forecast.slope?.toFixed(4)}</Badge>
                    </div>
                    <ResponsiveContainer width="100%" height={340}>
                      <AreaChart data={forecast.data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                        <defs>
                          <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="index" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(v: any) => v != null ? Number(v).toFixed(2) : "—"}
                        />
                        <Legend />
                        <ReferenceLine x={forecast.data.findIndex((d: any) => d.isForecast)} stroke="hsl(var(--border))" strokeDasharray="4 2" label={{ value: "Forecast →", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <Area type="monotone" dataKey="upper" stroke="none" fill="url(#ciGradient)" name="95% CI Upper" legendType="none" />
                        <Area type="monotone" dataKey="lower" stroke="none" fill="hsl(var(--background))" name="95% CI Lower" legendType="none" />
                        <Line type="monotone" dataKey="actual" stroke={CHART_COLORS.actual} dot={false} strokeWidth={2} name="Actual" connectNulls={false} />
                        <Line type="monotone" dataKey="fitted" stroke={CHART_COLORS.forecast} dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="Trend / Forecast" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Anomaly Detection ──────────────────────────────────────── */}
          <TabsContent value="anomalies" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" /> Anomaly Detection
                </CardTitle>
                <CardDescription>Identify outliers using statistical methods</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Column</Label>
                    <Select value={anomalyCol} onValueChange={setAnomalyCol}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Auto-select" />
                      </SelectTrigger>
                      <SelectContent>
                        {numericCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Method</Label>
                    <Select value={anomalyMethod} onValueChange={setAnomalyMethod}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iqr">IQR (Robust)</SelectItem>
                        <SelectItem value="zscore">Z-Score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => setSubmittedAnomaly({ col: anomalyCol, method: anomalyMethod })} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Detect
                  </Button>
                </div>

                {loadingAnomalies && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
                {anomalyError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
                    {(anomalyError as Error).message}
                  </div>
                )}
                {anomalies && !loadingAnomalies && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <Badge variant="outline">Column: {anomalies.column}</Badge>
                      <Badge variant="outline">Method: {anomalies.method}</Badge>
                      <Badge variant="destructive">{anomalies.anomalyCount} anomalies ({anomalies.anomalyPercent}%)</Badge>
                      <Badge variant="outline">{anomalies.totalPoints} total points</Badge>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="index" name="Index" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                        <YAxis dataKey="value" name="Value" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            return (
                              <div className="p-2 text-xs space-y-1">
                                <p>Row: {d?.rowIndex}</p>
                                <p>Value: {d?.value?.toFixed(3)}</p>
                                <p>Score: {d?.score?.toFixed(3)}</p>
                                <p className={d?.isAnomaly ? "text-destructive font-bold" : "text-primary"}>
                                  {d?.isAnomaly ? "⚠ Anomaly" : "Normal"}
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Scatter
                          data={anomalies.data.filter((d: any) => !d.isAnomaly)}
                          fill={CHART_COLORS.normal}
                          fillOpacity={0.6}
                          name="Normal"
                        />
                        <Scatter
                          data={anomalies.data.filter((d: any) => d.isAnomaly)}
                          fill={CHART_COLORS.anomaly}
                          name="Anomaly"
                          shape={(props: any) => <circle {...props} r={6} />}
                        />
                        <Legend />
                      </ScatterChart>
                    </ResponsiveContainer>

                    {anomalies.anomalyCount > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Top Anomalies</p>
                        <div className="overflow-x-auto rounded-md border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Row</th>
                                <th className="px-3 py-2 text-right font-medium">Value</th>
                                <th className="px-3 py-2 text-right font-medium">Anomaly Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {anomalies.data
                                .filter((d: any) => d.isAnomaly)
                                .sort((a: any, b: any) => b.score - a.score)
                                .slice(0, 10)
                                .map((d: any) => (
                                  <tr key={d.rowIndex} className="border-t border-border hover:bg-muted/20">
                                    <td className="px-3 py-1.5 text-muted-foreground">{d.rowIndex}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-destructive">{d.value?.toFixed(3)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{d.score?.toFixed(3)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Correlation ───────────────────────────────────────────── */}
          <TabsContent value="correlation" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4 text-primary" /> Correlation Analysis
                </CardTitle>
                <CardDescription>Pearson correlation heatmap between numeric features</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCorr && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
                {corrError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
                    {(corrError as Error).message}
                  </div>
                )}
                {correlation && !loadingCorr && (
                  <div className="space-y-6">
                    <CorrelationHeatmap columns={correlation.columns} matrix={correlation.matrix} />

                    {correlation.topPairs.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Strongest Correlations</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {correlation.topPairs.slice(0, 8).map((p: any) => {
                            const val = p.correlation;
                            const isStrong = Math.abs(val) >= 0.7;
                            const isMod = Math.abs(val) >= 0.4;
                            return (
                              <div key={`${p.colA}-${p.colB}`} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                                <span className="font-mono text-muted-foreground">{p.colA} ↔ {p.colB}</span>
                                <Badge
                                  variant={isStrong ? "default" : isMod ? "secondary" : "outline"}
                                  className={val > 0 ? "" : "text-destructive border-destructive/50"}
                                >
                                  {val > 0 ? "+" : ""}{val}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Executive Report ──────────────────────────────────────── */}
          <TabsContent value="executive" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Executive Report
                </CardTitle>
                <CardDescription>AI-generated comprehensive report with summary, findings, recommendations, and statistical tables</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Report Title (optional)</Label>
                  <Input
                    placeholder="e.g. Q2 Sales Data — Executive Summary"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="max-w-lg"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {["Executive Summary", "Key Findings", "Strategic Recommendations", "Risks & Limitations", "Column Statistics", "Numeric Summary"].map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>
                  ))}
                </div>

                <Button
                  onClick={() => execReportMutation.mutate()}
                  disabled={execReportMutation.isPending}
                  className="gap-2"
                >
                  {execReportMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><FileText className="w-4 h-4" /> Generate Executive Report</>}
                </Button>

                {generatedReport && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{generatedReport.title}</p>
                        <p className="text-xs text-muted-foreground">Generated {new Date(generatedReport.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <a href={generatedReport.downloadUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="gap-2 shrink-0">
                        <Download className="w-4 h-4" /> Download PDF
                      </Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feature breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: TrendingUp, title: "AI Narrative", desc: "Gemini-powered executive summary, findings, and strategic recommendations tailored to the dataset" },
                { icon: Grid3x3, title: "Statistical Tables", desc: "Column details, numeric summary stats (mean, std, min, max, median) for all features" },
                { icon: AlertTriangle, title: "Data Quality", desc: "Missing values, row count, duplicate detection — everything leadership needs to trust the data" },
                { icon: FileText, title: "Professional PDF", desc: "Beautifully formatted A4 report with cover stats, colour-coded tables, and footer branding" },
              ].map(({ icon: Icon, title, desc }) => (
                <Card key={title} className="border-border bg-card/50">
                  <CardContent className="p-4 flex gap-3">
                    <div className="p-2 rounded bg-primary/10 h-fit shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
