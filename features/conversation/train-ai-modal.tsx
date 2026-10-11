"use client";

import { useState } from "react";
import { Sparkles, X, Brain, CheckCircle2, ShieldCheck, Database } from "lucide-react";
import { toast } from "sonner";

export interface TrainAiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrainAiModal({ open, onOpenChange }: TrainAiModalProps) {
  const [modelTemp, setModelTemp] = useState("0.2");
  const [groundingMode, setGroundingMode] = useState("firstbank-core");
  const [compliancePolicy, setCompliancePolicy] = useState("pci-dss-v4");
  const [trainingStatus, setTrainingStatus] = useState<"idle" | "training" | "completed">("idle");

  if (!open) return null;

  function handleStartTraining() {
    setTrainingStatus("training");
    setTimeout(() => {
      setTrainingStatus("completed");
      toast.success("AI model calibrated with latest FirstBank customer care knowledge artifacts!");
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="train-ai-title"
        className="border-line bg-surface flex w-full max-w-xl flex-col rounded-xl border shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="border-line flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Brain className="size-3.5" />
            </span>
            <div>
              <h2 id="train-ai-title" className="text-ink text-sm font-semibold">
                Train AI Assistant
              </h2>
              <p className="text-ink-muted text-xs">FIRSTASSIST Response Grounding & Rules</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-ink-subtle hover:text-ink hover:bg-surface-muted rounded-md p-1 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col p-5 gap-4">
          <div className="bg-blue-50/70 border border-blue-200/60 dark:bg-blue-950/20 dark:border-blue-900/40 rounded-lg p-3 text-xs text-blue-900 dark:text-blue-300">
            <p className="font-medium flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-blue-600 shrink-0" />
              FirstBank Enterprise AI Governance
            </p>
            <p className="mt-1 text-blue-800/80 dark:text-blue-400 text-[11px] leading-relaxed">
              Every suggested response is grounded in approved banking SOPs, avoiding hallucinations and strictly enforcing sensitive PII / account masking.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="knowledge-source" className="text-ink font-medium block mb-1">Knowledge Grounding Source:</label>
              <select
                id="knowledge-source"
                value={groundingMode}
                onChange={(e) => setGroundingMode(e.target.value)}
                className="border-line bg-canvas text-ink w-full h-8 rounded-md border px-2.5 outline-none focus:border-blue-500"
              >
                <option value="firstbank-core">FirstBank Core FAQ & Products Catalog (v2026.09)</option>
                <option value="cards-ebanking">E-Banking & Card Dispute Resolutions Handbook</option>
                <option value="protected-email">Microsoft Purview Protected Communication Handler</option>
              </select>
            </div>

            <div>
              <label htmlFor="compliance-preset" className="text-ink font-medium block mb-1">Compliance & Safety Preset:</label>
              <select
                id="compliance-preset"
                value={compliancePolicy}
                onChange={(e) => setCompliancePolicy(e.target.value)}
                className="border-line bg-canvas text-ink w-full h-8 rounded-md border px-2.5 outline-none focus:border-blue-500"
              >
                <option value="pci-dss-v4">Strict Banking Standard (PCI-DSS & NDPR compliant)</option>
                <option value="balanced">Standard Customer Care Response</option>
              </select>
            </div>

            <div>
              <label htmlFor="temperature-slider" className="text-ink font-medium block mb-1">Response Creativity (Temperature):</label>
              <div className="flex items-center gap-3">
                <input
                  id="temperature-slider"
                  type="range"
                  min="0"
                  max="0.7"
                  step="0.1"
                  value={modelTemp}
                  onChange={(e) => setModelTemp(e.target.value)}
                  className="flex-1 accent-blue-600"
                />
                <span className="font-mono text-ink text-xs w-8">{modelTemp}</span>
              </div>
              <p className="text-ink-subtle text-[11px] mt-0.5">Lower temperature ensures predictable, audited banking responses.</p>
            </div>
          </div>

          {trainingStatus === "completed" && (
            <div className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300 rounded-lg p-3 text-xs flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>Model updated and aligned with FIRSTASSIST active queue.</span>
            </div>
          )}

          {/* Footer */}
          <div className="border-line flex items-center justify-between border-t pt-3 mt-1">
            <span className="text-ink-subtle text-[11px] flex items-center gap-1">
              <Database className="size-3" />
              Build 2026.09.28-0408
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-ink-secondary hover:bg-surface-muted rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleStartTraining}
                disabled={trainingStatus === "training"}
                className="bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
              >
                <Sparkles className="size-3.5" />
                {trainingStatus === "training" ? "Calibrating…" : "Calibrate model"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
