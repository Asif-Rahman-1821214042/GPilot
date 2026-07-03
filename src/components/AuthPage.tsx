import React, { useState } from "react";
import { BadgeCheck, LockKeyhole, LogIn, UserPlus } from "lucide-react";

type AuthUser = {
  id: string;
  name: string;
  staff_id: string;
  designation: string;
  type: string;
};

type AuthPageProps = {
  onAuthenticated: (token: string, user: AuthUser) => void;
};

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const payload = isSignup
      ? { name, staff_id: staffId, password, designation, type: "" }
      : { staff_id: staffId, password };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed");
      }
      onAuthenticated(data.access_token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 grid lg:grid-cols-[0.9fr_1.1fr]">
      <section className="hidden lg:flex flex-col justify-between bg-slate-950 text-white px-12 py-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xl">
            G
          </div>
          <div className="font-bold tracking-tight text-xl">
            GxPilot<span className="text-blue-400 font-mono">.ai</span>
          </div>
        </div>
        <div className="max-w-md">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300 border border-emerald-400/30 rounded-full px-3 py-1 mb-6">
            <BadgeCheck className="h-3.5 w-3.5" />
            Controlled Access
          </div>
          <h1 className="text-4xl font-black tracking-tight leading-tight">
            Sign in to the compliance workspace.
          </h1>
          <p className="mt-5 text-slate-300 leading-7">
            Staff credentials keep audit-ready document preparation, review history, and quality analytics tied to accountable users.
          </p>
        </div>
        <p className="text-xs text-slate-500 font-mono">
          JWT secured access with FastAPI HTTP bearer authentication.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xl">
              G
            </div>
            <div className="font-bold tracking-tight text-xl">
              GxPilot<span className="text-blue-600 font-mono">.ai</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 sm:p-8">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mb-7">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 h-9 rounded-md text-sm font-semibold flex items-center justify-center gap-2 ${!isSignup ? "bg-white text-blue-700 shadow-xs" : "text-slate-600"}`}
              >
                <LogIn className="h-4 w-4" />
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 h-9 rounded-md text-sm font-semibold flex items-center justify-center gap-2 ${isSignup ? "bg-white text-blue-700 shadow-xs" : "text-slate-600"}`}
              >
                <UserPlus className="h-4 w-4" />
                Sign up
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {isSignup && (
                <label className="block">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Staff ID</span>
                <input value={staffId} onChange={(e) => setStaffId(e.target.value)} required className="mt-1 w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>

              {isSignup && (
                <label className="block">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Designation</span>
                  <input value={designation} onChange={(e) => setDesignation(e.target.value)} required className="mt-1 w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Password</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isSignup ? 6 : 1} className="mt-1 w-full h-11 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>

              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

              <button disabled={isSubmitting} className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                <LockKeyhole className="h-4 w-4" />
                {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Login"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
