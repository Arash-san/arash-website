"use client";

import AppProvider from "@atlaskit/app-provider";
import Avatar from "@atlaskit/avatar";
import Button from "@atlaskit/button/default/button";
import { IconButton } from "@atlaskit/button/new";
import Checkbox from "@atlaskit/checkbox";
import Lozenge from "@atlaskit/lozenge";
import TextArea from "@atlaskit/textarea";
import Tooltip from "@atlaskit/tooltip";
import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ClockIcon from "@atlaskit/icon/core/clock";
import EmailIcon from "@atlaskit/icon/core/email";
import HomeIcon from "@atlaskit/icon/core/home";
import InboxIcon from "@atlaskit/icon/core/inbox";
import MicrophoneIcon from "@atlaskit/icon/core/microphone";
import NotificationIcon from "@atlaskit/icon/core/notification";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import SearchIcon from "@atlaskit/icon/core/search";
import SettingsIcon from "@atlaskit/icon/core/settings";
import StarIcon from "@atlaskit/icon/core/star-starred";
import TargetIcon from "@atlaskit/icon/core/target";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./life.css";

type Mode = "balanced" | "focus" | "social" | "recovery";
type Priority = "critical" | "high" | "normal";

type Task = {
  id: string;
  title: string;
  detail: string;
  source: string;
  meta: string;
  priority: Priority;
  done: boolean;
  kind: "work" | "health" | "social";
};

type AgentMessage = { role: "agent" | "arash"; text: string };

const initialTasks: Task[] = [
  {
    id: "meeting",
    title: "Prepare for the supervisor meeting",
    detail: "Review yesterday's results and write three questions before noon.",
    source: "Outlook",
    meta: "Today at 12:00 PM · 20 min",
    priority: "critical",
    done: false,
    kind: "work",
  },
  {
    id: "recording",
    title: "Finish the reflective report recording",
    detail: "Canvas says this exists. Canvas has declined to do it for you.",
    source: "Canvas",
    meta: "Today · 35 min",
    priority: "high",
    done: false,
    kind: "work",
  },
  {
    id: "messages",
    title: "Reply to the people you accidentally ghosted",
    detail: "Four replies. Two minutes each. Your thumbs have survived worse.",
    source: "Telegram",
    meta: "4 waiting · 8 min",
    priority: "high",
    done: false,
    kind: "social",
  },
  {
    id: "gym",
    title: "Sarkeys Gym",
    detail: "Put the clothes in the bag before your brain opens negotiations.",
    source: "Routine",
    meta: "Tomorrow at 5:30 PM",
    priority: "normal",
    done: false,
    kind: "health",
  },
];

const schedule = [
  { day: "TODAY", time: "12:00", title: "Supervisor meeting", tone: "brand" },
  { day: "WED", time: "10:00", title: "EMA data and continual learning", tone: "neutral" },
  { day: "WED", time: "17:30", title: "Sarkeys Gym", tone: "success" },
  { day: "THU", time: "14:00", title: "Meeting with Parisa and Mike", tone: "neutral" },
  { day: "THU", time: "14:30", title: "INQUIRE LAB and Servers", tone: "neutral" },
  { day: "FRI", time: "12:00", title: "Supervisor meeting", tone: "brand" },
];

const connectors = [
  { name: "University Outlook", state: "Browser ready", appearance: "success" as const },
  { name: "Google accounts", state: "Authorization next", appearance: "inprogress" as const },
  { name: "Google Tasks", state: "Authorization next", appearance: "inprogress" as const },
  { name: "Google Keep", state: "Bridge needed", appearance: "moved" as const },
];

const navItems = [
  { label: "Today", icon: HomeIcon },
  { label: "Tasks", icon: CheckCircleIcon },
  { label: "Calendar", icon: CalendarIcon },
  { label: "Messages", icon: InboxIcon, count: 4 },
  { label: "People", icon: PeopleGroupIcon },
];

const agentOpeners: Record<Mode, string> = {
  balanced: "Four meaningful things. One has consequences. The others merely have opinions.",
  focus: "Focus mode. I have hidden the decorative chaos. You are welcome.",
  social: "People mode. Apparently relationships require replying to messages. Astonishing system design.",
  recovery: "Low energy mode. We are reducing friction, not staging a moral trial.",
};

function readStoredTasks(): Task[] {
  if (typeof window === "undefined") return initialTasks;
  try {
    const value = window.localStorage.getItem("arash-life-tasks");
    return value ? JSON.parse(value) : initialTasks;
  } catch {
    return initialTasks;
  }
}

function LifeApp() {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("balanced");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeNav, setActiveNav] = useState("Today");
  const [agentInput, setAgentInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    { role: "agent", text: agentOpeners.balanced },
  ]);

  useEffect(() => {
    setTasks(readStoredTasks());
  }, []);

  useEffect(() => {
    window.localStorage.setItem("arash-life-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const order: Record<Priority, number> = { critical: 0, high: 1, normal: 2 };
    const filtered = mode === "social" ? [...tasks].sort((a, b) => Number(b.kind === "social") - Number(a.kind === "social")) : tasks;
    return [...filtered].sort((a, b) => Number(a.done) - Number(b.done) || order[a.priority] - order[b.priority]);
  }, [mode, tasks]);

  const doneCount = tasks.filter((task) => task.done).length;

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  }

  function chooseMode(nextMode: Mode, acknowledgment?: string) {
    setMode(nextMode);
    setMessages((current) => [...current, { role: "agent", text: acknowledgment ?? agentOpeners[nextMode] }]);
  }

  function respondToAgent(event: FormEvent) {
    event.preventDefault();
    const input = agentInput.trim();
    if (!input) return;

    const lower = input.toLowerCase();
    let response = "I heard you. I have written that down locally, where it cannot wander into another tab and die.";
    let nextMode = mode;

    if (lower.includes("focus") || lower.includes("important")) {
      nextMode = "focus";
      response = "Focus mode activated. The supervisor meeting now owns the page, as deadlines traditionally demand tribute.";
    } else if (lower.includes("social") || lower.includes("people") || lower.includes("message")) {
      nextMode = "social";
      response = "Social commitments moved up. We will now acknowledge that other humans continue existing between your research sessions.";
    } else if (lower.includes("tired") || lower.includes("exhausted") || lower.includes("sad")) {
      nextMode = "recovery";
      response = "Recovery mode. One small action first. I am sarcastic, not stupid.";
    } else if (lower.includes("normal") || lower.includes("balanced") || lower.includes("reset")) {
      nextMode = "balanced";
      response = "Balanced view restored. Chaos has returned to its assigned seating.";
    }

    setMode(nextMode);
    setMessages((current) => [...current, { role: "arash", text: input }, { role: "agent", text: response }]);
    setAgentInput("");
  }

  function startVoice() {
    type SpeechRecognitionConstructor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
      onend: () => void;
      onerror: () => void;
    };
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessages((current) => [...current, { role: "agent", text: "This browser has denied me ears. Typing remains tragically available." }]);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => setAgentInput(event.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  }

  return (
    <div className={`life-app mode-${mode}`}>
      <header className="mobile-header">
        <div className="brand-mark">A</div>
        <div>
          <strong>Arash</strong>
          <span>Command center</span>
        </div>
        <Tooltip content="Settings">
          <IconButton icon={SettingsIcon} label="Settings" appearance="subtle" />
        </Tooltip>
      </header>

      <aside className="side-rail" aria-label="Primary navigation">
        <div className="identity">
          <div className="brand-mark">A</div>
          <div>
            <strong>Arash</strong>
            <span>Command center</span>
          </div>
        </div>

        <nav className="nav-stack">
          {navItems.map(({ label, icon: Icon, count }) => (
            <button
              className={activeNav === label ? "nav-item active" : "nav-item"}
              key={label}
              onClick={() => setActiveNav(label)}
              type="button"
            >
              <Icon label="" />
              <span>{label}</span>
              {count ? <span className="nav-count">{count}</span> : null}
            </button>
          ))}
        </nav>

        <button className="nav-item connector-button" onClick={() => setShowConnectors((value) => !value)} type="button">
          <NotificationIcon label="" />
          <span>Connections</span>
          <span className="connection-count">2</span>
        </button>

        <div className="account-row">
          <Avatar appearance="circle" size="medium" name="Arash Ahmadi" />
          <div>
            <strong>Arash Ahmadi</strong>
            <span>Local on Yorha</span>
          </div>
        </div>
      </aside>

      <main className="command-main">
        <section className="morning-brief" aria-labelledby="morning-title">
          <div>
            <span className="date-line">TUESDAY, AUGUST 25</span>
            <h1 id="morning-title">Good morning, Arash.</h1>
            <p>{agentOpeners[mode]}</p>
          </div>
          <div className="brief-actions">
            <Tooltip content="Search everything">
              <IconButton icon={SearchIcon} label="Search" appearance="subtle" />
            </Tooltip>
            <Button appearance="primary" iconBefore={AddIcon}>Capture</Button>
          </div>
        </section>

        <div className="mode-switcher" role="tablist" aria-label="Daily layout mode">
          {(["balanced", "focus", "social", "recovery"] as Mode[]).map((item) => (
            <button
              aria-selected={mode === item}
              className={mode === item ? "mode-button selected" : "mode-button"}
              key={item}
              onClick={() => chooseMode(item)}
              role="tab"
              type="button"
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {showConnectors ? (
            <motion.section
              className="connector-panel"
              initial={reduceMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div>
                <h2>Connections</h2>
                <p>Two are ready. Two require authorization or a bridge.</p>
              </div>
              <div className="connector-grid">
                {connectors.map((connector) => (
                  <div className="connector-row" key={connector.name}>
                    <span>{connector.name}</span>
                    <Lozenge appearance={connector.appearance}>{connector.state}</Lozenge>
                  </div>
                ))}
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <LayoutGroup>
          <section className="priority-section" aria-labelledby="priority-title">
            <div className="section-heading">
              <div>
                <h2 id="priority-title">What deserves your attention</h2>
                <p>{doneCount} completed today. The bar is low because the day is young.</p>
              </div>
              <span className="task-total">{tasks.length - doneCount} open</span>
            </div>

            <motion.div className="task-stack" layout>
              <AnimatePresence initial={false}>
                {visibleTasks.map((task, index) => (
                  <motion.article
                    className={`task-row priority-${task.priority} ${task.done ? "is-done" : ""} ${index === 0 ? "is-leading" : ""}`}
                    key={task.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 18 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="task-check">
                      <Checkbox
                        aria-label={`Mark ${task.title} as ${task.done ? "open" : "done"}`}
                        isChecked={task.done}
                        name={task.id}
                        onChange={() => toggleTask(task.id)}
                        value={task.id}
                      />
                    </div>
                    <div className="task-copy">
                      <div className="task-title-line">
                        <h3>{task.title}</h3>
                        {task.priority === "critical" ? <Lozenge appearance="removed">DO NOT IGNORE</Lozenge> : null}
                      </div>
                      <p>{task.detail}</p>
                      <div className="task-meta">
                        <span>{task.source}</span>
                        <span>{task.meta}</span>
                      </div>
                    </div>
                    <div className="task-actions">
                      {!task.done ? <Button appearance={index === 0 ? "primary" : "subtle"}>Start</Button> : null}
                      <Button appearance="subtle">Snooze</Button>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </motion.div>
          </section>
        </LayoutGroup>

        {mode !== "focus" ? (
          <motion.section
            className={`social-strip ${mode === "social" ? "promoted" : ""}`}
            layout
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="social-icon"><PeopleGroupIcon label="" /></div>
            <div>
              <h2>You should encounter humans</h2>
              <p>Outlook inbox scanning will place OU events here. For now, four unanswered messages are requesting proof of life.</p>
            </div>
            <Button appearance="default">Review people</Button>
          </motion.section>
        ) : null}

        <section className="inbox-section" aria-labelledby="inbox-title">
          <div className="section-heading compact">
            <div>
              <h2 id="inbox-title">Inbox decisions</h2>
              <p>The agent will summarize messages here after connector authorization.</p>
            </div>
          </div>
          <div className="empty-inbox">
            <EmailIcon label="" />
            <div>
              <strong>No imported email yet</strong>
              <span>Your inbox remains innocent until synchronization proves otherwise.</span>
            </div>
            <Button appearance="default" onClick={() => setShowConnectors(true)}>View connections</Button>
          </div>
        </section>
      </main>

      <aside className="context-rail">
        <section className="agenda-panel" aria-labelledby="agenda-title">
          <div className="rail-heading">
            <div>
              <span>THIS WEEK</span>
              <h2 id="agenda-title">Your calendar</h2>
            </div>
            <Tooltip content="Open calendar">
              <IconButton icon={CalendarIcon} label="Open calendar" appearance="subtle" />
            </Tooltip>
          </div>
          <div className="agenda-list">
            {schedule.map((item) => (
              <div className={`agenda-row tone-${item.tone}`} key={`${item.day}-${item.time}-${item.title}`}>
                <div className="agenda-time">
                  <span>{item.day}</span>
                  <strong>{item.time}</strong>
                </div>
                <div className="agenda-title">{item.title}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="agent-panel" aria-labelledby="agent-title">
          <div className="agent-heading">
            <div className="agent-avatar"><AiChatIcon label="" /></div>
            <div>
              <h2 id="agent-title">Your agent</h2>
              <span>Opus 5 · subscription</span>
            </div>
            <span className="agent-status">LOCAL</span>
          </div>

          <div className="conversation" aria-live="polite">
            {messages.slice(-4).map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}-${message.text}`}>
                {message.text}
              </div>
            ))}
          </div>

          <form className="agent-composer" onSubmit={respondToAgent}>
            <TextArea
              appearance="standard"
              maxHeight="120px"
              minimumRows={2}
              name="agent-message"
              onChange={(event) => setAgentInput(event.target.value)}
              placeholder="Tell me what needs to change..."
              value={agentInput}
            />
            <div className="composer-actions">
              <Tooltip content={isListening ? "Listening" : "Talk to your agent"}>
                <IconButton
                  appearance={isListening ? "primary" : "subtle"}
                  icon={MicrophoneIcon}
                  label={isListening ? "Listening" : "Talk to your agent"}
                  onClick={startVoice}
                  type="button"
                />
              </Tooltip>
              <Button appearance="primary" type="submit">Tell agent</Button>
            </div>
          </form>
        </section>

        <section className="why-panel">
          <TargetIcon label="" />
          <div>
            <strong>Why this order?</strong>
            <p>Deadline, consequence, preparation time, and how impressively long you have avoided it.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default function LifePage() {
  return (
    <AppProvider defaultColorMode="light" defaultTheme={{ dark: "dark", light: "light", shape: "shape", spacing: "spacing", typography: "typography" }}>
      <LifeApp />
    </AppProvider>
  );
}
