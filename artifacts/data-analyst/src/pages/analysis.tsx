import React from "react";
import { useParams, Link } from "wouter";
import { 
  useGetDataset, 
  useGetDatasetOverview, 
  useGetDatasetCharts, 
  useGetDatasetKpis, 
  useGetDatasetInsights,
  getGetDatasetQueryKey,
  getGetDatasetOverviewQueryKey,
  getGetDatasetChartsQueryKey,
  getGetDatasetKpisQueryKey,
  getGetDatasetInsightsQueryKey
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, TrendingUp, TrendingDown, Minus, ArrowLeft, BrainCircuit, 
  TableProperties, BarChart3, Target, Lightbulb
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const CHART_COLORS = ['#00E5FF', '#3366FF', '#9933FF', '#FF3399', '#FFB800'];

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: dataset, isLoading: loadingDataset } = useGetDataset(id, { 
    query: { enabled: !!id, queryKey: getGetDatasetQueryKey(id) } 
  });
  const { data: overview, isLoading: loadingOverview } = useGetDatasetOverview(id, { 
    query: { enabled: !!id, queryKey: getGetDatasetOverviewQueryKey(id) } 
  });
  const { data: charts, isLoading: loadingCharts } = useGetDatasetCharts(id, { 
    query: { enabled: !!id, queryKey: getGetDatasetChartsQueryKey(id) } 
  });
  const { data: kpis, isLoading: loadingKpis } = useGetDatasetKpis(id, { 
    query: { enabled: !!id, queryKey: getGetDatasetKpisQueryKey(id) } 
  });
  const { data: insights, isLoading: loadingInsights } = useGetDatasetInsights(id, { 
    query: { enabled: !!id, queryKey: getGetDatasetInsightsQueryKey(id) } 
  });

  if (loadingDataset) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Dataset not found</h2>
        <Link href="/">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Upload</Button>
        </Link>
      </div>
    );
  }

  const renderChart = (config: any) => {
    switch (config.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={config.data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey={config.xAxis} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey={config.yAxis} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={config.data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey={config.xAxis} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey={config.yAxis} stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--background))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={config.data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey={config.yAxis}
                nameKey={config.xAxis}
              >
                {config.data.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" dataKey={config.xAxis} name={config.xAxis} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
              <YAxis type="number" dataKey={config.yAxis} name={config.yAxis} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} />
              <Scatter name="Data" data={config.data} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      default:
        return <div>Unsupported chart type: {config.chartType}</div>;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {dataset.name}
            <Badge variant="secondary" className="font-mono text-xs ml-2">{dataset.rowCount.toLocaleString()} rows</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            {dataset.columnCount} columns | {(dataset.fileSize / 1024).toFixed(1)} KB
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/chat/${id}`}>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <BrainCircuit className="w-4 h-4 mr-2" /> Ask AI
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl mb-8">
            <TabsTrigger value="overview"><TableProperties className="w-4 h-4 mr-2"/> Overview</TabsTrigger>
            <TabsTrigger value="kpis"><Target className="w-4 h-4 mr-2"/> KPIs</TabsTrigger>
            <TabsTrigger value="charts"><BarChart3 className="w-4 h-4 mr-2"/> Charts</TabsTrigger>
            <TabsTrigger value="insights"><Lightbulb className="w-4 h-4 mr-2"/> Insights</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            {loadingOverview ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : overview ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Missing Cells</CardDescription>
                      <CardTitle className="text-2xl">{overview.missingCells.toLocaleString()}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">{overview.missingPercent?.toFixed(2)}% of total data</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Duplicate Rows</CardDescription>
                      <CardTitle className="text-2xl">{overview.duplicateRows.toLocaleString()}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Numeric Columns</CardDescription>
                      <CardTitle className="text-2xl">{overview.numericColumns}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Categorical Columns</CardDescription>
                      <CardTitle className="text-2xl">{overview.categoricalColumns}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Column Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-semibold rounded-tl-md">Name</th>
                            <th className="px-4 py-3 font-semibold">Type</th>
                            <th className="px-4 py-3 font-semibold">Missing</th>
                            <th className="px-4 py-3 font-semibold">Unique</th>
                            <th className="px-4 py-3 font-semibold">Min</th>
                            <th className="px-4 py-3 font-semibold rounded-tr-md">Max</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {overview.columns.map((col, i) => (
                            <tr key={i} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{col.name}</td>
                              <td className="px-4 py-3 font-mono text-xs"><Badge variant="outline">{col.dtype}</Badge></td>
                              <td className="px-4 py-3">{col.nullCount}</td>
                              <td className="px-4 py-3">{col.uniqueCount}</td>
                              <td className="px-4 py-3 text-muted-foreground">{col.min !== null && col.min !== undefined ? String(col.min).substring(0, 15) : '-'}</td>
                              <td className="px-4 py-3 text-muted-foreground">{col.max !== null && col.max !== undefined ? String(col.max).substring(0, 15) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center p-12 text-muted-foreground">No overview data available.</div>
            )}
          </TabsContent>

          <TabsContent value="kpis" className="space-y-6">
            {loadingKpis ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : kpis && kpis.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {kpis.map((kpi) => (
                  <Card key={kpi.id} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardDescription className="font-medium text-foreground">{kpi.label}</CardDescription>
                      <CardTitle className="text-3xl font-mono">{kpi.value}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center mt-2 text-sm">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">{kpi.column}</span>
                        {kpi.change !== undefined && kpi.change !== null && (
                          <div className={`flex items-center gap-1 font-medium ${
                            kpi.trend === 'up' ? 'text-green-500' : 
                            kpi.trend === 'down' ? 'text-red-500' : 'text-gray-500'
                          }`}>
                            {kpi.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : 
                             kpi.trend === 'down' ? <TrendingDown className="w-4 h-4" /> : 
                             <Minus className="w-4 h-4" />}
                            {Math.abs(kpi.change)}%
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                No KPIs automatically detected for this dataset.
              </div>
            )}
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            {loadingCharts ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : charts && charts.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {charts.map((chart) => (
                  <Card key={chart.id} className="overflow-hidden border-border/50 bg-card/50">
                    <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
                      <CardTitle className="text-lg">{chart.title}</CardTitle>
                      {chart.description && <CardDescription>{chart.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="pt-6">
                      {renderChart(chart)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                No charts generated for this dataset yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            {loadingInsights ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : insights ? (
              <div className="space-y-6">
                {insights.keyFindings && insights.keyFindings.length > 0 && (
                  <Card className="border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.05)]">
                    <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                      <CardTitle className="flex items-center text-primary">
                        <BrainCircuit className="w-5 h-5 mr-2" /> Key Findings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ul className="space-y-3">
                        {insights.keyFindings.map((finding, i) => (
                          <li key={i} className="flex gap-3">
                            <div className="mt-1 bg-primary/20 text-primary w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0">{i+1}</div>
                            <span className="text-foreground leading-relaxed">{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed AI Analysis</CardTitle>
                    <CardDescription>Generated at {new Date(insights.generatedAt).toLocaleString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                      {insights.insights}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                No AI insights generated yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
