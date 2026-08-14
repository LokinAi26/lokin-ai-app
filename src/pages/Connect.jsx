import { useState } from "react";
import { Plug, Copy, Check, Bot, MessageSquare, MousePointer, Code2, ExternalLink } from "lucide-react";

const SERVER_URL = new URL("/api/mcp", window.location.origin).toString();

const CLIENTS = [
  {
    key: "chatgpt",
    label: "ChatGPT",
    icon: MessageSquare,
    color: "text-primary",
    steps: [
      "Open ChatGPT → Apps → enable Developer mode (accept the risk ChatGPT warns about).",
      "Click “Create app” and name it (e.g. LOKIN AI).",
      "Paste the MCP server URL below, then Create.",
      "Enable the app from the chat composer before prompting it.",
      "Approve: ChatGPT opens LOKIN’s consent page — sign in with your LOKIN account and approve. The assistant only ever acts as you.",
    ],
  },
  {
    key: "claude",
    label: "Claude",
    icon: Bot,
    color: "text-accent",
    steps: [
      "Open Claude → profile menu → Settings → Connectors.",
      "Click “Add custom connector”.",
      "Name it (e.g. LOKIN AI), paste the MCP server URL below, then Add.",
      "Approve: Claude opens LOKIN’s consent page — sign in with your LOKIN account and approve. The assistant only ever acts as you.",
    ],
  },
  {
    key: "cursor",
    label: "Cursor",
    icon: MousePointer,
    color: "text-primary",
    steps: [
      "Open Cursor → Settings → Tools & Integrations → “New MCP Server”.",
      "In mcp.json add an entry whose `url` is the MCP server URL below.",
      "Save and toggle it on.",
      "Approve: Cursor opens LOKIN’s consent page — sign in with your LOKIN account and approve. The assistant only ever acts as you.",
    ],
  },
  {
    key: "custom",
    label: "Custom",
    icon: Code2,
    color: "text-white/70",
    steps: [
      "Copy the MCP server URL below.",
      "Add it as a streamable HTTP MCP server in your client — name + URL is all most need.",
      "Reload the client.",
      "Approve the consent page with your LOKIN account. The assistant only ever acts as you.",
    ],
  },
];

export default function Connect() {
  const [tab, setTab] = useState("chatgpt");
  const [copied, setCopied] = useState(false);
  const active = CLIENTS.find((c) => c.key === tab);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SERVER_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="p-4 space-y-5 pb-6">
      <div className="flex items-center gap-2">
        <Plug className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold font-heading metal-text">Connect AI Clients</h1>
      </div>
      <p className="text-sm text-white/45 -mt-3">
        Link ChatGPT, Claude, or Cursor to LOKIN AI so your assistant can read your offers, earnings, and route tools — acting only as you.
      </p>

      {/* Server URL card */}
      <div className="rounded-2xl border border-accent/30 bg-black glow-cyan p-4">
        <div className="text-[11px] tracking-[0.18em] text-accent/80 font-display mb-2">MCP SERVER URL</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-primary font-mono">
            {SERVER_URL}
          </code>
          <button onClick={copy} className="shrink-0 h-10 w-10 rounded-lg border border-accent/40 bg-accent/10 text-accent flex items-center justify-center active:scale-95">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="text-[10px] text-white/40 mt-2">OAuth · each client signs in with your LOKIN account on the consent page.</div>
      </div>

      {/* Client tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {CLIENTS.map((c) => (
          <button key={c.key} onClick={() => setTab(c.key)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition-all ${tab === c.key ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.03] text-white/55"}`}>
            <c.icon className="h-4 w-4" /> {c.label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-5 space-y-4">
        <div className="flex items-center gap-2">
          <active.icon className={`h-5 w-5 ${active.color}`} />
          <h2 className="text-base font-semibold text-white">{active.label} setup</h2>
        </div>
        <ol className="space-y-3">
          {active.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <span className="text-sm text-white/75 leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-start gap-2">
          <ExternalLink className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-white/55">
            After we ship changes, refresh or re-add the connector — assistants cache the tool list, so new tools only appear after a refresh.
          </p>
        </div>
      </div>

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30">
        LOKIN AI · DRIVE SAFER. WORK SMARTER. LIVE SIMPLER.
      </div>
    </div>
  );
}