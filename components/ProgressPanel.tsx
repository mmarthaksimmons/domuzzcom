"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Circle, Loader2, XCircle, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface StageInfo {
  key: string;
  label: string;
  icon: string;
}

export interface ProgressEvent {
  stage: string;
  message: string;
  progress: number; // 0-100
}

const STAGES: StageInfo[] = [
  { key: "scraping", label: "Fetching property data", icon: "🔍" },
  { key: "normalizing", label: "Processing & cleaning data", icon: "🧹" },
  { key: "ai", label: "Running AI comparison", icon: "🤖" },
];

interface Props {
  /** Called when user wants to cancel */
  onCancel?: () => void;
}

export default function ProgressPanel({ onCancel }: Props) {
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [failedStage, setFailedStage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Starting comparison...");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for progress events from parent via custom events
  useEffect(() => {
    const handler = (e: CustomEvent<ProgressEvent>) => {
      const { stage, message: msg, progress: pct } = e.detail;
      setCurrentStage(stage);
      setMessage(msg);
      setProgress(pct);

      // Mark previous stages as completed
      const stageIdx = STAGES.findIndex((s) => s.key === stage);
      if (stageIdx >= 0) {
        const completed = new Set<string>();
        for (let i = 0; i < stageIdx; i++) {
          completed.add(STAGES[i].key);
        }
        setCompletedStages(completed);
      }
    };

    const doneHandler = () => {
      const completed = new Set(STAGES.map((s) => s.key));
      setCompletedStages(completed);
      setCurrentStage("done");
      setProgress(100);
      setMessage("Comparison complete!");
    };

    const errorHandler = (e: CustomEvent<{ stage: string; message: string }>) => {
      setFailedStage(e.detail.stage);
      setCurrentStage(e.detail.stage);
      setMessage(e.detail.message);
    };

    window.addEventListener("compare-progress", handler as EventListener);
    window.addEventListener("compare-done", doneHandler as EventListener);
    window.addEventListener("compare-error", errorHandler as EventListener);

    return () => {
      window.removeEventListener("compare-progress", handler as EventListener);
      window.removeEventListener("compare-done", doneHandler as EventListener);
      window.removeEventListener("compare-error", errorHandler as EventListener);
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getStageStatus = (stageKey: string) => {
    if (failedStage === stageKey) return "error";
    if (completedStages.has(stageKey)) return "complete";
    if (currentStage === stageKey) return "active";
    return "pending";
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/10">
      {/* Progress bar */}
      <div className="h-1.5 bg-muted relative">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
        {progress > 0 && progress < 100 && (
          <div
            className="absolute top-0 h-full w-20 bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-shimmer"
            style={{ left: `${progress}%`, transform: "translateX(-50%)" }}
          />
        )}
      </div>

      <CardContent className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div>
            <h3 className="font-semibold text-base sm:text-lg text-foreground">Comparing Properties</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{message}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
              ⏱️ This comparison may take up to 2 minutes to complete. Please do not close this page.
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-mono tabular-nums">{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* Stages */}
        <div className="space-y-0.5">
          {STAGES.map((stage, idx) => {
            const status = getStageStatus(stage.key);

            return (
              <div
                key={stage.key}
                className={`flex items-center gap-2 sm:gap-3 py-2.5 px-2 sm:px-3 rounded-lg transition-all duration-300 ${
                  status === "active"
                    ? "bg-primary/5 border border-primary/20 scale-[1.02]"
                    : status === "complete"
                    ? "bg-transparent"
                    : "bg-transparent"
                }`}
              >
                {/* Status icon */}
                <div className="flex-shrink-0 w-5 sm:w-7 flex items-center justify-center">
                  {status === "complete" && (
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                  )}
                  {status === "active" && (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-spin" />
                  )}
                  {status === "error" && (
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                  )}
                  {status === "pending" && (
                    <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/30" />
                  )}
                </div>

                {/* Stage icon + label */}
                <span
                  className={`text-base sm:text-lg flex-shrink-0 transition-opacity duration-300 ${
                    status === "pending" ? "opacity-30" : "opacity-100"
                  }`}
                >
                  {stage.icon}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs sm:text-sm font-medium transition-colors duration-300 ${
                      status === "active"
                        ? "text-primary"
                        : status === "complete"
                        ? "text-foreground"
                        : status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground/50"
                    }`}
                  >
                    {stage.label}
                  </p>
                  {status === "active" && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 animate-pulse">
                      {message}
                    </p>
                  )}
                </div>

                {/* Connector line (except last item) */}
                {idx < STAGES.length - 1 && (
                  <div className="flex-shrink-0 w-4 sm:w-5 flex justify-center">
                    <ChevronRight
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-colors duration-300 ${
                        completedStages.has(stage.key)
                          ? "text-emerald-400"
                          : "text-muted-foreground/20"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Cancel button */}
        {onCancel && currentStage !== "done" && !failedStage && (
          <div className="mt-6 pt-4 border-t flex justify-center">
            <button
              onClick={onCancel}
              className="text-sm text-muted-foreground hover:text-destructive transition-colors underline underline-offset-4"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Error state */}
        {failedStage && (
          <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium">Error during {failedStage}</p>
            <p className="text-xs text-destructive/80 mt-1">{message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}