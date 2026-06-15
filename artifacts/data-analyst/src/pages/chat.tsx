import React, { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetDataset, 
  useChatWithDataset, 
  useGetChatHistory, 
  useClearChatHistory,
  getGetChatHistoryQueryKey,
  getGetDatasetQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Trash2, Loader2, ArrowLeft, Database, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [message, setMessage] = useState("");

  const { data: dataset, isLoading: loadingDataset } = useGetDataset(id, { 
    query: { enabled: !!id, queryKey: getGetDatasetQueryKey(id) } 
  });
  
  const { data: history, isLoading: loadingHistory } = useGetChatHistory(id, {
    query: { enabled: !!id, queryKey: getGetChatHistoryQueryKey(id) }
  });

  const chatMutation = useChatWithDataset({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey(id) });
      },
      onError: () => {
        toast({ title: "Failed to send message", variant: "destructive" });
      }
    }
  });

  const clearMutation = useClearChatHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey(id) });
        toast({ title: "Chat history cleared" });
      }
    }
  });

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, chatMutation.isPending]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || chatMutation.isPending) return;

    chatMutation.mutate({ id, data: { message } });
    setMessage("");
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the chat history?")) {
      clearMutation.mutate({ id });
    }
  };

  if (loadingDataset) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background">
        <h2 className="text-2xl font-bold">Dataset not found</h2>
        <Link href="/">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Upload</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <header className="flex-none h-16 border-b border-border bg-card flex items-center justify-between px-6 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/analysis/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight text-foreground">{dataset.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{dataset.rowCount.toLocaleString()} rows</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-destructive"
            onClick={handleClear}
            disabled={!history || history.length === 0 || clearMutation.isPending}
          >
            {clearMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Clear Chat
          </Button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative bg-muted/10" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] pointer-events-none" />
        
        <ScrollArea className="h-full px-4 relative z-10" ref={scrollRef}>
          <div className="max-w-4xl mx-auto py-8 space-y-6">
            
            {loadingHistory ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : history && history.length > 0 ? (
              history.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <Avatar className="w-8 h-8 border border-primary/20 bg-primary/10 mt-1">
                      <AvatarFallback className="bg-transparent text-primary"><Bot className="w-4 h-4" /></AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-card text-card-foreground border border-border/50 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1 opacity-60">
                      {format(new Date(msg.createdAt), 'HH:mm')}
                    </span>
                  </div>

                  {msg.role === 'user' && (
                    <Avatar className="w-8 h-8 border border-border bg-muted mt-1">
                      <AvatarFallback className="bg-transparent"><User className="w-4 h-4" /></AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 shadow-inner">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">AI Data Assistant</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                  I'm ready to answer questions about <span className="font-mono text-foreground bg-muted px-1 py-0.5 rounded">{dataset.name}</span>. 
                  Ask me about correlations, trends, anomalies, or specific stats.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full">
                  {["What are the top 5 values in this dataset?", "Are there any strong correlations?", "Summarize the key metrics."].map((suggestion, i) => (
                    <button 
                      key={i}
                      onClick={() => setMessage(suggestion)}
                      className="text-left px-4 py-3 text-sm bg-card hover:bg-accent hover:text-accent-foreground border border-border/50 rounded-lg transition-colors shadow-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMutation.isPending && (
              <div className="flex gap-4 justify-start">
                <Avatar className="w-8 h-8 border border-primary/20 bg-primary/10 mt-1">
                  <AvatarFallback className="bg-transparent text-primary"><Bot className="w-4 h-4" /></AvatarFallback>
                </Avatar>
                <div className="bg-card text-card-foreground border border-border/50 px-4 py-4 rounded-2xl rounded-tl-sm flex items-center gap-1 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 bg-card border-t border-border z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSend} className="relative flex items-center">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask anything about your data..."
              className="pr-14 py-6 bg-background/50 border-input shadow-inner text-base rounded-xl focus-visible:ring-primary focus-visible:border-primary"
              disabled={chatMutation.isPending}
            />
            <Button 
              type="submit" 
              size="icon"
              className="absolute right-2 h-10 w-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all"
              disabled={!message.trim() || chatMutation.isPending}
            >
              {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
            </Button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">AI Assistant uses advanced analytics context</span>
          </div>
        </div>
      </div>
    </div>
  );
}
