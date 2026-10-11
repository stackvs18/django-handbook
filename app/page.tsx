"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  Terminal,
  Bookmark,
  History,
  Download,
  BarChart2,
  Settings,
  Search,
  CheckCircle2,
  XCircle,
  Flame,
  Award,
  BookCheck,
  ChevronRight,
  ChevronDown,
  Layers,
  ShieldCheck,
  Code2,
  Database,
  KeyRound,
  FileCode,
  Copy,
  Check,
  Sparkles,
  Zap,
  RotateCcw,
  ArrowRight,
  Menu,
  X,
  Star,
  Eye,
  ListFilter
} from "lucide-react";

import { STUDY_NOTES } from "@/data/notes";
import { MCQS, MCQ } from "@/data/mcqs";
import { COMMAND_REFERENCE } from "@/data/commands";

export default function Home() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<"dashboard" | "notes" | "quiz" | "commands">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false); // Managed by responsive handler
  const [expandedNotesMenu, setExpandedNotesMenu] = useState(true);
  const [expandedQuizMenu, setExpandedQuizMenu] = useState(true);

  // Notes View State
  const [selectedNoteId, setSelectedNoteId] = useState<string>("crud-practical-15m");
  const [noteUnitFilter, setNoteUnitFilter] = useState<string>("all");

  // Command Reference State
  const [commandCategory, setCommandCategory] = useState<string>("all");

  // Quiz Engine State
  const [quizUnit, setQuizUnit] = useState<string>("all");
  const [mcqViewMode, setMcqViewMode] = useState<"quiz" | "study">("study");
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [mcqSearchQuery, setMcqSearchQuery] = useState<string>("");

  // Global Search Command Palette (⌘K)
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>("");

  // Responsive sidebar handling for desktop vs mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Time-based greeting
  const [greeting, setGreeting] = useState("Good Evening");
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  // Keyboard shortcut for ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Helper to handle tab selection on mobile
  const handleNavClick = (tab: "dashboard" | "notes" | "quiz" | "commands", noteId?: string) => {
    setActiveTab(tab);
    if (noteId) setSelectedNoteId(noteId);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Filtered Quiz MCQs
  const filteredMCQs = useMemo(() => {
    return MCQS.filter((q) => {
      const matchesUnit = quizUnit === "all" || q.unit === quizUnit;
      const matchesSearch =
        !mcqSearchQuery.trim() ||
        q.question.toLowerCase().includes(mcqSearchQuery.toLowerCase()) ||
        q.explanation.toLowerCase().includes(mcqSearchQuery.toLowerCase());
      return matchesUnit && matchesSearch;
    });
  }, [quizUnit, mcqSearchQuery]);

  // Current active note object
  const currentNote = useMemo(() => {
    return STUDY_NOTES.find((n) => n.id === selectedNoteId) || STUDY_NOTES[0];
  }, [selectedNoteId]);

  // Quiz stats calculation
  const quizStats = useMemo(() => {
    let totalAnswered = 0;
    let correctCount = 0;
    Object.entries(userAnswers).forEach(([qId, ansIdx]) => {
      totalAnswered++;
      const mcq = MCQS.find((m) => m.id === Number(qId));
      if (mcq && mcq.correctIndex === ansIdx) {
        correctCount++;
      }
    });
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 92;
    return { totalAnswered, correctCount, accuracy };
  }, [userAnswers]);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Search Results for ⌘K
  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return { notes: [], mcqs: [], commands: [] };
    const query = globalSearch.toLowerCase();
    const matchedNotes = STUDY_NOTES.filter(
      (n) => n.title.toLowerCase().includes(query) || n.content.summary.toLowerCase().includes(query)
    );
    const matchedMCQs = MCQS.filter(
      (m) => m.question.toLowerCase().includes(query) || m.explanation.toLowerCase().includes(query)
    );
    const matchedCommands = COMMAND_REFERENCE.filter(
      (c) => c.command.toLowerCase().includes(query) || c.description.toLowerCase().includes(query)
    );
    return { notes: matchedNotes, mcqs: matchedMCQs, commands: matchedCommands };
  }, [globalSearch]);

  // Quick Access Topics Data (Unit 9 & Unit 10 focused)
  const QUICK_ACCESS_TOPICS = [
    { id: "crud-practical-15m", name: "CRUD Practical (15 Marks)", icon: Code2, sections: "6 steps · Movie Review System", badge: "MUST MASTER" },
    { id: "user-auth-5m", name: "Users & Auth (5 Marks)", icon: ShieldCheck, sections: "4 steps · UserCreateForm & login", badge: "HIGH WEIGHT" },
    { id: "drf-serializers-5m", name: "Serializers & DRF (5 Marks)", icon: KeyRound, sections: "ModelSerializer · ViewSets", badge: "HIGH WEIGHT" },
    { id: "unit9-sqlite3-direct", name: "SQLite3 Direct Python API", icon: FileCode, sections: "connect · cursor · fetchall" },
    { id: "unit10-jwt-simplejwt", name: "JWT Auth & SimpleJWT", icon: KeyRound, sections: "TokenObtainPairView · Bearer" },
    { id: "unit10-postman-versioning", name: "Postman & API Versioning", icon: Zap, sections: "URLPathVersioning · Header" },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#f5f5f5] flex flex-col font-sans selection:bg-white selection:text-black">
      
      {/* --- TOP BAR --- */}
      <header className="h-16 border-b border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-30 px-3 md:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1a1a1a] transition"
            title="Toggle Menu"
          >
            {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Search Trigger */}
          <div
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 bg-[#121212] hover:bg-[#1a1a1a] border border-[#262626] px-3 py-1.5 rounded-lg text-neutral-400 cursor-pointer flex-1 max-w-md transition text-xs sm:text-sm"
          >
            <Search className="w-4 h-4 text-neutral-500 shrink-0" />
            <span className="flex-1 text-neutral-400 truncate">Search notes, 75 MCQs, commands...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-[#262626] px-1.5 py-0.5 rounded text-neutral-300 border border-neutral-700">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Top Right Status */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-[#121212] border border-[#262626] px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="hidden xs:inline">Connected</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* --- MOBILE OVERLAY BACKDROP --- */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-xs z-40"
          />
        )}

        {/* --- LEFT SIDEBAR --- */}
        <aside
          className={`fixed lg:sticky top-16 bottom-0 left-0 z-50 lg:z-20 w-72 lg:w-[290px] bg-[#0a0a0a] border-r border-[#262626] flex flex-col transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } h-[calc(100vh-4rem)]`}
        >
          {/* Brand Block */}
          <div className="p-4 border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white text-black border border-white flex items-center justify-center font-extrabold text-lg">
                Dj
              </div>
              <div>
                <h1 className="font-bold text-white text-sm leading-tight tracking-wide">
                  Django Hub
                </h1>
                <p className="text-[11px] text-neutral-400 font-medium">Interactive Learning</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {/* LEARNING SECTION */}
            <div>
              <div className="px-3 text-[10px] font-bold text-neutral-500 tracking-wider uppercase mb-1.5">
                Learning
              </div>
              <nav className="space-y-1">
                {/* Dashboard */}
                <button
                  onClick={() => handleNavClick("dashboard")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                    activeTab === "dashboard"
                      ? "bg-white text-black font-bold shadow"
                      : "text-neutral-400 hover:text-white hover:bg-[#171717]"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>

                {/* Study Notes (Expandable) */}
                <div>
                  <button
                    onClick={() => {
                      setActiveTab("notes");
                      setExpandedNotesMenu((prev) => !prev);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                      activeTab === "notes"
                        ? "bg-white text-black font-bold shadow"
                        : "text-neutral-400 hover:text-white hover:bg-[#171717]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-4 h-4" />
                      <span>Study Notes</span>
                    </div>
                    {expandedNotesMenu ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {expandedNotesMenu && (
                    <div className="ml-3 pl-2.5 border-l border-[#262626] mt-1 space-y-1">
                      {STUDY_NOTES.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => handleNavClick("notes", note.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium truncate block transition ${
                            selectedNoteId === note.id && activeTab === "notes"
                              ? "text-white bg-[#262626] font-bold"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {note.isHighWeight && <span className="text-white mr-1">★</span>}
                          {note.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* MCQ Practice (Expandable - Unit 9 & Unit 10) */}
                <div>
                  <button
                    onClick={() => {
                      setActiveTab("quiz");
                      setExpandedQuizMenu((prev) => !prev);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                      activeTab === "quiz"
                        ? "bg-white text-black font-bold shadow"
                        : "text-neutral-400 hover:text-white hover:bg-[#171717]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-4 h-4" />
                      <span>MCQ Practice (75 Qs)</span>
                    </div>
                    {expandedQuizMenu ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {expandedQuizMenu && (
                    <div className="ml-3 pl-2.5 border-l border-[#262626] mt-1 space-y-1">
                      {[
                        { id: "all", label: "All 75 MCQs" },
                        { id: "Unit 9", label: "Unit 9 (Q445-Q465)" },
                        { id: "Unit 10", label: "Unit 10 (Q476-Q529)" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setQuizUnit(item.id);
                            setCurrentQuizIndex(0);
                            handleNavClick("quiz");
                          }}
                          className={`w-full text-left px-2.5 py-1 rounded-lg text-xs font-medium block transition ${
                            quizUnit === item.id && activeTab === "quiz"
                              ? "text-white bg-[#262626] font-bold"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Command Reference */}
                <button
                  onClick={() => handleNavClick("commands")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                    activeTab === "commands"
                      ? "bg-white text-black font-bold shadow"
                      : "text-neutral-400 hover:text-white hover:bg-[#171717]"
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>Command Reference</span>
                </button>
              </nav>
            </div>

            {/* TOOLS SECTION */}
            <div>
              <div className="px-3 text-[10px] font-bold text-neutral-500 tracking-wider uppercase mb-1.5">
                Tools
              </div>
              <nav className="space-y-1">
                {[
                  { name: "Bookmarks", icon: Bookmark },
                  { name: "History", icon: History },
                  { name: "Downloads", icon: Download }
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs text-neutral-600 cursor-not-allowed select-none"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    <span className="text-[9px] bg-[#1a1a1a] border border-[#262626] text-neutral-500 px-1.5 py-0.5 rounded font-mono">
                      Soon
                    </span>
                  </div>
                ))}
              </nav>
            </div>

            {/* ACCOUNT SECTION */}
            <div>
              <div className="px-3 text-[10px] font-bold text-neutral-500 tracking-wider uppercase mb-1.5">
                Account
              </div>
              <nav className="space-y-1">
                {[
                  { name: "Progress", icon: BarChart2 },
                  { name: "Settings", icon: Settings }
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl text-xs text-neutral-600 cursor-not-allowed select-none"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    <span className="text-[9px] bg-[#1a1a1a] border border-[#262626] text-neutral-500 px-1.5 py-0.5 rounded font-mono">
                      Soon
                    </span>
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Bottom Status Pill */}
          <div className="p-3 border-t border-[#262626]">
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-2.5 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
              <div>
                <div className="text-xs font-semibold text-white">Mock Engine Active</div>
                <div className="text-[10px] text-neutral-400">In-Memory / Instant</div>
              </div>
            </div>
          </div>
        </aside>

        {/* --- MAIN CONTENT AREA --- */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">

          {/* ========================================================================= */}
          {/* TAB 1: DASHBOARD                                                          */}
          {/* ========================================================================= */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 sm:space-y-8 animate-fadeIn">
              
              {/* HERO GREETING */}
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                  {greeting}, Vraj 👋
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                  Unit 9 & Unit 10 Exam Revision Hub — Monochrome Dashboard
                </p>
              </div>

              {/* 4 STAT CARDS ROW */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Stat 1: Topics */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between hover:border-neutral-500 transition">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-neutral-400">
                      High-Weight Topics
                    </span>
                    <BookCheck className="w-4 h-4 text-white" />
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <span className="text-lg sm:text-2xl font-bold text-white">6 Modules</span>
                  </div>
                </div>

                {/* Stat 2: Total MCQs */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between hover:border-neutral-500 transition">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-neutral-400">
                      Total MCQs
                    </span>
                    <HelpCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <span className="text-lg sm:text-2xl font-bold text-white">75 Qs</span>
                  </div>
                </div>

                {/* Stat 3: Accuracy */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between hover:border-neutral-500 transition">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-neutral-400">
                      Accuracy
                    </span>
                    <Award className="w-4 h-4 text-white" />
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <span className="text-lg sm:text-2xl font-bold text-white">{quizStats.accuracy}%</span>
                  </div>
                </div>

                {/* Stat 4: Streak */}
                <div className="bg-[#121212] border border-[#262626] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between hover:border-neutral-500 transition">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-neutral-400">
                      Streak
                    </span>
                    <Flame className="w-4 h-4 text-white" />
                  </div>
                  <div className="mt-2 sm:mt-3">
                    <span className="text-lg sm:text-2xl font-bold text-white">14 Days</span>
                  </div>
                </div>
              </div>

              {/* LEARNING PROGRESS CARD (UNIT 9 & UNIT 10) */}
              <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-white" />
                    Learning Progress (Unit 9 & Unit 10)
                  </h3>
                  <span className="text-[11px] text-neutral-400 font-medium">Updated today</span>
                </div>

                <div className="space-y-4 pt-1">
                  {/* Unit 9 */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5 gap-2">
                      <span className="text-neutral-300 truncate">Unit 9: Forms, CSRF, Authentication & Direct SQLite3 API (21 MCQs)</span>
                      <span className="text-white font-mono shrink-0">100%</span>
                    </div>
                    <div className="w-full bg-[#050505] h-2 rounded-full overflow-hidden border border-[#262626]">
                      <div className="bg-white h-full rounded-full w-[100%]" />
                    </div>
                  </div>

                  {/* Unit 10 */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5 gap-2">
                      <span className="text-neutral-300 truncate">Unit 10: DRF, Serializers, ViewSets, JWT & Postman (54 MCQs)</span>
                      <span className="text-white font-mono shrink-0">100%</span>
                    </div>
                    <div className="w-full bg-[#050505] h-2 rounded-full overflow-hidden border border-[#262626]">
                      <div className="bg-white h-full rounded-full w-[100%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 LARGE FEATURE CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                
                {/* Feature 1: Study Notes */}
                <div
                  onClick={() => handleNavClick("notes")}
                  className="bg-[#121212] border border-[#262626] hover:border-white rounded-xl p-5 flex flex-col justify-between group cursor-pointer transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-white">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-mono bg-[#1f1f1f] text-neutral-300 px-2 py-0.5 rounded border border-[#333]">
                        Practical + Code
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base group-hover:underline transition">
                        Study Notes
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        CRUD (15 Marks) · Auth (5 Marks) · DRF Serializers (5 Marks)
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-[#262626] flex items-center text-xs font-semibold text-white group-hover:translate-x-1 transition">
                    <span>Explore Notes</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>

                {/* Feature 2: MCQ Practice */}
                <div
                  onClick={() => handleNavClick("quiz")}
                  className="bg-[#121212] border border-[#262626] hover:border-white rounded-xl p-5 flex flex-col justify-between group cursor-pointer transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-white">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-mono bg-[#1f1f1f] text-white border border-neutral-600 px-2 py-0.5 rounded font-bold">
                        75 Qs Complete
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base group-hover:underline transition">
                        75 MCQs (Unit 9 & 10)
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        21 Unit 9 Qs (Q445-465) + 54 Unit 10 Qs (Q476-529)
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-[#262626] flex items-center text-xs font-semibold text-white group-hover:translate-x-1 transition">
                    <span>Start Practice</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>

                {/* Feature 3: Command Reference */}
                <div
                  onClick={() => handleNavClick("commands")}
                  className="bg-[#121212] border border-[#262626] hover:border-white rounded-xl p-5 flex flex-col justify-between group cursor-pointer transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-white">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-mono bg-[#1f1f1f] text-white border border-neutral-600 px-2 py-0.5 rounded font-bold">
                        Live CLI
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base group-hover:underline transition">
                        Command Reference
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        SQLite3 API · DRF endpoints · SimpleJWT tokens
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-[#262626] flex items-center text-xs font-semibold text-white group-hover:translate-x-1 transition">
                    <span>View Commands</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              </div>

              {/* QUICK ACCESS TOPICS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-white rounded-full" />
                  <h2 className="text-xs font-extrabold tracking-wider uppercase text-neutral-400">
                    HIGH WEIGHT REVISION TOPICS
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {QUICK_ACCESS_TOPICS.map((topic) => (
                    <div
                      key={topic.id}
                      onClick={() => handleNavClick("notes", topic.id)}
                      className="bg-[#121212] border border-[#262626] hover:border-white rounded-xl p-3.5 sm:p-4 flex items-start gap-3 cursor-pointer group transition hover:bg-[#1a1a1a]"
                    >
                      <div className="p-2 sm:p-2.5 rounded-lg bg-[#050505] border border-[#333] text-white shrink-0">
                        <topic.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-neutral-200 truncate group-hover:text-white transition">
                          {topic.name}
                        </h4>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">{topic.sections}</p>
                        {topic.badge && (
                          <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white text-black font-mono">
                            {topic.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: STUDY NOTES VIEW                                                   */}
          {/* ========================================================================= */}
          {activeTab === "notes" && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Filter Tabs & Mobile Topic Selector */}
              <div className="space-y-3 border-b border-[#262626] pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-white" />
                    <h2 className="text-base sm:text-lg font-bold text-white">Unit 9 & Unit 10 Exam Notes</h2>
                  </div>

                  <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-xl border border-[#262626] overflow-x-auto max-w-full">
                    {[
                      { label: "All Notes", val: "all" },
                      { label: "Unit 9", val: "Unit 9" },
                      { label: "Unit 10", val: "Unit 10" }
                    ].map((filter) => (
                      <button
                        key={filter.val}
                        onClick={() => setNoteUnitFilter(filter.val)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
                          noteUnitFilter === filter.val
                            ? "bg-white text-black font-bold shadow"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Quick Dropdown Selector for Notes */}
                <div className="lg:hidden">
                  <select
                    value={selectedNoteId}
                    onChange={(e) => setSelectedNoteId(e.target.value)}
                    className="w-full bg-[#121212] border border-[#262626] text-white text-xs rounded-xl p-2.5 font-semibold outline-none focus:border-white"
                  >
                    {STUDY_NOTES.filter(
                      (n) => noteUnitFilter === "all" || n.unit.includes(noteUnitFilter)
                    ).map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.isHighWeight ? "★ " : ""}{n.title} ({n.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Note Details Pane */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Note Selector Sidebar (Desktop Only) */}
                <div className="hidden lg:block lg:col-span-4 space-y-2">
                  {STUDY_NOTES.filter(
                    (n) => noteUnitFilter === "all" || n.unit.includes(noteUnitFilter)
                  ).map((note) => (
                    <button
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3 ${
                        selectedNoteId === note.id
                          ? "bg-[#1f1f1f] border-white text-white shadow-lg"
                          : "bg-[#121212] border-[#262626] text-neutral-400 hover:border-neutral-500 hover:text-white"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {note.isHighWeight ? (
                          <Star className="w-4 h-4 text-white fill-white" />
                        ) : (
                          <FileCode className="w-4 h-4 text-neutral-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-200 truncate">{note.title}</span>
                        </div>
                        <p className="text-[11px] text-neutral-400 line-clamp-1 mt-1">{note.content.summary}</p>
                        {note.marks && (
                          <span className="inline-block mt-2 text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded font-mono">
                            {note.marks}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Main Reading Pane */}
                <div className="lg:col-span-8 bg-[#121212] border border-[#262626] rounded-xl p-4 sm:p-6 space-y-6">
                  {/* Header */}
                  <div className="border-b border-[#262626] pb-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-white bg-[#262626] px-2.5 py-1 rounded border border-neutral-600 font-mono">
                        {currentNote.unit}
                      </span>
                      {currentNote.marks && (
                        <span className="text-xs font-bold text-black bg-white px-2.5 py-1 rounded font-mono">
                          {currentNote.marks}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">{currentNote.title}</h2>
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">{currentNote.content.explanation}</p>
                  </div>

                  {/* Step-by-Step Practical Walkthrough if available */}
                  {currentNote.content.steps && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-white" />
                        Step-by-Step Practical Execution
                      </h3>

                      <div className="space-y-6">
                        {currentNote.content.steps.map((step) => (
                          <div
                            key={step.stepNumber}
                            className="bg-[#080808] border border-[#262626] rounded-xl p-3.5 sm:p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center font-mono shrink-0">
                                  {step.stepNumber}
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold text-neutral-200">{step.title}</h4>
                              </div>
                              {step.codeFile && (
                                <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400 bg-[#171717] px-2 py-0.5 rounded border border-neutral-700">
                                  {step.codeFile}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-300">{step.desc}</p>

                            {step.code && (
                              <div className="relative group rounded-lg overflow-hidden border border-[#333] bg-[#000000]">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-[#121212] border-b border-[#262626] text-[10px] sm:text-[11px] font-mono text-neutral-400">
                                  <span className="truncate max-w-[180px] sm:max-w-xs">{step.codeFile || "Python Snippet"}</span>
                                  <button
                                    onClick={() => handleCopyCode(step.code!)}
                                    className="flex items-center gap-1 text-neutral-400 hover:text-white transition shrink-0"
                                  >
                                    {copiedCode === step.code ? (
                                      <Check className="w-3.5 h-3.5 text-white" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                    <span>{copiedCode === step.code ? "Copied" : "Copy"}</span>
                                  </button>
                                </div>
                                <pre className="p-3 text-xs font-mono text-neutral-200 overflow-x-auto leading-relaxed">
                                  <code>{step.code}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Code Snippets */}
                  {currentNote.content.codeSnippets && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400">
                        Authoritative Code Examples
                      </h3>
                      {currentNote.content.codeSnippets.map((snippet, idx) => (
                        <div key={idx} className="rounded-lg border border-[#333] bg-[#000000] overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-[#121212] border-b border-[#262626] text-[10px] sm:text-[11px] font-mono text-neutral-400">
                            <span>{snippet.file}</span>
                            <button
                              onClick={() => handleCopyCode(snippet.code)}
                              className="flex items-center gap-1 text-neutral-400 hover:text-white transition"
                            >
                              {copiedCode === snippet.code ? (
                                <Check className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedCode === snippet.code ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                          <pre className="p-3 text-xs font-mono text-neutral-200 overflow-x-auto leading-relaxed">
                            <code>{snippet.code}</code>
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Takeaways */}
                  {currentNote.content.keyTakeaways && (
                    <div className="bg-[#171717] border border-[#333] rounded-xl p-4 space-y-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-white" />
                        Exam Key Takeaways
                      </h4>
                      <ul className="space-y-1.5">
                        {currentNote.content.keyTakeaways.map((point, idx) => (
                          <li key={idx} className="text-xs text-neutral-200 flex items-start gap-2">
                            <span className="text-white font-bold">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: MCQ PRACTICE & ALL ANSWERS VIEW (75 MCQs COMPLETE)                 */}
          {/* ========================================================================= */}
          {activeTab === "quiz" && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* MCQ Header & View Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-medium text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-white shrink-0" />
                    75 Django MCQs ({filteredMCQs.length} Qs Showing)
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-0.5 font-normal">
                    Unit 9 (Q445–Q465) + Unit 10 (Q476–Q529) · View All Answers or Take Quiz
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Search Filter for MCQs */}
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-3" />
                    <input
                      type="text"
                      value={mcqSearchQuery}
                      onChange={(e) => setMcqSearchQuery(e.target.value)}
                      placeholder="Filter 75 MCQs..."
                      className="w-full bg-[#121212] border border-[#262626] text-xs sm:text-sm text-white placeholder-neutral-500 pl-8 pr-3 py-1.5 rounded-lg outline-none focus:border-white font-normal"
                    />
                  </div>

                  {/* Unit Selector */}
                  <select
                    value={quizUnit}
                    onChange={(e) => {
                      setQuizUnit(e.target.value);
                      setCurrentQuizIndex(0);
                    }}
                    className="bg-[#121212] border border-[#262626] text-white text-xs sm:text-sm rounded-lg px-2.5 py-1.5 font-normal outline-none focus:border-white"
                  >
                    <option value="all">All 75 MCQs</option>
                    <option value="Unit 9">Unit 9 (21 Qs: Q445–Q465)</option>
                    <option value="Unit 10">Unit 10 (54 Qs: Q476–Q529)</option>
                  </select>

                  {/* Mode Switcher Buttons */}
                  <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-xl border border-[#262626] w-full sm:w-auto justify-center">
                    <button
                      onClick={() => setMcqViewMode("study")}
                      className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                        mcqViewMode === "study"
                          ? "bg-white text-black shadow"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>All Answers</span>
                    </button>
                    <button
                      onClick={() => setMcqViewMode("quiz")}
                      className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                        mcqViewMode === "quiz"
                          ? "bg-white text-black shadow"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span>Quiz Mode</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* MODE 1: VIEW ALL ANSWERS & EXPLANATIONS (STUDY MODE) */}
              {mcqViewMode === "study" && (
                <div className="space-y-5 max-w-4xl mx-auto">
                  <div className="p-3 bg-[#121212] border border-[#262626] rounded-xl text-xs sm:text-sm text-neutral-300 flex flex-col sm:flex-row justify-between gap-1 font-normal">
                    <span>
                      Showing <strong className="font-medium text-white">{filteredMCQs.length}</strong> questions with correct answers revealed.
                    </span>
                    <span className="text-neutral-400 font-mono text-xs">75 MCQs Complete Bank</span>
                  </div>

                  <div className="space-y-5 sm:space-y-6">
                    {filteredMCQs.map((mcq) => (
                      <div
                        key={mcq.id}
                        className="bg-[#121212] border border-[#262626] rounded-xl p-4 sm:p-6 space-y-4 hover:border-neutral-500 transition"
                      >
                        {/* Question Header */}
                        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                          <span className="text-xs sm:text-sm font-mono font-medium text-neutral-300">
                            Question {mcq.id} ({mcq.unit})
                          </span>
                          <span className="text-xs font-mono text-neutral-400 bg-[#262626] px-2.5 py-0.5 rounded font-normal">
                            {mcq.category}
                          </span>
                        </div>

                        {/* Question Text (UNBOLDED & LARGER) */}
                        <h3 className="text-base sm:text-lg font-normal text-white leading-relaxed tracking-wide">
                          {mcq.question}
                        </h3>

                        {/* Options List (UNBOLDED & LARGER) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {mcq.options.map((opt, optIdx) => {
                            const isCorrect = optIdx === mcq.correctIndex;
                            return (
                              <div
                                key={optIdx}
                                className={`p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 font-normal transition ${
                                  isCorrect
                                    ? "bg-white text-black font-medium border-white"
                                    : "bg-[#050505] border-[#262626] text-neutral-300"
                                }`}
                              >
                                <span className="font-mono font-medium shrink-0">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <span className="flex-1 font-normal">{opt}</span>
                                {isCorrect && (
                                  <span className="text-[10px] bg-black text-white font-mono px-1.5 py-0.5 rounded font-medium shrink-0">
                                    CORRECT
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation Box Pre-Revealed (UNBOLDED & CLEAN) */}
                        <div className="bg-[#050505] border border-[#262626] rounded-xl p-3.5 space-y-1.5">
                          <div className="text-xs font-medium text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                            Explanation
                          </div>
                          <p className="text-xs sm:text-sm text-neutral-300 font-normal leading-relaxed">
                            {mcq.explanation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MODE 2: INTERACTIVE QUIZ MODE */}
              {mcqViewMode === "quiz" && (
                <div>
                  {filteredMCQs.length > 0 ? (
                    <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 sm:p-7 space-y-6 max-w-3xl mx-auto shadow-xl">
                      
                      {/* Question Header */}
                      <div className="flex items-center justify-between border-b border-[#262626] pb-3.5">
                        <span className="text-xs sm:text-sm font-mono font-normal text-neutral-400">
                          Q {currentQuizIndex + 1} of {filteredMCQs.length} (ID: Q{filteredMCQs[currentQuizIndex].id})
                        </span>
                        <span className="text-xs font-normal text-white bg-[#262626] px-2.5 py-1 rounded font-mono">
                          {filteredMCQs[currentQuizIndex].category} ({filteredMCQs[currentQuizIndex].unit})
                        </span>
                      </div>

                      {/* Question Text (UNBOLDED & LARGER) */}
                      <h3 className="text-base sm:text-xl font-normal text-white leading-relaxed">
                        {filteredMCQs[currentQuizIndex].question}
                      </h3>

                      {/* Options (UNBOLDED & LARGER) */}
                      <div className="space-y-3">
                        {filteredMCQs[currentQuizIndex].options.map((opt, optIdx) => {
                          const currentQId = filteredMCQs[currentQuizIndex].id;
                          const selectedAns = userAnswers[currentQId];
                          const isAnswered = selectedAns !== undefined;
                          const isCorrectOpt = optIdx === filteredMCQs[currentQuizIndex].correctIndex;
                          const isUserSelected = selectedAns === optIdx;

                          let btnStyle = "bg-[#050505] border-[#262626] text-neutral-300 hover:border-white font-normal";
                          if (isAnswered) {
                            if (isCorrectOpt) {
                              btnStyle = "bg-white text-black font-medium border-white";
                            } else if (isUserSelected) {
                              btnStyle = "bg-[#262626] border-white text-white font-normal";
                            } else {
                              btnStyle = "bg-[#050505] border-[#1a1a1a] text-neutral-600 opacity-50 font-normal";
                            }
                          }

                          return (
                            <button
                              key={optIdx}
                              disabled={isAnswered}
                              onClick={() => {
                                setUserAnswers((prev) => ({ ...prev, [currentQId]: optIdx }));
                              }}
                              className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed transition flex items-center justify-between ${btnStyle}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center font-mono text-xs font-normal shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="font-normal">{opt}</span>
                              </div>
                              {isAnswered && isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-current shrink-0" />}
                              {isAnswered && isUserSelected && !isCorrectOpt && (
                                <XCircle className="w-4 h-4 text-current shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Box when answered */}
                      {userAnswers[filteredMCQs[currentQuizIndex].id] !== undefined && (
                        <div className="bg-[#050505] border border-[#333] rounded-xl p-4 space-y-1.5 animate-fadeIn">
                          <div className="text-xs sm:text-sm font-medium text-white flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            Explanation & Concept
                          </div>
                          <p className="text-xs sm:text-sm text-neutral-300 font-normal leading-relaxed">
                            {filteredMCQs[currentQuizIndex].explanation}
                          </p>
                        </div>
                      )}

                      {/* Quiz Controls Footer */}
                      <div className="flex items-center justify-between border-t border-[#262626] pt-4 gap-2">
                        <button
                          disabled={currentQuizIndex === 0}
                          onClick={() => setCurrentQuizIndex((prev) => Math.max(0, prev - 1))}
                          className="px-4 py-2 rounded-lg bg-[#262626] hover:bg-[#333] text-xs sm:text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          Prev
                        </button>

                        <span className="text-xs sm:text-sm text-neutral-400 font-normal">
                          Score: <strong className="text-white font-medium">{quizStats.correctCount}</strong> / {quizStats.totalAnswered}
                        </span>

                        <button
                          disabled={currentQuizIndex === filteredMCQs.length - 1}
                          onClick={() => setCurrentQuizIndex((prev) => Math.min(filteredMCQs.length - 1, prev + 1))}
                          className="px-4 py-2 rounded-lg bg-white text-black font-medium text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed transition shadow"
                        >
                          Next
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-12 text-neutral-500 font-normal">No questions found.</div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: COMMAND REFERENCE VIEW                                             */}
          {/* ========================================================================= */}
          {activeTab === "commands" && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Command Reference Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-white shrink-0" />
                    Django CLI & API Command Reference
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Quick lookup cheat-sheet for CLI commands, SQLite3 Python API, and DRF Endpoints
                  </p>
                </div>

                {/* Filter Category */}
                <div className="flex items-center gap-2">
                  <select
                    value={commandCategory}
                    onChange={(e) => setCommandCategory(e.target.value)}
                    className="w-full sm:w-auto bg-[#121212] border border-[#262626] text-white text-xs rounded-lg px-3 py-1.5 font-medium outline-none focus:border-white"
                  >
                    <option value="all">All Categories</option>
                    <option value="Django CLI">Django CLI</option>
                    <option value="SQLite3 Direct API">SQLite3 Direct API</option>
                    <option value="DRF Endpoints">DRF Endpoints</option>
                    <option value="Auth & JWT">Auth & JWT</option>
                  </select>
                </div>
              </div>

              {/* Commands List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COMMAND_REFERENCE.filter(
                  (c) => commandCategory === "all" || c.category === commandCategory
                ).map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#121212] border border-[#262626] hover:border-white rounded-xl p-4 space-y-3 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-white bg-[#262626] px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] font-mono text-neutral-400 bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#262626]">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-300 font-medium">{item.description}</p>

                    <div className="relative group rounded-lg overflow-hidden border border-[#262626] bg-[#000000]">
                      <div className="flex items-center justify-between px-3 py-1 bg-[#171717] text-[10px] font-mono text-neutral-400 border-b border-[#262626]">
                        <span>Syntax / Example</span>
                        <button
                          onClick={() => handleCopyCode(item.example)}
                          className="flex items-center gap-1 hover:text-white transition"
                        >
                          {copiedCode === item.example ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedCode === item.example ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <pre className="p-2.5 text-xs font-mono text-neutral-200 overflow-x-auto">
                        <code>{item.example}</code>
                      </pre>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* ⌘K GLOBAL COMMAND PALETTE SEARCH MODAL                                    */}
      {/* ========================================================================= */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-10 sm:pt-20 px-3">
          <div className="bg-[#121212] border border-[#333] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden space-y-0">
            
            {/* Input Header */}
            <div className="p-3.5 border-b border-[#262626] flex items-center gap-2.5">
              <Search className="w-4 h-4 text-white shrink-0" />
              <input
                type="text"
                autoFocus
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search notes, 75 MCQs, commands..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-neutral-500 outline-none"
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1 text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results Container */}
            <div className="max-h-80 sm:max-h-96 overflow-y-auto p-3.5 space-y-3.5">
              {!globalSearch.trim() ? (
                <div className="text-center py-8 text-xs text-neutral-500">
                  Type to search across all 75 MCQs and Django revision resources...
                </div>
              ) : (
                <>
                  {/* Matched Notes */}
                  {searchResults.notes.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Study Notes ({searchResults.notes.length})
                      </div>
                      {searchResults.notes.map((note) => (
                        <div
                          key={note.id}
                          onClick={() => {
                            handleNavClick("notes", note.id);
                            setIsSearchOpen(false);
                          }}
                          className="p-2.5 bg-[#1a1a1a] hover:bg-[#262626] rounded-xl cursor-pointer transition border border-[#262626]"
                        >
                          <div className="text-xs font-bold text-white">{note.title}</div>
                          <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                            {note.content.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matched Commands */}
                  {searchResults.commands.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        Commands ({searchResults.commands.length})
                      </div>
                      {searchResults.commands.map((cmd, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            handleNavClick("commands");
                            setIsSearchOpen(false);
                          }}
                          className="p-2.5 bg-[#1a1a1a] hover:bg-[#262626] rounded-xl cursor-pointer transition border border-[#262626]"
                        >
                          <div className="text-xs font-mono font-bold text-white">{cmd.command}</div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">{cmd.description}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matched MCQs */}
                  {searchResults.mcqs.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        75 MCQs Bank ({searchResults.mcqs.length} Matches)
                      </div>
                      {searchResults.mcqs.map((mcq) => (
                        <div
                          key={mcq.id}
                          onClick={() => {
                            setQuizUnit(mcq.unit);
                            handleNavClick("quiz");
                            setIsSearchOpen(false);
                          }}
                          className="p-2.5 bg-[#1a1a1a] hover:bg-[#262626] rounded-xl cursor-pointer transition border border-[#262626]"
                        >
                          <div className="text-xs font-bold text-white">{mcq.question}</div>
                          <div className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                            {mcq.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-3 bg-[#0a0a0a] border-t border-[#262626] text-[10px] sm:text-[11px] text-neutral-500 flex justify-between">
              <span>Press <kbd className="text-neutral-400 font-mono">ESC</kbd> to close</span>
              <span>Django Study Hub</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
