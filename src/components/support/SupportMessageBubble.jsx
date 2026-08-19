import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

const STATUS_META = {
  pending: { icon: Loader2, cls: "text-white/45", spin: true, label: "Working" },
  running: { icon: Loader2, cls: "text-accent", spin: true, label: "Running" },
  in_progress: { icon: Loader2, cls: "text-accent", spin: true, label: "In progress" },
  completed: { icon: CheckCircle2, cls: "text-primary", spin: false, label: "Done" },
  success: { icon: CheckCircle2, cls: "text-primary", spin: false, label: "Done" },
  failed: { icon: AlertCircle, cls: "text-destructive", spin: false, label: "Failed" },
  error: { icon: AlertCircle, cls: "text-destructive", spin: false, label: "Error" },
};

function ToolCall({ toolCall }) {
  const [open, setOpen] = useState(false);
  const status = toolCall.status || "pending";
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  const proj = toolCall.display_projection || {};
  const hide = proj.hide_details && proj.details_redacted;
  const label = hide
    ? (["pending", "running", "in_progress"].includes(status) ? proj.active_label : (["failed", "error"].includes(status) ? proj.error_label : proj.label)) || meta.label
    : (proj.label || toolCall.name || "lookup");

  let parsedResults = toolCall.results;
  if (typeof parsedResults === "string") {
    try { parsedResults = JSON.parse(parsedResults); } catch { /* keep raw */ }
  }
  const isFailed = ["failed", "error"].includes(status) || /error|failed/i.test(String(toolCall.results || "")) || parsedResults?.success === false;
  const args = (() => { try { return JSON.parse(toolCall.arguments_string); } catch { return toolCall.arguments_string; } })();

  return (
    <div className="mt-1.5 text-[11px]">
      <button onClick={() => !hide && setOpen((o) => !o)} className="flex items-center gap-1.5 text-white/55">
        {!hide && (open ? <ChevronRight className="h-3 w-3 rotate-90" /> : <ChevronDown className="h-3 w-3" />)}
        <Icon className={`h-3 w-3 ${meta.spin ? "animate-spin" : ""} ${isFailed ? "text-destructive" : meta.cls}`} />
        <span className="font-medium">{label}</span>
      </button>
      {!hide && open && (
        <div className="mt-1 ml-5 space-y-1 rounded-lg border border-white/8 bg-black/30 p-2 text-[10px] text-white/60">
          {args && Object.keys(args || {}).length > 0 && (
            <div><span className="text-white/35">Params:</span> <pre className="whitespace-pre-wrap break-words">{JSON.stringify(args)}</pre></div>
          )}
          {toolCall.results != null && (
            <div><span className="text-white/35">Result:</span> <pre className="whitespace-pre-wrap break-words">{JSON.stringify(parsedResults)}</pre></div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupportMessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser
          ? "bg-primary/15 border border-primary/30 text-white rounded-br-md"
          : "lokin-panel border border-white/10 text-white/90 rounded-bl-md"
      }`}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1">
            <ReactMarkdown>{message.content || ""}</ReactMarkdown>
          </div>
        )}
        {!isUser && Array.isArray(message.tool_calls) && message.tool_calls.map((tc, i) => (
          <ToolCall key={i} toolCall={tc} />
        ))}
      </div>
    </div>
  );
}