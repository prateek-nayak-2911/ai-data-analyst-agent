import React, { useState } from "react";
import { 
  useListReports, 
  useGenerateReport,
  useListDatasets,
  getListReportsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText, Download, Loader2, Plus, Database, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ReportsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [datasetId, setDatasetId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeInsights, setIncludeInsights] = useState(true);
  const [includeKpis, setIncludeKpis] = useState(true);

  const { data: reports, isLoading: loadingReports } = useListReports();
  const { data: datasets, isLoading: loadingDatasets } = useListDatasets();
  
  const generateMutation = useGenerateReport({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        toast({ title: "Report generated successfully" });
        setIsDialogOpen(false);
        resetForm();
      },
      onError: () => {
        toast({ title: "Failed to generate report", variant: "destructive" });
      }
    }
  });

  const resetForm = () => {
    setDatasetId("");
    setTitle("");
    setIncludeCharts(true);
    setIncludeInsights(true);
    setIncludeKpis(true);
  };

  const handleGenerate = () => {
    if (!datasetId) {
      toast({ title: "Please select a dataset", variant: "destructive" });
      return;
    }
    
    generateMutation.mutate({
      id: datasetId,
      data: {
        title: title || undefined,
        includeCharts,
        includeInsights,
        includeKpis
      }
    });
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 flex flex-col gap-8 h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Intelligence Reports</h1>
          <p className="text-muted-foreground mt-1">Generate comprehensive PDF reports from your datasets.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 shadow-md">
              <Plus className="w-4 h-4 mr-2" /> New Report
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Generate Analysis Report</DialogTitle>
              <DialogDescription>
                Select a dataset and choose which analysis modules to include in the PDF.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="dataset">Source Dataset</Label>
                <Select value={datasetId} onValueChange={setDatasetId} disabled={loadingDatasets || !datasets?.length}>
                  <SelectTrigger id="dataset" className="bg-muted/50">
                    <SelectValue placeholder={
                      loadingDatasets ? "Loading..." : 
                      !datasets?.length ? "No datasets available" : 
                      "Select a dataset"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {datasets?.map(ds => (
                      <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="title">Report Title (Optional)</Label>
                <Input 
                  id="title" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="e.g. Q3 Sales Analysis" 
                  className="bg-muted/50"
                />
              </div>

              <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                <h4 className="text-sm font-medium text-foreground">Include Modules</h4>
                
                <div className="flex items-center space-x-2">
                  <Checkbox id="kpis" checked={includeKpis} onCheckedChange={(c) => setIncludeKpis(!!c)} />
                  <Label htmlFor="kpis" className="text-sm font-normal cursor-pointer">KPI Metrics & Summary</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox id="charts" checked={includeCharts} onCheckedChange={(c) => setIncludeCharts(!!c)} />
                  <Label htmlFor="charts" className="text-sm font-normal cursor-pointer">Data Visualizations</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox id="insights" checked={includeInsights} onCheckedChange={(c) => setIncludeInsights(!!c)} />
                  <Label htmlFor="insights" className="text-sm font-normal cursor-pointer">AI Generated Insights</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={generateMutation.isPending}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending || !datasetId}>
                {generateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Generate PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1">
        {loadingReports ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <Card key={report.id} className="flex flex-col overflow-hidden hover:shadow-md transition-all border-border/60 bg-card group">
                <CardHeader className="bg-muted/30 pb-4 border-b border-border/40">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2 text-primary">
                      <FileText className="w-5 h-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">PDF</Badge>
                  </div>
                  <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">{report.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 mt-1 text-xs">
                    <Database className="w-3 h-3" /> <span className="truncate">{report.datasetName}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="py-4 flex-1">
                  <div className="text-sm text-muted-foreground flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider font-semibold opacity-70">Generated</span>
                    <span>{format(new Date(report.createdAt), 'MMM dd, yyyy • HH:mm')}</span>
                  </div>
                </CardContent>
                <CardFooter className="p-0 border-t border-border/40 bg-muted/10">
                  <a href={report.downloadUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button variant="ghost" className="w-full rounded-none h-12 text-primary hover:text-primary hover:bg-primary/5 justify-between px-6">
                      <span className="font-medium">Download Report</span>
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed rounded-xl bg-muted/10 max-w-2xl mx-auto mt-12">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Reports Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Generate comprehensive PDF reports combining KPI metrics, visualizations, and AI insights from your uploaded datasets.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="border-primary/30 hover:bg-primary/5">
              <Plus className="w-4 h-4 mr-2 text-primary" /> Generate First Report
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Internal temporary stub for Badge to avoid breaking if not exported in ui
function Badge({ className, variant = "default", ...props }: any) {
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variant === 'outline' ? 'text-foreground' : 'border-transparent bg-primary text-primary-foreground'} ${className}`} {...props} />
  )
}
