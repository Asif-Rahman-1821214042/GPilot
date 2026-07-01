import React, { useState } from "react";
import { 
  BookOpen, ChevronRight, AlertCircle, Sparkles, FileText, 
  FileSpreadsheet, ShieldAlert, ArrowRight, CheckCircle2, 
  Clock, CheckSquare, Layers, HelpCircle, HardDrive
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface InteractiveStoryProps {
  onSelectSOP: () => void;
  onSelectAPQR: () => void;
  onSelectDesk: () => void;
}

export default function InteractiveStory({ onSelectSOP, onSelectAPQR, onSelectDesk }: InteractiveStoryProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentScenario, setCurrentScenario] = useState<number>(0);

  const scenarios = [
    {
      id: 0,
      title: "ভূমিকা ও সমস্যা (The Desk of QA Rahim)",
      subtitle: "আগে কেমন ছিল?",
      badge: "Manual Pain",
      color: "border-rose-300 bg-rose-50/50 text-rose-900",
      icon: <AlertCircle className="h-5 w-5 text-rose-600 animate-bounce" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-serif">
            ধরুন, <strong>ACI Healthcare</strong>-এ প্রতিদিন হাজার হাজার ওষুধ তৈরি হয়। একদিন QA অফিসার রাহিমের ডেস্কে পাহাড়সম কাজ এসে জমা হলো। নতুন <strong>SOP</strong> লিখতে হবে, <strong>APQR রিপোর্ট</strong> বানাতে হবে, <strong>Batch Record</strong> চেক করতে হবে এবং <strong>Regulatory Guideline</strong>-এর সাথে সব মিলিয়ে দেখতে হবে।
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100 text-[11px] text-rose-950 space-y-1">
              <span className="font-extrabold uppercase tracking-wider text-[9px] text-rose-700 block">🛑 আগের জটিলতা:</span>
              <p>রাহিমকে একেকটি তথ্য খুঁজতে Production, QC, Regulatory, ERP, Excel, Word, Email—সব জায়গায় ঘুরতে হতো। একটি APQR রিপোর্ট বানাতেই ২–৩ সপ্তাহ লেগে যেত!</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 space-y-1">
              <span className="font-extrabold uppercase tracking-wider text-[9px] text-slate-500 block">⚠️ QA Manager-এর টেনশন:</span>
              <p>রিপোর্ট লাইন বাই লাইন রিভিউ করা হতো। যদি একটি Signature বা Temperature Limit একটুও ভুল হয়, পুরো ফাইল রিজেক্ট হয়ে ফেরত যেত। অনেক সময় ও অর্থ অপচয় হতো।</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 1,
      title: "Scenario 1 – SOP তৈরি (SOP Drafting)",
      subtitle: "মিনিটের মধ্যে স্ট্যান্ডার্ড SOP ড্রাফট",
      badge: "Scenario 1",
      color: "border-indigo-300 bg-indigo-50/50 text-indigo-950",
      icon: <FileText className="h-5 w-5 text-indigo-600" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-serif">
            QA অফিসার শুধু লিখল: <span className="bg-white px-2 py-0.5 rounded border font-mono font-bold text-indigo-700">"Tablet manufacturing cleaning procedure তৈরি করতে হবে।"</span>
          </p>
          <div className="p-4 bg-white border border-indigo-150 rounded-xl space-y-2.5">
            <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 animate-spin text-amber-500" />
              GxPilot AI Assistant-এর কার্যক্রম:
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1.5 pl-1.5 list-none">
              <li className="flex items-start gap-1.5"><span className="text-emerald-500 font-black">✔</span> কোম্পানির স্ট্যান্ডার্ড টেমপ্লেট ও পূর্ববর্তী SOP স্বয়ংক্রিয়ভাবে বিশ্লেষণ করে।</li>
              <li className="flex items-start gap-1.5"><span className="text-emerald-500 font-black">✔</span> FDA 21 CFR Part 211 গাইডলাইন রেফারেন্স যুক্ত করে।</li>
              <li className="flex items-start gap-1.5"><span className="text-emerald-500 font-black">✔</span> ইউনিক <strong>Document ID</strong>, <strong>Version Number</strong> ও কার্যকর তারিখ সেট করে।</li>
            </ul>
          </div>
          <div className="flex justify-end pt-1">
            <button 
              type="button"
              onClick={onSelectSOP}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              SOP ড্রাফটার ফিচারে যান
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "Scenario 2 – APQR Report (Quality Summary)",
      subtitle: "স্বয়ংক্রিয় অ্যানালিটিক্যাল ডেটা কম্পাইল",
      badge: "Scenario 2",
      color: "border-emerald-300 bg-emerald-50/50 text-emerald-950",
      icon: <FileSpreadsheet className="h-5 w-5 text-emerald-600" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-serif">
            আগে প্রোডাকশন, QC রেজাল্ট, স্ট্যাবিলিটি রিপোর্ট, এবং কাস্টমার কমপ্লেইন ফাইলগুলো একে একে ঘাটাঘাটি করে ডেটা এক্সেল শিটে তোলা হতো।
          </p>
          <div className="p-3.5 bg-emerald-950 text-emerald-100 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">GxPilot Pipeline Flow:</span>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-900 px-2 py-0.5 rounded">FDA Compliant</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono divide-x divide-emerald-800">
              <div className="px-2 text-center flex-1">
                <span className="block font-bold">LIMS / SAP</span>
                <span className="text-[10px] text-emerald-300">Analytical</span>
              </div>
              <div className="px-2 text-center flex-1">
                <span className="block font-bold">LIMS / Excel</span>
                <span className="text-[10px] text-emerald-300">Aggregated</span>
              </div>
              <div className="px-2 text-center flex-1">
                <span className="block font-bold">GxPilot AI</span>
                <span className="text-[10px] text-emerald-300">Report & Trend</span>
              </div>
            </div>
            <p className="text-[11px] text-emerald-200 leading-relaxed font-serif border-t border-emerald-800 pt-2">
              <strong>GxPilot</strong> সকল সোর্স থেকে সরাসরি ফাইল রিড করে গ্রাফ, ট্রেন্ড অ্যানালাইসিস এবং চূড়ান্ত পিডিএফে কনভার্ট করে এক ক্লিকে রেডি করে দেয়।
            </p>
          </div>
          <div className="flex justify-end pt-1">
            <button 
              type="button"
              onClick={onSelectAPQR}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              APQR কম্পাইলার ট্রাই করুন
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: "Scenario 3 – Batch Record Review",
      subtitle: "১০০% নির্ভুল অ্যানোমালি ও এক্সকারশন স্ক্যানিং",
      badge: "Scenario 3",
      color: "border-blue-300 bg-blue-50/50 text-blue-950",
      icon: <ShieldAlert className="h-5 w-5 text-blue-600" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-serif">
            আগে রাহিম বা QA ম্যানেজারকে শত শত পৃষ্ঠার ইন-প্রসেস রেকর্ড রিড করতে হতো। এখন এআই সম্পূর্ণ ফাইল সেকেন্ডে স্ক্যান করে ঝুঁকিপূর্ণ অসঙ্গতিগুলো সামনে এনে দেয়।
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
              <span className="text-[9px] font-extrabold text-red-600 uppercase tracking-widest block">❌ সনাক্তকৃত ত্রুটি:</span>
              <ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                <li>যেকোনো সিগনেচার মিসিং থাকলে।</li>
                <li>তাপমাত্রা নির্দিষ্ট লিমিট পার হলে (Excursion)।</li>
                <li>ভুল ডেট বা কম ইল্ড পার্সেন্টেজ।</li>
              </ul>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
              <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest block">✔ এআই সিদ্ধান্ত:</span>
              <ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                <li>রিলিজের ঝুঁকি মূল্যায়ন।</li>
                <li>লাইন বাই লাইন অ্যানোমালি হাইলাইট।</li>
                <li>"Release Recommended" বা "Hold Required" ডিসিশন সাপোর্ট।</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button 
              type="button"
              onClick={onSelectDesk}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              Batch Record অডিট ডেস্কে যান
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Scenario 4 – Document Review & ROI",
      subtitle: "ভার্সন ডিফারেন্স ট্র্যাকিং ও সার্বিক সুবিধা",
      badge: "Benefits & ROI",
      color: "border-amber-300 bg-amber-50/50 text-amber-950",
      icon: <Clock className="h-5 w-5 text-amber-600" />,
      content: (
        <div className="space-y-4">
          <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-serif">
            SOP ভার্সন ৫ থেকে ৬ পরিবর্তনের পর, GxPilot নিজে থেকেই দুটি ফাইল কম্পেয়ার করে বলে দেবে কোন লাইনটি চেঞ্জ হয়েছে এবং কোন FDA বা GxP আইনের সাথে এটি সাংঘর্ষিক হতে পারে।
          </p>
          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono font-bold uppercase mb-2 border-b border-slate-800 pb-1.5">
              <span>ACI Healthcare - GxPilot Dashboard Metrics</span>
              <span className="text-amber-400">🔥 60%-80% Time Saved</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-850 p-2 rounded-lg border border-slate-800">
                <span className="text-[8px] text-slate-400 uppercase font-mono block">রিপোর্ট সময়</span>
                <span className="text-xs font-black text-rose-400 line-through">৩ সপ্তাহ</span>
                <span className="text-xs font-black text-emerald-400 block">১ দিন</span>
              </div>
              <div className="bg-slate-850 p-2 rounded-lg border border-slate-800">
                <span className="text-[8px] text-slate-400 uppercase font-mono block">ভুলের সম্ভাবনা</span>
                <span className="text-xs font-black text-rose-400 block">উচ্চ</span>
                <span className="text-xs font-black text-emerald-400 block">প্রায় ০%</span>
              </div>
              <div className="bg-slate-850 p-2 rounded-lg border border-slate-800">
                <span className="text-[8px] text-slate-400 uppercase font-mono block">অডিট প্রস্তুতি</span>
                <span className="text-xs font-black text-slate-400 block">ম্যানুয়াল</span>
                <span className="text-xs font-black text-amber-400 block">২৪/৭ রেডি</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 italic text-center leading-normal">
            * শেষ সিদ্ধান্ত সর্বদা একজন মানুষেরই (QA Manager) থাকবে। হিউম্যান-ইন-দ্য-লুপ অডিট রেগুলেশনের একটি মূল স্তম্ভ।
          </p>
        </div>
      )
    }
  ];

  const handleNext = () => {
    setCurrentScenario(prev => (prev + 1) % scenarios.length);
  };

  const handlePrev = () => {
    setCurrentScenario(prev => (prev - 1 + scenarios.length) % scenarios.length);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
      
      {/* Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-850 text-slate-100 px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800 select-none transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 text-blue-400" />
          <div>
            <h3 className="text-sm font-bold tracking-tight">গল্পের মাধ্যমে প্রজেক্টটি বুঝি (GxPilot Storyline Dashboard)</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">ACI Healthcare-এ QA অফিসার রাহিমের ডেস্কে GxPilot-এর দৈনন্দিন জাদুকরী ভূমিকা</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-900 px-2 py-0.5 rounded font-extrabold uppercase tracking-wide">
            Interactive Guide
          </span>
          <span className="text-slate-400 text-xs font-bold font-mono">
            {isOpen ? "Collapse [-]" : "Expand [+]"}
          </span>
        </div>
      </div>

      {/* Expanded Story Canvas */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-slate-150"
          >
            <div className="p-5 md:p-6 bg-slate-50/50">
              
              {/* Stepper Grid Selector */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
                {scenarios.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentScenario(idx)}
                    className={`px-3 py-2 text-left rounded-xl border transition-all cursor-pointer ${
                      currentScenario === idx
                        ? "bg-white text-blue-700 border-blue-300 shadow-2xs font-extrabold"
                        : "bg-slate-50/60 text-slate-600 border-slate-200 hover:bg-white"
                    }`}
                  >
                    <span className="block text-[8px] text-slate-400 uppercase font-bold tracking-widest">{s.badge}</span>
                    <span className="text-[11px] truncate block mt-0.5 font-sans">{s.title.split(" (")[0]}</span>
                  </button>
                ))}
              </div>

              {/* Main Content Area */}
              <div className="bg-white rounded-2xl border border-slate-200/95 p-5 md:p-6 shadow-3xs relative min-h-[220px] flex flex-col justify-between">
                
                {/* Visual Watermark Indicator */}
                <div className="absolute right-4 top-4 select-none pointer-events-none text-[3rem] font-black opacity-[0.025] uppercase tracking-wider">
                  GxPilot
                </div>

                <div className="space-y-4">
                  {/* Scenario Meta Info */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-slate-100 rounded-lg border border-slate-150">
                        {scenarios[currentScenario].icon}
                      </div>
                      <div>
                        <span className="text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                          {scenarios[currentScenario].badge}
                        </span>
                        <h4 className="text-sm font-black text-slate-800 tracking-tight mt-1">{scenarios[currentScenario].title}</h4>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-bold italic hidden sm:inline">{scenarios[currentScenario].subtitle}</span>
                  </div>

                  {/* Scenario Body content */}
                  <div>
                    {scenarios[currentScenario].content}
                  </div>
                </div>

                {/* Bottom Navigation controls */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
                  <span className="text-[10px] font-mono text-slate-400">
                    Scenario <strong className="text-slate-700">{currentScenario + 1}</strong> of <strong className="text-slate-700">{scenarios.length}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      পূর্ববর্তী
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      পরবর্তী
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
