import React, { useState, useEffect, useRef } from "react";
import { Send, HelpCircle, Sparkles, RefreshCw, Trash2, ShieldCheck, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage } from "../types";

export default function ComplianceChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch chat history on load
  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/chat/history");
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error fetching chat history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput("");
    setIsLoading(true);

    // Optimistically add user message (will be re-fetched or kept in local state)
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: userMsg,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!response.ok) {
        throw new Error("Failed to get bot reply");
      }

      const data = await response.json();
      
      const botMsg: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: Date.now() + 2,
        role: "assistant",
        content: "I apologize, but I had trouble consulting the regulatory knowledge base. Please verify that your Gemini API key is configured.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    if (confirm("Are you sure you want to clear chat history?")) {
      try {
        await fetch("/api/chat/history/clear", { method: "POST" });
        setMessages([]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getStarterQuestions = () => [
    "What are FDA double verification guidelines under 21 CFR 211?",
    "How should a QC specialist handle out-of-specification (OOS) results?",
    "Explain computer system validation requirements under EU GMP Annex 11.",
    "Help me draft an SOP change control procedure outline."
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[520px]">
      {/* Chat header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">GxPilot Regulation Copilot</h2>
            <p className="text-[10px] text-slate-400">FDA 21 CFR & EU GMP compliance oracle</p>
          </div>
        </div>
        
        <button
          onClick={clearHistory}
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Clear Chat History"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-6">
            <ShieldCheck className="h-10 w-10 text-blue-600 mb-2.5 stroke-1" />
            <h3 className="text-sm font-bold text-slate-800">Pharmaceutical Compliance Advisor</h3>
            <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
              Ask GxPilot anything about CFR clauses, warning letter analysis, deviation corrective actions, or release guidelines.
            </p>
            
            <div className="grid grid-cols-1 gap-2 mt-6 max-w-md w-full">
              {getStarterQuestions().map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(q)}
                  className="p-2.5 text-left bg-white border border-slate-250 hover:border-blue-400 rounded-xl text-xs text-slate-700 hover:text-blue-600 font-sans transition-all shadow-2xs cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed font-sans shadow-2xs ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none whitespace-pre-wrap"
                  }`}
                >
                  <div className="prose prose-sm max-w-none">
                    {msg.content}
                  </div>
                  <div
                    className={`text-[9px] mt-1.5 font-mono ${
                      msg.role === "user" ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3.5 rounded-2xl rounded-bl-none shadow-2xs flex items-center gap-2 text-xs text-slate-500 font-sans">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span>GxPilot is searching compliance guidelines...</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {/* Input container */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex gap-2">
        <input
          type="text"
          placeholder="Ask GxPilot about FDA 21 CFR, EU GMP or batch release guidance..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-3.5 py-2 border border-slate-250 focus:outline-none focus:border-blue-500 rounded-xl text-xs font-medium"
        />
        <button
          type="submit"
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
