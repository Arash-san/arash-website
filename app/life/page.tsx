"use client";

import Image from "next/image";
import Checkbox from "@atlaskit/checkbox";
import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ClockIcon from "@atlaskit/icon/core/clock";
import CloseIcon from "@atlaskit/icon/core/close";
import EmailIcon from "@atlaskit/icon/core/email";
import HomeIcon from "@atlaskit/icon/core/home";
import InboxIcon from "@atlaskit/icon/core/inbox";
import MicrophoneIcon from "@atlaskit/icon/core/microphone";
import NotificationIcon from "@atlaskit/icon/core/notification";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import SearchIcon from "@atlaskit/icon/core/search";
import SettingsIcon from "@atlaskit/icon/core/settings";
import TargetIcon from "@atlaskit/icon/core/target";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import greetingPayload from "@/public/life/greetings.json";
import "./life.css";

type Mode = "balanced" | "focus" | "social" | "recovery";
type Priority = "critical" | "high" | "normal";
type Theme = "dark" | "light";
type TaskKind = "work" | "health" | "social";

type Task = {
  id: string;
  title: string;
  detail: string;
  source: string;
  meta: string;
  priority: Priority;
  done: boolean;
  active?: boolean;
  kind: TaskKind;
};

type AgentMessage = { role: "agent" | "arash"; text: string };
type AgentStep = { label: string; detail: string; state: "done" | "working" | "needs-you" };
type GreetingPeriod = "morning" | "afternoon" | "evening" | "late-night";
type GreetingProgress = "stuck" | "moving" | "clear";
type Greeting = { id: string; period: GreetingPeriod; mode: Mode; progress: GreetingProgress; headline: string; nudge: string };

const greetings = greetingPayload.items as Greeting[];

const initialTasks: Task[] = [
  { id: "meeting", title: "Prepare for the supervisor meeting", detail: "Review yesterday's results and write three questions before noon.", source: "Outlook", meta: "Today at 12:00 PM / 20 min", priority: "critical", done: false, kind: "work" },
  { id: "recording", title: "Finish the reflective report recording", detail: "Canvas says this exists. Canvas has declined to do it for you.", source: "Canvas", meta: "Today / 35 min", priority: "high", done: false, kind: "work" },
  { id: "messages", title: "Reply to the people you accidentally ghosted", detail: "Open the actual threads, see who is waiting, and answer with context instead of guilt.", source: "Telegram", meta: "Personal messages need connection", priority: "high", done: false, kind: "social" },
  { id: "gym", title: "Sarkeys Gym", detail: "Put the clothes in the bag before your brain opens negotiations.", source: "Routine", meta: "Tomorrow at 5:30 PM", priority: "normal", done: false, kind: "health" },
];

const initialAgentSteps: AgentStep[] = [
  { label: "Read the board", detail: "4 open tasks found", state: "done" },
  { label: "Check consequences", detail: "Supervisor preparation ranks first", state: "done" },
  { label: "Inspect live sources", detail: "Telegram and Google need permission", state: "needs-you" },
];

const schedule = [
  { day: "TODAY", time: "12:00", title: "Supervisor meeting", tone: "urgent" },
  { day: "WED", time: "10:00", title: "EMA data and continual learning", tone: "plain" },
  { day: "WED", time: "17:30", title: "Sarkeys Gym", tone: "good" },
  { day: "THU", time: "14:00", title: "Meeting with Parisa and Mike", tone: "plain" },
  { day: "THU", time: "14:30", title: "INQUIRE LAB and Servers", tone: "plain" },
  { day: "FRI", time: "12:00", title: "Supervisor meeting", tone: "urgent" },
];

const connectors = [
  { name: "University Outlook", state: "Browser ready", tone: "ready" },
  { name: "Personal Telegram", state: "Needs a personal session", tone: "waiting" },
  { name: "Google accounts", state: "Needs permission", tone: "waiting" },
  { name: "Google Tasks", state: "Needs permission", tone: "waiting" },
  { name: "Google Keep", state: "Needs a bridge", tone: "bridge" },
];

const navItems = [
  { label: "Today", icon: HomeIcon, target: "top" },
  { label: "Tasks", icon: CheckCircleIcon, target: "tasks" },
  { label: "Calendar", icon: CalendarIcon, target: "calendar" },
  { label: "Messages", icon: InboxIcon, target: "inbox" },
  { label: "People", icon: PeopleGroupIcon, target: "people" },
];

const agentOpeners: Record<Mode, string> = {
  balanced: "Four open loops. One is holding a knife. Let us begin there.",
  focus: "Focus mode. The decorative chaos has been escorted from the building.",
  social: "People mode. Other humans remain annoyingly real and worth replying to.",
  recovery: "Low battery mode. Tiny steps, zero moral courtroom drama.",
};

const modeLabels: Record<Mode, { label: string; note: string }> = {
  balanced: { label: "Daily mix", note: "everything, sensibly" },
  focus: { label: "Tunnel vision", note: "one thing, aggressively" },
  social: { label: "Human mode", note: "reply before exile" },
  recovery: { label: "Soft landing", note: "low-friction wins" },
};

function readStoredTasks(): Task[] {
  if (typeof window === "undefined") return initialTasks;
  try {
    const value = window.localStorage.getItem("arash-life-tasks");
    const parsed = value ? JSON.parse(value) : initialTasks;
    if (!Array.isArray(parsed)) return initialTasks;
    return parsed.map((stored: Task) => {
      const current = initialTasks.find((task) => task.id === stored.id);
      return current ? { ...stored, title: current.title, detail: current.detail, source: current.source, meta: stored.id === "messages" ? current.meta : stored.meta } : stored;
    });
  } catch {
    return initialTasks;
  }
}

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem("arash-life-theme") === "light" ? "light" : "dark";
}

function greetingPeriod(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "late-night";
}

function LifeApp() {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("balanced");
  const [theme, setTheme] = useState<Theme>("dark");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeNav, setActiveNav] = useState("Today");
  const [agentInput, setAgentInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [newTask, setNewTask] = useState({ title: "", detail: "", priority: "normal" as Priority, kind: "work" as TaskKind });
  const [messages, setMessages] = useState<AgentMessage[]>([{ role: "agent", text: agentOpeners.balanced }]);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>(initialAgentSteps);
  const [expandedTask, setExpandedTask] = useState<string | null>("meeting");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { setTasks(readStoredTasks()); setTheme(readTheme()); }, []);
  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(clock);
  }, []);
  useEffect(() => { window.localStorage.setItem("arash-life-tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { window.localStorage.setItem("arash-life-theme", theme); }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setShowSearch(false); setShowCapture(false); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const visibleTasks = useMemo(() => {
    const order: Record<Priority, number> = { critical: 0, high: 1, normal: 2 };
    const kindBoost = (task: Task) => mode === "social" ? Number(task.kind !== "social") : mode === "recovery" ? Number(task.priority === "critical") : 0;
    return [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || Number(b.active) - Number(a.active) || kindBoost(a) - kindBoost(b) || order[a.priority] - order[b.priority]);
  }, [mode, tasks]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return [
      ...tasks.filter((task) => `${task.title} ${task.detail} ${task.source}`.toLowerCase().includes(query)).map((task) => ({ id: task.id, title: task.title, detail: `Task from ${task.source}`, target: "tasks" })),
      ...schedule.filter((item) => `${item.title} ${item.day} ${item.time}`.toLowerCase().includes(query)).map((item) => ({ id: `${item.day}-${item.time}`, title: item.title, detail: `${item.day} at ${item.time}`, target: "calendar" })),
    ].slice(0, 8);
  }, [searchQuery, tasks]);

  const doneCount = tasks.filter((task) => task.done).length;
  const openCount = tasks.length - doneCount;
  const currentDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now);
  const greeting = useMemo(() => {
    const period = greetingPeriod(now.getHours());
    const progress: GreetingProgress = openCount === 0 ? "clear" : doneCount > 0 ? "moving" : "stuck";
    return greetings.find((item) => item.period === period && item.mode === mode && item.progress === progress) ?? {
      id: "local-fallback", period, mode, progress,
      headline: `${period === "late-night" ? "Still awake" : `Good ${period}`}, Arash.`,
      nudge: agentOpeners[mode],
    };
  }, [doneCount, mode, now, openCount]);
  const notify = (text: string) => setToast(text);

  function scrollTo(target: string, label?: string) {
    setActiveNav(label ?? activeNav);
    document.getElementById(target)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function toggleTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    setTasks((current) => current.map((item) => item.id === id ? { ...item, done: !item.done, active: false } : item));
    if (task) notify(task.done ? "Resurrected. Apparently it was not dead enough." : "Done. Your dopamine has been notified.");
  }

  function toggleStart(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const activating = !task.active;
    setTasks((current) => current.map((item) => ({ ...item, active: item.id === id ? activating : false })));
    if (activating) {
      setMode("focus");
      setMessages((current) => [...current, { role: "agent", text: `You are now doing “${task.title}.” I hid the buffet of alternative procrastinations.` }]);
      notify("Timer brain engaged. One mission only.");
    } else notify("Paused. Strategic retreat, allegedly.");
  }

  function snoozeTask(id: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setTasks((current) => current.map((item) => item.id === id ? { ...item, active: false, meta: "Snoozed until tomorrow morning" } : item));
    notify("Snoozed once. The cat is keeping receipts.");
  }

  function chooseMode(nextMode: Mode) {
    setMode(nextMode);
    setMessages((current) => [...current, { role: "agent", text: agentOpeners[nextMode] }]);
  }

  function captureTask(event: FormEvent) {
    event.preventDefault();
    if (!newTask.title.trim()) return;
    const task: Task = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `task-${Date.now()}`,
      title: newTask.title.trim(), detail: newTask.detail.trim() || "No description. A thrilling mystery for Future Arash.",
      source: "Captured here", meta: "Just now", priority: newTask.priority, done: false, kind: newTask.kind,
    };
    setTasks((current) => [task, ...current]);
    setNewTask({ title: "", detail: "", priority: "normal", kind: "work" });
    setShowCapture(false);
    notify("Captured. It can no longer hide in your frontal lobe.");
  }

  function queueConnector(name: string) {
    setAgentInput(`Help me connect ${name}`);
    setMessages((current) => [...current, { role: "agent", text: `${name} joined the integration queue. I will not pretend OAuth happened because a button looked confident.` }]);
    notify(`${name} queued for setup.`);
  }

  function executeAgentCommand(command: string) {
    const input = command.trim();
    if (!input) return;
    const lower = input.toLowerCase();
    let response = "Logged locally. It is now harder for that thought to escape into the wallpaper.";
    let nextMode = mode;
    let steps: AgentStep[] = [
      { label: "Understand the command", detail: input, state: "done" },
      { label: "Choose safe actions", detail: "No external write without approval", state: "done" },
    ];
    if (lower.includes("telegram") || lower.includes("message") || lower.includes("ghost")) {
      nextMode = "social";
      setExpandedTask("messages");
      response = "I opened the Telegram workspace. Real names and message previews require a personal Telegram connection first.";
      steps = [...steps, { label: "Open Telegram workspace", detail: "Task expanded", state: "done" }, { label: "Read personal threads", detail: "Connection required", state: "needs-you" }];
      window.setTimeout(() => scrollTo("task-messages", "Messages"), 40);
    } else if (lower.includes("focus") || lower.includes("important")) {
      nextMode = "focus";
      setExpandedTask("meeting");
      response = "Tunnel vision engaged. The supervisor meeting preparation now owns the room.";
      steps = [...steps, { label: "Rank open tasks", detail: "Consequence and deadline scored", state: "done" }, { label: "Recompose the board", detail: "Focus mode active", state: "done" }];
    } else if (lower.includes("tired") || lower.includes("exhausted") || lower.includes("sad")) {
      nextMode = "recovery";
      response = "Soft landing activated. One small action first. I am sarcastic, not stupid.";
      steps = [...steps, { label: "Reduce cognitive load", detail: "Recovery mode active", state: "done" }];
    } else if (lower.includes("normal") || lower.includes("balanced") || lower.includes("reset")) {
      nextMode = "balanced";
      response = "Daily mix restored. Chaos has returned to assigned seating.";
      steps = [...steps, { label: "Restore the full board", detail: "Balanced mode active", state: "done" }];
    } else if (lower.includes("connect")) {
      setShowConnectors(true);
      response = "I opened the connection queue. You approve the account step; I handle the boring plumbing after that.";
      steps = [...steps, { label: "Open connection queue", detail: "Awaiting your account approval", state: "needs-you" }];
    }
    setMode(nextMode);
    setAgentSteps(steps);
    setMessages((current) => [...current, { role: "arash", text: input }, { role: "agent", text: response }]);
    setAgentInput("");
  }

  function respondToAgent(event: FormEvent) {
    event.preventDefault();
    executeAgentCommand(agentInput);
  }

  function startVoice() {
    type SpeechRecognitionConstructor = new () => { continuous: boolean; interimResults: boolean; lang: string; start: () => void; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; onerror: () => void };
    const speechWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setMessages((current) => [...current, { role: "agent", text: "This browser has denied me ears. Typing remains tragically operational." }]); return; }
    const recognition = new Recognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = "en-US";
    recognition.onresult = (event) => setAgentInput(event.results[0][0].transcript);
    recognition.onend = () => setIsListening(false); recognition.onerror = () => setIsListening(false);
    setIsListening(true); recognition.start();
  }

  function renderTaskWorkspace(task: Task) {
    if (task.id === "messages") return (
      <div className="task-workspace telegram-workspace">
        <div className="workspace-bar"><div><span>PERSONAL TELEGRAM</span><strong>People and messages</strong></div><span className="permission-state">CONNECTION NEEDED</span></div>
        <div className="thread-head"><span>Person</span><span>Last message</span><span>Waiting</span></div>
        <div className="thread-empty">
          <InboxIcon label="" />
          <div><strong>No personal threads available yet</strong><p>The bot can notify you, but it cannot read your private Telegram inbox. A personal Telegram session is required to show real names, exact messages, waiting time, and reply actions here.</p></div>
        </div>
        <div className="workspace-actions"><button className="primary-action" onClick={() => queueConnector("Personal Telegram")} type="button">Connect personal Telegram</button><button onClick={() => notify("Manual contact capture is next in the queue.")} type="button">Add person manually</button></div>
      </div>
    );
    if (task.id === "meeting") return (
      <div className="task-workspace meeting-workspace">
        <div className="meeting-brief"><div><span>NEXT EVENT</span><strong>Today, 12:00 PM</strong><small>Supervisor meeting via Outlook</small></div><div><span>READY BY</span><strong>11:40 AM</strong><small>20 minutes protected</small></div></div>
        <div className="prep-list"><button onClick={() => notify("Results review opened.")} type="button"><span>01</span><div><strong>Review yesterday&apos;s results</strong><small>Find the one result that changes the conversation.</small></div></button><button onClick={() => notify("Question scratchpad opened.")} type="button"><span>02</span><div><strong>Write three questions</strong><small>Specific questions, not philosophical fog.</small></div></button><button onClick={() => notify("Meeting note prepared.")} type="button"><span>03</span><div><strong>Open one meeting note</strong><small>Everything your future self needs in one place.</small></div></button></div>
      </div>
    );
    if (task.id === "recording") return (
      <div className="task-workspace canvas-workspace">
        <div className="deliverable"><span>DELIVERABLE</span><strong>Reflective report recording</strong><p>Record, check the audio, upload, then verify Canvas shows a submission receipt.</p></div>
        <div className="deliverable-steps"><button onClick={() => notify("Recording checklist ready.")} type="button">Open recording checklist</button><button onClick={() => notify("Canvas connector is not live yet.")} type="button">Check Canvas status</button></div>
      </div>
    );
    if (task.id === "gym") return (
      <div className="task-workspace routine-workspace">
        <div className="routine-line"><span>17:00</span><strong>Pack clothes and water</strong></div><div className="routine-line"><span>17:15</span><strong>Leave before negotiations begin</strong></div><div className="routine-line"><span>17:30</span><strong>Arrive at Sarkeys</strong></div>
      </div>
    );
    return <div className="task-workspace generic-workspace"><strong>Captured context</strong><p>{task.detail}</p><button onClick={() => setShowCapture(true)} type="button">Add more context</button></div>;
  }

  return (
    <div className={`life-app mode-${mode}`} data-theme={theme} id="top">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />

      <header className="topbar">
        <button className="wordmark" onClick={() => scrollTo("top", "Today")} type="button" aria-label="Back to today"><span className="wordmark-glyph">A!</span><span><strong>Arash, assembled</strong><small>mostly operational</small></span></button>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setShowSearch(true)} type="button" aria-label="Search everything"><SearchIcon label="" /></button>
          <button className="icon-button" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}><SettingsIcon label="" /></button>
          <button className="capture-button" onClick={() => setShowCapture(true)} type="button"><AddIcon label="" /> Capture thought</button>
        </div>
      </header>

      <aside className="nav-dock" aria-label="Primary navigation">
        {navItems.map(({ label, icon: Icon, target }) => <button className={activeNav === label ? "dock-button active" : "dock-button"} key={label} onClick={() => scrollTo(target, label)} type="button" aria-label={label}><Icon label="" /><span className="dock-label">{label}</span></button>)}
        <button className={showConnectors ? "dock-button active" : "dock-button"} onClick={() => { setShowConnectors((value) => !value); window.setTimeout(() => scrollTo("connections", "Today"), 30); }} type="button" aria-label="Connections"><NotificationIcon label="" /><span className="dock-label">Connections</span></button>
      </aside>

      <main className="command-main">
        <motion.section className="hello-stage" initial={false}>
          <div className="hello-copy"><span className="date-line">{currentDate}</span><div className="greeting-copy" key={greeting.id}><h1>{greeting.headline}</h1><p>{greeting.nudge}</p></div><div className="day-stats" aria-label="Daily progress"><span><strong>{openCount}</strong> open loops</span><span><strong>{doneCount}</strong> slain today</span><span><strong>{schedule.length}</strong> calendar ambushes</span></div></div>
          <motion.div className="gremlin-wrap" animate={reduceMotion ? undefined : { y: [0, -5, 0], rotate: [-.5, .5, -.5] }} transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}><Image src="/life/task-cat-editorial.png" width={390} height={410} priority alt="A hand-inked midnight-blue cat assistant holding a chartreuse note and a pen" /><span className="gremlin-caption">I brought a pen. This is serious.</span></motion.div>
        </motion.section>

        <section className="mode-orbit" aria-label="Choose how today should feel">
          {(Object.keys(modeLabels) as Mode[]).map((item) => <button aria-pressed={mode === item} className={mode === item ? "mode-card selected" : "mode-card"} key={item} onClick={() => chooseMode(item)} type="button"><strong>{modeLabels[item].label}</strong><span>{modeLabels[item].note}</span></button>)}
        </section>

        <section className="agent-workbench" id="agent" aria-labelledby="agent-title">
          <div className="agent-workbench-head"><div className="agent-mark"><AiChatIcon label="" /></div><div><span className="panel-kicker">COMMAND SURFACE</span><h2 id="agent-title">Ask. Review. Let it act.</h2><p>It can reorganize this page now. External accounts still wait for your permission.</p></div><span className="runtime-state">LOCAL ACTIONS ONLINE</span></div>
          <div className="agent-workbench-grid">
            <div className="agent-dialogue">
              <div className="conversation" aria-live="polite">{messages.slice(-4).map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}-${message.text}`}><span>{message.role === "agent" ? "CAT" : "YOU"}</span>{message.text}</div>)}</div>
              <form className="agent-composer" onSubmit={respondToAgent}><textarea aria-label="Give the agent a task" name="agent-message" onChange={(event) => setAgentInput(event.target.value)} placeholder="Try: show me who I need to reply to" rows={3} value={agentInput} /><div className="composer-actions"><button className={isListening ? "voice-button listening" : "voice-button"} onClick={startVoice} type="button" aria-label={isListening ? "Listening" : "Talk to your agent"}><MicrophoneIcon label="" /></button><span>Enter a goal. The agent will show its actions.</span><button className="send-button" type="submit">Run</button></div></form>
              <div className="agent-suggestions" aria-label="Suggested commands"><button onClick={() => executeAgentCommand("Focus on the most important task")} type="button">Focus the board</button><button onClick={() => executeAgentCommand("Show me my Telegram messages")} type="button">Open Telegram</button><button onClick={() => executeAgentCommand("I am tired, make today smaller")} type="button">Make today smaller</button></div>
            </div>
            <div className="agent-run"><div className="run-heading"><div><span>CURRENT RUN</span><strong>{modeLabels[mode].label}</strong></div><span>{agentSteps.some((step) => step.state === "needs-you") ? "1 NEEDS YOU" : "COMPLETE"}</span></div><div className="run-steps">{agentSteps.map((step, index) => <div className={`run-step state-${step.state}`} key={`${step.label}-${index}`}><span>{step.state === "done" ? "✓" : step.state === "working" ? "↻" : "!"}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></div>)}</div><div className="agent-boundary"><TargetIcon label="" /><p><strong>Permission boundary</strong>Local task and layout changes run immediately. Email, messages, and account writes require approval.</p></div></div>
          </div>
        </section>

        <AnimatePresence>{showConnectors ? <motion.section id="connections" className="connector-panel" initial={reduceMotion ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}><div className="panel-intro"><span className="panel-kicker">THE WIRING CLOSET</span><h2>Apps that need to talk to each other</h2><p>Honest states only. No decorative green checks for integrations that do not exist yet.</p></div><div className="connector-grid">{connectors.map((connector) => <div className="connector-row" key={connector.name}><div><strong>{connector.name}</strong><span className={`connector-state ${connector.tone}`}>{connector.state}</span></div><button onClick={() => queueConnector(connector.name)} type="button">Queue setup</button></div>)}</div></motion.section> : null}</AnimatePresence>

        <LayoutGroup><section className="priority-section" id="tasks" aria-labelledby="priority-title"><div className="section-heading"><div><span className="panel-kicker">YOUR ACTUAL LIFE</span><h2 id="priority-title">What deserves your brain</h2><p>Every source gets its own workspace. Expand a task and the useful context lives with it.</p></div><button className="text-button" onClick={() => setShowCapture(true)} type="button"><AddIcon label="" /> Add one</button></div><motion.div className="task-stack" layout><AnimatePresence initial={false}>{visibleTasks.map((task, index) => <motion.article id={`task-${task.id}`} className={`task-row source-${task.source.toLowerCase().replaceAll(" ", "-")} priority-${task.priority} ${task.done ? "is-done" : ""} ${task.active ? "is-active" : ""} ${index === 0 ? "is-leading" : ""} ${expandedTask === task.id ? "is-expanded" : ""}`} key={task.id} layout initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}><div className="task-check"><Checkbox aria-label={`Mark ${task.title} as ${task.done ? "open" : "done"}`} isChecked={task.done} name={task.id} onChange={() => toggleTask(task.id)} value={task.id} /></div><div className="task-copy"><div className="task-title-line"><span className="source-stamp">{task.source}</span><h3>{task.title}</h3>{task.priority === "critical" ? <span className="danger-tag">CONSEQUENCES</span> : null}{task.active ? <span className="active-tag">DOING NOW</span> : null}</div><p>{task.detail}</p><div className="task-meta"><span>{task.meta}</span></div></div><div className="task-actions"><button className="explain-task" aria-expanded={expandedTask === task.id} onClick={() => setExpandedTask((current) => current === task.id ? null : task.id)} type="button">{expandedTask === task.id ? "Hide context" : "Explain more"}</button>{!task.done ? <button className="task-start" onClick={() => toggleStart(task.id)} type="button">{task.active ? "Pause" : "Start"}</button> : null}{!task.done ? <button className="task-snooze" onClick={() => snoozeTask(task.id)} type="button"><ClockIcon label="" /> Snooze</button> : null}</div>{expandedTask === task.id ? renderTaskWorkspace(task) : null}</motion.article>)}</AnimatePresence></motion.div></section></LayoutGroup>

        {mode !== "focus" ? <section className="life-bento"><motion.article className={`people-card ${mode === "social" ? "promoted" : ""}`} id="people" layout><div className="people-visual"><PeopleGroupIcon label="" /></div><div><span className="panel-kicker">PROOF OF LIFE</span><h2>You should encounter humans</h2><p>Connect personal Telegram to turn vague guilt into named conversations and reply actions.</p></div><button onClick={() => { chooseMode("social"); setExpandedTask("messages"); window.setTimeout(() => scrollTo("task-messages", "People"), 30); }} type="button">Open people task</button></motion.article><article className="inbox-card" id="inbox"><EmailIcon label="" /><div><span className="panel-kicker">INBOX TRIAGE</span><h2>No imported email yet</h2><p>Your inbox remains innocent until synchronization proves otherwise.</p></div><button onClick={() => { setShowConnectors(true); window.setTimeout(() => scrollTo("connections", "Messages"), 30); }} type="button">Wire it up</button></article></section> : null}
      </main>

      <aside className="context-rail">
        <section className="agenda-panel" id="calendar" aria-labelledby="agenda-title"><div className="rail-heading"><div><span className="panel-kicker">THIS WEEK</span><h2 id="agenda-title">Calendar ambushes</h2></div><CalendarIcon label="" /></div><div className="agenda-list">{schedule.map((item) => <button className={`agenda-row tone-${item.tone}`} key={`${item.day}-${item.time}-${item.title}`} onClick={() => notify(`${item.title} selected. Calendar editing arrives with the live connector.`)} type="button"><div className="agenda-time"><span>{item.day}</span><strong>{item.time}</strong></div><div className="agenda-title">{item.title}</div></button>)}</div></section>
        <section className="why-panel"><TargetIcon label="" /><div><strong>Why this order?</strong><p>Deadline, consequence, preparation time, and how spectacularly long you have avoided it.</p></div></section>
      </aside>

      <AnimatePresence>
        {showSearch ? <motion.div className="modal-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setShowSearch(false)}><motion.section className="search-modal" role="dialog" aria-modal="true" aria-label="Search everything" initial={reduceMotion ? false : { opacity: 0, y: -18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><SearchIcon label="" /><h2>Find the thing</h2><button onClick={() => setShowSearch(false)} type="button" aria-label="Close search"><CloseIcon label="" /></button></div><input aria-label="Search tasks, meetings, and people" autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tasks, meetings, people..." /><div className="search-results">{!searchQuery ? <p>Type something. Telepathy remains in backlog.</p> : searchResults.length ? searchResults.map((result) => <button key={result.id} onClick={() => { setShowSearch(false); scrollTo(result.target, result.target === "calendar" ? "Calendar" : "Tasks"); }} type="button"><strong>{result.title}</strong><span>{result.detail}</span></button>) : <p>Nothing found. Either it is done or it has achieved invisibility.</p>}</div></motion.section></motion.div> : null}
        {showCapture ? <motion.div className="modal-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setShowCapture(false)}><motion.form className="capture-modal" role="dialog" aria-modal="true" aria-label="Capture a task" onSubmit={captureTask} initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><AddIcon label="" /><h2>Get it out of your head</h2><button onClick={() => setShowCapture(false)} type="button" aria-label="Close capture"><CloseIcon label="" /></button></div><label>What is the thing?<input autoFocus required value={newTask.title} onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))} placeholder="Print the recommendation letters" /></label><label>Useful detail<textarea rows={3} value={newTask.detail} onChange={(event) => setNewTask((current) => ({ ...current, detail: event.target.value }))} placeholder="Enough context that Tomorrow Arash cannot claim confusion" /></label><div className="capture-grid"><label>Priority<select value={newTask.priority} onChange={(event) => setNewTask((current) => ({ ...current, priority: event.target.value as Priority }))}><option value="normal">Normal</option><option value="high">High</option><option value="critical">Consequences</option></select></label><label>Kind<select value={newTask.kind} onChange={(event) => setNewTask((current) => ({ ...current, kind: event.target.value as TaskKind }))}><option value="work">Work</option><option value="health">Health</option><option value="social">People</option></select></label></div><button className="save-task" type="submit">Put it on the board</button></motion.form></motion.div> : null}
      </AnimatePresence>

      <AnimatePresence>{toast ? <motion.div className="toast" role="status" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>{toast}</motion.div> : null}</AnimatePresence>
    </div>
  );
}

export default function LifePage() { return <LifeApp />; }
