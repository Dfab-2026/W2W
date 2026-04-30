'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, HardHat, MapPin, Search, Bell, Star, Phone, Send, Plus, LogOut,
  Sparkles, ShieldCheck, ArrowRight, Smartphone, Apple, Loader2, Building2,
  Hammer, Users, ClipboardList, Clock, CheckCircle2, XCircle, MessageSquare,
  Edit3, Camera, ChevronLeft, Filter, Banknote, Upload, ArrowLeft, Image as ImgIcon,
  Mail, KeyRound, Hash, Copy, Eye, EyeOff, Lock, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

import { getSupabase } from '@/lib/supabase/client';

// ----------------------------- helpers -----------------------------
const SESSION_KEY = 'w2w-session';

function saveSession(session, role, profile) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ session, role, profile }));
}
function loadSession() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
  // Also wipe Supabase's own cached auth so getSession() doesn't resurrect a stale token.
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k === 'w2w-auth' || k.startsWith('sb-')) localStorage.removeItem(k);
    });
  } catch {}
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function uploadFile(file, kind, token) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('kind', kind);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data; // { url, path }
}

// ----------- PasswordInput (with eye toggle) -----------
function PasswordInput({ value, onChange, placeholder = '••••••••', autoComplete, className = '' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`pl-9 pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-indigo-600 transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ----------- 3D Tilt wrapper (mouse parallax) -----------
function Tilt3D({ children, className = '', max = 14 }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * max;
    const ry = (x - 0.5) * max;
    ref.current.style.transform = `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.01)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`transition-transform duration-200 will-change-transform ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
}

// ----------- Floating particles backdrop -----------
function Particles({ count = 18, color = 'bg-white/30' }) {
  const particles = useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 4 + Math.random() * 8,
      d: 4 + Math.random() * 6,
      delay: Math.random() * 4,
    })),
    [count]
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${color} blur-[1px]`}
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -40, 0], opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: p.d, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ----------- Animated gradient mesh background -----------
function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-indigo-500/30 blur-3xl"
        animate={{ x: [0, 80, 0], y: [0, 60, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -right-40 w-[26rem] h-[26rem] rounded-full bg-emerald-400/30 blur-3xl"
        animate={{ x: [0, -60, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 left-1/3 w-[22rem] h-[22rem] rounded-full bg-fuchsia-400/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const initials = (name) => (name || '').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() || '?';

// ============================================================
// MAIN APP — single combined login, role only matters at signup
// ============================================================
export default function App() {
  // screens: 'splash' | 'login' | 'signup-role' | 'signup-form' | 'signup-otp'
  //        | 'oauth-role' | 'forgot-email' | 'forgot-reset' | 'worker-app' | 'employer-app'
  const [screen, setScreen] = useState('splash');
  const [auth, setAuth] = useState(null);
  const [signup, setSignup] = useState({ role: null, full_name: '', email: '', password: '' });
  const [oauthCtx, setOauthCtx] = useState(null);
  const [forgotEmail, setForgotEmail] = useState('');

  // ----- Boot sequence -----
  useEffect(() => {
    const boot = async () => {
      const s = loadSession();
      if (s?.session?.access_token) {
        // Validate saved session against the server
        try {
          const me = await api('me', { token: s.session.access_token });
          if (me?.profile?.id) {
            const validated = {
              session: s.session,
              role: me.profile.role || s.role,
              profile: me.profile,
            };
            saveSession(validated.session, validated.role, validated.profile);
            setAuth(validated);
            setScreen(validated.role === 'employer' ? 'employer-app' : 'worker-app');
            return;
          }
        } catch {
          // token invalid/expired — fall through to login
        }
        clearSession();
      }

      // Detect Supabase OAuth callback (hash fragment with access_token)
      try {
        const supa = getSupabase();
        const { data } = await supa.auth.getSession();
        if (data?.session?.access_token) {
          const fin = await api('auth/oauth-finalize', {
            method: 'POST', body: { access_token: data.session.access_token },
          });
          if (fin.needs_role) {
            setOauthCtx({ access_token: data.session.access_token, email: fin.email, full_name: fin.full_name });
            setScreen('oauth-role');
            return;
          }
          const profile = fin.profile || { id: data.session.user.id, role: fin.role, login_id: fin.login_id };
          const payload = { session: data.session, role: fin.role, profile };
          saveSession(payload.session, payload.role, payload.profile);
          setAuth(payload);
          setScreen(fin.role === 'employer' ? 'employer-app' : 'worker-app');
          if (typeof window !== 'undefined' && window.location.hash) {
            window.history.replaceState({}, '', window.location.pathname);
          }
          return;
        }
      } catch (e) { /* no oauth session */ }

      const t = setTimeout(() => setScreen('login'), 1300);
      return () => clearTimeout(t);
    };
    boot();
  }, []);

  const handleLogout = async () => {
    try { await getSupabase().auth.signOut(); } catch {}
    clearSession();
    setAuth(null);
    setSignup({ role: null, full_name: '', email: '', password: '' });
    setScreen('login');
  };

  const handleAuthed = (data) => {
    const payload = { session: data.session, role: data.role, profile: data.profile || data.user };
    saveSession(payload.session, payload.role, payload.profile);
    setAuth(payload);
    setScreen(data.role === 'employer' ? 'employer-app' : 'worker-app');
    toast.success('Welcome to Work2Wish!');
  };

  // -- helper for OAuth role pick
  const completeOAuthRole = async (role) => {
    try {
      const fin = await api('auth/oauth-finalize', {
        method: 'POST', body: { access_token: oauthCtx.access_token, role },
      });
      const supa = getSupabase();
      const { data } = await supa.auth.getSession();
      const profile = fin.profile || { role: fin.role, login_id: fin.login_id };
      handleAuthed({ session: data.session, role: fin.role, profile });
    } catch (e) { toast.error(e.message); }
  };

  return (
    <AnimatePresence mode="wait">
      {screen === 'splash' && <Splash key="splash" />}
      {screen === 'login' && (
        <LoginPage key="login"
          onAuthed={handleAuthed}
          onGotoSignup={() => setScreen('signup-role')}
          onGotoForgot={() => setScreen('forgot-email')} />
      )}
      {screen === 'forgot-email' && (
        <ForgotEmail key="forgot-email"
          onSent={(email) => { setForgotEmail(email); setScreen('forgot-reset'); }}
          onBack={() => setScreen('login')} />
      )}
      {screen === 'forgot-reset' && (
        <ForgotReset key="forgot-reset"
          email={forgotEmail}
          onAuthed={handleAuthed}
          onBack={() => setScreen('forgot-email')} />
      )}
      {screen === 'signup-role' && (
        <SignupRolePicker key="signup-role"
          onPick={(role) => { setSignup(s => ({ ...s, role })); setScreen('signup-form'); }}
          onBack={() => setScreen('login')} />
      )}
      {screen === 'signup-form' && (
        <SignupForm key="signup-form" data={signup}
          onChange={(p) => setSignup(s => ({ ...s, ...p }))}
          onSent={() => setScreen('signup-otp')}
          onBack={() => setScreen('signup-role')} />
      )}
      {screen === 'signup-otp' && (
        <SignupOTP key="signup-otp" data={signup}
          onAuthed={handleAuthed}
          onBack={() => setScreen('signup-form')} />
      )}
      {screen === 'oauth-role' && (
        <OAuthRolePicker key="oauth-role" ctx={oauthCtx} onPick={completeOAuthRole} />
      )}
      {screen === 'worker-app' && (
        <motion.div key="worker-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WorkerApp auth={auth} onLogout={handleLogout} />
        </motion.div>
      )}
      {screen === 'employer-app' && (
        <motion.div key="employer-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <EmployerApp auth={auth} onLogout={handleLogout} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// SPLASH (animated, 3D)
// ============================================================
function Splash() {
  return (
    <motion.div key="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-700 via-blue-600 to-emerald-500 p-6 overflow-hidden relative">
      <GradientMesh />
      <Particles count={28} color="bg-white/40" />
      <div className="text-center text-white relative" style={{ perspective: 1000 }}>
        <motion.div
          className="mx-auto w-32 h-32 rounded-3xl bg-white/15 backdrop-blur-md grid place-items-center ring-1 ring-white/40 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
          initial={{ rotateY: -180, scale: 0.5, opacity: 0 }}
          animate={{ rotateY: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 90, damping: 12 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <motion.div
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear', delay: 0.8 }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <Hammer className="w-16 h-16 drop-shadow-lg" />
          </motion.div>
        </motion.div>
        <motion.h1 className="text-7xl font-extrabold tracking-tight mt-8 drop-shadow-2xl"
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 80 }}>
          Work2Wish
        </motion.h1>
        <motion.p className="mt-4 text-white/90 text-xl"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          Real work, real wages, near you.
        </motion.p>
        <motion.div className="mt-10 flex justify-center gap-1.5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-white"
              animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================================
// LOGIN PAGE  (combined: email or login_id + password + Google)
// ============================================================
function LoginPage({ onAuthed, onGotoSignup, onGotoForgot }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) return toast.error('Enter email/login ID and password');
    setBusy(true);
    try {
      const data = await api('auth/login', { method: 'POST', body: { identifier, password } });
      onAuthed(data);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const google = async () => {
    try {
      const supa = getSupabase();
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supa.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
    } catch (e) {
      toast.error(`Google sign-in failed: ${e.message}. Make sure Google is enabled in Supabase Auth → Providers.`);
    }
  };

  return (
    <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 grid lg:grid-cols-2 relative overflow-hidden">
      {/* left: marketing with 3D depth */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-indigo-700 via-blue-600 to-emerald-500 text-white relative overflow-hidden">
        <GradientMesh />
        <Particles count={22} color="bg-white/30" />
        <div className="relative z-10" style={{ perspective: 1200 }}>
          <motion.div className="flex items-center gap-3"
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <motion.div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur grid place-items-center ring-1 ring-white/30"
              animate={{ rotate: [0, 8, 0, -8, 0] }} transition={{ duration: 6, repeat: Infinity }}>
              <Hammer className="w-6 h-6" />
            </motion.div>
            <span className="text-2xl font-extrabold">Work2Wish</span>
          </motion.div>
          <motion.h1 className="text-5xl font-extrabold leading-tight mt-16"
            initial={{ y: 30, opacity: 0, rotateX: -10 }} animate={{ y: 0, opacity: 1, rotateX: 0 }} transition={{ delay: 0.1, type: 'spring' }}
            style={{ transformStyle: 'preserve-3d' }}>
            Find day-work<br />or hire skilled hands.
          </motion.h1>
          <motion.p className="text-white/90 text-lg mt-4 max-w-md"
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            One platform for workers and employers. Apply, chat, get paid — all in your pocket.
          </motion.p>
          <motion.ul className="mt-8 space-y-3 text-sm"
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }}>
            {[
              { i: ShieldCheck, t: 'Verified employers and rated workers' },
              { i: MapPin,      t: 'Location-matched job recommendations' },
              { i: MessageSquare, t: 'Real-time chat between worker & employer' },
              { i: Sparkles,    t: 'Free for workers — pay only when hiring' },
            ].map((f, i) => (
              <motion.li key={i} variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                whileHover={{ x: 4 }}
                className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 grid place-items-center backdrop-blur"><f.i className="w-5 h-5" /></div>
                {f.t}
              </motion.li>
            ))}
          </motion.ul>

          {/* 3D Today-near-you preview card */}
          <Tilt3D className="mt-10 max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 ring-1 ring-white/30 shadow-2xl">
              <div className="flex items-center justify-between text-white/90 text-xs">
                <span className="font-semibold">Today near you</span>
                <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />Auto</span>
              </div>
              <div className="space-y-2 mt-3">
                {[
                  { t: 'Carpenter — 2 days', p: 1200, c: 'Modular Homes', d: '1.2 km' },
                  { t: 'Electrician — 1 day', p: 1500, c: 'BrightSpark', d: '0.6 km' },
                ].map((j, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.1 }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white/10">
                    <div className="w-8 h-8 rounded-lg bg-white/20 grid place-items-center text-white"><Hammer className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{j.t}</p>
                      <p className="text-[10px] opacity-80">{j.c} · {j.d}</p>
                    </div>
                    <span className="text-sm font-bold">{fmtMoney(j.p)}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </Tilt3D>
        </div>
        <p className="relative text-white/60 text-xs">© {new Date().getFullYear()} Work2Wish</p>
      </div>

      {/* right: form */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 relative">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-500 grid place-items-center text-white"><Hammer className="w-5 h-5" /></div>
            <span className="text-xl font-extrabold">Work2Wish</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">Welcome back</h2>
          <p className="text-muted-foreground mt-1">Log in to continue.</p>

          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
            <Button variant="outline" className="w-full h-12 mt-6 hover:shadow-md transition-shadow"
                    onClick={google}>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.4 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c2.8 0 5.4 1.1 7.4 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.4 4.5 9.8 8.6 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-4.9c-2 1.4-4.4 2.4-6.9 2.4-5.3 0-9.7-3-11.3-7l-6.5 5C9.5 39.4 16.1 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 1.9-1.9 3.5-3.4 4.7l6 4.9C40 35.1 43.5 30 43.5 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
              Continue with Google
            </Button>
          </motion.div>

          <div className="flex items-center gap-3 my-6">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Email or Login ID</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="you@example.com or 234812" autoComplete="username" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                <button type="button" onClick={onGotoForgot} className="text-xs text-indigo-600 hover:underline font-medium">
                  Forgot password?
                </button>
              </div>
              <PasswordInput value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button type="submit" disabled={busy} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-shadow">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Log in <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </motion.div>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            New to Work2Wish?{' '}
            <button onClick={onGotoSignup} className="text-indigo-600 font-semibold hover:underline">Create an account</button>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================================
// FORGOT PASSWORD — Step 1: enter email
// ============================================================
function ForgotEmail({ onSent, onBack }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Enter your email');
    setBusy(true);
    try {
      await api('auth/forgot-password', { method: 'POST', body: { email } });
      toast.success(`If an account exists for ${email}, a code has been sent.`);
      onSent(email);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <motion.div key="forgot-email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col relative overflow-hidden">
      <GradientMesh />
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start m-6 relative"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex-1 flex items-center justify-center px-6 relative">
        <Tilt3D className="w-full max-w-md">
          <Card className="shadow-2xl border-0 ring-1 ring-black/5">
            <CardHeader className="text-center pb-2">
              <motion.div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 grid place-items-center text-white mb-3"
                animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Lock className="w-7 h-7" />
              </motion.div>
              <CardTitle className="text-2xl">Forgot your password?</CardTitle>
              <CardDescription>No worries — we'll email you a 6-digit code to reset it.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" className="pl-9" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                </div>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button type="submit" disabled={busy} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send reset code <Send className="w-4 h-4 ml-2" /></>}
                  </Button>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </Tilt3D>
      </div>
    </motion.div>
  );
}

// ============================================================
// FORGOT PASSWORD — Step 2: enter code + new password
// ============================================================
function ForgotReset({ email, onAuthed, onBack }) {
  const [code, setCode] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (code.length !== 6) return toast.error('Enter the 6-digit code');
    if (pw1.length < 6) return toast.error('Password must be at least 6 characters');
    if (pw1 !== pw2) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      const d = await api('auth/reset-password', {
        method: 'POST',
        body: { email, otp: code, new_password: pw1 },
      });
      toast.success('Password reset! You are now logged in.');
      onAuthed(d);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <motion.div key="forgot-reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col relative overflow-hidden">
      <GradientMesh />
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start m-6 relative"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex-1 flex items-center justify-center px-6 relative">
        <Tilt3D className="w-full max-w-md">
          <Card className="shadow-2xl border-0 ring-1 ring-black/5">
            <CardHeader className="text-center pb-2">
              <motion.div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-500 grid place-items-center text-white mb-3"
                animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <ShieldAlert className="w-7 h-7" />
              </motion.div>
              <CardTitle className="text-2xl">Reset your password</CardTitle>
              <CardDescription>Code sent to <b>{email}</b></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg" />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div>
                <Label>New password</Label>
                <PasswordInput value={pw1} onChange={e => setPw1(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <PasswordInput value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Type it again" autoComplete="new-password" />
              </div>
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button onClick={submit} disabled={busy || code.length !== 6}
                        className="w-full h-11 bg-indigo-600 hover:bg-indigo-700">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Reset password <CheckCircle2 className="w-4 h-4 ml-2" /></>}
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </Tilt3D>
      </div>
    </motion.div>
  );
}

// ============================================================
// SIGNUP — Step 1: pick role
// ============================================================
function SignupRolePicker({ onPick, onBack }) {
  return (
    <motion.div key="signup-role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6 flex flex-col relative overflow-hidden">
      <GradientMesh />
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start relative"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full relative">
        <motion.h1 className="text-4xl sm:text-5xl font-extrabold text-center"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          How will you use Work2Wish?
        </motion.h1>
        <p className="text-muted-foreground mt-2 text-center">Choose your role — you can't change this later.</p>

        <div className="grid sm:grid-cols-2 gap-5 mt-10 w-full" style={{ perspective: 1200 }}>
          {[
            { role: 'worker', icon: HardHat, color: 'indigo', title: "I'm a worker", sub: 'Find daily / short-term jobs near me' },
            { role: 'employer', icon: Briefcase, color: 'emerald', title: "I'm an employer", sub: 'Post jobs and hire skilled workers' },
          ].map((r, i) => (
            <motion.div key={r.role}
              initial={{ y: 30, opacity: 0, rotateY: i === 0 ? -20 : 20 }}
              animate={{ y: 0, opacity: 1, rotateY: 0 }}
              transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 90 }}>
              <Tilt3D max={20}>
                <button onClick={() => onPick(r.role)}
                  className={`w-full text-left p-7 bg-white rounded-2xl border-2 hover:border-${r.color}-500 hover:shadow-2xl transition-shadow group block`}>
                  <motion.div className={`w-16 h-16 rounded-2xl grid place-items-center text-white ${r.color === 'indigo' ? 'bg-gradient-to-br from-indigo-600 to-blue-500' : 'bg-gradient-to-br from-emerald-600 to-teal-500'} shadow-lg`}
                    whileHover={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 0.6 }}>
                    <r.icon className="w-8 h-8" />
                  </motion.div>
                  <p className="font-bold text-2xl mt-5">{r.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{r.sub}</p>
                  <div className={`mt-5 inline-flex items-center text-sm font-semibold ${r.color === 'indigo' ? 'text-indigo-600' : 'text-emerald-600'} group-hover:translate-x-1 transition-transform`}>
                    Continue <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </button>
              </Tilt3D>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// SIGNUP — Step 2: form
// ============================================================
function SignupForm({ data, onChange, onSent, onBack }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!data.full_name || !data.email || !data.password) return toast.error('Fill all fields');
    if (data.password.length < 6) return toast.error('Password must be at least 6 characters');
    setBusy(true);
    try {
      await api('auth/send-otp', { method: 'POST', body: data });
      toast.success(`OTP sent to ${data.email}`);
      onSent();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const accent = data.role === 'employer' ? 'emerald' : 'indigo';
  return (
    <motion.div key="signup-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-black/5">
          <CardHeader className="text-center pb-2">
            <div className={`w-14 h-14 mx-auto rounded-2xl grid place-items-center text-white mb-3 ${
              data.role === 'employer' ? 'bg-gradient-to-br from-emerald-600 to-teal-500' : 'bg-gradient-to-br from-indigo-600 to-blue-500'
            }`}>
              {data.role === 'employer' ? <Briefcase className="w-7 h-7" /> : <HardHat className="w-7 h-7" />}
            </div>
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>Signing up as <span className="font-semibold capitalize">{data.role}</span></CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Full name</Label>
                <Input value={data.full_name} onChange={e => onChange({ full_name: e.target.value })} placeholder="Your name" />
              </div>
              <div>
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" className="pl-9" value={data.email} onChange={e => onChange({ email: e.target.value })} placeholder="you@example.com" />
                </div>
              </div>
              <div>
                <Label>Password</Label>
                <PasswordInput value={data.password} onChange={e => onChange({ password: e.target.value })} placeholder="At least 6 characters" />
              </div>
              <Button type="submit" disabled={busy}
                      className={`w-full h-11 ${accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send OTP <Send className="w-4 h-4 ml-2" /></>}
              </Button>
              <p className="text-xs text-muted-foreground text-center">A 6-digit code will be sent to your email.</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// ============================================================
// SIGNUP — Step 3: enter OTP
// ============================================================
function SignupOTP({ data, onAuthed, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const verify = async () => {
    if (code.length !== 6) return toast.error('Enter the 6-digit code');
    setBusy(true);
    try {
      const d = await api('auth/verify-otp', { method: 'POST', body: { email: data.email, otp: code } });
      onAuthed(d);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const resend = async () => {
    setResending(true);
    try {
      await api('auth/resend-otp', { method: 'POST', body: { email: data.email } });
      toast.success('Sent a new code');
      setSecondsLeft(60); setCode('');
    } catch (e) { toast.error(e.message); } finally { setResending(false); }
  };

  const accent = data.role === 'employer' ? 'emerald' : 'indigo';

  return (
    <motion.div key="signup-otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-black/5">
          <CardHeader className="text-center pb-2">
            <motion.div className={`w-14 h-14 mx-auto rounded-2xl grid place-items-center text-white mb-3 ${
              accent === 'emerald' ? 'bg-gradient-to-br from-emerald-600 to-teal-500' : 'bg-gradient-to-br from-indigo-600 to-blue-500'
            }`}
              animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Mail className="w-7 h-7" />
            </motion.div>
            <CardTitle className="text-2xl">Verify your email</CardTitle>
            <CardDescription>We sent a 6-digit code to <b>{data.email}</b></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={verify} disabled={busy || code.length !== 6}
                    className={`w-full h-11 ${accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & continue <CheckCircle2 className="w-4 h-4 ml-2" /></>}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {secondsLeft > 0 ? (
                <>Didn't get it? Resend in <b>{secondsLeft}s</b></>
              ) : (
                <button onClick={resend} disabled={resending} className="text-indigo-600 font-semibold hover:underline disabled:opacity-50">
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// ============================================================
// OAuth (Google) — pick role for first-time Google sign-ins
// ============================================================
function OAuthRolePicker({ ctx, onPick }) {
  return (
    <motion.div key="oauth-role" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col items-center justify-center">
      <div className="text-center max-w-md">
        <motion.div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-500 grid place-items-center text-white"
          initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}>
          <Sparkles className="w-8 h-8" />
        </motion.div>
        <h1 className="text-3xl font-extrabold mt-4">Hi {ctx?.full_name || 'there'}!</h1>
        <p className="text-muted-foreground mt-1">One quick thing — how will you use Work2Wish?</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-8 w-full max-w-2xl">
        {[
          { role: 'worker', icon: HardHat, color: 'indigo', title: "I'm a worker", sub: 'Find jobs near me' },
          { role: 'employer', icon: Briefcase, color: 'emerald', title: "I'm an employer", sub: 'Hire workers' },
        ].map((r) => (
          <motion.button key={r.role} onClick={() => onPick(r.role)}
            whileHover={{ y: -4, scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className={`text-left p-6 bg-white rounded-2xl border-2 hover:border-${r.color}-500 hover:shadow-xl transition`}>
            <div className={`w-14 h-14 rounded-2xl grid place-items-center text-white ${r.color === 'indigo' ? 'bg-gradient-to-br from-indigo-600 to-blue-500' : 'bg-gradient-to-br from-emerald-600 to-teal-500'}`}>
              <r.icon className="w-7 h-7" />
            </div>
            <p className="font-bold text-xl mt-4">{r.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{r.sub}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// WORKER APP
// ============================================================
function WorkerApp({ auth, onLogout }) {
  const token = auth?.session?.access_token;
  const [tab, setTab] = useState('home'); // home | myjobs | chats | profile
  const [me, setMe] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [chatPeer, setChatPeer] = useState(null);

  const refreshMe = async () => {
    try { const data = await api('me', { token }); setMe(data); } catch (e) { toast.error(e.message); }
  };
  const refreshNotifs = async () => {
    try { const d = await api('notifications', { token }); setNotifs(d.notifications); } catch {}
  };
  useEffect(() => { if (token) { refreshMe(); refreshNotifs(); } }, [token]);

  // realtime: refresh notifs on insert
  useEffect(() => {
    if (!token || !me?.profile?.id) return;
    const supa = getSupabase();
    supa.realtime.setAuth(token);
    const ch = supa.channel(`worker-notifs-${me.profile.id}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.profile.id}` },
          () => refreshNotifs())
      .subscribe();
    return () => { supa.removeChannel(ch); };
  }, [token, me?.profile?.id]);

  const openChatWith = (peer) => { setChatPeer(peer); setTab('chats'); };
  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* top bar */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-500 grid place-items-center text-white"><Hammer className="w-4 h-4" /></div>
            <div className="leading-tight">
              <p className="font-bold">Work2Wish</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{me?.extra?.location_text || 'Set your location'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Sheet open={showNotifs} onOpenChange={setShowNotifs}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>Notifications</SheetTitle></SheetHeader>
                <ScrollArea className="h-[80vh] mt-3">
                  {notifs.length === 0 && <p className="text-sm text-muted-foreground p-4">No notifications yet.</p>}
                  {notifs.map(n => (
                    <div key={n.id} className={`p-3 rounded-lg border mb-2 ${n.read ? '' : 'bg-indigo-50/40 border-indigo-100'}`}>
                      <p className="font-semibold text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container py-4">
        {tab === 'home'    && <WorkerHome token={token} onChat={openChatWith} />}
        {tab === 'myjobs'  && <WorkerMyJobs token={token} onChat={openChatWith} />}
        {tab === 'chats'   && <ChatScreen token={token} me={{ id: me?.profile?.id, profile: me?.profile }} peerHint={chatPeer} color="indigo" />}
        {tab === 'profile' && <WorkerProfile token={token} me={me} onSaved={refreshMe} onLogout={onLogout} />}
      </main>

      {/* bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="container grid grid-cols-4">
          {[
            { k: 'home',    i: Search,         l: 'Find' },
            { k: 'myjobs',  i: ClipboardList,  l: 'My jobs' },
            { k: 'chats',   i: MessageSquare,  l: 'Chats' },
            { k: 'profile', i: HardHat,        l: 'Profile' },
          ].map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); if (t.k !== 'chats') setChatPeer(null); }}
              className={`py-3 flex flex-col items-center gap-1 text-xs ${tab === t.k ? 'text-indigo-600' : 'text-muted-foreground'}`}>
              <t.i className="w-5 h-5" />{t.l}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function WorkerHome({ token }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api(`jobs${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token });
      setJobs(d.jobs);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const apply = async (jobId) => {
    try {
      await api(`jobs/${jobId}/apply`, { method: 'POST', token, body: {} });
      toast.success('Applied! Employer notified.');
      setSelected(null);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
                 placeholder="Search jobs..." className="pl-9 bg-white" />
        </div>
        <Button onClick={load} variant="outline"><Filter className="w-4 h-4 mr-1" />Search</Button>
      </div>

      <div>
        <h2 className="font-bold text-lg mb-2">Jobs near you</h2>
        {loading && <div className="grid place-items-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
        {!loading && jobs.length === 0 && <p className="text-sm text-muted-foreground p-6 bg-white rounded-xl border text-center">No jobs yet. Check back soon.</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          {jobs.map(j => <JobCard key={j.id} job={j} onClick={() => setSelected(j)} />)}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selected.title}</DialogTitle>
                <DialogDescription>{selected.employers?.company_name} · {selected.location_text}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2 my-3">
                <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700">
                  <p className="text-xs">Daily pay</p><p className="font-bold">{fmtMoney(selected.daily_pay)}</p>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50 text-indigo-700">
                  <p className="text-xs">Duration</p><p className="font-bold">{selected.duration_days} day(s)</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-100 text-slate-700">
                  <p className="text-xs">Category</p><p className="font-bold capitalize">{selected.category || 'General'}</p>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{selected.description || 'No description provided.'}</p>
              <DialogFooter className="flex-col sm:flex-row gap-2 mt-3">
                <Button variant="outline" className="w-full sm:w-auto"><Phone className="w-4 h-4 mr-2" /> Call employer</Button>
                <Button onClick={() => apply(selected.id)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
                  <Send className="w-4 h-4 mr-2" /> Apply now
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobCard({ job, onClick }) {
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border hover:shadow-md transition p-4 group">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 grid place-items-center text-indigo-600 shrink-0">
          <Hammer className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold truncate group-hover:text-indigo-700">{job.title}</p>
              <p className="text-xs text-muted-foreground truncate">{job.employers?.company_name}</p>
            </div>
            {job.employers?.verified && <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <Badge variant="secondary"><MapPin className="w-3 h-3 mr-0.5" />{job.location_text || '—'}</Badge>
            <Badge variant="secondary"><Clock className="w-3 h-3 mr-0.5" />{job.duration_days}d</Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><Banknote className="w-3 h-3 mr-0.5" />{fmtMoney(job.daily_pay)}/day</Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

function WorkerMyJobs({ token, onChat }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try { const d = await api('worker/applications', { token }); setApps(d.applications); }
    catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const groups = {
    Applied:   apps.filter(a => a.status === 'pending'),
    Ongoing:   apps.filter(a => ['accepted','ongoing'].includes(a.status)),
    Completed: apps.filter(a => a.status === 'completed'),
    Rejected:  apps.filter(a => a.status === 'rejected'),
  };

  if (loading) return <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Tabs defaultValue="Applied">
      <TabsList className="grid grid-cols-4 w-full">
        {Object.keys(groups).map(k => <TabsTrigger key={k} value={k}>{k} ({groups[k].length})</TabsTrigger>)}
      </TabsList>
      {Object.entries(groups).map(([k, list]) => (
        <TabsContent key={k} value={k} className="space-y-2 mt-3">
          {list.length === 0 && <p className="text-sm text-muted-foreground p-6 bg-white rounded-xl border text-center">No items.</p>}
          {list.map(a => (
            <div key={a.id} className="bg-white border rounded-xl p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{a.jobs?.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.jobs?.employers?.company_name} · {a.jobs?.location_text}</p>
                </div>
                <Badge variant={a.status === 'accepted' ? 'default' : 'secondary'} className={a.status === 'rejected' ? 'bg-red-100 text-red-700' : ''}>{a.status}</Badge>
              </div>
              <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                <span>{fmtMoney(a.jobs?.daily_pay)}/day</span>
                <span>·</span>
                <span>{a.jobs?.duration_days}d</span>
                <span>·</span>
                <span>Applied {new Date(a.applied_at).toLocaleDateString()}</span>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-3"
                      onClick={() => onChat?.({
                        peer_id: a.jobs?.employer_id,
                        peer_name: a.jobs?.employers?.company_name || 'Employer',
                        peer_photo: a.jobs?.employers?.company_logo,
                        peer_role: 'employer',
                      })}>
                <MessageSquare className="w-4 h-4 mr-1" /> Message employer
              </Button>
            </div>
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function WorkerProfile({ token, me, onSaved, onLogout }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (me) setForm({
      full_name: me.profile?.full_name || '',
      phone: me.profile?.phone || '',
      age: me.extra?.age || '',
      skills: (me.extra?.skills || []).join(', '),
      experience_years: me.extra?.experience_years || 0,
      expected_daily_wage: me.extra?.expected_daily_wage || 0,
      location_text: me.extra?.location_text || '',
      bio: me.extra?.bio || '',
    });
  }, [me]);

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...form,
        age: form.age ? Number(form.age) : null,
        skills: typeof form.skills === 'string' ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : form.skills,
        experience_years: Number(form.experience_years) || 0,
        expected_daily_wage: Number(form.expected_daily_wage) || 0,
      };
      await api('me/profile', { method: 'PATCH', token, body });
      toast.success('Profile saved');
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (!me) return <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <AvatarUploader
            token={token}
            currentUrl={me.profile?.photo_url}
            kind="avatar"
            color="indigo"
            onUploaded={() => onSaved()}
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg">{me.profile?.full_name || 'Worker'}</p>
            <p className="text-sm text-muted-foreground truncate">{me.profile?.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-medium">{Number(me.extra?.rating || 0).toFixed(1)}</span>
              {me.extra?.verified ? <Badge className="bg-emerald-100 text-emerald-700">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
            </div>
            {me.profile?.login_id && (
              <button
                onClick={() => { navigator.clipboard?.writeText(me.profile.login_id); toast.success('Login ID copied'); }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full hover:bg-indigo-100">
                <Hash className="w-3 h-3" /> ID: <span className="font-bold tracking-wider">{me.profile.login_id}</span>
                <Copy className="w-3 h-3 opacity-60" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Edit profile</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name"  v={form.full_name}           on={(v) => setForm(f => ({ ...f, full_name: v }))} />
          <Field label="Phone"      v={form.phone}               on={(v) => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Age"        v={form.age}                 on={(v) => setForm(f => ({ ...f, age: v }))} type="number" />
          <Field label="Experience (years)" v={form.experience_years} on={(v) => setForm(f => ({ ...f, experience_years: v }))} type="number" />
          <Field label="Expected daily wage (₹)" v={form.expected_daily_wage} on={(v) => setForm(f => ({ ...f, expected_daily_wage: v }))} type="number" />
          <Field label="Location" v={form.location_text} on={(v) => setForm(f => ({ ...f, location_text: v }))} />
          <div className="sm:col-span-2">
            <Label>Skills (comma-separated)</Label>
            <Input value={form.skills || ''} onChange={(e) => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="Carpentry, Electrical, Painting" />
          </div>
          <div className="sm:col-span-2">
            <Label>Bio</Label>
            <Textarea rows={3} value={form.bio || ''} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell employers about yourself" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4 mr-2" />}Save profile
        </Button>
        <Button variant="outline" onClick={onLogout}><LogOut className="w-4 h-4 mr-2" />Logout</Button>
      </div>
    </div>
  );
}

function Field({ label, v, on, type = 'text' }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={v ?? ''} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

// ============================================================
// EMPLOYER APP
// ============================================================
function EmployerApp({ auth, onLogout }) {
  const token = auth?.session?.access_token;
  const [tab, setTab] = useState('dashboard'); // dashboard | post | chats | profile
  const [me, setMe] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [chatPeer, setChatPeer] = useState(null);

  const refreshMe = async () => {
    try { const d = await api('me', { token }); setMe(d); } catch {}
  };
  const refreshJobs = async () => {
    try { const d = await api('employer/jobs', { token }); setJobs(d.jobs); }
    catch (e) { toast.error(e.message); }
  };
  useEffect(() => { if (token) { refreshMe(); refreshJobs(); } }, [token]);

  const openChatWith = (peer) => { setChatPeer(peer); setTab('chats'); };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 grid place-items-center text-white"><Briefcase className="w-4 h-4" /></div>
            <div className="leading-tight">
              <p className="font-bold">{me?.extra?.company_name || 'Work2Wish'}</p>
              <p className="text-[10px] text-muted-foreground">Employer portal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-4">
        {tab === 'dashboard' && <EmployerDashboard token={token} jobs={jobs} reload={refreshJobs} onChat={openChatWith} />}
        {tab === 'post'      && <PostJob token={token} onPosted={() => { refreshJobs(); setTab('dashboard'); }} />}
        {tab === 'chats'     && <ChatScreen token={token} me={{ id: me?.profile?.id, profile: me?.profile }} peerHint={chatPeer} color="emerald" />}
        {tab === 'profile'   && <EmployerProfile token={token} me={me} onSaved={refreshMe} onLogout={onLogout} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t">
        <div className="container grid grid-cols-4">
          {[
            { k: 'dashboard', i: ClipboardList, l: 'Jobs' },
            { k: 'post',      i: Plus,          l: 'Post job' },
            { k: 'chats',     i: MessageSquare, l: 'Chats' },
            { k: 'profile',   i: Building2,     l: 'Company' },
          ].map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); if (t.k !== 'chats') setChatPeer(null); }}
              className={`py-3 flex flex-col items-center gap-1 text-xs ${tab === t.k ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              <t.i className="w-5 h-5" />{t.l}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function EmployerDashboard({ token, jobs, reload, onChat }) {
  const [openJob, setOpenJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApp, setLoadingApp] = useState(false);

  const totalApplicants = jobs.reduce((s, j) => s + (j.applicants_count || 0), 0);
  const totalPending    = jobs.reduce((s, j) => s + (j.pending_count || 0), 0);

  const openApplicants = async (job) => {
    setOpenJob(job); setLoadingApp(true);
    try { const d = await api(`employer/jobs/${job.id}/applicants`, { token }); setApplicants(d.applicants); }
    catch (e) { toast.error(e.message); } finally { setLoadingApp(false); }
  };
  const decide = async (appId, status) => {
    try {
      await api(`applications/${appId}`, { method: 'PATCH', token, body: { status } });
      toast.success(`Marked ${status}`);
      // refresh
      const d = await api(`employer/jobs/${openJob.id}/applicants`, { token });
      setApplicants(d.applicants);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active jobs"  value={jobs.filter(j => j.status === 'open').length} icon={Briefcase} color="emerald" />
        <StatCard label="Total applicants" value={totalApplicants} icon={Users} color="indigo" />
        <StatCard label="Pending review"   value={totalPending} icon={Clock} color="amber" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Posted jobs</h2>
        <Button size="sm" variant="outline" onClick={reload}>Refresh</Button>
      </div>

      {jobs.length === 0 && <p className="text-sm text-muted-foreground p-6 bg-white rounded-xl border text-center">No jobs yet. Tap “Post job” to start hiring.</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {jobs.map(j => (
          <Card key={j.id} className="hover:shadow-md transition cursor-pointer" onClick={() => openApplicants(j)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{j.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{j.location_text} · {j.duration_days}d</p>
                </div>
                <Badge className={j.status === 'open' ? 'bg-emerald-100 text-emerald-700' : ''} variant={j.status === 'open' ? 'default' : 'secondary'}>{j.status}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span className="font-bold">{fmtMoney(j.daily_pay)}/day</span>
                <span className="ml-auto text-xs text-muted-foreground">{j.applicants_count || 0} applicant(s)</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={!!openJob} onOpenChange={(o) => !o && setOpenJob(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>Applicants — {openJob?.title}</SheetTitle></SheetHeader>
          <ScrollArea className="h-[85vh] mt-3 pr-2">
            {loadingApp && <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}
            {!loadingApp && applicants.length === 0 && <p className="text-sm text-muted-foreground p-6 bg-white rounded-xl border text-center">No applicants yet.</p>}
            <div className="space-y-2">
              {applicants.map(a => {
                const up = a.workers?.user_profiles || {};
                return (
                <div key={a.id} className="border rounded-xl p-3 bg-white">
                  <div className="flex items-center gap-3">
                    <Avatar><AvatarImage src={up.photo_url} /><AvatarFallback>{initials(up.full_name || up.email)}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{up.full_name || up.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{(a.workers?.skills || []).join(', ') || 'No skills set'}</p>
                      <p className="text-[11px] text-muted-foreground">Wage ₹{a.workers?.expected_daily_wage || 0}/day · {a.workers?.experience_years || 0}y exp</p>
                    </div>
                    <Badge variant="secondary">{a.status}</Badge>
                  </div>
                  {a.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => decide(a.id, 'accepted')}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => decide(a.id, 'rejected')}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                  <Button size="sm" variant="ghost" className="w-full mt-2 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => onChat?.({ peer_id: a.worker_id, peer_name: up.full_name || up.email, peer_photo: up.photo_url, peer_role: 'worker' })}>
                    <MessageSquare className="w-4 h-4 mr-1" /> Message worker
                  </Button>
                </div>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const map = { emerald: 'bg-emerald-50 text-emerald-700', indigo: 'bg-indigo-50 text-indigo-700', amber: 'bg-amber-50 text-amber-700' };
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-lg grid place-items-center ${map[color]}`}><Icon className="w-5 h-5" /></div>
        <p className="text-2xl font-extrabold mt-2">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function PostJob({ token, onPosted }) {
  const [f, setF] = useState({
    title: '', category: 'general', description: '', location_text: '',
    daily_pay: 1000, duration_days: 1, start_date: '',
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title) return toast.error('Title required');
    setBusy(true);
    try {
      await api('jobs', { method: 'POST', token, body: f });
      toast.success('Job posted!');
      onPosted();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Post a new job</CardTitle><CardDescription>Reach workers near your location instantly.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Job title</Label><Input value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} placeholder="e.g. Carpenter for 2 days" /></div>
          <div>
            <Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF(s => ({ ...s, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['general','construction','electrical','plumbing','painting','carpentry','cleaning','delivery','farming','warehouse'].map(c => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Location</Label><Input value={f.location_text} onChange={e => setF(s => ({ ...s, location_text: e.target.value }))} placeholder="Area, City" /></div>
          <div><Label>Daily pay (₹)</Label><Input type="number" value={f.daily_pay} onChange={e => setF(s => ({ ...s, daily_pay: e.target.value }))} /></div>
          <div><Label>Duration (days)</Label><Input type="number" value={f.duration_days} onChange={e => setF(s => ({ ...s, duration_days: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Start date</Label><Input type="date" value={f.start_date} onChange={e => setF(s => ({ ...s, start_date: e.target.value }))} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={4} value={f.description} onChange={e => setF(s => ({ ...s, description: e.target.value }))} placeholder="What needs to be done?" /></div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Post job
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EmployerProfile({ token, me, onSaved, onLogout }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (me) setF({
      full_name: me.profile?.full_name || '',
      phone: me.profile?.phone || '',
      company_name: me.extra?.company_name || '',
      industry: me.extra?.industry || '',
      location_text: me.extra?.location_text || '',
      description: me.extra?.description || '',
    });
  }, [me]);

  const save = async () => {
    setBusy(true);
    try { await api('me/profile', { method: 'PATCH', token, body: f }); toast.success('Saved'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (!me) return <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <AvatarUploader
            token={token}
            currentUrl={me.extra?.company_logo}
            kind="logo"
            color="emerald"
            onUploaded={() => onSaved()}
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg">{me.extra?.company_name || 'Set company name'}</p>
            <p className="text-sm text-muted-foreground truncate">{me.profile?.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {me.extra?.verified ? <Badge className="bg-emerald-100 text-emerald-700">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
            </div>
            {me.profile?.login_id && (
              <button
                onClick={() => { navigator.clipboard?.writeText(me.profile.login_id); toast.success('Login ID copied'); }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full hover:bg-emerald-100">
                <Hash className="w-3 h-3" /> ID: <span className="font-bold tracking-wider">{me.profile.login_id}</span>
                <Copy className="w-3 h-3 opacity-60" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Company profile</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field label="Your name"   v={f.full_name}    on={(v) => setF(s => ({ ...s, full_name: v }))} />
          <Field label="Phone"       v={f.phone}        on={(v) => setF(s => ({ ...s, phone: v }))} />
          <Field label="Company"     v={f.company_name} on={(v) => setF(s => ({ ...s, company_name: v }))} />
          <Field label="Industry"    v={f.industry}     on={(v) => setF(s => ({ ...s, industry: v }))} />
          <Field label="Location"    v={f.location_text} on={(v) => setF(s => ({ ...s, location_text: v }))} />
          <div className="sm:col-span-2">
            <Label>About</Label>
            <Textarea rows={3} value={f.description || ''} onChange={(e) => setF(s => ({ ...s, description: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4 mr-2" />}Save
        </Button>
        <Button variant="outline" onClick={onLogout}><LogOut className="w-4 h-4 mr-2" />Logout</Button>
      </div>
    </div>
  );
}


// ============================================================
// Avatar uploader (used by both worker & employer profile)
// ============================================================
function AvatarUploader({ token, currentUrl, kind = 'avatar', onUploaded, color = 'indigo' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const onPick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error('Max 5 MB');
    setBusy(true);
    try {
      const { url } = await uploadFile(f, kind, token);
      // persist
      const field = kind === 'logo' ? 'company_logo' : 'photo_url';
      await api('me/profile', { method: 'PATCH', token, body: { [field]: url } });
      toast.success('Photo updated');
      onUploaded?.(url);
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };
  const ring = color === 'emerald' ? 'ring-emerald-500' : 'ring-indigo-500';
  return (
    <div className="relative inline-block">
      <Avatar className={`w-20 h-20 ring-2 ${ring} ring-offset-2 ring-offset-white`}>
        <AvatarImage src={currentUrl} />
        <AvatarFallback className="text-xl font-bold">?</AvatarFallback>
      </Avatar>
      <button onClick={() => ref.current?.click()} disabled={busy}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border shadow grid place-items-center hover:bg-slate-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
      </button>
      <input ref={ref} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}

// ============================================================
// CHAT (realtime) — used by both worker & employer apps
// ============================================================
function ChatScreen({ token, me, peerHint, color = 'indigo' }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(peerHint || null); // {peer_id, peer_name, peer_photo}

  const loadThreads = async () => {
    setLoading(true);
    try { const d = await api('chat/threads', { token }); setThreads(d.threads); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadThreads(); }, []);

  // Auto-open hinted peer once
  useEffect(() => { if (peerHint) setActive(peerHint); }, [peerHint?.peer_id]);

  // Subscribe to new incoming messages globally → refresh threads
  useEffect(() => {
    if (!me?.id) return;
    const supa = getSupabase();
    // hand the JWT over to realtime so RLS policy passes
    supa.realtime.setAuth(token);
    const ch = supa.channel(`thread-list-${me.id}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me.id}` },
          () => loadThreads())
      .subscribe();
    return () => { supa.removeChannel(ch); };
  }, [me?.id, token]);

  if (active) {
    return (
      <ChatThread token={token} me={me} peer={active}
                  onBack={() => { setActive(null); loadThreads(); }} color={color} />
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-lg">Chats</h2>
      {loading && <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
      {!loading && threads.length === 0 && (
        <p className="text-sm text-muted-foreground p-6 bg-white rounded-xl border text-center">
          No conversations yet. {me?.profile?.role === 'worker' ? 'Apply to a job to start chatting.' : 'Once workers apply to your jobs, you can chat with them here.'}
        </p>
      )}
      <div className="space-y-2">
        {threads.map(t => (
          <button key={t.peer_id} onClick={() => setActive(t)}
                  className="w-full text-left bg-white rounded-xl border hover:shadow transition p-3 flex items-center gap-3">
            <Avatar><AvatarImage src={t.peer_photo} /><AvatarFallback>{initials(t.peer_name)}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate">{t.peer_name}</p>
                {t.last_message && <span className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(t.last_message.created_at).toLocaleDateString()}
                </span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{t.last_message?.content || 'Start a conversation'}</p>
            </div>
            {t.unread_count > 0 && (
              <span className="ml-2 inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white w-5 h-5">{t.unread_count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatThread({ token, me, peer, onBack, color }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const load = async () => {
    try {
      const d = await api(`messages?peer=${peer.peer_id}`, { token });
      setMessages(d.messages || []);
      // mark as read
      api('messages/mark-read', { method: 'POST', token, body: { peer_id: peer.peer_id } }).catch(() => {});
    } catch (e) { toast.error(e.message); }
  };

  useEffect(() => { load(); }, [peer.peer_id]);

  // realtime subscription for this thread
  useEffect(() => {
    if (!me?.id) return;
    const supa = getSupabase();
    supa.realtime.setAuth(token);
    const ch = supa.channel(`thread-${me.id}-${peer.peer_id}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages',
            filter: `receiver_id=eq.${me.id}` },
          (payload) => {
            const m = payload.new;
            if (m.sender_id === peer.peer_id) {
              setMessages(prev => [...prev, m]);
              api('messages/mark-read', { method: 'POST', token, body: { peer_id: peer.peer_id } }).catch(() => {});
            }
          })
      .subscribe();
    return () => { supa.removeChannel(ch); };
  }, [me?.id, peer.peer_id, token]);

  // autoscroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText(''); setSending(true);
    // optimistic
    const optimistic = { id: 'tmp-' + Date.now(), sender_id: me.id, receiver_id: peer.peer_id, content, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    try {
      const d = await api('messages', { method: 'POST', token, body: { receiver_id: peer.peer_id, content } });
      setMessages(prev => prev.map(m => m.id === optimistic.id ? d.message : m));
    } catch (e) {
      toast.error(e.message);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally { setSending(false); }
  };

  const accent = color === 'emerald' ? 'bg-emerald-600' : 'bg-indigo-600';
  const accentText = color === 'emerald' ? 'text-emerald-50' : 'text-indigo-50';

  return (
    <div className="bg-white rounded-xl border overflow-hidden flex flex-col h-[75vh]">
      {/* header */}
      <div className="flex items-center gap-3 p-3 border-b bg-slate-50">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <Avatar className="w-9 h-9"><AvatarImage src={peer.peer_photo} /><AvatarFallback>{initials(peer.peer_name)}</AvatarFallback></Avatar>
        <div className="leading-tight min-w-0">
          <p className="font-semibold truncate">{peer.peer_name}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{peer.peer_role || 'user'} · live</p>
        </div>
      </div>
      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {messages.length === 0 && <p className="text-center text-xs text-muted-foreground mt-8">Say hi 👋</p>}
        {messages.map(m => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                mine ? `${accent} ${accentText} rounded-br-sm` : 'bg-white border rounded-bl-sm'
              }`}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`text-[9px] mt-1 ${mine ? 'opacity-80' : 'text-muted-foreground'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {/* input */}
      <div className="p-2 border-t flex items-center gap-2 bg-white">
        <Input value={text} onChange={e => setText(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && !sending && send()}
               placeholder="Type a message..." />
        <Button onClick={send} disabled={sending || !text.trim()} className={accent + ' hover:opacity-90'}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
