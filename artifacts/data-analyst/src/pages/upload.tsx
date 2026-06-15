import React, { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileSpreadsheet, Trash2, Loader2, ArrowRight } from "lucide-react";
import { 
  useListDatasets, 
  useDeleteDataset, 
  getListDatasetsQueryKey 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: datasets, isLoading: isLoadingDatasets } = useListDatasets();
  const deleteDataset = useDeleteDataset();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.match(/\.xlsx?$/)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/datasets/upload', { 
        method: 'POST', 
        body: formData 
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      const dataset = await res.json();
      
      queryClient.invalidateQueries({ queryKey: getListDatasetsQueryKey() });
      toast({
        title: "Upload successful",
        description: `${file.name} has been processed.`,
      });
      
      setLocation(`/analysis/${dataset.id}`);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDataset.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDatasetsQueryKey() });
        toast({ title: "Dataset deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete dataset", variant: "destructive" });
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 flex flex-col gap-8 h-full overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Data Intelligence</h1>
        <p className="text-muted-foreground">Upload your dataset to instantly generate insights, charts, and a smart chat interface.</p>
      </div>

      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="p-0">
          <label 
            className={`flex flex-col items-center justify-center w-full h-64 cursor-pointer transition-colors ${
              isDragging ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {isUploading ? (
                <>
                  <Loader2 className="w-10 h-10 mb-4 text-primary animate-spin" />
                  <p className="mb-2 text-sm font-semibold">Uploading and analyzing...</p>
                  <p className="text-xs text-muted-foreground">This might take a moment.</p>
                </>
              ) : (
                <>
                  <UploadCloud className={`w-10 h-10 mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="mb-2 text-sm font-semibold">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">CSV or Excel files only</p>
                </>
              )}
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept=".csv,.xlsx,.xls" 
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Recent Datasets</h2>
        {isLoadingDatasets ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : datasets && datasets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((dataset) => (
              <Card 
                key={dataset.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => setLocation(`/analysis/${dataset.id}`)}
              >
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
                    <CardTitle className="text-base truncate" title={dataset.name}>
                      {dataset.name}
                    </CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDelete(dataset.id, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Rows: {dataset.rowCount.toLocaleString()}</span>
                      <span>Cols: {dataset.columnCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Size: {formatFileSize(dataset.fileSize)}</span>
                      <span>{formatDistanceToNow(new Date(dataset.uploadedAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-primary text-sm font-medium">
                    Analyze dataset <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed rounded-lg bg-muted/10">
            <p className="text-muted-foreground">No datasets uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
