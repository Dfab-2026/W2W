'use client';



import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, HardHat, MapPin, Map, Search, Bell, Star, Phone, Send, Plus, LogOut,
  Sparkles, ShieldCheck, ArrowRight, Smartphone, Apple, Loader2, Building2,
  Hammer, Users, ClipboardList, Clock, CheckCircle2, XCircle, MessageSquare,
  Edit3, Camera, ChevronLeft, Filter, Banknote, Upload, ArrowLeft, Image as ImgIcon,
  Mail, KeyRound, Hash, Copy, Eye, EyeOff, Lock, ShieldAlert, X,
  FileText, Tag, IndianRupee, Calendar, Award, Check, UserCircle, Sun, Moon, Globe2, Trash2, CheckCheck, Save
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

import { getSupabase } from '@/lib/supabase/client';


function Work2WishLogo({ className = 'w-10 h-10', imgClassName = 'w-full h-full object-contain rounded-xl' }) {
  return (
    <img
      src="/work2wish-logo.png"
      alt="Work2Wish logo"
      className={className + ' select-none'}
      draggable={false}
    />
  );
}

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

function getSavedAccessToken() {
  if (typeof window === 'undefined') return null;
  try {
    const saved = loadSession();
    return saved?.session?.access_token || null;
  } catch {
    return null;
  }
}

async function getFreshAccessToken(preferredToken) {
  if (preferredToken) return preferredToken;
  if (typeof window === 'undefined') return null;
  const saved = loadSession();
  try {
    const supa = getSupabase();
    if (saved?.session?.access_token && saved?.session?.refresh_token) {
      await supa.auth.setSession({
        access_token: saved.session.access_token,
        refresh_token: saved.session.refresh_token,
      });
    }
    const { data: refreshed } = await supa.auth.refreshSession();
    const session = refreshed?.session;
    if (session?.access_token) {
      saveSession(session, saved?.role, saved?.profile);
      return session.access_token;
    }
  } catch {}
  return saved?.session?.access_token || null;
}

async function api(path, { method = 'GET', body, token } = {}) {
  const makeRequest = async (accessToken) => {
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`/api/${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let accessToken = token || getSavedAccessToken();
  let res = await makeRequest(accessToken);

  // On Vercel, a saved session can become stale. Refresh once and retry without
  // logging the user out or blocking actions such as posting a job/profile save.
  if (res.status === 401) {
    const refreshedToken = await getFreshAccessToken(null);
    if (refreshedToken && refreshedToken !== accessToken) {
      accessToken = refreshedToken;
      res = await makeRequest(accessToken);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || `Request failed (${res.status})`;
    if (res.status === 401 || /unauthorized|jwt|token|session/i.test(message)) {
      throw new Error('Please login again or refresh the page, then try once more.');
    }
    throw new Error(message);
  }
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
const isYes = (v) => v === true || v === 'yes' || v === 'true';
const jobBenefits = (job = {}) => ([
  isYes(job.food_included) ? 'Food' : null,
  isYes(job.accommodation_available) ? 'Accommodation' : null,
  isYes(job.transportation_provided) ? 'Travel' : null,
  isYes(job.overtime_available) ? 'Overtime' : null,
].filter(Boolean));
const jobExpiresAt = (job = {}) => {
  if (job.expires_at) return new Date(job.expires_at);
  const days = Number(job.post_valid_days || job.valid_days || 0);
  if (!days || !job.created_at) return null;
  const d = new Date(job.created_at); d.setDate(d.getDate() + days); return d;
};
const jobDaysLeft = (job = {}) => {
  const d = jobExpiresAt(job); if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};
const detailsToWords = (details = {}) => Object.entries(details || {})
  .filter(([,v]) => v !== null && v !== undefined && v !== '')
  .map(([k,v]) => `${String(k).replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
const trMap = {
  ta: { 'Chats':'அரட்டைகள்','Type worker or company name to start chat':'தேடி அரட்டை தொடங்குங்கள்','Open jobs':'திறந்த வேலைகள்','Search':'தேடு','Post job':'வேலை பதிவு','Publish Job':'வேலை வெளியிடு','Update Job':'வேலை புதுப்பி','Notifications':'அறிவிப்புகள்','History':'வரலாறு','Profile':'சுயவிவரம்','My jobs':'என் வேலைகள்','Apply now':'விண்ணப்பிக்கவும்','Edit':'திருத்து','Hired':'நியமிக்கப்பட்ட','Jobs':'வேலைகள்','Post':'பதிவு' },
  hi: { 'Chats':'चैट','Type worker or company name to start chat':'खोजें या नई चैट शुरू करें','Open jobs':'खुली नौकरियां','Search':'खोजें','Post job':'नौकरी पोस्ट करें','Publish Job':'नौकरी प्रकाशित करें','Update Job':'नौकरी अपडेट करें','Notifications':'सूचनाएं','History':'इतिहास','Profile':'प्रोफाइल','My jobs':'मेरी नौकरियां','Apply now':'अभी आवेदन करें','Edit':'संपादित करें','Hired':'नियुक्त','Jobs':'नौकरियां','Post':'पोस्ट' },
  kn: { 'Chats':'ಚಾಟ್‌ಗಳು','Type worker or company name to start chat':'ಹುಡುಕಿ ಅಥವಾ ಹೊಸ ಚಾಟ್ ಆರಂಭಿಸಿ','Open jobs':'ತೆರೆದ ಕೆಲಸಗಳು','Search':'ಹುಡುಕಿ','Post job':'ಕೆಲಸ ಪೋಸ್ಟ್','Publish Job':'ಕೆಲಸ ಪ್ರಕಟಿಸಿ','Update Job':'ಕೆಲಸ ಅಪ್‌ಡೇಟ್','Notifications':'ಅಧಿಸೂಚನೆಗಳು','History':'ಇತಿಹಾಸ','Profile':'ಪ್ರೊಫೈಲ್','My jobs':'ನನ್ನ ಕೆಲಸಗಳು','Apply now':'ಅರ್ಜಿಸಲಿ','Edit':'ತಿದ್ದು','Hired':'ನೇಮಿಸಲಾದ','Jobs':'ಉದ್ಯೋಗಗಳು','Post':'ಪೋಸ್ಟ್' }
};
const tText = (text) => (trMap[localStorage.getItem('w2w-language') || 'en'] || {})[text] || text;

function applyAppTheme(next) {
  if (typeof window === 'undefined') return;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = next === 'dark' || (next === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
  document.body?.classList?.toggle('dark', dark);
}

function ThemeToggle() {
  const [theme, setTheme] = useState('system');
  useEffect(() => {
    const saved = localStorage.getItem('w2w-theme') || 'system';
    setTheme(saved);
    applyAppTheme(saved);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => saved === 'system' && applyAppTheme('system');
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);
  const changeTheme = (next) => {
    setTheme(next);
    localStorage.setItem('w2w-theme', next);
    applyAppTheme(next);
    toast.success(`Theme: ${next === 'light' ? 'Light' : next === 'dark' ? 'Dark' : 'System default'}`);
  };
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Sparkles;
  return (
    <Select value={theme} onValueChange={changeTheme}>
      <SelectTrigger
        title="Theme"
        aria-label="Theme"
        className="h-10 w-10 rounded-full bg-[#07183f] border border-sky-300/30 px-0 grid place-items-center text-white hover:bg-[#0b2a68] shadow-sm transition-colors"
      >
        <ThemeIcon className="w-4 h-4" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system"><span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4" /> System</span></SelectItem>
        <SelectItem value="light"><span className="inline-flex items-center gap-2"><Sun className="w-4 h-4" /> Light</span></SelectItem>
        <SelectItem value="dark"><span className="inline-flex items-center gap-2"><Moon className="w-4 h-4" /> Dark</span></SelectItem>
      </SelectContent>
    </Select>
  );
}

function GlobalLanguageSelect() {
const [lang, setLang] = useState('en');
  useEffect(() => {
    const saved = localStorage.getItem('w2w-language') || 'en';
    setLang(saved);
    document.documentElement.lang = saved;
  }, []);
  const change = (next) => {
    setLang(next);
    localStorage.setItem('w2w-language', next);
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent('w2w-language-change', { detail: next }));
    toast.success(`Language: ${next.toUpperCase()}`);
  };
  return (
    <Select value={lang} onValueChange={change}>
      <SelectTrigger
        title="Language"
        aria-label="Language"
        className="h-10 w-10 rounded-full bg-[#07183f] border border-sky-300/30 px-0 grid place-items-center text-white hover:bg-[#0b2a68] shadow-sm transition-colors"
      >
        <Globe2 className="w-4 h-4" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="ta">Tamil</SelectItem>
        <SelectItem value="hi">Hindi</SelectItem>
        <SelectItem value="kn">Kannada</SelectItem>
        <SelectItem value="te">Telugu</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ============================================================
// MAIN APP — single combined login, role only matters at signup
// ============================================================
export default function App() {
  // screens: 'splash' | 'login' | 'signup-role' | 'signup-form' | 'signup-otp'
  //        | 'oauth-role' | 'forgot-email' | 'forgot-reset' | 'worker-app' | 'employer-app'
  const [screen, setScreenState] = useState('splash');
  const [navigationHistory, setNavigationHistory] = useState([]); // Track previous screens
  const [auth, setAuth] = useState(null);
  const [signup, setSignup] = useState({ role: null, full_name: '', email: '', password: '', confirm_password: '' });
  const [oauthCtx, setOauthCtx] = useState(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [language, setLanguage] = useState('en'); // en, hi, etc.

  // Smart screen setter that tracks history
  const setScreen = (newScreen) => {
    setNavigationHistory(prev => [...prev, screen]);
    setScreenState(newScreen);
  };

  // Go back one screen without logout
  const goBack = () => {
    if (navigationHistory.length === 0) return;
    const previousScreen = navigationHistory[navigationHistory.length - 1];
    setNavigationHistory(prev => prev.slice(0, -1));
    setScreenState(previousScreen);
  };

  // ----- Boot sequence -----
  useEffect(() => {
    const boot = async () => {
      const s = loadSession();
      if (s?.session?.access_token) {
        // Validate saved session against the server. Also restore the Supabase
        // client session so authenticated actions continue working after deploy/refresh.
        try {
          if (s.session?.refresh_token) {
            await getSupabase().auth.setSession({
              access_token: s.session.access_token,
              refresh_token: s.session.refresh_token,
            });
          }
          const me = await api('me', { token: s.session.access_token });
          if (me?.profile?.id) {
            const validated = {
              session: s.session,
              role: me.profile.role || s.role,
              profile: me.profile,
            };
            saveSession(validated.session, validated.role, validated.profile);
            setAuth(validated);
            setScreen(validated.role === 'admin' ? 'admin-app' : validated.role === 'employer' ? 'employer-app' : 'worker-app');
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
            setSignup({
              role: null,
              full_name: fin.full_name || '',
              email: fin.email || '',
              password: '',
              confirm_password: '',
              is_google_signup: true,
              google_access_token: data.session.access_token,
            });
            setScreen('signup-role');
            return;
          }
          const profile = fin.profile || { id: data.session.user.id, role: fin.role, login_id: fin.login_id };
          const payload = { session: data.session, role: fin.role, profile };
          saveSession(payload.session, payload.role, payload.profile);
          setAuth(payload);
          setScreen(fin.role === 'admin' ? 'admin-app' : fin.role === 'employer' ? 'employer-app' : 'worker-app');
          if (typeof window !== 'undefined' && window.location.hash) {
            window.history.replaceState({}, '', window.location.pathname);
          }
          return;
        }
      } catch (e) { /* no oauth session */ }

      const t = setTimeout(() => setScreen('login'), 1000);
      return () => clearTimeout(t);
    };
    boot();
  }, []);

  useEffect(() => {
    const onExpired = () => {
      clearSession();
      setAuth(null);
      setScreen('login');
      toast.error('Session expired. Please login again.');
    };
    window.addEventListener('w2w-session-expired', onExpired);
    return () => window.removeEventListener('w2w-session-expired', onExpired);
  }, []);

  const handleLogout = async () => {
    try { await getSupabase().auth.signOut(); } catch {}
    clearSession();
    setAuth(null);
    setSignup({ role: null, full_name: '', email: '', password: '', confirm_password: '' });
    setScreen('login');
  };

  const handleAuthed = (data) => {
    const payload = { session: data.session, role: data.role, profile: data.profile || data.user };
    saveSession(payload.session, payload.role, payload.profile);
    try {
      if (payload.session?.access_token && payload.session?.refresh_token) {
        getSupabase().auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
      }
    } catch {}
    setAuth(payload);
    setScreen(data.role === 'admin' ? 'admin-app' : data.role === 'employer' ? 'employer-app' : 'worker-app');
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
          onGotoForgot={() => setScreen('forgot-email')}
          onAdminAuthed={handleAuthed} />
      )}
      {screen === 'forgot-email' && (
        <ForgotEmail key="forgot-email"
          onSent={(email) => { setForgotEmail(email); setScreen('forgot-reset'); }}
          onBack={goBack} />
      )}
      {screen === 'forgot-reset' && (
        <ForgotReset key="forgot-reset"
          email={forgotEmail}
          onAuthed={handleAuthed}
          onBack={goBack} />
      )}
      {screen === 'signup-role' && (
        <SignupRolePicker key="signup-role"
          onPick={(role) => { setSignup(s => ({ ...s, role })); setScreen('signup-form'); }}
          onBack={goBack}
          onAdminAuthed={handleAuthed} />
      )}
      {screen === 'signup-form' && (
        <SignupForm key="signup-form" data={signup}
          onChange={(p) => setSignup(s => ({ ...s, ...p }))}
          onSent={() => setScreen('signup-otp')}
          onBack={goBack} />
      )}
      {screen === 'signup-otp' && (
        <SignupOTP key="signup-otp" data={signup}
          onAuthed={handleAuthed}
          onBack={goBack} />
      )}
      {screen === 'oauth-role' && (
        <OAuthRolePicker key="oauth-role" ctx={oauthCtx} onPick={completeOAuthRole} />
      )}
      {screen === 'admin-app' && (
        <motion.div key="admin-app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <AdminApp auth={auth} onLogout={handleLogout} />
        </motion.div>
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


function AdminAccessButton({ onAuthed }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!email || !password) return toast.error('Enter admin email and password');
    setBusy(true);
    try {
      const data = await api('auth/login', { method: 'POST', body: { identifier: email, password } });
      if (data.role !== 'admin') {
        toast.error('This email is not registered as admin');
        return;
      }
      setOpen(false);
      onAuthed?.(data);
      toast.success('Admin verified');
    } catch (e) {
      toast.error(e.message || 'Admin login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="bg-white/80 backdrop-blur border-slate-200 shadow-sm hover:bg-white">
        
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Admin verification</DialogTitle>
          <DialogDescription>Login with the email you marked as admin in Supabase.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Admin email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div>
            <Label>Password</Label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify Admin <ArrowRight className="w-4 h-4 ml-2" /></>}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminApp({ auth, onLogout }) {
  const token = auth?.session?.access_token;
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [profileView, setProfileView] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');

  const loadUsers = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const d = await api(`admin/users${params.toString() ? `?${params.toString()}` : ''}`, { token });
      setUsers(d.users || []);
    } catch (e) {
      toast.error(e.message || 'Unable to load admin users');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { loadUsers(); }, [token, roleFilter, statusFilter]);

  // Keep admin panel fresh when users submit verification from another tab/device.
  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => {
      loadUsers();
    }, 8000);
    return () => clearInterval(t);
  }, [token, roleFilter, statusFilter]);

  const openDetails = async (user) => {
    setSelected(user);
    setMessages([]);
    setAdminMessage('');
    setLoadingDetails(true);
    try {
      const detail = await api(`admin/users/${user.id}`, { token });
      const msg = await api(`admin/users/${user.id}/messages`, { token });
      setSelected(detail.user || user);
      setMessages(msg.messages || []);
    } catch (e) {
      toast.error(e.message || 'Unable to load details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const blockUser = async (id, blocked) => {
    setBusy(true);
    try {
      await api(`admin/users/${id}/block`, { method: 'PATCH', token, body: { blocked } });
      toast.success(blocked ? 'User blocked' : 'User unblocked');
      await loadUsers();
      if (selected?.id === id) setSelected((s) => ({ ...s, blocked }));
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const verifyUser = async (id, verified = true) => {
    if (verified && adminUserRole !== 'admin' && !adminRequiredSectionsDone) {
      toast.error(adminUserRole === 'worker' ? 'Verify Profile, Bank Details and Verification section first' : 'Verify Profile and Employer Verification section first');
      return;
    }
    setBusy(true);
    try {
      const body = { verified };
      if (selected?.role === 'worker') {
        body.badges = {
          verified_worker: !!selected.badge_verified_worker,
          skilled_worker: !!selected.badge_skilled_worker,
          experienced: !!selected.badge_experienced,
          immediate_joiner: !!selected.available,
        };
      }
      await api(`admin/users/${id}/verify`, { method: 'PATCH', token, body });
      toast.success(verified ? 'Account verified' : 'Verification rejected');
      await loadUsers();
      if (selected?.id === id) await openDetails(selected);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const activityDetails = (row) => {
    if (!row?.details) return {};
    if (typeof row.details === 'string') {
      try { return JSON.parse(row.details); } catch { return {}; }
    }
    return row.details || {};
  };

  const normalizeVerificationSection = (section) => (section === 'verification' ? 'documents' : section);
  const sectionActivityMatches = (row, wanted) => {
    const d = activityDetails(row);
    const rowSection = normalizeVerificationSection(d.section || d.verification_section || d.pending_verification_section);
    return rowSection === wanted;
  };
  const getAdminSectionState = (section) => {
    const wanted = normalizeVerificationSection(section);
    const sectionStatuses = selected?.section_statuses || selected?.extra?.section_statuses || {};
    const aliasWanted = wanted === 'documents' ? 'verification' : wanted === 'verification' ? 'documents' : wanted;
    const directStatus = sectionStatuses?.[wanted] || sectionStatuses?.[aliasWanted];
    if (directStatus === 'pending' || directStatus === 'submitted' || directStatus === 'modified') return 'pending';
    if (directStatus === 'rejected') return 'rejected';
    if (directStatus === 'verified') return 'verified';

    const rows = [...(selected?.activity || [])]
      .filter((a) => sectionActivityMatches(a, wanted))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    const latest = rows[0];
    const action = String(latest?.action || '').toLowerCase();
    if (action.includes('admin_verified_section') || action.includes('verified_profile_section')) return 'verified';
    if (action.includes('submit') || action.includes('upload') || action.includes('pending') || action.includes('verification')) return 'pending';

    const pendingSection = normalizeVerificationSection(
      selected?.verification_section ||
      selected?.pending_verification_section ||
      selected?.extra?.verification_section ||
      selected?.extra?.pending_verification_section
    );
    const status = selected?.verification_status || selected?.extra?.verification_status;
    if ((status === 'pending' || status === 'submitted' || status === 'modified') && pendingSection === wanted) return 'pending';
    return 'not_submitted';
  };
  const isSectionVerified = (section) => getAdminSectionState(section) === 'verified';
  const adminUserRole = (selected?.role || '').toLowerCase();
  const adminRequiredSections = adminUserRole === 'worker' ? ['profile', 'bank', 'verification'] : ['profile', 'verification'];
  const adminRequiredSectionsDone = adminRequiredSections.every(isSectionVerified);

  const verifySection = async (section) => {
    if (!selected?.id) return;
    setBusy(true);
    try {
      await api(`admin/users/${selected.id}/section-verify`, { method: 'PATCH', token, body: { section } });
      toast.success('Section verified');
      await openDetails(selected);
      await loadUsers();
    } catch (e) { toast.error(e.message || 'Unable to verify section'); } finally { setBusy(false); }
  };

  const sendAdminProfileMessage = async () => {
    if (!selected?.id || !adminMessage.trim()) return toast.error('Enter message');
    setBusy(true);
    try {
      await api('messages', { method: 'POST', token, body: { receiver_id: selected.id, content: adminMessage.trim() } });
      await api('notifications', { method: 'POST', token, body: { user_id: selected.id, title: 'Admin message', message: adminMessage.trim(), type: 'admin_message', source_id: selected.id } }).catch(() => null);
      await api(`admin/users/${selected.id}/section-verify`, { method: 'PATCH', token, body: { section: 'admin_message', messageOnly: true } }).catch(() => null);
      toast.success('Message sent');
      setAdminMessage('');
      await openDetails(selected);
    } catch (e) { toast.error(e.message || 'Unable to send message'); } finally { setBusy(false); }
  };

  const deleteUser = async (id, email) => {
    if (!confirm(`Permanently delete ${email || 'this user'}?`)) return;
    if (!confirm('This removes user auth, profile, jobs/applications/messages. Continue?')) return;
    setBusy(true);
    try {
      await api(`admin/users/${id}`, { method: 'DELETE', token });
      toast.success('User deleted');
      setSelected(null);
      await loadUsers();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const localFiltered = users.filter((u) => {
    const text = `${u.email || ''} ${u.full_name || ''} ${u.company_name || ''} ${u.role || ''} ${u.login_id || ''} ${u.location_text || ''} ${u.aadhaar_number || ''} ${u.pan_number || ''}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef2ff,transparent_34%),linear-gradient(180deg,#f8fafc,#eef2f7)]">
      <header className="bg-white/95 backdrop-blur-xl border-b sticky top-0 z-20 shadow-sm">
        <div className="container py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em]">Work2Wish</p>
            <h1 className="text-2xl font-extrabold flex items-center gap-2 mt-0.5">
              <motion.div
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-white shadow-lg shadow-amber-500/25"
                animate={{ rotate: [0, 5, 0, -5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <ShieldCheck className="w-5 h-5" />
              </motion.div>
              Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">Users, documents, jobs, chats, history.</p>
          </div>
          <div className="flex gap-2 items-center">
            <NotificationCenter token={token} userId={auth?.profile?.id} channelKey="admin" accent="amber" />
            <Button variant="outline" onClick={loadUsers} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}</Button>
            <Button onClick={onLogout} className="bg-emerald-600 hover:bg-emerald-700"><LogOut className="w-4 h-4 mr-2" /> Logout</Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-5">
        <div className="grid sm:grid-cols-5 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total users</p><p className="text-2xl font-bold">{users.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Workers</p><p className="text-2xl font-bold">{users.filter(u => u.role === 'worker').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Employers</p><p className="text-2xl font-bold">{users.filter(u => u.role === 'employer').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending verify</p><p className="text-2xl font-bold text-amber-600">{users.filter(u => u.verification_status === 'submitted' || u.verification_status === 'pending').length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Blocked</p><p className="text-2xl font-bold text-red-600">{users.filter(u => u.blocked).length}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle>All user details</CardTitle>
                <CardDescription>Inspect and manage accounts.</CardDescription>
              </div>
              <div className="grid md:grid-cols-4 gap-2">
                <div className="relative md:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadUsers()} className="pl-9" placeholder="Search email, name, login ID, card, location" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="worker">Workers</SelectItem><SelectItem value="employer">Employers</SelectItem><SelectItem value="admin">Admins</SelectItem></SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All status</SelectItem><SelectItem value="pending">Pending verification</SelectItem><SelectItem value="verified">Verified</SelectItem><SelectItem value="unverified">Unverified</SelectItem><SelectItem value="blocked">Blocked</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm bg-white">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">Login ID</th>
                    <th className="text-left p-3">Cards</th>
                    <th className="text-left p-3">Location</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {localFiltered.map((u) => (
                    <tr key={u.id} className="border-t align-top hover:bg-slate-50">
                      <td className="p-3 min-w-64"><p className="font-semibold">{u.full_name || u.company_name || 'No name'}</p><p className="text-xs text-muted-foreground">{u.email}</p>{u.company_name && <p className="text-xs text-muted-foreground">{u.company_name}</p>}</td>
                      <td className="p-3 capitalize"><Badge variant="secondary">{u.role}</Badge></td>
                      <td className="p-3">{u.login_id || '—'}</td>
                      <td className="p-3 min-w-52">
                        {u.role === 'worker' ? (
                          <>
                            <p className="text-xs">Aadhaar: {u.aadhaar_number || '—'}</p>
                            <p className="text-xs">PAN: {u.pan_number || '—'}</p>
                          </>
                        ) : u.role === 'employer' ? (
                          <>
                            <p className="text-xs">Company PAN: {u.pan_number || '—'}</p>
                            <p className="text-xs">GST: {u.gst_number || '—'}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Admin account</p>
                        )}
                      </td>
                      <td className="p-3 min-w-72"><p className="line-clamp-2">{u.location_text || 'No saved location'}</p>{u.latitude && u.longitude && <p className="text-xs text-muted-foreground">{formatCoordinates(u.latitude, u.longitude)}</p>}</td>
                      <td className="p-3 space-y-1">
                        {u.blocked ? <Badge className="bg-red-100 text-red-700">Blocked</Badge> : <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>}
                        {u.verified ? <Badge className="bg-emerald-100 text-emerald-700 block w-fit">Verified</Badge> : <Badge variant="outline" className="block w-fit">{u.verification_status || 'Unverified'}</Badge>}
                        {(() => {
                          try {
                            const submittedAt = u.verification_submitted_at ? new Date(u.verification_submitted_at) : null;
                            const verifiedAt = u.verified_at ? new Date(u.verified_at) : null;
                            const needsReview = submittedAt && (!verifiedAt || submittedAt.getTime() > verifiedAt.getTime());
                            if (needsReview) return <Badge className="bg-amber-100 text-amber-800 block w-fit">Updated</Badge>;
                          } catch (e) {}
                          return null;
                        })()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => openDetails(u)}>View</Button>
                          <Button size="sm" variant="outline" disabled={busy || u.role === 'admin'} onClick={() => blockUser(u.id, !u.blocked)}>{u.blocked ? 'Unblock' : 'Block'}</Button>
                          <Button size="sm" variant="destructive" disabled={busy || u.role === 'admin'} onClick={() => deleteUser(u.id, u.email)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {localFiltered.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-muted-foreground">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.full_name || selected?.company_name || selected?.email || 'User details'}</DialogTitle>
            <DialogDescription>Full account record.</DialogDescription>
          </DialogHeader>
          {loadingDetails ? <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div> : selected && (
            <div className="space-y-5">
              <div className="grid md:grid-cols-3 gap-3">
                <InfoTile label="Email" value={selected.email} />
                <InfoTile label="Role" value={selected.role} />
                <InfoTile label="Login ID" value={selected.login_id} />
                <InfoTile label="Phone" value={selected.phone} />
                <InfoTile label="Location" value={selected.location_text} />
                <InfoTile label="Account status" value={selected.verified ? 'Verified account' : (selected.verification_status || 'Not submitted')} />
              </div>

              {(() => {
                const canFinalVerify = adminRequiredSectionsDone;
                const verificationTitle = selected.role === 'worker' ? 'Worker Verification' : 'Employer Verification';
                return (
                  <div className="grid lg:grid-cols-3 gap-4">
                    <AdminVerificationSection
                      title="Profile"
                      tone="indigo"
                      icon={<UserCircle className="w-4 h-4" />}
                      verified={isSectionVerified('profile')}
                      onVerify={() => verifySection('profile')}
                      disabled={busy || selected.role === 'admin'}
                    >
                      <InfoTile label="Name" value={selected.full_name || selected.company_name} />
                      <InfoTile label="Phone" value={selected.phone} />
                      <InfoTile label="Address" value={selected.role === 'employer' ? selected.company_address : selected.address} />
                      <InfoTile label="Coordinates" value={selected.latitude && selected.longitude ? formatCoordinates(selected.latitude, selected.longitude) : '—'} />
                      {selected.role === 'worker' && <InfoTile label="Skills" value={(selected.skills || []).join(', ')} />}
                      {selected.role === 'worker' && <InfoTile label="Experience" value={`${selected.experience_years || 0} years · ${selected.experience_level || '—'}`} />}
                      {selected.role === 'employer' && <InfoTile label="Company" value={selected.company_name} />}
                      {selected.role === 'employer' && <InfoTile label="Industry" value={selected.industry} />}
                      {selected.role === 'employer' && <InfoTile label="HR contact" value={selected.hr_contact || selected.official_email} />}
                    </AdminVerificationSection>

                    {adminUserRole === 'worker' && (
                      <AdminVerificationSection
                        title="Bank Details"
                        tone="emerald"
                        icon={<Banknote className="w-4 h-4" />}
                        verified={isSectionVerified('bank')}
                        onVerify={() => verifySection('bank')}
                        disabled={busy || selected.role === 'admin'}
                      >
                        <InfoTile label="Account holder" value={selected.account_holder_name || selected.full_name || selected.company_name} />
                        <InfoTile label="Bank name" value={selected.bank_name} />
                        <InfoTile label="Bank account" value={selected.bank_account || selected.bank_account_number} />
                        <InfoTile label="IFSC" value={selected.ifsc_code} />
                        <InfoTile label="Branch name" value={selected.branch_name} />
                        <InfoTile label="UPI" value={selected.upi_id} />
                        <AdminDocPreview title="UPI QR" url={selected.bank_qr_url} />
                      </AdminVerificationSection>
                    )}

                    <AdminVerificationSection
                      title={verificationTitle}
                      tone="amber"
                      icon={<ShieldCheck className="w-4 h-4" />}
                      verified={isSectionVerified('verification')}
                      onVerify={() => verifySection('verification')}
                      disabled={busy || selected.role === 'admin'}
                    >
                      <InfoTile label={selected.role === 'worker' ? 'Aadhaar' : 'Company PAN'} value={selected.role === 'worker' ? selected.aadhaar_number : selected.pan_number} />
                      {selected.role === 'worker' && <InfoTile label="PAN" value={selected.pan_number} />}
                      {selected.role === 'employer' && <InfoTile label="GST" value={selected.gst_number} />}
                      <div className="grid sm:grid-cols-2 gap-3">
                        {selected.role === 'worker' && <AdminDocPreview title="Aadhaar front" url={selected.aadhaar_front_url} />}
                        {selected.role === 'worker' && <AdminDocPreview title="Aadhaar back" url={selected.aadhaar_back_url} />}
                        <AdminDocPreview title={selected.role === 'employer' ? 'Company PAN front' : 'PAN front'} url={selected.pan_image_url} />
                        <AdminDocPreview title={selected.role === 'employer' ? 'Company PAN back' : 'PAN back'} url={selected.pan_back_url} />
                        {selected.role === 'employer' && <AdminDocPreview title="GST certificate" url={selected.gst_certificate_url} />}
                        <AdminDocPreview title={selected.role === 'employer' ? 'Employer selfie' : 'Selfie'} url={selected.selfie_url || selected.selfie_front_url} />
                        {selected.role === 'worker' && <AdminDocPreview title="Skill certificate" url={selected.certificate_url} />}
                      </div>
                      {adminUserRole === 'worker' && (
                        <div className="grid gap-3">
                          <AdminCheck label="Verified Worker" checked={!!selected.badge_verified_worker} onChange={(v) => setSelected(s => ({ ...s, badge_verified_worker: v }))} />
                          <AdminCheck label="Skilled Worker" checked={!!selected.badge_skilled_worker} onChange={(v) => setSelected(s => ({ ...s, badge_skilled_worker: v }))} />
                          <AdminCheck label="Experienced" checked={!!selected.badge_experienced} onChange={(v) => setSelected(s => ({ ...s, badge_experienced: v }))} />
                          <StatusPill label="Mobile OTP" ok={!!selected.mobile_verified} />
                          <StatusPill label="Selfie" ok={!!selected.selfie_verified} />
                        </div>
                      )}
                    </AdminVerificationSection>
                  </div>
                );
              })()}

              {(() => {
                try {
                  const submittedAt = selected.verification_submitted_at ? new Date(selected.verification_submitted_at) : null;
                  const verifiedAt = selected.verified_at ? new Date(selected.verified_at) : null;
                  const needsReview = submittedAt && (!verifiedAt || submittedAt.getTime() > verifiedAt.getTime());
                  if (needsReview) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><Badge className="bg-amber-100 text-amber-800 mr-2">Updated</Badge>Documents changed. Review all three sections and verify account again.</div>;
                } catch (e) {}
                return null;
              })()}

              <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-sky-700" /> Message profile owner</h3>
                  <Badge className="bg-white text-sky-700 border border-sky-200">Direct</Badge>
                </div>
                <Textarea value={adminMessage} onChange={(e) => setAdminMessage(e.target.value)} placeholder="Type issue or update needed" className="bg-white" />
                <Button disabled={busy || selected.role === 'admin'} onClick={sendAdminProfileMessage} className="bg-sky-600 hover:bg-sky-700"><Send className="w-4 h-4 mr-2" /> Send message</Button>
              </div>

              <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-4">
                <Button disabled={busy || adminUserRole === 'admin' || !adminRequiredSectionsDone} onClick={() => verifyUser(selected.id, true)} className="bg-emerald-600 hover:bg-emerald-700"><ShieldCheck className="w-4 h-4 mr-2" /> Final verify account</Button>
                <Button disabled={busy || selected.role === 'admin'} variant="outline" onClick={() => verifyUser(selected.id, false)}><XCircle className="w-4 h-4 mr-2" /> Reject verification</Button>
                <Button disabled={busy || selected.role === 'admin'} variant="outline" onClick={() => blockUser(selected.id, !selected.blocked)}>{selected.blocked ? 'Unblock user' : 'Block user'}</Button>
                <Button disabled={busy || selected.role === 'admin'} variant="destructive" onClick={() => deleteUser(selected.id, selected.email)}>Delete user</Button>
              </div>

              {selected.role === 'employer' && (
                <AdminCompactList
                  title="Job posts"
                  icon={<Briefcase className="w-4 h-4" />}
                  empty="No jobs posted."
                  rows={(selected.jobs || []).map(j => ({
                    id: j.id,
                    main: j.title,
                    sub: `${j.category || 'Job'} · ₹${j.daily_pay || 0}/day · ${j.status || 'open'}`,
                    meta: `${(j.applications || []).length} applicants · ${j.location_text || 'No location'}`
                  }))}
                />
              )}

              {adminUserRole === 'worker' && (
                <AdminCompactList
                  title="Applications"
                  icon={<ClipboardList className="w-4 h-4" />}
                  empty="No applications."
                  rows={(selected.applications || []).map(a => ({
                    id: a.id,
                    main: a.jobs?.title || 'Job application',
                    sub: `${a.status || 'pending'} · ₹${a.jobs?.daily_pay || 0}/day`,
                    meta: `${a.jobs?.category || 'Job'} · ${a.jobs?.location_text || 'No location'}`
                  }))}
                />
              )}

              <AdminCompactList
                title="Activity history"
                icon={<Clock className="w-4 h-4" />}
                empty="No history."
                rows={(selected.activity || []).map(a => ({
                  id: a.id,
                  main: String(a.action || '').replace(/_/g, ' '),
                  sub: new Date(a.created_at).toLocaleString(),
                  meta: a.details ? JSON.stringify(a.details) : ''
                }))}
              />

              <div>
                <h3 className="font-bold mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Recent chats/messages</h3>
                <div className="rounded-xl border bg-slate-50 max-h-72 overflow-y-auto">
                  {messages.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No messages found.</p> : messages.map((m) => (
                    <div key={m.id} className="p-3 border-b bg-white">
                      <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()} · From {m.sender_id} → {m.receiver_id}</p>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminVerificationSection({ title, tone = 'indigo', icon, verified, children, onVerify, disabled }) {
  const styles = {
    indigo: 'border-indigo-200 bg-indigo-50/60 text-indigo-800',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-800',
  };
  const button = verified
    ? 'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700 disabled:!opacity-100 disabled:bg-emerald-600 disabled:text-white disabled:cursor-default'
    : 'border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700';
  return (
    <div className={`rounded-3xl border ${styles[tone] || styles.indigo} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-extrabold flex items-center gap-2">{icon}{title}</h3>
          <Badge className={verified ? 'mt-2 bg-emerald-100 text-emerald-800 border border-emerald-200' : 'mt-2 bg-white text-slate-600 border border-slate-200'}>{verified ? 'Section verified' : 'Review pending'}</Badge>
        </div>
        <Button size="sm" variant="outline" disabled={disabled || verified} onClick={onVerify} className={button}>
          <CheckCircle2 className="w-4 h-4 mr-1" /> {verified ? 'Done' : 'Verify'}
        </Button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoTile({ label, value }) {
  return <div className="rounded-xl border bg-white p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold break-words">{value || '—'}</p></div>;
}

function AdminCompactList({ title, icon, rows = [], empty = 'No records.' }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="font-bold mb-3 flex items-center gap-2">{icon}{title}</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : rows.map((r) => (
          <div key={r.id || `${r.main}-${r.sub}`} className="rounded-xl border bg-slate-50 p-3">
            <p className="text-sm font-semibold capitalize">{r.main || '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.sub || '—'}</p>
            {r.meta && <p className="text-[11px] text-muted-foreground mt-1 break-words line-clamp-2">{r.meta}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminCheck({ label, checked, onChange }) {
  return (
    <label className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm cursor-pointer transition ${checked ? 'bg-emerald-50 border-emerald-300 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
      <span className="font-semibold text-slate-800">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${checked ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{checked ? 'Verified' : 'Not verified'}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
      </span>
    </label>
  );
}

function StatusPill({ label, ok }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 flex items-center justify-between ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <Badge className={ok ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}>{ok ? 'Verified' : 'Pending'}</Badge>
    </div>
  );
}

function AdminDocPreview({ title, url }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="font-semibold text-sm mb-2">{title}</p>
      <div className="h-40 rounded-lg bg-slate-50 border grid place-items-center overflow-hidden">
        {url ? <img src={url} alt={title} className="w-full h-full object-contain" /> : <p className="text-xs text-muted-foreground">Not uploaded</p>}
      </div>
      {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">Open file</a>}
    </div>
  );
}

// ============================================================
// SPLASH (animated, 3D)
// ============================================================
function Splash() {
  return (
    <motion.div key="splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#061a4d] via-[#0b67bd] to-[#9ee8ff] p-6 overflow-hidden relative">
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
          <Work2WishLogo className="w-24 h-24 drop-shadow-2xl" />
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
      const { data, error } = await supa.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
        skipBrowserRedirect: true,
      });
      if (error) throw error;
      if (data?.url && typeof window !== 'undefined') window.location.replace(data.url);
    } catch (e) {
      toast.error(`Google sign-in failed: ${e.message}. Make sure Google is enabled in Supabase Auth → Providers.`);
    }
  };

  return (
    <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50 grid lg:grid-cols-2 relative">
      {/* left: marketing with 3D depth */}
      <div className="hidden lg:flex flex-col justify-center p-10 bg-gradient-to-br from-[#061a4d] via-[#0b67bd] to-[#9ee8ff] text-white relative overflow-hidden">
        <GradientMesh />
        <Particles count={22} color="bg-white/30" />
        <div className="relative z-10" style={{ perspective: 1200 }}>
          <motion.div className="flex items-center gap-3"
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <motion.div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur grid place-items-center ring-1 ring-white/30 p-1.5"
              animate={{ rotate: [0, 3, 0, -3, 0] }} transition={{ duration: 6, repeat: Infinity }}>
              <Work2WishLogo className="w-full h-full" />
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
              { i: MapPin, Map,      t: 'Location-matched job recommendations' },
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

        </div>
        <p className="relative text-white/60 text-xs">© {new Date().getFullYear()} Work2Wish</p>
      </div>

      {/* right: form */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 relative">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white grid place-items-center shadow-sm ring-1 ring-sky-100 p-1"><Work2WishLogo className="w-full h-full" /></div>
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
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 flex flex-col relative overflow-hidden">
      <GradientMesh />
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start m-6 relative"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex-1 flex items-center justify-center px-6 relative">
        <Tilt3D className="w-full max-w-md">
          <Card className="shadow-2xl border-0 ring-1 ring-black/5">
            <CardHeader className="text-center pb-2">
              <motion.div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#061a4d] to-[#0b8fe8] grid place-items-center text-white mb-3"
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
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 flex flex-col relative overflow-hidden">
      <GradientMesh />
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start m-6 relative"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex-1 flex items-center justify-center px-6 relative">
        <Tilt3D className="w-full max-w-md">
          <Card className="shadow-2xl border-0 ring-1 ring-black/5">
            <CardHeader className="text-center pb-2">
              <motion.div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#061a4d] to-[#21b7ff] grid place-items-center text-white mb-3"
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
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 p-6 flex flex-col relative overflow-hidden">
      <GradientMesh />
      <div className="relative z-10 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="relative"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      </div>
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
                  <motion.div className={`w-16 h-16 rounded-2xl grid place-items-center text-white ${r.color === 'indigo' ? 'bg-gradient-to-br from-[#061a4d] to-[#0b8fe8]' : 'bg-gradient-to-br from-[#061a4d] to-[#21b7ff]'} shadow-lg`}
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
function getPasswordStrength(password = '') {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Weak', width: '25%', color: 'bg-red-500' };
  if (score <= 3) return { label: 'Medium', width: '60%', color: 'bg-amber-500' };
  return { label: 'Strong', width: '100%', color: 'bg-emerald-500' };
}

function SignupForm({ data, onChange, onSent, onBack }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!data.full_name || !data.email || !data.password || !data.confirm_password) return toast.error('Fill all fields');
    if (data.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (getPasswordStrength(data.password).label === 'Weak') return toast.error('Use a stronger password');
    if (data.password !== data.confirm_password) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      await api(
        data.is_google_signup ? 'auth/google-send-otp' : 'auth/send-otp',
        { method: 'POST', body: data }
      );
      toast.success(`OTP sent to ${data.email}`);
      onSent();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const strength = getPasswordStrength(data.password || '');
  const accent = data.role === 'employer' ? 'emerald' : 'indigo';
  return (
    <motion.div key="signup-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6 flex flex-col">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-black/5">
          <CardHeader className="text-center pb-2">
            <div className={`w-14 h-14 mx-auto rounded-2xl grid place-items-center text-white mb-3 ${
              data.role === 'employer' ? 'bg-gradient-to-br from-[#061a4d] to-[#21b7ff]' : 'bg-gradient-to-br from-[#061a4d] to-[#0b8fe8]'
            }`}>
              {data.role === 'employer' ? <Briefcase className="w-7 h-7" /> : <HardHat className="w-7 h-7" />}
            </div>
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Signing up as <span className="font-semibold capitalize">{data.role}</span>{data.is_google_signup ? ' with Google' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Full name</Label>
                <Input
                  value={data.full_name}
                  disabled={data.is_google_signup}
                  onChange={e => onChange({ full_name: e.target.value })}
                  placeholder="Your name"
                  className={data.is_google_signup ? 'bg-slate-100 cursor-not-allowed' : ''}
                />
              </div>
              <div>
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    className={`pl-9 ${data.is_google_signup ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                    value={data.email}
                    disabled={data.is_google_signup}
                    onChange={e => onChange({ email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div>
                <Label>Password</Label>
                <PasswordInput
                  value={data.password}
                  onChange={e => onChange({ password: e.target.value })}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
                {data.password && (
                  <div className="mt-2">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-[1000ms] ${strength.color}`} style={{ width: strength.width }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Strength: <b>{strength.label}</b></p>
                  </div>
                )}
              </div>
              <div>
                <Label>Confirm password</Label>
                <PasswordInput
                  value={data.confirm_password || ''}
                  onChange={e => onChange({ confirm_password: e.target.value })}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
                {data.confirm_password && data.password !== data.confirm_password && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
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
      const d = await api(
        data.is_google_signup ? 'auth/google-verify-otp' : 'auth/verify-otp',
        {
          method: 'POST',
          body: data.is_google_signup
            ? { email: data.email, otp: code, google_access_token: data.google_access_token }
            : { email: data.email, otp: code },
        }
      );
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
              accent === 'emerald' ? 'bg-gradient-to-br from-[#061a4d] to-[#21b7ff]' : 'bg-gradient-to-br from-[#061a4d] to-[#0b8fe8]'
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
        <motion.div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#061a4d] to-[#21b7ff] grid place-items-center text-white"
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
            <div className={`w-14 h-14 rounded-2xl grid place-items-center text-white ${r.color === 'indigo' ? 'bg-gradient-to-br from-[#061a4d] to-[#0b8fe8]' : 'bg-gradient-to-br from-[#061a4d] to-[#21b7ff]'}`}>
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


function NotificationCenter({
 token,
 userId,
 channelKey = 'worker',
 accent = 'indigo',
 onNavigate = null
}) {

const [open,setOpen]=useState(false);
const [notifications,setNotifications]=useState([]);
const [selected,setSelected]=useState(null);
const [loading,setLoading]=useState(false);

useEffect(()=>{

loadNotifications();

},[]);

useEffect(() => {
  if (typeof window === 'undefined') return;

  const handleNotificationBack = (event) => {
    if (!open && !selected) return;

    // Close notification UI first. Do not also change dashboard tabs.
    event?.stopImmediatePropagation?.();

    if (selected) {
      setSelected(null);
      setOpen(true);
      return;
    }

    setOpen(false);
  };

  window.addEventListener('popstate', handleNotificationBack);
  return () => window.removeEventListener('popstate', handleNotificationBack);
}, [open, selected]);


async function loadNotifications(){

if(!token) return;

try{

setLoading(true);

const data=await api(
`notifications?user_id=${userId}`,
{token}
);

setNotifications(
data.notifications || []
);

}catch(e){

toast.error(
"Unable to load notifications"
);

}
finally{

setLoading(false);

}

}

const unreadCount=
notifications.filter(
n=>!n.read
).length;


return(

<>

{/* Bell Button */}

<Button
size="icon"
variant="outline"
className="
relative
rounded-full
"

onClick={()=>{
setOpen(true);
if (typeof window !== 'undefined') {
  window.history.pushState(
    { w2wInternal: true, panel: 'notifications', channelKey },
    '',
    window.location.href
  );
}
}}

>

<Bell className="w-5 h-5"/>

{unreadCount>0 && (

<div
className="
absolute
-top-1
-right-1
w-5
h-5
rounded-full
bg-red-500
text-white
text-xs
flex
items-center
justify-center
"
>

{unreadCount}

</div>

)}

</Button>



<AnimatePresence>

{open && (

<>

{/* No page overlay: notification panel stays separate and will not dim/cover other cards */}

{/* Right Panel */}

<motion.div

initial={{
x:350
}}

animate={{
x:0
}}

exit={{
x:350
}}

transition={{
type:"spring",
damping:25
}}

className="
fixed
top-[64px]
right-3
w-[min(360px,92vw)]
h-[calc(100vh-76px)]
rounded-3xl
border border-slate-200/80
bg-gradient-to-b from-white via-slate-50 to-indigo-50
dark:bg-slate-900
shadow-2xl
z-[60]
flex
flex-col
overflow-hidden
"

>

{/* Header */}

<div
className="
p-4
border-b
flex
items-center
justify-between
"
>

{selected ? (

<Button
variant="ghost"
size="sm"
onClick={()=>{
setSelected(null)
}}
className="
gap-2
"
>

<ChevronLeft
className="
w-4
h-4
"
/>

Back

</Button>

)

:

<>

<div>

<h2
className="
font-bold
text-lg
"
>

Notifications

</h2>

<p
className="
text-xs
text-gray-500
mt-0.5
"
>

{notifications.length} total

</p>

</div>

<div
className="
flex
items-center
gap-2
"
>

{unreadCount > 0 && (

<Button
variant="ghost"
size="sm"
onClick={() => {
  setNotifications(prev =>
    prev.map(n => ({ ...n, read: true }))
  );
  toast.success('All marked as read');
}}
className="
text-xs
h-auto
py-1
px-2
"
>

Mark all read

</Button>

)}

<div
className="
px-2
py-1
rounded-full
bg-green-100
dark:bg-green-950
text-green-700
dark:text-green-300
text-xs
font-semibold
"
>

{unreadCount} new

</div>

</div>

</>

}

</div>



{/* Details */}

{selected ? (

<div
className="
flex-1
overflow-y-auto
p-4
space-y-4
"
>

{/* Hero Card */}

<div
className="
rounded-3xl
bg-gradient-to-br
from-green-500
to-emerald-700
text-white
p-6
"
>

<div
className="
w-14
h-14
rounded-xl
bg-white/20
flex
items-center
justify-center
mb-4
"
>

<Bell className="w-7 h-7"/>

</div>


<h2
className="
font-bold
text-2xl
mb-2
"
>

{selected?.title ||
"Notification"}

</h2>

<p
className="
mt-3
text-sm
leading-relaxed
"
>

{selected?.message ||
"No details"}

</p>

</div>


{/* Metadata Section */}

<div
className="
rounded-2xl
border
bg-slate-50
dark:bg-slate-800
p-4
space-y-4
"
>

<div className="space-y-3">

<div
className="
flex
justify-between
items-start
"
>

<div>

<p
className="
text-xs
font-semibold
text-gray-500
dark:text-gray-400
uppercase
tracking-wider
"
>

Type

</p>

<div
className="
mt-2
flex
gap-2
flex-wrap
"
>

<Badge
variant="outline"
className="
capitalize
bg-green-50
dark:bg-green-950
text-green-700
dark:text-green-300
border-green-200
dark:border-green-800
"
>

{selected?.type || 'notification'}

</Badge>

{selected?.read ? (

<Badge
variant="outline"
className="
bg-gray-100
dark:bg-gray-800
text-gray-600
dark:text-gray-300
border-gray-200
dark:border-gray-700
"
>

✓ Read

</Badge>

) : (

<Badge
className="
bg-red-500
hover:bg-red-600
"
>

New

</Badge>

)}

</div>

</div>

</div>

</div>


<Separator className="my-3"/>


<div className="space-y-3">

<div>

<p
className="
text-xs
font-semibold
text-gray-500
dark:text-gray-400
uppercase
tracking-wider
"
>

Received

</p>

<p
className="
mt-2
text-sm
font-medium
"
>

{selected?.created_at
?
new Date(
selected.created_at
).toLocaleString()

:
"Unknown"}

</p>

<p
className="
text-xs
text-gray-400
mt-1
"
>

{selected?.created_at
?
(() => {
  const now = new Date();
  const then = new Date(selected.created_at);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
})()
:
''
}

</p>

</div>

</div>


<Separator className="my-3"/>


<div>

<p
className="
text-xs
font-semibold
text-gray-500
dark:text-gray-400
uppercase
tracking-wider
"
>

Reference ID

</p>

<div
className="
mt-2
flex
items-center
gap-2
bg-slate-100
dark:bg-slate-700
p-3
rounded-lg
font-mono
text-xs
"
>

<span>

#{selected?.id}

</span>

<Button
size="sm"
variant="ghost"
onClick={() => {
  navigator.clipboard.writeText(selected?.id);
  toast.success('ID copied!');
}}
className="ml-auto h-6"
>

<Copy className="w-3 h-3"/>

</Button>

</div>

</div>

</div>


{/* Action Buttons */}

<div
className="
pt-2
flex
gap-2
"
>

<Button
variant="default"
className="
flex-1
bg-green-600
hover:bg-green-700
"
onClick={() => {
  setSelected(null);
  toast.success('Notification marked as handled');
}}
>

<CheckCircle2 className="w-4 h-4 mr-2"/>

Done

</Button>


<Button
variant="outline"
onClick={() => {
  setNotifications(prev => prev.filter(n => n.id !== selected.id));
  setSelected(null);
  toast.success('Notification deleted');
}}
>

<Trash2 className="w-4 h-4"/>

</Button>

</div>

</div>

)

:

<div
className="
flex-1
overflow-y-auto
p-3
space-y-3
"
>

{loading ? (

<div
className="
flex
justify-center
p-6
"
>

<Loader2
className="
animate-spin
"
/>

</div>

)

:

notifications.length===0

?

<div
className="
h-full
flex
items-center
justify-center
text-gray-400
"
>

No Notifications

</div>

:

notifications.map(item=>(

<motion.div

key={item.id}

whileHover={{
scale:1.02
}}

onClick={()=>{

setNotifications(
prev=>
prev.map(n=>

n.id===item.id

?

{
...n,
read:true
}

:n

)

);
api(`notifications/${item.id}/read`, { method: 'POST', token }).catch(() => null);

const target = {
  ...item,
  type: item.type,
  reference_id: item.reference_id || item.source_id || item.target_id || item.related_id,
  target_route: item.target_route || item.target_page || item.route,
  peer_id: item.peer_id,
  peer_name: item.peer_name,
  peer_photo: item.peer_photo,
  peer_role: item.peer_role,
};

if (onNavigate) {
  onNavigate(target);
  setOpen(false);
  setSelected(null);
  toast.success('Opening related page');
} else {
  if (typeof window !== 'undefined') {
    window.history.pushState(
      { w2wInternal: true, panel: 'notification-detail', notificationId: item.id },
      '',
      window.location.href
    );
  }
  setSelected(item);
}

}}

className="
relative
rounded-3xl
border border-white/70
bg-gradient-to-br from-white via-indigo-50/80 to-emerald-50/60
dark:bg-slate-800
shadow-lg shadow-indigo-100/70
hover:shadow-2xl hover:-translate-y-0.5
cursor-pointer
p-4
overflow-hidden
"

>

<div
className="
absolute
left-0
top-0
bottom-0
w-1
bg-green-500
"
/>

<div
className="
flex
gap-3
"
>

<div
className="
w-12
h-12
rounded-2xl
bg-gradient-to-br from-[#061a4d] to-[#21b7ff]
text-white
flex
items-center
justify-center
"
>

<Bell
className="
w-5
h-5
"
/>

</div>


<div className="flex-1">

<div
className="
flex
justify-between
items-start
gap-2
"
>

<div className="flex-1">

<p
className="
font-semibold
text-sm
"
>

{item.title ||
"Notification"}

</p>

<div
className="
flex
items-center
gap-2
mt-1
flex-wrap
"
>

<Badge
variant="outline"
className="
text-[10px]
capitalize
py-0
px-1.5
bg-blue-50
dark:bg-blue-950
text-blue-700
dark:text-blue-300
border-blue-200
dark:border-blue-800
"
>

{item.type || 'system'}

</Badge>

{!item.read && (

<Badge
className="
text-[10px]
py-0
px-1.5
bg-red-500
hover:bg-red-600
animate-pulse
"
>

New

</Badge>

)}

</div>

</div>

{!item.read && (

<div
className="
w-2
h-2
rounded-full
bg-red-500
animate-pulse
mt-1
flex-shrink-0
"
/>

)}

</div>


<p
className="
text-xs
text-gray-500
dark:text-gray-400
mt-2
line-clamp-2
leading-snug
"
>

{item.message}

</p>

<p
className="
text-[11px]
text-gray-400
mt-2
flex
items-center
gap-1
"
>

<Clock className="w-3 h-3"/>

{
item.created_at
?

(() => {
  const now = new Date();
  const then = new Date(item.created_at);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
})()

:

"Recently"

}

</p>

</div>

</div>

</motion.div>

))

}

</div>

}

</motion.div>

</>

)}

</AnimatePresence>

</>

);

}


function AccountActivitySheet({ token, accent = 'indigo' }) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!token) return;
    setBusy(true);
    try { const d = await api('me/activity', { token }); setActivity(d.activity || []); }
    catch (e) { toast.error(e.message || 'Unable to load history'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);
  const top = accent === 'emerald' ? 'from-emerald-600 to-teal-600' : 'from-indigo-600 to-blue-600';
  const clean = (v) => {
    const text = String(v || '').replace(/_/g, ' ');
    const map = {
      login: 'You signed in to your account',
      logout: 'You signed out of your account',
      updated_profile: 'You updated your profile details',
      submitted_verification: 'You sent your account for admin verification',
      admin_verified_account: 'Admin finally verified your account',
      admin_rejected_verification: 'Admin rejected your verification and asked for correction',
      admin_verified_section: 'Admin verified one document section in your profile',
      admin_sent_message: 'Admin sent you a message about your account',
      verified_user: 'You verified a user account from admin panel',
      rejected_user: 'You rejected a user verification from admin panel',
      sent_profile_message: 'You messaged a profile owner from admin panel',
      verified_profile_section: 'You verified a profile section from admin panel',
      admin_blocked_account: 'Admin blocked your account',
      admin_unblocked_account: 'Admin unblocked your account',
      blocked_user: 'You blocked a user account',
      unblocked_user: 'You unblocked a user account',
      deleted_user: 'You deleted a user account',
      worker_confirmed_hire: 'Worker accepted the hire and moved the job to next step',
      posted_job: 'You posted a new job',
      updated_job_post: 'You edited a posted job',
      application_pending: 'You applied for a job and it is waiting for company review',
      application_accepted: 'Company selected your application',
      application_rejected: 'Company rejected your application',
      application_ongoing: 'Your job moved to ongoing work',
      application_completed: 'Your job was completed',
      set_application_accepted: 'You selected a worker for the job',
      set_application_rejected: 'You rejected a worker application',
      set_application_ongoing: 'You moved the hired worker to ongoing work',
      set_application_completed: 'You marked the hired work as completed',
      profile_update: 'You updated your profile details',
      verification_submit: 'You sent your account for verification',
      document_upload: 'You uploaded a document for admin review',
      skill_certificate_upload: 'You added a skill certificate for admin re-verification',
      job_post: 'You posted a new job',
      job_apply: 'You applied for a job',
      application_accept: 'Employer accepted an application',
      application_reject: 'Employer rejected an application',
      account_verified: 'Admin verified your account',
      account_rejected: 'Admin rejected your verification',
      account_deleted: 'Account delete action was recorded',
    };
    const key = String(v || '').toLowerCase();
    return map[key] || `You ${text.replace(/\b\w/g, c => c.toUpperCase()).toLowerCase()}`;
  };
  return (
    <>
      <Button type="button" variant="outline" className="w-full justify-start h-11 rounded-xl" onClick={() => setOpen(true)}>
        <Clock className="w-4 h-4 mr-2" /> Activity history
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 w-full sm:max-w-lg overflow-hidden premium-panel">
          <DialogHeader className={`px-5 py-4 bg-gradient-to-r ${top} text-white`}>
            <DialogTitle className="text-white flex items-center gap-2"><Clock className="w-5 h-5" /> History</DialogTitle>
            <DialogDescription className="text-xs text-white/80">Recent account activity, similar to Google history.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[70vh] bg-slate-50">
            <div className="p-4 space-y-3">
              {busy && <div className="grid place-items-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>}
              {!busy && activity.length === 0 && <div className="rounded-2xl border bg-white p-6 text-center text-sm text-muted-foreground">No history yet.</div>}
              {!busy && activity.map((a) => (
                <div key={a.id || `${a.action}-${a.created_at}`} className="rounded-2xl border bg-white p-4 shadow-sm premium-history-row">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 grid place-items-center shrink-0 border border-blue-100"><Clock className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-sm">{clean(a.action)}</p>
                        <Badge variant="outline" className="shrink-0 rounded-full">{new Date(a.created_at).toLocaleDateString()}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        <InfoTile label="Activity" value={String(a.action || '').replace(/_/g, ' ')} />
                        <InfoTile label="Device time" value={new Date(a.created_at).toLocaleTimeString()} />
                      </div>
                      {a.details && Object.keys(a.details || {}).length > 0 && (
                        <div className="mt-3 rounded-xl border bg-slate-50 p-3 space-y-1">
                          {detailsToWords(a.details).map((line, idx) => <p key={idx} className="text-[11px] text-slate-700 capitalize">{line}</p>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// WORKER APP
// ============================================================
function WorkerApp({ auth, onLogout }) {
  const token = auth?.session?.access_token;
  const [tab, setTabState] = useState('home'); // home | myjobs | chats | profile
  const [me, setMe] = useState(null);
  const [chatPeer, setChatPeer] = useState(null);
  const tabHistoryRef = useRef([]);

  const setTab = (nextTab, options = {}) => {
    setTabState((currentTab) => {
      if (!nextTab || currentTab === nextTab) return currentTab;

      if (!options.replace && typeof window !== 'undefined') {
        tabHistoryRef.current.push(currentTab);
        window.history.pushState(
          { w2wInternal: true, portal: 'worker', tab: nextTab },
          '',
          window.location.href
        );
      }

      return nextTab;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.history.replaceState(
      { ...(window.history.state || {}), w2wInternal: true, portal: 'worker', tab: 'home' },
      '',
      window.location.href
    );

    const handleBrowserBack = () => {
      const previousTab = tabHistoryRef.current.pop();

      if (previousTab) {
        setChatPeer(null);
        setTabState(previousTab);
        return;
      }

      setChatPeer(null);
      setTabState('home');
      window.history.pushState(
        { w2wInternal: true, portal: 'worker', tab: 'home' },
        '',
        window.location.href
      );
    };

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, []);

  const refreshMe = async () => {
    try { const data = await api('me', { token }); setMe(data); } catch (e) { toast.error(e.message); }
  };
  useEffect(() => { if (token) { refreshMe(); } }, [token]);

  const openChatWith = (peer) => { setChatPeer(peer); setTab('chats'); };

  const handleNotificationNavigate = (notif) => {
    const type = (notif?.type || '').toLowerCase();
    const title = (notif?.title || '').toLowerCase();
    const route = (notif?.target_route || notif?.target_page || notif?.route || '').toLowerCase();
    const message = (notif?.body || notif?.message || '').toLowerCase();
    const text = `${type} ${title} ${route} ${message}`;

    if (text.includes('chat') || type === 'message') {
      setChatPeer(null);
      setTab('chats');
      return;
    }

    if (text.includes('verification') || text.includes('verified') || text.includes('profile') || text.includes('document') || text.includes('selfie')) {
      setTab('profile');
      return;
    }

    if (text.includes('application') || text.includes('accepted') || text.includes('ongoing') || text.includes('attendance') || text.includes('completed') || text.includes('payment') || text.includes('job moved')) {
      setTab('myjobs');
      return;
    }

    if (text.includes('job')) {
      setTab('home');
    }
  };

  return (
    <div className="h-screen bg-slate-50 overflow-hidden flex flex-col">
      {/* top bar — premium */}
      <header className="bg-gradient-to-r from-[#04112f] via-[#071f55] to-[#0b3b91] backdrop-blur-xl border-b border-blue-400/20 shrink-0 z-10 shadow-[0_10px_34px_rgba(7,31,85,0.30)]">
        <div className="container py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="w-11 h-11 rounded-xl bg-white grid place-items-center shadow-lg shadow-blue-950/30 ring-2 ring-sky-300/40 p-1"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.5 }}
            >
              <Work2WishLogo className="w-full h-full" />
            </motion.div>
            <div className="leading-tight">
              <p className="font-extrabold text-white tracking-tight">{me?.profile?.full_name || 'Worker'}</p>
              <p className="text-[10px] text-sky-100/80">Worker portal</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationCenter token={token} userId={me?.profile?.id} channelKey="worker" accent="indigo" onNavigate={handleNotificationNavigate} />
            <GlobalLanguageSelect />
            <ThemeToggle />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button type="button" variant="ghost" size="icon" className="rounded-xl text-sky-100 hover:bg-white/10 hover:text-white" onClick={() => setTab('profile')} title="Profile">
                <UserCircle className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className={tab === 'chats' ? "container flex-1 min-h-0 py-3 overflow-hidden" : "container flex-1 min-h-0 overflow-y-auto py-4 pb-4"}>
        {tab === 'home'    && <WorkerHome token={token} me={me} onChat={openChatWith} />}
        {tab === 'myjobs'  && <WorkerMyJobs token={token} onChat={openChatWith} onLogout={onLogout} />}
        {tab === 'chats'   && <ChatScreen token={token} me={{ id: me?.profile?.id, profile: me?.profile }} peerHint={chatPeer} color="indigo" />}
        {tab === 'profile' && <WorkerProfile token={token} me={me} onSaved={refreshMe} onLogout={onLogout} />}
      </main>

      {/* bottom nav — premium */}
      <nav className={`shrink-0 bg-gradient-to-r from-[#04112f] via-[#071f55] to-[#0b3b91] backdrop-blur-xl shadow-[0_-8px_30px_rgba(7,31,85,0.28)] ${tab === 'profile' ? 'border-t-0' : 'border-t border-blue-400/20'}`}>
        <div className="container grid grid-cols-3">
          {[
            { k: 'home',    i: Search,         l: 'Find' },
            { k: 'myjobs',  i: ClipboardList,  l: 'My jobs' },
            { k: 'chats',   i: MessageSquare,  l: 'Chats' },
          ].map(t => {
            const active = tab === t.k;
            return (
              <button key={t.k}
                onClick={() => { setTab(t.k); if (t.k !== 'chats') setChatPeer(null); }}
                className={`py-2.5 flex flex-col items-center gap-1 text-xs font-medium transition-all duration-200 relative ${active ? 'text-white' : 'text-sky-200/70 hover:text-white'}`}>
                {active && (
                  <motion.span
                    layoutId="worker-tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-sky-300"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-white/12 ring-1 ring-sky-300/25' : ''}`}
                >
                  <t.i className="w-5 h-5" />
                </motion.span>
                <span>{t.l}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}


function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  return getDistanceKm(Number(lat1), Number(lon1), Number(lat2), Number(lon2)) * 1000;
}

function getStrictRadiusKm(radiusValue, customValue) {
  const raw = radiusValue === 'custom' ? customValue : radiusValue;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.round(n * 1000) / 1000;
}

function formatCoordinates(lat, lng) {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return '';
  const a = Number(lat);
  const b = Number(lng);
  if (Number.isNaN(a) || Number.isNaN(b)) return '';
  return `${a.toFixed(5)}, ${b.toFixed(5)}`;
}



async function fetchJsonNoAuth(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function getServerPlacePredictions(query) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const data = await fetchJsonNoAuth(`/api/places/autocomplete?input=${encodeURIComponent(q)}`);
  return (data.predictions || []).map((item) => ({
    ...item,
    source: 'google-server',
    structured_formatting: item.structured_formatting || {
      main_text: item.description,
      secondary_text: item.description,
    },
  }));
}

async function getServerPlaceDetails(placeId, fallbackText = '') {
  if (!placeId && fallbackText) return getServerGeocode(fallbackText);
  const data = await fetchJsonNoAuth(`/api/places/details?place_id=${encodeURIComponent(placeId)}&fallback=${encodeURIComponent(fallbackText || '')}`);
  return data.location;
}

async function getServerGeocode(address) {
  const q = (address || '').trim();
  if (q.length < 3) throw new Error('Type at least 3 characters for location');
  const data = await fetchJsonNoAuth(`/api/places/geocode?address=${encodeURIComponent(q)}`);
  return data.location;
}

async function getServerReverseGeocode(lat, lng) {
  const data = await fetchJsonNoAuth(`/api/places/geocode?latlng=${encodeURIComponent(`${lat},${lng}`)}`);
  return data.location?.location_text || `GPS: ${formatCoordinates(lat, lng)}`;
}

function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY || '';
}

let googleMapsLoaderPromise = null;
function loadGoogleMapsPlaces() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps can only load in browser'));
  if (window.google?.maps?.places) return Promise.resolve(window.google);

  const key = getGoogleMapsApiKey();
  if (!key) return Promise.reject(new Error('Google Maps API key missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local'));

  if (!googleMapsLoaderPromise) {
    googleMapsLoaderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-w2w-google-maps="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google));
        existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly&language=en`;
      script.async = true;
      script.defer = true;
      script.dataset.w2wGoogleMaps = 'true';
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Google Maps failed to load. Check API key restrictions and enabled APIs.'));
      document.head.appendChild(script);
    });
  }
  return googleMapsLoaderPromise;
}


async function getOpenStreetMapPredictions(query) {
  const q = (query || '').trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=20&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((item) => ({
    place_id: `osm-${item.osm_type || 'place'}-${item.osm_id}`,
    description: item.display_name,
    osm: true,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    structured_formatting: {
      main_text: item.name || item.display_name?.split(',')?.[0] || q,
      secondary_text: item.display_name,
    },
    types: item.type ? [item.type] : [],
  }));
}

async function getOpenStreetMapDetails(predictionOrText) {
  if (predictionOrText && typeof predictionOrText === 'object' && predictionOrText.osm) {
    return {
      location_text: predictionOrText.description || '',
      place_name: predictionOrText.structured_formatting?.main_text || '',
      place_id: predictionOrText.place_id || '',
      latitude: predictionOrText.latitude,
      longitude: predictionOrText.longitude,
    };
  }
  const q = String(predictionOrText || '').trim();
  const list = await getOpenStreetMapPredictions(q);
  if (!list.length) throw new Error('No location found');
  return getOpenStreetMapDetails(list[0]);
}

async function reverseGeocodeLocation(lat, lng) {
  try {
    return await getServerReverseGeocode(lat, lng);
  } catch {
    try {
      const google = await loadGoogleMapsPlaces();
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } });
      return result?.results?.[0]?.formatted_address || `GPS: ${formatCoordinates(lat, lng)}`;
    } catch {
      return `GPS: ${formatCoordinates(lat, lng)}`;
    }
  }
}

async function getPlacePredictions(query) {
  const q = (query || '').trim();
  if (q.length < 2) return [];

  const seen = new Set();
  const addUnique = (items, out) => {
    for (const item of (items || [])) {
      const key = item.place_id || item.description || item.structured_formatting?.main_text;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 40) break;
    }
  };

  const finalList = [];

  // 1) Server Google route: supports Places New, legacy Autocomplete, Query Autocomplete and Text Search.
  try {
    const serverList = await getServerPlacePredictions(q);
    addUnique(serverList, finalList);
  } catch (error) {
    // Browser Google fallback below.
  }

  // 2) Browser Google fallback: IMPORTANT - do not stop after server results.
  // This adds companies, shops, factories, offices, landmarks and exact addresses like Google/Rapido.
  if (getGoogleMapsApiKey()) {
    try {
      const google = await loadGoogleMapsPlaces();
      const autoService = new google.maps.places.AutocompleteService();
      const holder = document.createElement('div');
      const placesService = new google.maps.places.PlacesService(holder);
      const sessionToken = new google.maps.places.AutocompleteSessionToken();
      const requestBase = { input: q, sessionToken };

      const getPredictions = (request) => new Promise((resolve) => {
        autoService.getPlacePredictions(request, (predictions, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) return resolve([]);
          resolve(predictions.map((p) => ({ ...p, source: 'google-browser-autocomplete' })));
        });
      });

      const getQueries = () => new Promise((resolve) => {
        autoService.getQueryPredictions(requestBase, (predictions, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) return resolve([]);
          resolve(predictions.map((p, i) => ({
            ...p,
            place_id: p.place_id || `query-${i}-${btoa(unescape(encodeURIComponent(p.description || q))).replace(/=+$/,'')}`,
            source: 'google-browser-query',
            is_query_prediction: true,
            structured_formatting: p.structured_formatting || { main_text: p.description || q, secondary_text: 'Search this place/company/address' },
            types: p.types || ['query'],
          })));
        });
      });

      const textSearch = (searchText) => new Promise((resolve) => {
        placesService.textSearch({ query: searchText }, (results, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return resolve([]);
          resolve(results.slice(0, 12).map((place) => {
            const name = place.name || '';
            const address = place.formatted_address || place.vicinity || '';
            const description = name && address && !address.toLowerCase().startsWith(name.toLowerCase())
              ? `${name} - ${address}`
              : (address || name || searchText);
            return {
              place_id: place.place_id,
              description,
              source: 'google-browser-text-search',
              structured_formatting: {
                main_text: name || description.split(',')[0] || searchText,
                secondary_text: address || description,
              },
              types: place.types || ['establishment'],
            };
          }).filter((p) => p.place_id || p.description));
        });
      });

      const [textPlaces, businessAuto, allAuto, addressAuto, geocodeAuto, regionAuto, queries] = await Promise.all([
        textSearch(q),
        getPredictions({ ...requestBase, types: ['establishment'] }),
        getPredictions(requestBase),
        getPredictions({ ...requestBase, types: ['address'] }),
        getPredictions({ ...requestBase, types: ['geocode'] }),
        getPredictions({ ...requestBase, types: ['(regions)'] }),
        getQueries(),
      ]);

      // Order: exact company/shop/place results first, then normal addresses/areas.
      addUnique(textPlaces, finalList);
      addUnique(businessAuto, finalList);
      addUnique(allAuto, finalList);
      addUnique(addressAuto, finalList);
      addUnique(geocodeAuto, finalList);
      addUnique(regionAuto, finalList);
      addUnique(queries, finalList);
    } catch (error) {
      // OSM fallback below.
    }
  }

  // 3) OSM fallback/extra. Useful when Google key restrictions are blocking browser/server.
  try {
    const osm = await getOpenStreetMapPredictions(q);
    addUnique(osm, finalList);
  } catch {}

  return finalList.slice(0, 40);
}

async function getPlaceDetails(placeId, fallbackText = '') {
  if (!placeId && fallbackText) return geocodeTypedAddress(fallbackText);

  try {
    return await getServerPlaceDetails(placeId, fallbackText);
  } catch (serverError) {
    // Continue to browser script fallback below.
  }

  const google = await loadGoogleMapsPlaces();
  const holder = document.createElement('div');
  const service = new google.maps.places.PlacesService(holder);

  return new Promise((resolve, reject) => {
    service.getDetails(
      {
        placeId,
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types', 'business_status'],
      },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
          reject(new Error('Unable to fetch selected location. Try choosing another suggestion.'));
          return;
        }

        const name = place.name || '';
        const address = place.formatted_address || fallbackText || name;
        const text = name && address && !address.toLowerCase().startsWith(name.toLowerCase())
          ? `${name} - ${address}`
          : (address || name || fallbackText || 'Selected location');

        resolve({
          location_text: text,
          place_name: name,
          place_id: place.place_id || placeId || '',
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
        });
      }
    );
  });
}

async function findPlaceFromText(query) {
  const q = (query || '').trim();
  if (q.length < 3) throw new Error('Type at least 3 characters for location');

  const google = await loadGoogleMapsPlaces();
  const holder = document.createElement('div');
  const service = new google.maps.places.PlacesService(holder);

  const normalizePlace = (first) => {
    const name = first.name || '';
    const address = first.formatted_address || first.vicinity || q;
    const text = name && address && !address.toLowerCase().startsWith(name.toLowerCase())
      ? `${name} - ${address}`
      : (address || name || q);
    return {
      location_text: text,
      place_name: name,
      place_id: first.place_id || '',
      latitude: first.geometry.location.lat(),
      longitude: first.geometry.location.lng(),
    };
  };

  const byFindPlace = await new Promise((resolve) => {
    service.findPlaceFromQuery(
      {
        query: q,
        fields: ['name', 'formatted_address', 'geometry', 'place_id', 'types', 'business_status'],
      },
      (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        resolve(normalizePlace(results[0]));
      }
    );
  });

  if (byFindPlace) return byFindPlace;

  const byTextSearch = await new Promise((resolve) => {
    service.textSearch(
      {
        query: q,
      },
      (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        resolve(normalizePlace(results[0]));
      }
    );
  });

  if (byTextSearch) return byTextSearch;
  throw new Error('No place result');
}

async function geocodeTypedAddress(address) {
  const q = (address || '').trim();
  if (q.length < 3) throw new Error('Type at least 3 characters for location');

  // Google Maps style search: try Places Text Search / Find Place first so company,
  // shop, office and landmark names do not get reduced into only a main area.
  try {
    return await findPlaceFromText(q);
  } catch {
    // Continue to geocode fallbacks for pure addresses.
  }

  try {
    return await getServerGeocode(q);
  } catch {
    // Continue to browser geocoder fallback.
  }

  const google = await loadGoogleMapsPlaces();
  const geocoder = new google.maps.Geocoder();

  const geocodeResult = await new Promise((resolve) => {
    geocoder.geocode(
      { address: q },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        const first = results[0];
        resolve({
          location_text: first.formatted_address || q,
          place_name: first.address_components?.[0]?.long_name || '',
          place_id: first.place_id || '',
          latitude: first.geometry.location.lat(),
          longitude: first.geometry.location.lng(),
        });
      }
    );
  });

  if (geocodeResult) return geocodeResult;
  throw new Error('Unable to find this company/place/address. Try full company name with area, city, state, or country.');
}

function MapPinPicker({ value = '', latitude, longitude, color = 'indigo', onPick }) {
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(latitude || '');
  const [lng, setLng] = useState(longitude || '');
  const isEmerald = color === 'emerald';
  useEffect(() => { setLat(latitude || ''); setLng(longitude || ''); }, [latitude, longitude]);
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const hasPin = Number.isFinite(latNum) && Number.isFinite(lngNum);
  const mapSrc = hasPin
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${latNum},${lngNum}`)}&z=16&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent(value || 'India')}&z=12&output=embed`;
  const savePin = async () => {
    if (!hasPin) return toast.error('Enter valid latitude and longitude');
    let text = value || `Pin: ${formatCoordinates(latNum, lngNum)}`;
    try { text = await reverseGeocodeLocation(latNum, lngNum); } catch {}
    onPick?.({ location_text: text, latitude: latNum, longitude: lngNum });
    setOpen(false);
    toast.success('Map pin selected');
  };
  const useGps = () => {
    if (!navigator.geolocation) return toast.error('GPS not supported');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); },
      () => toast.error('Please allow location permission'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className={`h-7 px-2 rounded-lg ${isEmerald ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}>
        <Map className="w-4 h-4" /><span className="hidden sm:inline ml-1">Pin</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-5xl rounded-3xl p-0 overflow-hidden">
          <DialogHeader className={`p-5 text-white ${'bg-gradient-to-r from-sky-700 via-blue-600 to-cyan-500'}`}>
            <DialogTitle>Pin exact location</DialogTitle>
            <DialogDescription className="text-white/80">Use current GPS or enter latitude and longitude. The map preview updates before saving.</DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-3">
            <div className="rounded-3xl overflow-hidden border bg-slate-100 h-[48vh] min-h-[320px] max-h-[560px]">
              <iframe title="Location map preview" src={mapSrc} className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" className="rounded-xl" />
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude" className="rounded-xl" />
              <Button type="button" variant="outline" onClick={useGps} className="rounded-xl"><MapPin className="w-4 h-4 mr-2" />Use GPS</Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" onClick={savePin} className={isEmerald ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-indigo-700 hover:bg-indigo-800'}>Save pin</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LocationSearchBox({
  label = 'Location',
  value = '',
  latitude,
  longitude,
  onChange,
  color = 'indigo',
  placeholder = 'Search company, shop, landmark, area or full address',
  // REAL FIX: supports Google Places New + legacy Autocomplete + Text Search + Query predictions for company/shop names.
  helper = 'Type like Google Maps. Choose a company/place suggestion to save exact latitude and longitude.',
}) {
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const blurRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [query, setQuery] = useState(value || '');
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [locationError, setLocationError] = useState('');
  const hasGoogleKey = !!getGoogleMapsApiKey();

  const updateDropdownPosition = () => {
    if (typeof window === 'undefined' || !inputRef.current) return;
    const box = inputRef.current.closest('[data-location-search-box]') || inputRef.current;
    const rect = box.getBoundingClientRect();
    setDropdownPos({
      top: Math.round(rect.bottom + 8),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
    });
  };

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    if (!showPredictions) return;
    updateDropdownPosition();
    const handler = () => updateDropdownPosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [showPredictions, query, predictions.length]);

  useEffect(() => {
    let active = true;
    if (!hasGoogleKey) { setReady(false); return () => { active = false; }; }
    loadGoogleMapsPlaces()
      .then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setReady(false); });
    return () => { active = false; };
  }, [hasGoogleKey]);

  const applyLocation = (loc, successText = 'Location selected with exact GPS') => {
    const clean = {
      location_text: loc.location_text || '',
      place_name: loc.place_name || loc.name || '',
      place_id: loc.place_id || '',
      latitude: loc.latitude !== undefined && loc.latitude !== null ? Number(loc.latitude) : null,
      longitude: loc.longitude !== undefined && loc.longitude !== null ? Number(loc.longitude) : null,
    };
    onChange?.(clean);
    setQuery(clean.location_text || '');
    setPredictions([]);
    setShowPredictions(false);
    toast.success(successText);
  };

  const fetchPredictions = async (text) => {
    const q = (text || '').trim();
    setLocationError('');
    if (q.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setShowPredictions(true);
    setLoading(true);
    try {
      let list = [];
      try {
        // Use the full merged search, not only the server result.
        // This keeps area/address results AND adds company/shop/office/landmark results.
        list = hasGoogleKey ? await getPlacePredictions(q) : await getOpenStreetMapPredictions(q);
      } catch {
        list = await getOpenStreetMapPredictions(q);
      }

      const exactSearchOption = q.length >= 3 ? [{
        place_id: `query-exact-${btoa(unescape(encodeURIComponent(q))).replace(/=+$/,'')}`,
        description: q,
        source: 'exact-company-place-search',
        is_query_prediction: true,
        structured_formatting: {
          main_text: `Search exact place: ${q}`,
          secondary_text: 'Use Google Places Text Search for company, shop, office, landmark or full address',
        },
        types: ['establishment', 'query'],
      }] : [];
      const mergedList = [...exactSearchOption, ...(list || [])].filter((item, index, arr) => {
        const key = item.place_id || item.description;
        return key && arr.findIndex((x) => (x.place_id || x.description) === key) === index;
      });
      setPredictions(mergedList.slice(0, 40));
      setShowPredictions(true);
      if (!mergedList?.length) setLocationError('No suggestion found yet. Type company/shop name with area, full address, landmark, city, state, or country.');
    } catch (e) {
      setPredictions([]);
      setShowPredictions(true);
      setLocationError(e.message || 'Unable to search location now. Try current GPS or type a clearer area.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    updateDropdownPosition();
    onChange?.({ location_text: v, latitude: null, longitude: null });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(v), 250);
  };

  const selectPrediction = async (prediction) => {
    if (!prediction?.place_id && !prediction?.description) return;
    setLoading(true);
    try {
      const loc = prediction.osm
        ? await getOpenStreetMapDetails(prediction)
        : prediction.is_query_prediction || String(prediction.place_id || '').startsWith('query-')
          ? await geocodeTypedAddress(prediction.description || prediction.structured_formatting?.main_text || query)
          : await getPlaceDetails(prediction.place_id, prediction.description);
      applyLocation(loc, 'Location selected from suggestions');
    } catch (e) {
      setLocationError(e.message || 'Unable to select this location');
      toast.error(e.message || 'Unable to select this location');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    const q = (query || inputRef.current?.value || '').trim();
    if (q.length < 3) {
      toast.error('Type at least 3 characters for location');
      return;
    }
    setLoading(true);
    try {
      let loc;
      try {
        loc = hasGoogleKey ? await geocodeTypedAddress(q) : await getOpenStreetMapDetails(q);
      } catch {
        loc = await getOpenStreetMapDetails(q);
      }
      applyLocation(loc, loc.latitude && loc.longitude ? 'Location found and selected' : 'Address saved');
    } catch (e) {
      applyLocation({ location_text: q, latitude: null, longitude: null }, 'Typed location saved without GPS. For exact GPS, use Current or choose a suggestion.');
    } finally {
      setLoading(false);
    }
  };

  const useCurrent = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not supported on this device');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const text = await reverseGeocodeLocation(lat, lng);
        applyLocation(
          { location_text: text, latitude: lat, longitude: lng },
          'Current GPS location selected'
        );
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
        toast.error('Please allow location permission');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const selectedText = formatCoordinates(latitude, longitude);
  const activeColor = color === 'emerald' ? 'emerald' : 'indigo';
  const buttonClass = activeColor === 'emerald'
    ? 'bg-emerald-600 hover:bg-emerald-700'
    : 'bg-indigo-600 hover:bg-indigo-700';
  const borderClass = activeColor === 'emerald'
    ? 'focus-within:ring-emerald-500/30 focus-within:border-emerald-400'
    : 'focus-within:ring-indigo-500/30 focus-within:border-indigo-400';
  const selectedClass = activeColor === 'emerald'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-indigo-50 text-indigo-700';

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}

      <div className="relative">
        <div data-location-search-box className={`relative rounded-xl border bg-white shadow-sm transition-all focus-within:ring-4 ${borderClass}`}>
          <MapPin className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${activeColor === 'emerald' ? 'text-emerald-600' : 'text-indigo-600'}`} />
          <Input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              updateDropdownPosition();
              setShowPredictions(true);
              if (query.trim().length >= 2) fetchPredictions(query);
            }}
            onBlur={() => {
              blurRef.current = setTimeout(() => setShowPredictions(false), 160);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (predictions.length > 0 && showPredictions) selectPrediction(predictions[0]);
                else handleManualSearch();
              }
            }}
            placeholder={placeholder}
            autoComplete="off"
            className="pl-9 pr-40 sm:pr-56 border-0 shadow-none focus-visible:ring-0 h-11 rounded-xl bg-transparent"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
            <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={handleManualSearch} disabled={loading} className="h-7 px-2" title="Search typed address">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="hidden sm:inline ml-1">Search</span>
            </Button>
            <MapPinPicker value={query} latitude={latitude} longitude={longitude} color={activeColor} onPick={(loc) => applyLocation(loc, 'Map pin saved')} />
            <Button type="button" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={useCurrent} disabled={gpsLoading} className={`h-7 px-2 text-white ${buttonClass}`} title="Use current GPS">
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              <span className="hidden sm:inline ml-1">GPS</span>
            </Button>
          </div>
        </div>

        {showPredictions && (predictions.length > 0 || loading || locationError) && (
          <div
            className="fixed z-[999999] max-h-80 overflow-y-auto rounded-2xl border bg-white shadow-2xl ring-1 ring-slate-200"
            style={{ top: dropdownPos.top || undefined, left: dropdownPos.left || undefined, width: dropdownPos.width || undefined }}
          >
            {loading && predictions.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Searching places...</div>
            )}
            {!loading && predictions.length === 0 && locationError && (
              <div className="px-4 py-3 text-sm text-amber-700 bg-amber-50">{locationError}</div>
            )}
            {predictions.map((p) => (
              <button
                key={p.place_id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(p)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-start gap-3 border-b last:border-b-0"
              >
                <div className={`mt-0.5 w-8 h-8 rounded-full grid place-items-center ${selectedClass}`}>
                  {(p.types || []).includes('establishment') ? <Building2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {p.structured_formatting?.main_text || p.description}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {p.structured_formatting?.secondary_text || p.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {locationError ? <p className="text-xs text-red-600 px-1 font-medium">{locationError}</p> : null}
      {selectedText ? <div className={`text-[10px] rounded-md px-2 py-1 ${selectedClass}`}>Saved: <b>{selectedText}</b></div> : null}
    </div>
  );
}

function WorkerHome({ token, me, onChat }) {
  const [jobs, setJobs] = useState([]);
  const [nearbyJobs, setNearbyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [hasCheckedNearby, setHasCheckedNearby] = useState(false);
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payFilter, setPayFilter] = useState('all');
  const [benefitFilter, setBenefitFilter] = useState('all');
  const [radiusKm, setRadiusKm] = useState('10');
  const [customRadius, setCustomRadius] = useState('');
  const [selected, setSelected] = useState(null);
  const [profileView, setProfileView] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (payFilter !== 'all') params.set('min_pay', payFilter);
      const d = await api(`jobs${params.toString() ? `?${params.toString()}` : ''}`, { token });
      let list = d.jobs || [];
      if (benefitFilter !== 'all') list = list.filter(j => jobBenefits(j).map(x => x.toLowerCase()).includes(benefitFilter));
      setJobs(list);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  // Keep applicant counts fresh so every worker sees live demand on each job card.
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => load(), 15000);
    return () => clearInterval(timer);
  }, [token, q, categoryFilter, payFilter, benefitFilter]);

  const activeRadius = getStrictRadiusKm(radiusKm, customRadius);

  const findNearbyFromCoords = async (userLat, userLng, sourceLabel = 'selected location') => {
    const limitKm = getStrictRadiusKm(radiusKm, customRadius);
    setLocationLoading(true);
    setLocationError('');
    setHasCheckedNearby(true);
    try {
      const d = await api('jobs', { token });
      const filtered = (d.jobs || [])
        .map((job) => {
          const hasCoords = job.latitude !== null && job.latitude !== undefined && job.longitude !== null && job.longitude !== undefined;
          const distance = hasCoords
            ? getDistanceKm(userLat, userLng, Number(job.latitude), Number(job.longitude))
            : null;
          return { ...job, distance_km: distance };
        })
        .filter((job) => job.distance_km !== null && Number(job.distance_km.toFixed(3)) <= limitKm)
        .sort((a, b) => a.distance_km - b.distance_km);

      setNearbyJobs(filtered);
      if (filtered.length > 0) toast.success(`${filtered.length} job(s) within ${limitKm} km`);
      if (filtered.length === 0) toast.info(`No jobs within ${limitKm} km`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLocationLoading(false);
    }
  };

  const loadNearbyJobs = async () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not supported on this device');
      return;
    }

    setLocationLoading(true);
    setLocationError('');
    setHasCheckedNearby(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await findNearbyFromCoords(pos.coords.latitude, pos.coords.longitude, 'current location');
      },
      () => {
        setLocationError('Please allow location permission to see nearby jobs');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const loadNearbyFromSavedLocation = async () => {
    const lat = Number(me?.extra?.latitude);
    const lng = Number(me?.extra?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setLocationError('Save your home/preferred location in Profile first, or use current location.');
      setHasCheckedNearby(true);
      return;
    }
    await findNearbyFromCoords(lat, lng, 'saved location');
  };

  const openProfileDetails = async (profileId) => {
    if (!profileId) return;
    try {
      const d = await api(`profiles/${profileId}`, { token });
      setProfileView(d);
    } catch (e) { toast.error(e.message); }
  };

  const apply = async (jobId) => {
    try {
      await api(`jobs/${jobId}/apply`, { method: 'POST', token, body: {} });
      const bumpApplicantCount = (list) => list.map(j =>
        j.id === jobId ? { ...j, applicants_count: Number(j.applicants_count || 0) + 1, pending_count: Number(j.pending_count || 0) + 1 } : j
      );
      setJobs(bumpApplicantCount);
      setNearbyJobs(bumpApplicantCount);
      setSelected(prev => prev?.id === jobId ? { ...prev, applicants_count: Number(prev.applicants_count || 0) + 1, pending_count: Number(prev.pending_count || 0) + 1 } : prev);
      toast.success('Applied! Employer notified.');
      setSelected(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  // When a radius search is active, show ONLY jobs inside the selected distance.
  // This prevents a 0.8 km job from appearing when the worker selects 0.6 km.
  const visibleJobs = hasCheckedNearby ? nearbyJobs : jobs;

  return (
    <div className="space-y-4 pt-6 relative z-0">
      <Card className="sticky top-6 z-10 rounded-3xl premium-card premium-search-card border-indigo-100 bg-gradient-to-r from-white via-indigo-50/60 to-sky-50/70 shadow-xl shadow-indigo-100/60">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500" />
              <Input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
                     placeholder="Search work, skill, company or area" className="pl-9 bg-white rounded-2xl border-indigo-100 h-11 shadow-sm focus:border-indigo-300" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="rounded-2xl bg-white border-indigo-100 h-11 lg:w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {['welding','fabrication','machining','assembly','electrical','plumbing','painting','carpentry','warehouse','general'].map(c => <SelectItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={payFilter} onValueChange={setPayFilter}>
                <SelectTrigger className="rounded-2xl bg-white border-indigo-100 h-11 lg:w-[120px]"><SelectValue placeholder="Pay" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any pay</SelectItem>
                  <SelectItem value="800">₹800+</SelectItem>
                  <SelectItem value="1200">₹1200+</SelectItem>
                  <SelectItem value="1800">₹1800+</SelectItem>
                </SelectContent>
              </Select>
              <Select value={benefitFilter} onValueChange={setBenefitFilter}>
                <SelectTrigger className="rounded-2xl bg-white border-indigo-100 h-11 lg:w-[145px]"><SelectValue placeholder="Benefits" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any benefits</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="accommodation">Accommodation</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="overtime">Overtime</SelectItem>
                </SelectContent>
              </Select>
              <Select value={radiusKm} onValueChange={setRadiusKm}>
                <SelectTrigger className="rounded-2xl bg-white border-indigo-100 h-11 lg:w-[145px]"><SelectValue placeholder="Distance" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5 km</SelectItem>
                  <SelectItem value="1">1 km</SelectItem>
                  <SelectItem value="3">3 km</SelectItem>
                  <SelectItem value="5">5 km</SelectItem>
                  <SelectItem value="10">10 km</SelectItem>
                  <SelectItem value="25">Within 25 km</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {radiusKm === 'custom' && <Input type="number" min="0.1" step="0.1" value={customRadius} onChange={(e) => setCustomRadius(e.target.value)} placeholder="0.6 km" className="lg:w-24 h-11 rounded-2xl bg-white border-indigo-100" />}
            <Button onClick={load} className="rounded-2xl h-11 px-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-600/20"><Filter className="w-4 h-4 mr-1" />Search</Button>
            <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white p-1 shadow-sm" title="Nearby search">
              <Button type="button" size="icon" variant="ghost" onClick={loadNearbyJobs} disabled={locationLoading} className="h-9 w-9 rounded-xl text-indigo-700 hover:bg-indigo-50" title="Search using current GPS location">
                {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={loadNearbyFromSavedLocation} disabled={locationLoading} className="h-9 w-9 rounded-xl text-emerald-700 hover:bg-emerald-50" title="Search using saved profile location">
                <Map className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center">
              <MapPin className="w-5 h-5" />
            </span>
            Nearby jobs · {activeRadius} km
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              onClick={loadNearbyJobs}
              disabled={locationLoading}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20"
            >
              {locationLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <MapPin className="w-4 h-4 mr-2" />
              )}
              Current location
            </Button>
            <Button
              type="button"
              onClick={loadNearbyFromSavedLocation}
              disabled={locationLoading}
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Saved location
            </Button>
          </div>

          {locationError && <p className="text-sm text-red-500 mt-3">{locationError}</p>}

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {nearbyJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelected(job)}
                className="text-left bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-lg hover:border-indigo-200 transition group premium-job-mini"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate group-hover:text-indigo-700">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.employers?.company_name} · {job.location_text || 'Location not added'}</p>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 shrink-0">
                    {job.distance_km < 1 ? job.distance_km.toFixed(2) : job.distance_km.toFixed(1)} km
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="font-bold text-emerald-700">{fmtMoney(job.daily_pay)}/day</span>
                  <span className="text-muted-foreground">{job.duration_days} day(s)</span>
                </div>
              </button>
            ))}
          </div>

          {hasCheckedNearby && !locationLoading && nearbyJobs.length === 0 && !locationError && (
            <p className="text-sm text-muted-foreground mt-3">No jobs within {activeRadius} km.</p>
          )}

          {!hasCheckedNearby && (
            <p className="text-sm text-muted-foreground mt-3">Select distance and search nearby.</p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="font-bold text-lg mb-2">{hasCheckedNearby ? `Jobs within ${activeRadius} km` : 'Open jobs'}</h2>
        {loading && <div className="grid place-items-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
        {!loading && visibleJobs.length === 0 && <p className="text-sm text-muted-foreground p-6 bg-white rounded-xl border text-center">{hasCheckedNearby ? `No jobs within ${activeRadius} km.` : 'No jobs yet. Check back soon.'}</p>}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleJobs.map(j => <JobCard key={j.id} job={j} onClick={() => setSelected(j)} onProfile={() => openProfileDetails(j.employer_id)} />)}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl rounded-3xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selected.title}</DialogTitle>
                <DialogDescription>
                  {selected.employers?.company_name} · {selected.location_text}
                  {selected.distance_km !== undefined && selected.distance_km !== null ? ` · ${selected.distance_km < 1 ? selected.distance_km.toFixed(2) : selected.distance_km.toFixed(1)} km away` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 my-3">
                <div className="p-3 rounded-2xl border bg-emerald-50 text-emerald-700"><p className="text-xs">Daily pay</p><p className="font-bold">{fmtMoney(selected.daily_pay)}</p></div>
                <div className="p-3 rounded-2xl border bg-indigo-50 text-indigo-700"><p className="text-xs">Duration</p><p className="font-bold">{selected.duration_days} day(s)</p></div>
                <div className="p-3 rounded-2xl border bg-slate-50 text-slate-700"><p className="text-xs">Workers</p><p className="font-bold">{selected.workers_needed || 1}</p></div>
                <div className="p-3 rounded-2xl border bg-amber-50 text-amber-700"><p className="text-xs">Shift</p><p className="font-bold capitalize">{selected.shift_timing || 'day'}</p></div>
                <div className="p-3 rounded-2xl border bg-rose-50 text-rose-700"><p className="text-xs">Applied</p><p className="font-bold">{Number(selected.applicants_count || 0)} worker(s)</p></div>
              </div>
              <div className="rounded-2xl border bg-white p-4 space-y-3">
                <div><p className="text-xs font-semibold text-slate-500">Work details</p><p className="text-sm whitespace-pre-wrap text-slate-700 mt-1">{selected.description || 'No description provided.'}</p></div>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <InfoTile label="Skill needed" value={selected.skill_needed || 'Any suitable worker'} />
                  <InfoTile label="Experience" value={selected.experience || 'beginner'} />
                  <InfoTile label="Start date" value={selected.start_date || 'Not mentioned'} />
                  <InfoTile label="Contact" value={selected.contact_number || 'After apply'} />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 mt-3">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => openProfileDetails(selected.employer_id)}><Building2 className="w-4 h-4 mr-2" /> Company profile</Button>
                <Button variant="outline" className="w-full sm:w-auto"><Phone className="w-4 h-4 mr-2" /> Call employer</Button>
                <Button onClick={() => apply(selected.id)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
                  <Send className="w-4 h-4 mr-2" /> Apply now
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ProfileDetailsDialog data={profileView} onClose={() => setProfileView(null)} onChat={(peer) => onChat?.(peer)} />
    </div>
  );
}

function JobCard({ job, onClick, onProfile }) {
  const benefits = jobBenefits(job);
  const daysLeft = jobDaysLeft(job);
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="text-left w-full bg-white rounded-3xl border border-indigo-100 hover:border-indigo-300 hover:shadow-2xl transition-colors p-4 group premium-job-card worker-job-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 grid place-items-center border border-indigo-100 shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate group-hover:text-indigo-700">{job.title}</p>
            <p className="text-xs text-muted-foreground truncate"><span onClick={(e) => { e.stopPropagation(); onProfile?.(); }} className="font-semibold text-indigo-700 hover:underline cursor-pointer">{job.employers?.company_name || 'Company'}</span> · {job.category || 'General'}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {Number(job.applicants_count || 0) > 0 && (
            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 rounded-full shadow-sm">
              <Users className="w-3.5 h-3.5 mr-1" /> {Number(job.applicants_count || 0)} applied
            </Badge>
          )}
          {job.employers?.verified && <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full"><ShieldCheck className="w-3.5 h-3.5 mr-1" />Verified</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mt-4">
        <span className="rounded-xl border bg-slate-50 px-2.5 py-2 truncate"><MapPin className="w-3 h-3 mr-1 inline" />{job.location_text || 'Location not added'}</span>
        <span className="rounded-xl border bg-slate-50 px-2.5 py-2"><Clock className="w-3 h-3 mr-1 inline" />{job.duration_days || 1} day(s)</span>
        <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-emerald-700 font-bold"><Banknote className="w-3 h-3 mr-1 inline" />{fmtMoney(job.daily_pay)}/day</span>
        <span className="rounded-xl border bg-slate-50 px-2.5 py-2"><Users className="w-3 h-3 mr-1 inline" />{job.workers_needed || 1} worker(s)</span>
        <span className={`rounded-xl border px-2.5 py-2 font-semibold ${Number(job.applicants_count || 0) > 0 ? 'border-rose-100 bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}><Users className="w-3 h-3 mr-1 inline" />{Number(job.applicants_count || 0)} applied</span>
      </div>
      {benefits.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {benefits.map(b => <span key={b} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-semibold">{b}</span>)}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{job.skill_needed || job.experience || 'Open requirement'}</span>
        {daysLeft !== null && <span className={daysLeft <= 1 ? 'text-red-600 font-semibold' : 'text-slate-500'}>{daysLeft > 0 ? `${daysLeft} day(s) left` : 'Closing today'}</span>}
      </div>
    </motion.button>
  );
}

function WorkerMyJobs({ token, onChat, onLogout }) {
  const [apps, setApps] = useState([]);
  const [profileView, setProfileView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [activeTab, setActiveTab] = useState('Applied');
  const [gpsAttendanceId, setGpsAttendanceId] = useState(null);
  const load = async () => {
    setLoading(true);
    try {
      const d = await api('worker/applications', { token });
      const normalized = (d.applications || []).map((a) => ({
        ...a,
        status: String(a.status || '').toLowerCase().trim(),
      }));
      setApps(normalized);
    }
    catch (e) { /* silently fail */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openProfileDetails = async (profileId) => {
    if (!profileId) return;
    try { setProfileView(await api(`profiles/${profileId}`, { token })); } catch (e) { toast.error(e.message); }
  };

  const confirmHire = async (appId) => {
    setConfirmingId(appId);

    const previousApps = apps;
    try {
      // Employee accepts the employer invitation. Only now the job becomes active/ongoing.
      setApps(prevApps => prevApps.map(a =>
        a.id === appId ? { ...a, status: 'ongoing', worker_confirmed_at: new Date().toISOString() } : a
      ));
      setActiveTab('Ongoing');

      try {
        await api(`applications/${appId}/worker-confirm`, {
          method: 'POST',
          token,
          body: { status: 'ongoing' }
        });
      } catch (confirmErr) {
        // Some project versions do not have worker-confirm route. PATCH keeps the flow working.
        await api(`applications/${appId}`, {
          method: 'PATCH',
          token,
          body: { status: 'ongoing' }
        });
      }

      await load();
      setActiveTab('Ongoing');
      toast.success('✅ Invitation accepted! Job moved to Ongoing.');
    } catch (e) {
      setApps(previousApps);
      setActiveTab('Applied');
      toast.error(e.message || 'Unable to accept invitation');
    } finally {
      setConfirmingId(null);
    }
  };

  const markGpsAttendance = async (app) => {
    if (!app?.id) return;
    if (!navigator.geolocation) return toast.error('GPS is not supported on this device');
    const jobLat = Number(app.jobs?.latitude);
    const jobLng = Number(app.jobs?.longitude);
    if (!Number.isFinite(jobLat) || !Number.isFinite(jobLng)) {
      toast.error('This job does not have saved GPS. Ask employer to update job GPS.');
      return;
    }
    setGpsAttendanceId(app.id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;
          await api(`applications/${app.id}/gps-attendance`, {
            method: 'POST',
            token,
            body: { latitude, longitude, date: new Date().toISOString().slice(0, 10) }
          });
          const distance = getDistanceMeters(latitude, longitude, jobLat, jobLng);
          toast.success(`Attendance completed. Distance: ${Math.round(distance)}m`);
          await load();
          setActiveTab('Ongoing');
        } catch (e) {
          toast.error(e.message || 'Unable to mark GPS attendance');
        } finally {
          setGpsAttendanceId(null);
        }
      },
      () => { toast.error('Allow location permission to mark attendance'); setGpsAttendanceId(null); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Helper: Generate work dates and check attendance
  const getWorkDates = (job) => {
    const dates = [];
    const startDate = job?.start_date ? new Date(job.start_date) : new Date();
    const duration = Math.max(1, Number(job?.duration_days || 1));
    for (let i = 0; i < duration; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const getAttendanceStatus = (app, date) => {
    if (!app.attendance_records) return null;
    const dateStr = date.toISOString().split('T')[0];
    return app.attendance_records.find(r => (r.attendance_date || r.date) === dateStr)?.status;
  };

  const groups = {
    Applied:   apps.filter(a => a.status === 'pending' || a.status === 'accepted'),
    Ongoing:   apps.filter(a => a.status === 'ongoing'),
    Completed: apps.filter(a => a.status === 'completed'),
    Rejected:  apps.filter(a => a.status === 'rejected'),
  };

  if (loading) return <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="tabs-mobile-wrap">
      <TabsList className="grid grid-cols-4 w-full">
        {Object.keys(groups).map(k => <TabsTrigger key={k} value={k}>{k} ({groups[k].length})</TabsTrigger>)}
      </TabsList>
      {Object.entries(groups).map(([k, list]) => (
        <TabsContent key={k} value={k} className={k === 'Ongoing' ? "space-y-3 mt-3" : "space-y-2 mt-3"}>
          {list.length === 0 && <p className="text-sm text-muted-foreground p-6 bg-white rounded-xl border text-center">No items.</p>}
          {list.map(a => (
            <div key={a.id} className={`bg-white border rounded-xl p-4 transition ${a.status === 'accepted' ? 'border-emerald-400 border-2 bg-emerald-50 dark:bg-emerald-950 shadow-lg shadow-emerald-200' : ''}`}>
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold truncate">{a.jobs?.title}</p>
                    {a.status === 'accepted' && (
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="shrink-0"
                      >
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 animate-pulse">
                          🎉 Invitation!
                        </Badge>
                      </motion.div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate"><button type="button" onClick={() => openProfileDetails(a.jobs?.employer_id)} className="font-semibold text-indigo-700 hover:underline">{a.jobs?.employers?.company_name}</button> · {a.jobs?.location_text}</p>
                </div>
                <Badge variant={a.status === 'accepted' ? 'default' : 'secondary'} className={`shrink-0 ${a.status === 'rejected' ? 'bg-red-100 text-red-700' : a.status === 'accepted' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>{a.status}</Badge>
              </div>
              <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                <span>{fmtMoney(a.jobs?.daily_pay)}/day</span>
                <span>·</span>
                <span>{a.jobs?.duration_days}d</span>
                <span>·</span>
                <span>Applied {new Date(a.applied_at).toLocaleDateString()}</span>
              </div>
              {a.status === 'accepted' && (
                <div className="mt-2 p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    ✨ The company has sent you a job invitation! Click Accept to confirm.
                  </p>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                {a.status === 'accepted' && (
                  <Button type="button" size="sm" disabled={confirmingId === a.id} className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => confirmHire(a.id)}>
                    {confirmingId === a.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />} Accept Job
                  </Button>
                )}
                {a.status === 'completed' && !a.feedback_given && (
                  <Button size="sm" variant="outline" className="flex-1"
                          onClick={() => {
                            // Open feedback dialog
                            const rating = prompt('Rate the company (1-5):');
                            const feedback = prompt('Feedback for the company:');
                            if (rating && feedback) {
                              api('feedback/company', { method: 'POST', token, body: { application_id: a.id, rating: parseInt(rating), feedback_text: feedback } })
                                .then(() => { load(); toast.success('Feedback submitted!'); })
                                .catch(e => toast.error(e.message));
                            }
                          }}>
                    <Star className="w-4 h-4 mr-1" /> Give Feedback
                  </Button>
                )}
                <Button size="sm" variant="outline" className="flex-1"
                        onClick={() => onChat?.({
                          peer_id: a.jobs?.employer_id,
                          peer_name: a.jobs?.employers?.company_name || 'Employer',
                          peer_photo: a.jobs?.employers?.company_logo,
                          peer_role: 'employer',
                        })}>
                  <MessageSquare className="w-4 h-4 mr-1" /> Message
                </Button>
              </div>
              {a.status === 'ongoing' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 dark:from-emerald-700 dark:to-teal-700 border-2 border-emerald-500 dark:border-emerald-600 shadow-lg shadow-emerald-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-base text-white drop-shadow-sm">� Your Work Now</h4>
                    <Badge className="bg-white text-emerald-600 font-bold animate-pulse">ACTIVE</Badge>
                  </div>
                  
                  {/* Work Schedule */}
                  <div className="rounded-lg bg-white/95 dark:bg-slate-800 p-3 border border-emerald-100 dark:border-emerald-800 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">Work Schedule</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-slate-600 dark:text-slate-400">Start</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{a.jobs?.start_date ? new Date(a.jobs.start_date).toLocaleDateString() : 'TBD'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 dark:text-slate-400">Duration</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{a.jobs?.duration_days}d</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 dark:text-slate-400">Shift</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{a.jobs?.shift_timing || 'Day'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 dark:text-slate-400">Daily Pay</p>
                        <p className="text-sm font-bold text-emerald-600">{fmtMoney(a.jobs?.daily_pay)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Tracker */}
                  <div className="rounded-lg bg-white/95 dark:bg-slate-800 p-3 border border-emerald-100 dark:border-emerald-800 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">Attendance</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {getWorkDates(a.jobs).map((date, idx) => {
                        const status = getAttendanceStatus(a, date);
                        const isPresent = status === 'present' || status === 'completed';
                        const isAbsent = status === 'absent';
                        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
                        return (
                          <div key={idx} className={`text-center p-2 rounded-lg text-[10px] font-bold transition ${
                            isPresent ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' :
                            isAbsent ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' :
                            'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {isPresent ? <Check className="w-4 h-4 mx-auto mb-0.5" /> : isAbsent ? '❌' : ''}
                            <p>{dateStr}</p>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={gpsAttendanceId === a.id}
                      className="mt-3 w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                      onClick={() => markGpsAttendance(a)}
                    >
                      {gpsAttendanceId === a.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
                      Mark Today Attendance with GPS
                    </Button>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 text-center">Works only when your current GPS is inside the employer selected radius.</p>
                  </div>
                  
                  {/* Job Details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/95 dark:bg-slate-800 p-3 border border-emerald-100 dark:border-emerald-800 shadow-sm">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Location</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        {a.jobs?.location_text}
                      </p>
                    </div>
                    {a.jobs?.category && (
                      <div className="rounded-lg bg-white/95 dark:bg-slate-800 p-3 border border-emerald-100 dark:border-emerald-800 shadow-sm">
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Category</p>
                        <Badge className="capitalize bg-emerald-600 dark:bg-emerald-700 text-white border border-emerald-500 font-semibold">{a.jobs?.category}</Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="rounded-lg bg-white/95 dark:bg-slate-800 p-3 border border-emerald-100 dark:border-emerald-800 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{a.jobs?.description || 'No description provided'}</p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </TabsContent>
      ))}
      <ProfileDetailsDialog data={profileView} onClose={() => setProfileView(null)} onChat={(peer) => onChat?.(peer)} />
    </Tabs>
  );
}



function PhotoPreviewDialog({ photo, title, onClose }) {
  const open = !!photo;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden bg-white">
        <div className="p-4 border-b flex items-center justify-between">
          <DialogTitle className="text-base font-bold">{title || 'Profile photo'}</DialogTitle>
        </div>
        <div className="p-4 bg-slate-50 grid place-items-center">
          {photo ? (
            <img src={photo} alt={title || 'Profile photo'} className="max-h-[70vh] w-full object-contain rounded-2xl border bg-white shadow-sm" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}


function ProfileDetailsDialog({ data, onClose, onChat }) {
  const open = !!data?.profile;
  const p = data?.profile || {};
  const stats = data?.stats || {};
  const isWorker = p.role === 'worker';
  const title = isWorker ? (p.full_name || 'Worker profile') : (p.company_name || p.full_name || 'Company profile');
  const photo = isWorker ? p.photo_url : (p.company_logo || p.photo_url);
  const feedbacks = data?.feedbacks || [];
  const activeHires = data?.activeHires || [];
  const postedJobs = data?.postedJobs || [];
  const [photoPreview, setPhotoPreview] = useState(null);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden premium-panel max-h-[92vh]">
        <div className={`p-5 md:p-6 text-white ${isWorker ? 'bg-gradient-to-r from-indigo-700 via-blue-600 to-sky-500' : 'bg-gradient-to-r from-emerald-700 via-green-600 to-teal-500'}`}>
          <div className="flex items-start gap-4">
            <button type="button" onClick={() => photo && setPhotoPreview({ photo, title })} className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-white/70" title="View profile photo">
              <Avatar className="w-16 h-16 border-2 border-white/50 shadow-xl"><AvatarImage src={photo} /><AvatarFallback>{initials(title)}</AvatarFallback></Avatar>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl md:text-2xl truncate">{title}</DialogTitle>
                {p.verified && <Badge className="bg-white/20 text-white border-white/30"><ShieldCheck className="w-3.5 h-3.5 mr-1" />Verified</Badge>}
              </div>
              <DialogDescription className="text-white/85 mt-1">
                {isWorker ? `${p.experience_years || 0} years experience · ${(p.skills || []).join(', ') || 'Skills not added'}` : `${p.industry || 'Company'} · ${p.location_text || p.company_address || 'Location not added'}`}
              </DialogDescription>
            </div>
          </div>
        </div>
        <ScrollArea className="max-h-[72vh]">
          <div className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <InfoTile label={isWorker ? 'Works completed' : 'Completed hires'} value={stats.completedWorks || 0} />
              <InfoTile label="Feedbacks" value={stats.feedbackCount || 0} />
              <InfoTile label={isWorker ? 'Expected wage' : 'Posted jobs'} value={isWorker ? fmtMoney(p.expected_daily_wage || 0) : (stats.postedJobs || 0)} />
              <InfoTile label="Location" value={p.location_text || p.company_address || p.address || '—'} />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-bold mb-3 flex items-center gap-2"><UserCircle className="w-4 h-4" /> Details</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {isWorker ? <>
                  <InfoTile label="Skills" value={(p.skills || []).join(', ') || '—'} />
                  <InfoTile label="Experience level" value={p.experience_level || '—'} />
                  <InfoTile label="Phone" value={p.phone || '—'} />
                  <InfoTile label="Available" value={p.available ? 'Immediate joiner' : 'Not marked'} />
                </> : <>
                  <InfoTile label="Company" value={p.company_name || '—'} />
                  <InfoTile label="Industry" value={p.industry || '—'} />
                  <InfoTile label="HR contact" value={p.hr_contact || p.phone || '—'} />
                  <InfoTile label="Official email" value={p.official_email || p.email || '—'} />
                </>}
              </div>
            </div>

            {isWorker && (
              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-indigo-900"><ClipboardList className="w-4 h-4" /> Work timeline</h3>
                {activeHires.length === 0 ? <p className="text-sm text-muted-foreground">No accepted or completed work records yet.</p> : (
                  <div className="space-y-2">{activeHires.map((a) => <div key={a.id} className="bg-white rounded-2xl border p-3 text-sm"><div className="flex justify-between gap-2"><b>{a.jobs?.title}</b><Badge variant="secondary">{a.status}</Badge></div><p className="text-xs text-muted-foreground">{a.jobs?.employers?.company_name} · {a.jobs?.location_text} · {fmtMoney(a.jobs?.daily_pay)}/day</p></div>)}</div>
                )}
              </div>
            )}

            {!isWorker && (
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-emerald-900"><Briefcase className="w-4 h-4" /> Recent job posts</h3>
                {postedJobs.length === 0 ? <p className="text-sm text-muted-foreground">No public job posts yet.</p> : (
                  <div className="space-y-2">{postedJobs.map((j) => <div key={j.id} className="bg-white rounded-2xl border p-3 text-sm"><div className="flex justify-between gap-2"><b>{j.title}</b><Badge variant="secondary">{j.status}</Badge></div><p className="text-xs text-muted-foreground">{j.category || 'Job'} · {j.location_text} · {fmtMoney(j.daily_pay)}/day</p></div>)}</div>
                )}
              </div>
            )}

            <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-amber-900"><Star className="w-4 h-4" /> Feedback</h3>
              {feedbacks.length === 0 ? <p className="text-sm text-muted-foreground">No feedback added yet.</p> : (
                <div className="space-y-2">{feedbacks.map((f, i) => <div key={i} className="rounded-2xl bg-white border p-3"><p className="text-sm font-semibold">{'★'.repeat(Number(f.rating || 0))}{'☆'.repeat(Math.max(0, 5-Number(f.rating || 0)))}</p><p className="text-sm text-slate-700 mt-1">{f.feedback_text || 'No written feedback.'}</p></div>)}</div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button className={`flex-1 ${isWorker ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`} onClick={() => onChat?.({ peer_id: p.id || p.user_id, peer_name: title, peer_photo: photo, peer_role: p.role })}>
                <MessageSquare className="w-4 h-4 mr-2" /> Message {isWorker ? 'worker' : 'company'}
              </Button>
              <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
      <PhotoPreviewDialog photo={photoPreview?.photo} title={photoPreview?.title} onClose={() => setPhotoPreview(null)} />
    </Dialog>
  );
}

function SavedLocationEditor({ label, value, latitude, longitude, color = 'indigo', placeholder, helper, onChange, onSave }) {
  const hasSaved = !!String(value || '').trim();
  const locationKey = `${value || ''}|${latitude || ''}|${longitude || ''}`;
  const [savingLocation, setSavingLocation] = useState(false);
  const [savedKey, setSavedKey] = useState(locationKey);
  const [editingLocation, setEditingLocation] = useState(!hasSaved);
  const [locationEditUnlocked, setLocationEditUnlocked] = useState(false);
  const lastLoadedLocationKeyRef = useRef(locationKey);

  useEffect(() => {
    // Saved locations must stay locked/closed after reload.
    // Only the Change button can unlock the editor again.
    if (!hasSaved) {
      setEditingLocation(true);
      setLocationEditUnlocked(false);
      lastLoadedLocationKeyRef.current = '';
      return;
    }

    // When the saved location arrives from DB after refresh/login, keep it closed.
    // Do not treat the initial DB hydration as a user edit.
    if (!lastLoadedLocationKeyRef.current || !locationEditUnlocked) {
      lastLoadedLocationKeyRef.current = locationKey;
      setSavedKey(locationKey);
      setEditingLocation(false);
      setLocationEditUnlocked(false);
    }
  }, [hasSaved, locationKey, locationEditUnlocked]);

  const isEmerald = color === 'emerald';
  const wrapClass = isEmerald
    ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-emerald-100/70'
    : 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-indigo-100/70';
  const iconBox = isEmerald ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700';
  const changedAfterSave = locationKey !== savedKey;
  const canSaveLocation = !!value && (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)));
  const savedButtonClass = isEmerald
    ? 'border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-600 disabled:bg-emerald-600 disabled:text-white disabled:!opacity-100 disabled:cursor-default'
    : 'border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-600 disabled:bg-indigo-600 disabled:text-white disabled:opacity-100 disabled:cursor-default';
  const changeButtonClass = isEmerald
    ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
    : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50';

  const saveOnlyLocation = async () => {
    if (!canSaveLocation) {
      toast.error('Search and select one exact area/location before saving');
      return;
    }
    if (!onSave) {
      setSavedKey(locationKey);
      setEditingLocation(false);
      setLocationEditUnlocked(false);
      toast.success('Location ready. Press Save profile to store it.');
      return;
    }
    setSavingLocation(true);
    try {
      await onSave({
        location_text: value || '',
        latitude: Number(latitude),
        longitude: Number(longitude),
        place_id: '',
        place_name: '',
      });
      setSavedKey(locationKey);
      setEditingLocation(false);
      setLocationEditUnlocked(false);
      toast.success('Location saved');
    } catch (e) {
      toast.error(e.message || 'Location save failed');
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div className={`rounded-2xl border p-4 space-y-3 shadow-sm ${wrapClass}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex gap-3">
          <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${iconBox}`}><MapPin className="w-5 h-5" /></div>
          <div className="min-w-0">
            <Label>{label}</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {hasSaved && !editingLocation ? 'Saved location is active. Click Change to update it.' : 'Search and select an exact area, pin, or current GPS, then click Save.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          {hasSaved && !editingLocation ? (
            <>
              <Button type="button" variant="outline" disabled className={savedButtonClass}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Saved
              </Button>
              <Button type="button" variant="outline" className={changeButtonClass} onClick={() => { setLocationEditUnlocked(true); setEditingLocation(true); }}>
                Change
              </Button>
            </>
          ) : (
            <Button type="button" className={`${isEmerald ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600'} text-white disabled:text-white disabled:opacity-100`} onClick={saveOnlyLocation} disabled={savingLocation || !canSaveLocation}>
              {savingLocation ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} {hasSaved ? 'Save change' : 'Save location'}
            </Button>
          )}
        </div>
      </div>

      {hasSaved && !editingLocation ? (
        <div className="rounded-2xl border border-white/70 bg-white/85 p-3 shadow-inner space-y-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
          <p className="text-xs text-slate-500">{formatCoordinates(latitude, longitude)}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/70 bg-white/85 p-3 shadow-inner space-y-2">
          <LocationSearchBox
            label=""
            value={value || ''}
            latitude={latitude}
            longitude={longitude}
            color={color}
            placeholder={placeholder}
            helper={helper}
            onChange={onChange}
          />
          <div className={`rounded-xl border px-3 py-2 text-xs ${changedAfterSave ? (isEmerald ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-indigo-200 bg-indigo-50 text-indigo-800') : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            {canSaveLocation ? 'Exact GPS selected. Click Save to store it.' : 'Search/select one exact place or use current GPS before saving.'}
          </div>
        </div>
      )}
    </div>
  );
}


function VerificationDocumentsCard({ token, me, role, verified, form, setForm, onSaved, color = 'indigo' }) {
  const [busy, setBusy] = useState(false);
  const accent = color === 'emerald' ? 'emerald' : 'indigo';
  const isEmployer = role === 'employer';
  const documentReviewStatus = sectionReviewState(me, 'documents', form.verification_status, verified);
  const documentChangedAfterReview = (documentReviewStatus === 'pending' || documentReviewStatus === 'verified') && hasVerifySectionChanged(
    isEmployer ? EMPLOYER_DOCUMENT_VERIFY_FIELDS : WORKER_DOCUMENT_VERIFY_FIELDS,
    form,
    me?.profile || {},
    me?.extra || {}
  );
  const status = documentChangedAfterReview ? 'modified' : documentReviewStatus;
  const lockedVerified = status === 'verified' && !documentChangedAfterReview;

  const cleanAadhaar = (value) => String(value || '').replace(/\D/g, '').slice(0, 20);
  const cleanPan = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const cleanGst = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
  const isValidAadhaar = (value) => /^\d{12}$/.test(String(value || ''));
  const isValidPan = (value) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value || ''));
  const isValidGst = (value) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(value || ''));

  const uploadDoc = async (file, field, kind) => {
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await uploadFile(file, kind, token);
      setForm((s) => ({ ...s, [field]: url }));
      toast.success(field === 'certificate_url' ? 'Skill certificate selected. Click Send for Verification to send it for admin review.' : 'Document selected. Click Send for Verification to send it for admin review.');
    } catch (e) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const submitVerification = async () => {
    const pan = cleanPan(form.pan_number);

    if (!pan || !isValidPan(pan)) return toast.error('Enter valid PAN format, e.g. ABCDE1234F');

    if (isEmployer) {
      const gst = cleanGst(form.gst_number);
      if (!form.company_address?.trim()) return toast.error('Enter company address');
      if (!gst || !isValidGst(gst)) return toast.error('Enter valid 15-character GST number');
      if (!form.pan_image_url || !form.pan_back_url || !form.gst_certificate_url) {
        return toast.error('Upload PAN front, PAN back and GST certificate');
      }
    } else {
      const aadhaar = cleanAadhaar(form.aadhaar_number);
      if (!form.address?.trim()) return toast.error('Enter full address');
      if (!aadhaar || !isValidAadhaar(aadhaar)) return toast.error('Aadhaar must be exactly 12 digits');
      if (!form.aadhaar_front_url || !form.aadhaar_back_url || !form.pan_image_url || !form.pan_back_url) {
        return toast.error('Upload Aadhaar front/back and PAN front/back. Skill certificate is optional');
      }
    }

    setBusy(true);
    try {
      const body = isEmployer
        ? {
            company_address: form.company_address,
            gst_number: cleanGst(form.gst_number),
            pan_number: pan,
            pan_image_url: form.pan_image_url,
            pan_back_url: form.pan_back_url,
            gst_certificate_url: form.gst_certificate_url,
            verification_status: 'pending',
            verification_section: 'documents',
          }
        : {
            address: form.address,
            aadhaar_number: cleanAadhaar(form.aadhaar_number),
            pan_number: pan,
            aadhaar_front_url: form.aadhaar_front_url,
            aadhaar_back_url: form.aadhaar_back_url,
            pan_image_url: form.pan_image_url,
            pan_back_url: form.pan_back_url,
            certificate_url: form.certificate_url,
            verification_status: 'pending',
            verification_section: 'documents',
          };

      await api('me/profile', { method: 'PATCH', token, body });
      setForm((s) => ({ ...s, ...body }));
      toast.success('Verification submitted for admin review');
      onSaved?.();
    } catch (e) {
      toast.error(e.message || 'Unable to submit verification');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'h-11 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-offset-0';

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden rounded-3xl bg-white">
      <CardHeader className={`${'bg-sky-50/80'} border-b`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${lockedVerified ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isEmployer ? 'Company verification' : 'Worker verification'}
            </CardTitle>
            <CardDescription>
              {isEmployer
                ? 'Submit GST and company PAN documents for admin approval.'
                : 'Submit Aadhaar/PAN and address details for admin approval.'}
            </CardDescription>
          </div>
          {lockedVerified ? (
            <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verified</Badge>
          ) : status === 'submitted' || status === 'pending' ? (
            <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
          ) : status === 'modified' ? (
            <Badge className="bg-amber-100 text-amber-700">Modified</Badge>
          ) : status === 'saved' ? (
            <Badge className="bg-sky-100 text-sky-700">Saved</Badge>
          ) : status === 'rejected' ? (
            <Badge className="bg-red-100 text-red-700">Rejected</Badge>
          ) : (
            <Badge className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm"><XCircle className="w-3.5 h-3.5 mr-1" /> Unverified</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5 bg-slate-50/40" onKeyDown={(e) => { if (e.key === 'Enter' && e.target?.tagName !== 'TEXTAREA') { e.preventDefault(); if (!busy && !lockedVerified) submitVerification(); } }}>
        {isEmployer ? (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>GST number</Label>
                <Input
                  value={form.gst_number || ''}
                  maxLength={15}
                  onChange={(e) => setForm((s) => ({ ...s, gst_number: cleanGst(e.target.value) }))}
                  placeholder="22AAAAA0000A1Z5"
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground mt-1">15 characters. Example: 22AAAAA0000A1Z5</p>
                {form.gst_number && !isValidGst(form.gst_number) && <p className="text-xs text-red-500 mt-1">Invalid GST format</p>}
              </div>
              <div>
                <Label>Company PAN number</Label>
                <Input
                  value={form.pan_number || ''}
                  maxLength={10}
                  onChange={(e) => setForm((s) => ({ ...s, pan_number: cleanPan(e.target.value) }))}
                  placeholder="ABCDE1234F"
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground mt-1">Format: 5 letters + 4 digits + 1 letter</p>
                {form.pan_number && !isValidPan(form.pan_number) && <p className="text-xs text-red-500 mt-1">Invalid PAN format</p>}
              </div>
            </div>

            <div>
              <Label>Company address</Label>
              <Textarea
                rows={3}
                value={form.company_address || ''}
                onChange={(e) => setForm((s) => ({ ...s, company_address: e.target.value }))}
                placeholder="Door no, street, area, city, state, pincode"
                className="rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-offset-0 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
              <DocumentUploadBox color="emerald" label="Company PAN front" url={form.pan_image_url} verified={lockedVerified} disabled={busy} onFile={(file) => uploadDoc(file, 'pan_image_url', 'company-pan-front')} />
              <DocumentUploadBox color="emerald" label="Company PAN back" url={form.pan_back_url} verified={lockedVerified} disabled={busy} onFile={(file) => uploadDoc(file, 'pan_back_url', 'company-pan-back')} />
              <DocumentUploadBox color="emerald" label="GST certificate" url={form.gst_certificate_url} verified={lockedVerified} disabled={busy} onFile={(file) => uploadDoc(file, 'gst_certificate_url', 'gst-certificate')} />
            </div>
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Aadhaar number</Label>
                <Input
                  value={form.aadhaar_number || ''}
                  maxLength={12}
                  inputMode="numeric"
                  onChange={(e) => setForm((s) => ({ ...s, aadhaar_number: cleanAadhaar(e.target.value) }))}
                  placeholder="123412341234"
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground mt-1">Exactly 12 digits</p>
                {form.aadhaar_number && !isValidAadhaar(form.aadhaar_number) && <p className="text-xs text-red-500 mt-1">Aadhaar must be 12 digits</p>}
              </div>
              <div>
                <Label>PAN number</Label>
                <Input
                  value={form.pan_number || ''}
                  maxLength={10}
                  onChange={(e) => setForm((s) => ({ ...s, pan_number: cleanPan(e.target.value) }))}
                  placeholder="ABCDE1234F"
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground mt-1">Format: ABCDE1234F</p>
                {form.pan_number && !isValidPan(form.pan_number) && <p className="text-xs text-red-500 mt-1">Invalid PAN format</p>}
              </div>
            </div>

            <div className="sm:col-span-12">
              <Label>Full address</Label>
              <Textarea
                rows={3}
                value={form.address || ''}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                placeholder="Manual typing only: door no, street, area, city, state, pincode"
                className="rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-offset-0 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">Type your full address manually. GPS/search location is selected separately in Profile below.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
              <DocumentUploadBox color="indigo" label="Aadhaar front" url={form.aadhaar_front_url} verified={lockedVerified} disabled={busy} onFile={(file) => uploadDoc(file, 'aadhaar_front_url', 'aadhaar-front')} />
              <DocumentUploadBox color="indigo" label="Aadhaar back" url={form.aadhaar_back_url} verified={lockedVerified} disabled={busy} onFile={(file) => uploadDoc(file, 'aadhaar_back_url', 'aadhaar-back')} />
              <DocumentUploadBox color="indigo" label="PAN front" url={form.pan_image_url} verified={lockedVerified} disabled={busy} onFile={(file) => uploadDoc(file, 'pan_image_url', 'pan-front')} />
              <DocumentUploadBox color="indigo" label="PAN back" url={form.pan_back_url} verified={lockedVerified} disabled={busy} onFile={(file) => uploadDoc(file, 'pan_back_url', 'pan-back')} />
              <DocumentUploadBox color="indigo" label="Skill certificate (optional)" url={form.certificate_url} verified={lockedVerified} disabled={busy} optional allowLater onFile={(file) => uploadDoc(file, 'certificate_url', 'skill-certificate')} />
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between rounded-xl bg-slate-50 border p-3">
          <div>
            <p className="text-sm font-semibold">Admin approval required</p>
            <p className="text-xs text-muted-foreground">Admin checks your details and marks the account verified.</p>
            {form.verification_notes && <p className="text-xs text-red-600 mt-1">Note: {form.verification_notes}</p>}
          </div>
          <Button
type="button"
onClick={submitVerification}

disabled={
busy ||
lockedVerified ||
status==="pending" ||
status==="submitted"
}

className={`

min-w-[220px]
h-12
rounded-2xl
font-semibold
transition-all
duration-300
disabled:opacity-100
disabled:cursor-default

${

lockedVerified

?

'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600 disabled:text-white disabled:!opacity-100 disabled:cursor-default'

:

status==="pending" ||
status==="submitted"

?

'bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-500 disabled:text-white disabled:!opacity-100 disabled:cursor-default'

:

'!bg-rose-600 hover:!bg-rose-700 !text-white disabled:!bg-rose-600 disabled:!text-white disabled:!opacity-100'

}

`}
>

{

busy

?

<>

<Loader2
className="
w-4
h-4
mr-2
animate-spin
"
/>

Submitting...

</>

:

lockedVerified

?

<>

<CheckCircle2
className="
w-4
h-4
mr-2
"
/>

Done

</>

:

status==="pending" ||
status==="submitted"

?

<>

<Clock
className="
w-4
h-4
mr-2
"
/>

Pending Approval

</>

:

status==="modified"

?

<>

<ShieldCheck
className="
w-4
h-4
mr-2
"
/>

Send for Verification

</>

:

<>

<ShieldCheck
className="
w-4
h-4
mr-2
"
/>

Send for Verification

</>

}

</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentUploadBox({ label, url, onFile, disabled, verified = false, color = 'indigo', optional = false, allowLater = false }) {
  const hasFile = !!url;
  const canUpload = !disabled && (!hasFile || (allowLater && !verified));
  const fileLabel = verified && hasFile ? 'Verified' : hasFile ? 'Uploaded' : 'Upload';
  const theme = color === 'emerald'
    ? { card: 'border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/60 to-white shadow-emerald-100/70', icon: 'border-emerald-100 bg-emerald-50 text-emerald-500', btn: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50', link: 'text-emerald-700' }
    : { card: 'border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/60 to-white shadow-indigo-100/70', icon: 'border-indigo-100 bg-indigo-50 text-indigo-500', btn: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50', link: 'text-indigo-700' };

  return (
    <div className={`h-full min-h-[168px] rounded-3xl border p-4 flex flex-col justify-between shadow-sm hover:shadow-lg transition ${theme.card}`}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label className="font-semibold text-slate-900">{label}</Label>
          {verified && hasFile && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className={`w-16 h-16 rounded-2xl border grid place-items-center overflow-hidden shrink-0 ${theme.icon}`}>
            {hasFile ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <ImgIcon className="w-6 h-6" />}
          </div>
          {verified && hasFile ? (
            <a className="h-10 min-w-[112px] inline-flex items-center justify-center px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50" href={url} target="_blank" rel="noreferrer">
              View file
            </a>
          ) : (
            <label className={`h-10 min-w-[112px] inline-flex items-center justify-center px-3 py-2 rounded-xl border text-sm bg-white/90 ${theme.btn} ${canUpload ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
              <Upload className="w-4 h-4 mr-2" /> {fileLabel}
              <input type="file" accept="image/*,.pdf" className="hidden" disabled={!canUpload} onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = ''; }} />
            </label>
          )}
        </div>
      </div>
      <div className="mt-3 min-h-[18px]">
        {!verified && hasFile && <a className={`text-xs hover:underline inline-block ${theme.link}`} href={url} target="_blank" rel="noreferrer">View uploaded file</a>}
        {verified && !hasFile && !optional && <p className="text-xs text-amber-700">Missing file</p>}
      </div>
    </div>
  );
}


function sectionReviewState(me, section, fallbackStatus, verified) {
  const normalizedSection = section === 'verification' ? 'documents' : section;
  const normalizeSection = (value) => value === 'verification' ? 'documents' : value;
  const sectionStatuses = me?.section_statuses || me?.extra?.section_statuses || {};
  const aliasSection = normalizedSection === 'documents' ? 'verification' : normalizedSection === 'verification' ? 'documents' : normalizedSection;
  const sectionStatus = sectionStatuses?.[normalizedSection] || sectionStatuses?.[aliasSection];
  if (sectionStatus === 'pending' || sectionStatus === 'submitted' || sectionStatus === 'modified') return 'pending';
  if (sectionStatus === 'rejected') return 'rejected';
  if (sectionStatus === 'verified') return 'verified';

  const parseDetails = (row) => {
    if (!row?.details) return {};
    if (typeof row.details === 'string') {
      try { return JSON.parse(row.details); } catch { return {}; }
    }
    return row.details || {};
  };
  const latestSectionActivity = [...(me?.activity || [])]
    .filter((a) => {
      const d = parseDetails(a);
      return normalizeSection(d.section || d.verification_section || d.pending_verification_section) === normalizedSection;
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
  const latestAction = String(latestSectionActivity?.action || '').toLowerCase();
  if (latestAction.includes('admin_verified_section') || latestAction.includes('verified_profile_section')) return 'verified';
  if (latestAction.includes('submit') || latestAction.includes('upload') || latestAction.includes('pending') || latestAction.includes('verification')) return 'pending';

  // IMPORTANT: section verification must stay independent.
  // Example: Bank verify should mark only Bank as pending, not Documents/Profile.
  // When section-wise verification exists, do not use the old global fallback for other cards.
  if (Object.keys(sectionStatuses).length > 0) {
    if (verified) return 'verified';
    return 'not_submitted';
  }

  // Legacy fallback for old rows before section-wise verification logs existed.
  const submittedSection = normalizeSection(me?.extra?.verification_section || me?.extra?.pending_verification_section);
  if ((fallbackStatus === 'pending' || fallbackStatus === 'submitted') && (!submittedSection || submittedSection === normalizedSection)) return 'pending';
  if (fallbackStatus === 'rejected' && (!submittedSection || submittedSection === normalizedSection)) return 'rejected';
  if (verified) return 'verified';
  return 'not_submitted';
}



const BANK_VERIFY_FIELDS = ['account_holder_name', 'bank_name', 'bank_account', 'ifsc_code', 'branch_name', 'upi_id', 'bank_qr_url'];

function normalizeBankValue(key, value) {
  const text = String(value ?? '').trim();
  if (key === 'ifsc_code') return text.toUpperCase().replace(/\s/g, '');
  if (key === 'bank_account') return text.replace(/\D/g, '');
  return text;
}

function bankPayloadFromExtra(extra = {}) {
  return {
    account_holder_name: extra.account_holder_name || '',
    bank_name: extra.bank_name || '',
    bank_account: extra.bank_account || extra.bank_account_number || '',
    ifsc_code: extra.ifsc_code || '',
    branch_name: extra.branch_name || '',
    upi_id: extra.upi_id || '',
    bank_qr_url: extra.bank_qr_url || '',
  };
}

function hasBankDetailsChanged(current = {}, saved = {}) {
  return BANK_VERIFY_FIELDS.some((key) => normalizeBankValue(key, current[key]) !== normalizeBankValue(key, saved[key]));
}


const PROFILE_VERIFY_FIELDS = ['full_name', 'phone', 'age', 'gender', 'skills', 'experience_years', 'experience_level', 'expected_daily_wage', 'languages_known', 'available', 'location_text', 'latitude', 'longitude', 'place_id', 'place_name', 'previous_employer_reference', 'bio'];
const EMPLOYER_PROFILE_VERIFY_FIELDS = ['full_name', 'phone', 'company_name', 'industry', 'company_size', 'hr_contact', 'official_email', 'company_address', 'gst_number', 'pan_number', 'location_text', 'latitude', 'longitude', 'place_id', 'place_name', 'description'];
const WORKER_DOCUMENT_VERIFY_FIELDS = ['address', 'aadhaar_number', 'pan_number', 'aadhaar_front_url', 'aadhaar_back_url', 'pan_image_url', 'pan_back_url', 'certificate_url', 'selfie_url', 'selfie_front_url', 'selfie_left_url', 'selfie_right_url'];
const EMPLOYER_DOCUMENT_VERIFY_FIELDS = ['company_address', 'gst_number', 'pan_number', 'pan_image_url', 'pan_back_url', 'gst_certificate_url'];

function normalizeVerifyValue(key, value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).join(',');
  const text = String(value ?? '').trim();
  if (['pan_number', 'gst_number', 'ifsc_code'].includes(key)) return text.toUpperCase().replace(/\s/g, '');
  if (key === 'aadhaar_number' || key === 'phone') return text.replace(/\D/g, '');
  if (['age', 'experience_years', 'expected_daily_wage', 'latitude', 'longitude'].includes(key)) return text === '' ? '' : String(Number(text));
  if (key === 'available') return String(value === true || value === 'true');
  return text;
}

function extraValueForKey(profile = {}, extra = {}, key) {
  if (key === 'full_name' || key === 'phone') return profile?.[key] || '';
  return extra?.[key] ?? '';
}

function hasVerifySectionChanged(fields = [], current = {}, profile = {}, extra = {}) {
  return fields.some((key) => normalizeVerifyValue(key, current[key]) !== normalizeVerifyValue(key, extraValueForKey(profile, extra, key)));
}

function isFinalCardVerified(me, section, fallbackStatus, globalVerified, modified = false) {
  return sectionReviewState(me, section, fallbackStatus, globalVerified) === 'verified' && !modified;
}

function finalProfileSaveKey(me, role) {
  return `w2w-final-profile-save-${role || me?.profile?.role || 'user'}-${me?.profile?.id || me?.id || 'me'}`;
}

function SectionVerificationAction({ token, me, section, title, description, color = 'indigo', setForm, onSaved, disabled = false, payloadBuilder = null, validate = null, modified = false }) {
  const [busy, setBusy] = useState(false);
  const verified = !!me?.extra?.verified;
  const rawStatus = sectionReviewState(me, section, me?.extra?.verification_status, verified);
  const status = modified && (rawStatus === 'pending' || rawStatus === 'verified') ? 'modified' : rawStatus;
  const label = status === 'verified' ? 'Done' : status === 'pending' ? 'Pending Approval' : 'Send for Verification';
  const Icon = status === 'verified' ? CheckCircle2 : status === 'pending' ? Clock : ShieldCheck;
  const blocked = !!disabled || status === 'pending' || status === 'verified';
  const actionClass = status === 'verified'
    ? 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600 disabled:text-white disabled:!opacity-100 disabled:cursor-default'
    : status === 'pending'
      ? 'bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-500 disabled:text-white disabled:!opacity-100 disabled:cursor-default'
      : '!bg-rose-600 !text-white hover:!bg-rose-700 disabled:!bg-rose-600 disabled:!text-white disabled:!opacity-100 disabled:cursor-pointer';
  const sendForReview = async () => {
    if (blocked || busy) return;
    setBusy(true);
    try {
      if (validate) {
        const validationMessage = validate();
        if (validationMessage) {
          toast.error(validationMessage);
          setBusy(false);
          return;
        }
      }
      const extraPayload = payloadBuilder ? (payloadBuilder() || {}) : {};
      const body = { ...extraPayload, verification_status: 'pending', verification_section: section };
      await api('me/profile', { method: 'PATCH', token, body });
      setForm?.((prev) => ({ ...prev, ...body }));
      await onSaved?.();
      toast.success(`${title} sent for admin verification`);
    } catch (e) {
      toast.error(e.message || 'Unable to send verification');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between rounded-xl bg-slate-50 border p-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Button
        type="button"
        disabled={busy || blocked}
        onClick={sendForReview}
        className={`${actionClass} min-w-[220px] h-12 rounded-2xl font-semibold transition-all duration-300 disabled:!opacity-100 disabled:cursor-not-allowed`}
      >
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Icon className="w-4 h-4 mr-2" />}
        {label}
      </Button>
    </div>
  );
}

function WorkerProfile({ token, me, onSaved, onLogout }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finalSaved, setFinalSaved] = useState(false);
  const verified = !!me?.extra?.verified;
  useEffect(() => {
    if (me) setForm({
      full_name: me.profile?.full_name || '',
      phone: me.profile?.phone || '',
      age: me.extra?.age || '',
      skills: (me.extra?.skills || []).join(', '),
      experience_years: me.extra?.experience_years || 0,
      experience_level: me.extra?.experience_level || 'beginner',
      expected_daily_wage: me.extra?.expected_daily_wage || 0,
      gender: me.extra?.gender || '',
      languages_known: Array.isArray(me.extra?.languages_known) ? me.extra.languages_known.join(', ') : (me.extra?.languages_known || ''),
      bank_account: me.extra?.bank_account || '',
      account_holder_name: me.extra?.account_holder_name || '',
      bank_name: me.extra?.bank_name || '',
      ifsc_code: me.extra?.ifsc_code || '',
      branch_name: me.extra?.branch_name || '',
      upi_id: me.extra?.upi_id || '',
      bank_qr_url: me.extra?.bank_qr_url || '',
      selfie_url: me.extra?.selfie_url || '',
      selfie_front_url: me.extra?.selfie_front_url || '',
      selfie_left_url: me.extra?.selfie_left_url || '',
      selfie_right_url: me.extra?.selfie_right_url || '',
      certificate_url: me.extra?.certificate_url || '',
      mobile_verified: !!me.extra?.mobile_verified,
      selfie_verified: !!me.extra?.selfie_verified,
      badge_verified_worker: !!me.extra?.badge_verified_worker,
      badge_skilled_worker: !!me.extra?.badge_skilled_worker,
      badge_experienced: !!me.extra?.badge_experienced,
      badge_immediate_joiner: !!me.extra?.badge_immediate_joiner,
      previous_employer_reference: me.extra?.previous_employer_reference || '', 
      available: me.extra?.available ?? true,
      location_text: me.extra?.location_text || '',
      latitude: me.extra?.latitude || '',
      longitude: me.extra?.longitude || '',
      place_id: me.extra?.place_id || '',
      place_name: me.extra?.place_name || '',
      bio: me.extra?.bio || '',
      address: me.extra?.address || '',
      aadhaar_number: me.extra?.aadhaar_number || '',
      pan_number: me.extra?.pan_number || '',
      aadhaar_front_url: me.extra?.aadhaar_front_url || '',
      aadhaar_back_url: me.extra?.aadhaar_back_url || '',
      pan_image_url: me.extra?.pan_image_url || '',
      pan_back_url: me.extra?.pan_back_url || '',
      verification_status: me.extra?.verification_status || (me.extra?.verified ? 'verified' : 'not_submitted'),
      verification_notes: me.extra?.verification_notes || '',
      language: me.profile?.language || 'en',
    });
  }, [me]);

  useEffect(() => {
    if (!me) return;
    setFinalSaved(localStorage.getItem(finalProfileSaveKey(me, 'worker')) === 'saved');
  }, [me]);

  const buildWorkerProfilePayload = () => ({
    full_name: form.full_name || '',
    phone: form.phone || '',
    age: form.age ? Number(form.age) : null,
    gender: form.gender || '',
    skills: typeof form.skills === 'string' ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : (form.skills || []),
    experience_years: Number(form.experience_years) || 0,
    experience_level: form.experience_level || 'beginner',
    expected_daily_wage: Number(form.expected_daily_wage) || 0,
    languages_known: typeof form.languages_known === 'string' ? form.languages_known.split(',').map(s => s.trim()).filter(Boolean) : (form.languages_known || []),
    available: !!form.available,
    badge_immediate_joiner: !!form.available,
    location_text: form.location_text || '',
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    place_id: form.place_id || '',
    place_name: form.place_name || '',
    previous_employer_reference: form.previous_employer_reference || '',
    bio: form.bio || '',
  });

  const buildWorkerDocumentPayload = () => ({
    address: form.address || '',
    aadhaar_number: form.aadhaar_number || '',
    pan_number: form.pan_number || '',
    aadhaar_front_url: form.aadhaar_front_url || '',
    aadhaar_back_url: form.aadhaar_back_url || '',
    pan_image_url: form.pan_image_url || '',
    pan_back_url: form.pan_back_url || '',
    certificate_url: form.certificate_url || '',
    selfie_url: form.selfie_url || '',
    selfie_front_url: form.selfie_front_url || '',
    selfie_left_url: form.selfie_left_url || '',
    selfie_right_url: form.selfie_right_url || '',
  });

  const buildWorkerBankPayload = () => ({
    account_holder_name: form.account_holder_name || '',
    bank_name: form.bank_name || '',
    bank_account: form.bank_account || '',
    ifsc_code: (form.ifsc_code || '').toUpperCase().replace(/\s/g, ''),
    branch_name: form.branch_name || '',
    upi_id: form.upi_id || '',
    bank_qr_url: form.bank_qr_url || '',
  });

  const requireWorkerBank = () => {
    if (!form.account_holder_name?.trim()) return 'Enter account holder name';
    if (!form.bank_name?.trim()) return 'Enter bank name';
    if (!form.bank_account?.trim()) return 'Enter account number';
    if (!form.ifsc_code?.trim()) return 'Enter IFSC code';
    return '';
  };

  const workerBankReviewStatus = sectionReviewState(me, 'bank', me?.extra?.verification_status, verified);
  const workerBankChangedAfterReview = (workerBankReviewStatus === 'pending' || workerBankReviewStatus === 'verified') && hasBankDetailsChanged(buildWorkerBankPayload(), bankPayloadFromExtra(me?.extra || {}));
  const workerProfileReviewStatus = sectionReviewState(me, 'profile', me?.extra?.verification_status, verified);
  const workerProfileChangedAfterReview = (workerProfileReviewStatus === 'pending' || workerProfileReviewStatus === 'verified') && hasVerifySectionChanged(PROFILE_VERIFY_FIELDS, buildWorkerProfilePayload(), me?.profile || {}, me?.extra || {});
  const workerDocumentReviewStatus = sectionReviewState(me, 'documents', me?.extra?.verification_status, verified);
  const workerDocumentChangedAfterReview = (workerDocumentReviewStatus === 'pending' || workerDocumentReviewStatus === 'verified') && hasVerifySectionChanged(WORKER_DOCUMENT_VERIFY_FIELDS, buildWorkerDocumentPayload(), me?.profile || {}, me?.extra || {});
  // Final Save button must follow the visible card status. If cards show Done/Verified, Save must work.
  // Do not block final Save because of stale local comparison data after admin approval or page refresh.
  const workerProfileCardVerifiedForSave = workerProfileReviewStatus === 'verified' || verified;
  const workerDocumentCardVerifiedForSave = workerDocumentReviewStatus === 'verified' || verified;
  const workerBankCardVerifiedForSave = workerBankReviewStatus === 'verified' || verified;
  const workerAllProfileCardsVerified = workerProfileCardVerifiedForSave && workerDocumentCardVerifiedForSave && workerBankCardVerifiedForSave;
  const workerAnyProfileCardPending = [workerProfileReviewStatus, workerDocumentReviewStatus, workerBankReviewStatus].some((s) => s === 'pending') || workerProfileChangedAfterReview || workerDocumentChangedAfterReview || workerBankChangedAfterReview;
  const workerTopStatus = finalSaved && workerAllProfileCardsVerified ? 'verified' : workerAnyProfileCardPending ? 'pending' : 'unverified';

  useEffect(() => {
    if (!workerAllProfileCardsVerified && finalSaved) {
      localStorage.removeItem(finalProfileSaveKey(me, 'worker'));
      setFinalSaved(false);
    }
  }, [workerAllProfileCardsVerified, finalSaved, me]);

  const requireWorkerDocuments = () => {
    if (!form.aadhaar_front_url || !form.aadhaar_back_url) return 'Upload Aadhaar front and back';
    if (!form.pan_image_url || !form.pan_back_url) return 'Upload PAN front and back';
    return '';
  };

  const save = async () => {
    if (!workerAllProfileCardsVerified) {
      toast.error('Verify Personal Profile, Documents and Bank Details before final save');
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...buildWorkerProfilePayload(),
        ...buildWorkerDocumentPayload(),
        ...buildWorkerBankPayload(),
        mobile_verified: !!(form.mobile_verified || me?.extra?.mobile_verified),
        selfie_verified: !!(form.selfie_verified || me?.extra?.selfie_verified),
        verification_status: 'verified',
      };
      await api('me/profile', { method: 'PATCH', token, body });
      setForm((prev) => ({ ...prev, ...body }));
      localStorage.setItem(finalProfileSaveKey(me, 'worker'), 'saved');
      setFinalSaved(true);
      toast.success('Profile saved');
      await onSaved?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const saveWorkerLocation = async (loc) => {
    const nextStatus = verified
      ? 'pending'
      : (form.verification_status === 'pending' || form.verification_status === 'submitted' ? 'pending' : 'saved');
    const body = {
      location_text: loc.location_text || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      place_id: form.place_id || '',
      place_name: form.place_name || '',
      verification_status: nextStatus,
      verification_section: 'location',
    };
    await api('me/profile', { method: 'PATCH', token, body });
    setForm((s) => ({ ...s, ...body }));
    // Keep the location box saved/closed after refresh. Final profile Save state is controlled only by card verification and real profile edits.
    await onSaved();
  };


  const deleteAccount = async () => {
    const first = confirm('Are you sure you want to permanently delete your account?');
    if (!first) return;

    const second = confirm('This will remove your account and data from Work2Wish permanently. This cannot be undone. Continue?');
    if (!second) return;

    setBusy(true);
    try {
      await api('me/account', { method: 'DELETE', token });
      toast.success('Account deleted successfully');
      onLogout();
    } catch (e) {
      toast.error(e.message || 'Failed to delete account');
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card className="profile-section-card overflow-hidden">
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
              {workerTopStatus === 'verified' ? (
                <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verified</Badge>
              ) : workerTopStatus === 'pending' ? (
                <Badge className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm"><XCircle className="w-3.5 h-3.5 mr-1" /> Unverified</Badge>
              ) : (
                <Badge className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm"><XCircle className="w-3.5 h-3.5 mr-1" /> Unverified</Badge>
              )}
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


      <VerificationDocumentsCard
        token={token}
        me={me}
        role="worker"
        verified={!!me.extra?.verified}
        form={form}
        setForm={setForm}
        onSaved={onSaved}
        color="indigo"
      />

      <Card className="profile-section-card overflow-hidden">
        <CardHeader className="profile-section-header">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-600" /> Bank details</CardTitle>
              <CardDescription>Standard payout details. Visible only to verified employers after hiring approval.</CardDescription>
            </div>
            <label className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 cursor-pointer hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700/50 dark:text-emerald-300">
              <Upload className="w-4 h-4" /> QR upload <span className="text-[10px] font-normal opacity-70">optional</span>
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const { url } = await uploadFile(file, 'bank-qr', token); setForm(f => ({ ...f, bank_qr_url: url })); toast.success('QR uploaded. Click Send for Verification to send it for admin review.'); } catch (err) { toast.error(err.message || 'QR upload failed'); } finally { e.target.value = ''; } }} />
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <Field label="Account holder name" v={form.account_holder_name} on={(v) => setForm(f => ({ ...f, account_holder_name: v }))} />
            <Field label="Bank name" v={form.bank_name} on={(v) => setForm(f => ({ ...f, bank_name: v }))} />
            <Field label="Account number" v={form.bank_account} on={(v) => setForm(f => ({ ...f, bank_account: v.replace(/\D/g, '') }))} />
            <Field label="IFSC code" v={form.ifsc_code} on={(v) => setForm(f => ({ ...f, ifsc_code: v.toUpperCase().replace(/\s/g, '') }))} />
            <Field label="Branch name" v={form.branch_name} on={(v) => setForm(f => ({ ...f, branch_name: v }))} />
            <Field label="UPI ID" v={form.upi_id} on={(v) => setForm(f => ({ ...f, upi_id: v }))} />
          </div>
          {form.bank_qr_url && (
            <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:bg-emerald-950/30 dark:border-emerald-800/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl border bg-white overflow-hidden grid place-items-center shrink-0">
                  <img src={form.bank_qr_url} alt="UPI QR" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">UPI QR uploaded</p>
                  <p className="text-xs text-muted-foreground truncate">Optional QR code saved for payout verification.</p>
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" onClick={() => setForm(f => ({ ...f, bank_qr_url: '' }))}>Remove</Button>
            </div>
          )}
          <SectionVerificationAction
            token={token}
            me={me}
            section="bank"
            title="Admin approval required"
            description="Admin checks your bank details and marks the account verified."
            color="emerald"
            setForm={setForm}
            onSaved={onSaved}
            disabled={(() => {
              return !(
                String(form.account_holder_name || '').trim() &&
                String(form.bank_name || '').trim() &&
                String(form.bank_account || '').trim() &&
                String(form.ifsc_code || '').trim() &&
                String(form.branch_name || '').trim()
              );
            })()}
            validate={() => {
              if (!String(form.account_holder_name || '').trim()) return 'Enter account holder name';
              if (!String(form.bank_name || '').trim()) return 'Enter bank name';
              if (!String(form.bank_account || '').trim()) return 'Enter account number';
              if (!String(form.ifsc_code || '').trim()) return 'Enter IFSC code';
              if (!String(form.branch_name || '').trim()) return 'Enter branch name';
              return '';
            }}
            payloadBuilder={() => ({
              account_holder_name: form.account_holder_name,
              bank_name: form.bank_name,
              bank_account: form.bank_account,
              ifsc_code: String(form.ifsc_code || '').toUpperCase().trim(),
              branch_name: form.branch_name,
              upi_id: form.upi_id,
              bank_qr_url: form.bank_qr_url,
            })}
            modified={workerBankChangedAfterReview}
          />
        </CardContent>
      </Card>

      <Card className="profile-section-card overflow-hidden">
        <CardHeader className="profile-section-header"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><CardTitle className="text-base">Edit profile</CardTitle><CardDescription>Personal, skill and availability information.</CardDescription></div></div></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name"  v={form.full_name}           on={(v) => setForm(f => ({ ...f, full_name: v }))} />
          <Field label="Phone"      v={form.phone}               on={(v) => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Age"        v={form.age}                 on={(v) => setForm(f => ({ ...f, age: v }))} type="number" />
          <div>
            <Label>Gender</Label>
            <Select value={form.gender || ''} onValueChange={(v) => setForm(f => ({ ...f, gender: v }))}>
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
            </Select>
          </div>
          <Field label="Experience (years)" v={form.experience_years} on={(v) => setForm(f => ({ ...f, experience_years: v }))} type="number" />
          <div>
            <Label>Experience level</Label>
            <Select value={form.experience_level || 'beginner'} onValueChange={(v) => setForm(f => ({ ...f, experience_level: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="beginner">Beginner</SelectItem><SelectItem value="skilled">Skilled</SelectItem><SelectItem value="experienced">Experienced</SelectItem><SelectItem value="expert">Expert</SelectItem></SelectContent>
            </Select>
          </div>
          <Field label="Expected daily wage (₹)" v={form.expected_daily_wage} on={(v) => setForm(f => ({ ...f, expected_daily_wage: v }))} type="number" />
          <div>
            <Label>Availability</Label>
            <Select value={String(form.available ?? true)} onValueChange={(v) => setForm(f => ({ ...f, available: v === 'true', badge_immediate_joiner: v === 'true' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="true">Available now</SelectItem><SelectItem value="false">Not available</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-3">

            <SavedLocationEditor
              label="Home / preferred work location"
              value={form.location_text || ''}
              latitude={form.latitude}
              longitude={form.longitude}
              color="indigo"
              placeholder="Search home area, landmark, city"
                helper="Workers can search, pin, or use current GPS to save the exact work location."
                onChange={(loc) => setForm(f => ({ ...f, ...loc }))}
                onSave={saveWorkerLocation}
              />
          </div>
          <div className="sm:col-span-2">
            <Label>Skills (comma-separated)</Label>
            <Input value={form.skills || ''} onChange={(e) => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="TIG welding, CNC, Fitter, Helper" />
          </div>
          <div className="sm:col-span-2">
            <Label>Languages known</Label>
            <Input value={form.languages_known || ''} onChange={(e) => setForm(f => ({ ...f, languages_known: e.target.value }))} placeholder="Tamil, English, Kannada, Hindi" />
          </div>
          <div className="sm:col-span-2">
            <Card className="profile-section-card overflow-hidden">
              <CardHeader className="profile-section-header">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div><CardTitle className="text-base">Identity checks</CardTitle>
                  <CardDescription>Mobile, selfie, certificate and admin-approved badges.</CardDescription></div>

                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid lg:grid-cols-2 gap-4 items-stretch">
                  <MobileOtpVerificationBox token={token} phone={form.phone} verified={!!me.extra?.mobile_verified} onVerified={(phone) => { setForm(f => ({ ...f, phone: phone || f.phone, mobile_verified: true })); onSaved?.(); }} />
                  <SelfieVerificationBox token={token} url={form.selfie_url} frontUrl={form.selfie_front_url} leftUrl={form.selfie_left_url} rightUrl={form.selfie_right_url} verified={!!(me.extra?.selfie_verified || form.selfie_verified)} disabled={busy} onUploaded={(payload) => { setForm(f => ({ ...f, ...(typeof payload === 'string' ? { selfie_url: payload, selfie_verified: true } : payload), selfie_verified: true, verification_status: 'verified' })); onSaved?.(); }} />
                </div>
                <div className="grid lg:grid-cols-1 gap-4 items-stretch">
                  <div className="rounded-2xl border bg-white p-4 min-h-[132px]">
                    <Label>Admin approved badges</Label>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <AnimatedWorkerBadge show={!!me.extra?.badge_verified_worker} label="Verified Worker" tone="emerald" />
                      <AnimatedWorkerBadge show={!!me.extra?.badge_skilled_worker} label="Skilled Worker" tone="blue" />
                      <AnimatedWorkerBadge show={!!me.extra?.badge_experienced} label="Experienced" tone="violet" />
                      <AnimatedWorkerBadge show={!!me.extra?.badge_immediate_joiner} label="Immediate Joiner" tone="amber" />
                      {!me.extra?.badge_verified_worker && !me.extra?.badge_skilled_worker && !me.extra?.badge_experienced && !me.extra?.badge_immediate_joiner && <span className="text-xs text-muted-foreground">Admin badges appear after approval. Immediate Joiner appears automatically when available.</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="sm:col-span-2">
            <Label>Previous employer reference</Label>
            <Textarea rows={2} value={form.previous_employer_reference || ''} onChange={(e) => setForm(f => ({ ...f, previous_employer_reference: e.target.value }))} placeholder="Company/person name and contact if available" />
          </div>
          <div className="sm:col-span-2">
            <Label>Bio</Label>
            <Textarea rows={3} value={form.bio || ''} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell employers about yourself" />
          </div>
          <div className="sm:col-span-2">
            <SectionVerificationAction
              token={token}
              me={me}
              section="profile"
              title="Admin approval required"
              description="Admin checks your personal profile details and marks the profile verified."
              color="indigo"
              setForm={setForm}
              onSaved={onSaved}
              disabled={!String(form.full_name || '').trim() || !String(form.phone || '').trim()}
              validate={() => {
                if (!String(form.full_name || '').trim()) return 'Enter full name';
                if (!String(form.phone || '').trim()) return 'Enter phone number';
                return '';
              }}
              payloadBuilder={buildWorkerProfilePayload}
              modified={workerProfileChangedAfterReview}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          onClick={save}
          disabled={busy || !workerAllProfileCardsVerified || finalSaved}
          className={`h-12 ${finalSaved ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600 disabled:text-white' : 'bg-emerald-600 hover:bg-emerald-700'} shadow-lg shadow-emerald-600/20 disabled:!opacity-100 disabled:cursor-not-allowed`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : finalSaved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
          {finalSaved ? 'Saved' : 'Save profile'}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setSettingsOpen(true)}
          className="h-12 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
        >
          <ShieldCheck className="w-4 h-4 mr-2" />
          Account settings
        </Button>
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Account settings</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Signed in as</p>
                <p className="text-sm text-muted-foreground truncate mt-1">{me.profile?.email}</p>
                {me.profile?.login_id && (
                  <p className="text-xs text-indigo-700 mt-2">Login ID: <b>{me.profile.login_id}</b></p>
                )}
              </div>

              <div className="rounded-2xl border p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">Quick actions</p>
                <AccountActivitySheet token={token} accent="indigo" />
                <Button
                  type="button"
                  onClick={onLogout}
                  disabled={busy}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={deleteAccount}
                  disabled={busy}
                  className="w-full"
                >
                  Delete Account Permanently
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}


function AnimatedWorkerBadge({ show, label, tone = 'emerald' }) {
  if (!show) return null;
  const tones = {
    emerald: 'from-emerald-500 to-teal-600 text-white shadow-emerald-200',
    blue: 'from-blue-500 to-cyan-600 text-white shadow-blue-200',
    violet: 'from-violet-500 to-fuchsia-600 text-white shadow-violet-200',
    amber: 'from-amber-400 to-orange-500 text-white shadow-amber-200',
  };
  return (
    <motion.span initial={{ scale: .85, opacity: 0, y: 6 }} animate={{ scale: 1, opacity: 1, y: 0 }} whileHover={{ scale: 1.06, rotate: -1 }} className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${tones[tone] || tones.emerald} px-3 py-1.5 text-xs font-bold shadow-lg`}>
      <Award className="w-3.5 h-3.5" /> {label}
    </motion.span>
  );
}


function SelfieVerificationBox({ token, url, frontUrl, leftUrl, rightUrl, verified, disabled, onUploaded }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanTimerRef = useRef(null);
  const stableFaceCountRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [faceMessage, setFaceMessage] = useState('Open camera and keep your full front face inside the green frame. It will auto capture when the face is clear.');
  const [capturedPreview, setCapturedPreview] = useState(frontUrl || url || '');
  const [capturedBlob, setCapturedBlob] = useState(null);
  const capturedBlobRef = useRef(null);
  const autoCaptureLockRef = useRef(false);

  useEffect(() => {
    setCapturedPreview(frontUrl || url || '');
    if (frontUrl || url) {
      capturedBlobRef.current = null;
    }
  }, [url, frontUrl]);

  useEffect(() => () => stopCamera(), []);

  const stopFaceScan = () => {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    stableFaceCountRef.current = 0;
  };

  const resetAutoCapture = () => {
    stopFaceScan();
    autoCaptureLockRef.current = false;
    capturedBlobRef.current = null;
    stableFaceCountRef.current = 0;
    setCapturedBlob(null);
    setCapturedPreview('');
  };

  const stopCamera = () => {
    stopFaceScan();
    try { streamRef.current?.getTracks?.().forEach((track) => track.stop()); } catch {}
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const captureFrontFace = async () => {
    if (!videoRef.current || !canvasRef.current || verified || busy || autoCaptureLockRef.current) return;
    autoCaptureLockRef.current = true;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    const canvas = canvasRef.current;
    // Capture the real camera frame without zooming/cropping so the full face stays visible.
    // Use high JPEG quality for clearer admin review.
    const sourceW = video.videoWidth;
    const sourceH = video.videoHeight;
    const maxW = 1280;
    const scale = Math.min(1, maxW / sourceW);
    const outputW = Math.round(sourceW * scale);
    const outputH = Math.round(sourceH * scale);
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Mirror the saved selfie to match the live front camera preview.
    ctx.translate(outputW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, sourceW, sourceH, 0, 0, outputW, outputH);

    canvas.toBlob((blob) => {
      if (!blob) {
        autoCaptureLockRef.current = false;
        return toast.error('Auto capture failed. Try again.');
      }
      const preview = URL.createObjectURL(blob);
      capturedBlobRef.current = blob;
      setCapturedBlob(blob);
      setCapturedPreview(preview);
      stopCamera();
      setFaceMessage('Front face captured clearly. Click Submit for Review.');
      toast.success('Front face auto captured');
    }, 'image/jpeg', 0.98);
  };

  const startFaceScan = async () => {
    stopFaceScan();
    if (typeof window === 'undefined') return;

    const loadDetector = async () => {
      if (detectorRef.current) return detectorRef.current;
      if ('FaceDetector' in window) {
        detectorRef.current = { type: 'native', detector: new window.FaceDetector({ fastMode: false, maxDetectedFaces: 2 }) };
        return detectorRef.current;
      }
      // Better fallback for Chrome/Edge builds where native FaceDetector is unavailable.
      // Loads MediaPipe in the browser and detects real human faces before auto-capture.
      try {
        const mp = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
        const vision = await mp.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
        const detector = await mp.FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.65,
        });
        detectorRef.current = { type: 'mediapipe', detector };
        return detectorRef.current;
      } catch {
        detectorRef.current = { type: 'manual', detector: null };
        return detectorRef.current;
      }
    };

    const readFaces = async (detectorPack, video) => {
      if (detectorPack.type === 'native') {
        const faces = await detectorPack.detector.detect(video);
        return (faces || []).map((f) => ({
          x: f.boundingBox?.x || 0,
          y: f.boundingBox?.y || 0,
          width: f.boundingBox?.width || 0,
          height: f.boundingBox?.height || 0,
        }));
      }
      if (detectorPack.type === 'mediapipe') {
        const result = detectorPack.detector.detectForVideo(video, performance.now());
        return (result?.detections || []).map((d) => {
          const b = d.boundingBox || {};
          return { x: b.originX || 0, y: b.originY || 0, width: b.width || 0, height: b.height || 0 };
        });
      }
      return [];
    };

    try {
      setFaceMessage('Starting human face detection...');
      const detectorPack = await loadDetector();
      if (detectorPack.type === 'manual') {
        setFaceMessage('Auto detection is loading slowly. Keep your full front face visible and hold still...');
        let fallbackTicks = 0;
        scanTimerRef.current = setInterval(async () => {
          if (!videoRef.current || capturedBlobRef.current || busy || autoCaptureLockRef.current) return;
          fallbackTicks += 1;
          setFaceMessage(fallbackTicks < 4 ? 'Keep full front face visible. Auto capturing soon...' : 'Capturing automatically...');
          if (fallbackTicks >= 5) {
            stopFaceScan();
            await captureFrontFace();
          }
        }, 600);
        return;
      }

      setFaceMessage('Looking for one clear front human face...');
      scanTimerRef.current = setInterval(async () => {
        try {
          const video = videoRef.current;
          if (!video || !video.videoWidth || !video.videoHeight || capturedBlobRef.current || busy || autoCaptureLockRef.current) return;
          const faces = await readFaces(detectorPack, video);
          if (!faces || faces.length !== 1) {
            stableFaceCountRef.current = 0;
            setFaceMessage('Keep only one human face visible in the frame.');
            return;
          }

          const box = faces[0] || {};
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const bw = box.width || 0;
          const bh = box.height || 0;
          const bx = box.x || 0;
          const by = box.y || 0;
          const faceArea = bw * bh;
          const frameArea = vw * vh;
          const centerX = bx + bw / 2;
          const centerY = by + bh / 2;

          // No zoom: allow the user to sit a little back. Capture only if one real face
          // is centered, front-like, and not cut by the camera edges.
          const marginX = vw * 0.05;
          const marginY = vh * 0.06;
          const fullyVisible = bx > marginX * 0.35 && by > marginY * 0.35 && bx + bw < vw - marginX * 0.35 && by + bh < vh - marginY * 0.35;
          const centered = Math.abs(centerX - vw / 2) < vw * 0.34 && Math.abs(centerY - vh / 2) < vh * 0.34;
          const goodSize = faceArea > frameArea * 0.018 && faceArea < frameArea * 0.55;
          const frontLike = bw > 0 && bh > 0 && bw / bh > 0.42 && bw / bh < 1.65;

          if (!fullyVisible) {
            stableFaceCountRef.current = 0;
            setFaceMessage('Move back slightly. Keep full head and face inside the frame.');
            return;
          }
          if (!centered) {
            stableFaceCountRef.current = 0;
            setFaceMessage('Center your face inside the green frame.');
            return;
          }
          if (!goodSize) {
            stableFaceCountRef.current = 0;
            setFaceMessage(faceArea >= frameArea * 0.36 ? 'Move back slightly. Face is too close.' : 'Move closer slightly. Face is too small.');
            return;
          }
          if (!frontLike) {
            stableFaceCountRef.current = 0;
            setFaceMessage('Face the camera straight. Front face only.');
            return;
          }

          stableFaceCountRef.current += 1;
          setFaceMessage(stableFaceCountRef.current >= 2 ? 'Human face matched. Auto capturing...' : 'Human face detected. Hold still...');
          if (stableFaceCountRef.current >= 2) {
            stopFaceScan();
            await captureFrontFace();
          }
        } catch {
          stableFaceCountRef.current = 0;
          setFaceMessage('Unable to detect face clearly. Improve light and face the camera.');
        }
      }, 450);
    } catch {
      setFaceMessage('Auto capture will start shortly. Keep your full front face visible.');
    }
  };

  const startCamera = async () => {
    if (verified || busy) return;
    setCameraError('');
    resetAutoCapture();
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.7777777778 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setTimeout(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        try { await videoRef.current.play(); } catch {}
        startFaceScan();
      }, 80);
    } catch (e) {
      setCameraError('Camera permission denied or unavailable. Please allow camera access.');
      toast.error('Camera access failed');
    }
  };

  const openVerification = () => {
    if (verified) return;
    setOpen(true);
    setTimeout(startCamera, 250);
  };

  const closeVerification = () => {
    stopCamera();
    setOpen(false);
  };

  const submitFaceCheck = async () => {
    if (verified) return;
    if (!capturedBlob) return toast.error('Keep your front face in camera until auto capture completes.');
    setBusy(true);
    try {
      const file = new File([capturedBlob], `selfie-front-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const uploaded = await uploadFile(file, 'selfie-front', token);
      const payload = {
        selfie_url: uploaded.url,
        selfie_front_url: uploaded.url,
        selfie_left_url: '',
        selfie_right_url: '',
        // Selfie is front-face auto captured, so mark this card verified immediately.
        // The image URL is still saved to the profile so admin can view it in dashboard.
        selfie_verified: true,
        selfie_verified_at: new Date().toISOString(),
        verification_status: 'verified',
      };
      await api('me/profile', { method: 'PATCH', token, body: payload });
      onUploaded?.(payload);
      closeVerification();
      toast.success('Front face submitted and verified');
    } catch (e) {
      toast.error(e.message || 'Face verification upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm min-h-[190px] flex flex-col justify-between ${verified ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold flex items-center gap-2"><Camera className="w-4 h-4" /> Selfie verification</p>
            <p className="text-xs text-muted-foreground mt-1">Front face only. Camera auto captures when your face is clear inside the frame.</p>
          </div>
          {verified ? <Badge className="bg-emerald-600 text-white opacity-100"><Check className="w-3 h-3 mr-1" /> Done</Badge> : <Badge className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm"><XCircle className="w-3.5 h-3.5 mr-1" /> Unverified</Badge>}
        </div>

        {verified ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-600 px-3 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 opacity-100 shadow-sm">
            <ShieldCheck className="w-4 h-4" /> Done
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Open the camera and keep your full face inside the green frame. It will auto capture.
          </div>
        )}
      </div>

      {!verified && (
        <Button type="button" className="mt-4 !bg-rose-600 hover:!bg-rose-700 !text-white disabled:!bg-rose-600 disabled:!text-white disabled:!opacity-100" disabled={disabled || busy} onClick={openVerification}>
          <Camera className="w-4 h-4 mr-2" /> Send for Verification
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : closeVerification()}>
        <DialogContent className="w-[94vw] max-w-[760px] max-h-[96vh] overflow-hidden rounded-3xl p-4">
          <DialogHeader>
            <DialogTitle>Front face auto capture</DialogTitle>
            <DialogDescription>Keep your full front face inside the green frame. It captures automatically when your face is clear.</DialogDescription>
          </DialogHeader>

          <div className="relative space-y-3 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400/40"
                  style={{
                    left: `${(i * 19) % 96}%`,
                    top: `${10 + ((i * 23) % 78)}%`,
                    animation: `selfieParticleMove ${5 + (i % 5)}s linear infinite`,
                    animationDelay: `${i * 0.35}s`,
                  }}
                />
              ))}
            </div>
            <div className="relative mx-auto h-[430px] w-[680px] max-w-[88vw] rounded-[2rem] border-[5px] border-emerald-500 bg-slate-950 overflow-hidden grid place-items-center shadow-[0_0_0_4px_rgba(16,185,129,0.12),0_20px_45px_rgba(15,23,42,0.25)]">
              {cameraOn ? (
                <>
                  <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-contain bg-slate-950 scale-x-[-1]" />
                  <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-2 ring-emerald-400/90 ring-offset-0 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.22),0_0_18px_rgba(16,185,129,0.35)]" />
                  <div className="pointer-events-none absolute inset-3 rounded-[1.5rem] border border-emerald-200/80" />
                  <div className="pointer-events-none absolute left-4 right-4 top-6 h-[2px] rounded-full bg-emerald-300/90 shadow-[0_0_16px_rgba(52,211,153,.95)] animate-[selfieScan_2.3s_ease-in-out_infinite]" />
                  <div className="absolute top-3 left-3 rounded-full bg-emerald-600/95 px-3 py-1 text-xs font-semibold text-white shadow">Front face only</div>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 max-w-[90%] text-center">{faceMessage}</div>
                </>
              ) : capturedPreview ? (
                <img src={capturedPreview} alt="Captured front selfie" className="absolute inset-0 w-full h-full object-contain bg-slate-950" />
              ) : (
                <div className="text-center text-slate-400 px-4">
                  <Camera className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-xs font-medium">Camera preview will appear here</p>
                </div>
              )}
            </div>

            {capturedPreview && !cameraOn && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Front face captured successfully.</div>
            )}
            {cameraError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{cameraError}</div>}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <style>{`@keyframes selfieParticleMove { 0% { transform: translate3d(0, 0, 0); opacity: .18; } 50% { transform: translate3d(16px, -24px, 0); opacity: .65; } 100% { transform: translate3d(-8px, -52px, 0); opacity: .18; } } @keyframes selfieScan { 0% { transform: translateY(0); opacity:.45; } 50% { transform: translateY(370px); opacity:1; } 100% { transform: translateY(0); opacity:.45; } }`}</style>

          <DialogFooter className="gap-2 sm:gap-2 shrink-0 flex-wrap">
            <Button type="button" variant="outline" disabled={busy || disabled || verified} onClick={cameraOn ? stopCamera : startCamera}>{cameraOn ? 'Stop camera' : 'Start camera'}</Button>
            <Button type="button" variant="outline" disabled={busy || disabled || verified || cameraOn} onClick={startCamera}>Retake</Button>
            <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600 disabled:text-white disabled:opacity-100" disabled={busy || disabled || verified || !capturedBlob} onClick={submitFaceCheck}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for review'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeIndianMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (String(value || '').trim().startsWith('+') && digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return '';
}

function MobileOtpVerificationBox({ token, phone, verified, onVerified }) {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => setMobile(phone || ''), [phone]);

  useEffect(() => {
    if (countdown <= 0) {
      setCountdown(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = timerRef.current || setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [countdown]);

  const canEdit = !verified || editing;
  const normalized = normalizeIndianMobile(mobile);

  const sendOtp = async () => {
    try {
      setBusy(true);
      if (!normalized) {
        throw new Error('Enter a valid 10-digit mobile number');
      }
      await api('auth/mobile-send-otp', { method: 'POST', token, body: { phone: normalized } });
      setSent(true);
      setCountdown(60);
      toast.success('OTP sent successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setBusy(true);
      if (!otp) throw new Error('Enter OTP');
      await api('auth/mobile-verify-otp', { method: 'POST', token, body: { phone: normalized, otp } });
      await api('me/profile', { method: 'PATCH', token, body: { phone: normalized, mobile_verified: true } });
      onVerified?.(normalized);
      setSent(false);
      setOtp('');
      setEditing(false);
      toast.success('Mobile number verified');
    } catch (err) {
      toast.error(err.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${verified && !editing ? 'border-emerald-200 bg-emerald-50/50' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold flex items-center gap-2"><Phone className="w-4 h-4" /> Mobile OTP</p>
          <p className="text-xs text-muted-foreground mt-0.5">Verify your active phone number.</p>
        </div>
        {verified && !editing ? <Badge className="bg-emerald-600 text-white opacity-100"><Check className="w-3 h-3 mr-1" /> Done</Badge> : <Badge className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm"><XCircle className="w-3.5 h-3.5 mr-1" /> Unverified</Badge>}
      </div>

      {verified && !editing && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Just verified
        </div>
      )}

      <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
        <Input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^0-9+ ]/g, '').slice(0, 16))} placeholder="9876543210 or +919876543210" disabled={!canEdit} inputMode="tel" />
        <Button
          type="button"
          variant="outline"
          onClick={sendOtp}
          disabled={busy || !canEdit || countdown > 0}
          className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-100 disabled:bg-emerald-50 disabled:text-emerald-700"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : countdown > 0 ? `Resend in ${countdown}s` : (sent ? 'Resend OTP' : 'Send OTP')}
        </Button>
        {verified && !editing ? (
          <Button type="button" variant="outline" onClick={() => { setEditing(true); setSent(false); setOtp(''); }}>Edit mobile</Button>
        ) : verified && editing ? (
          <Button type="button" variant="ghost" onClick={() => { setEditing(false); setMobile(phone || ''); setOtp(''); setSent(false); setCountdown(0); }}>Cancel</Button>
        ) : null}
      </div>

      {sent && (
        <div className="mt-3 text-sm text-slate-600">
          OTP sent to <span className="font-semibold">{normalized}</span>. {countdown > 0 ? `You can resend in ${countdown}s.` : 'You can resend now.'}
        </div>
      )}

      {canEdit && sent && (
        <div className="grid sm:grid-cols-[1fr_auto] gap-2 mt-2">
          <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit OTP" inputMode="numeric" />
          <Button type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600 disabled:text-white disabled:opacity-100" onClick={verifyOtp} disabled={busy || otp.length !== 6}>Verify</Button>
        </div>
      )}
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
  const [tab, setTabState] = useState('dashboard'); // dashboard | post | hired | chats | profile
  const [me, setMe] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [chatPeer, setChatPeer] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [notificationFocusApplicationId, setNotificationFocusApplicationId] = useState(null);
  const tabHistoryRef = useRef([]);

  const setTab = (nextTab, options = {}) => {
    setTabState((currentTab) => {
      if (!nextTab || currentTab === nextTab) return currentTab;

      if (!options.replace && typeof window !== 'undefined') {
        tabHistoryRef.current.push(currentTab);
        window.history.pushState(
          { w2wInternal: true, portal: 'employer', tab: nextTab },
          '',
          window.location.href
        );
      }

      return nextTab;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.history.replaceState(
      { ...(window.history.state || {}), w2wInternal: true, portal: 'employer', tab: 'dashboard' },
      '',
      window.location.href
    );

    const handleBrowserBack = () => {
      const previousTab = tabHistoryRef.current.pop();

      if (previousTab) {
        setChatPeer(null);
        setEditingJob(null);
        setTabState(previousTab);
        return;
      }

      setChatPeer(null);
      setEditingJob(null);
      setTabState('dashboard');
      window.history.pushState(
        { w2wInternal: true, portal: 'employer', tab: 'dashboard' },
        '',
        window.location.href
      );
    };

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, []);

  const refreshMe = async () => {
    try { const d = await api('me', { token }); setMe(d); } catch {}
  };
  const refreshJobs = async () => {
    try { const d = await api('employer/jobs', { token }); setJobs(d.jobs); }
    catch (e) { toast.error(e.message); }
  };
  useEffect(() => { if (token) { refreshMe(); refreshJobs(); } }, [token]);
  // Keep posted job applicant badges/counts live for employer without manual refresh.
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => refreshJobs(), 10000);
    return () => clearInterval(timer);
  }, [token]);

  // Auto-refresh jobs when switching to 'hired' tab to show newly accepted applicants
  useEffect(() => {
    if (token && tab === 'hired') {
      refreshJobs();
    }
  }, [token, tab]);

  const openChatWith = (peer) => { setChatPeer(peer); setTab('chats'); };

  const handleNotificationNavigate = (notif) => {
    const type = (notif?.type || '').toLowerCase();
    const title = (notif?.title || '').toLowerCase();
    const route = (notif?.target_route || notif?.target_page || notif?.route || '').toLowerCase();
    const message = (notif?.body || notif?.message || '').toLowerCase();
    const refId = notif?.reference_id || notif?.related_id || notif?.source_id || notif?.target_id;
    const text = `${type} ${title} ${route} ${message}`;

    if (text.includes('chat') || type === 'message') {
      setChatPeer(null);
      setTab('chats');
      return;
    }

    if (text.includes('verification') || text.includes('verified') || text.includes('profile') || text.includes('document') || text.includes('selfie')) {
      setTab('profile');
      return;
    }

    if (text.includes('new applicant') || text.includes('applicant') || text.includes('application submitted')) {
      setNotificationFocusApplicationId(refId || null);
      refreshJobs?.();
      setTab('dashboard');
      return;
    }

    if (text.includes('accepted') || text.includes('ongoing') || text.includes('hired') || text.includes('attendance') || text.includes('completed') || text.includes('payment') || text.includes('removed')) {
      refreshJobs?.();
      setTab('hired');
      return;
    }

    if (text.includes('job')) {
      refreshJobs?.();
      setTab('dashboard');
    }
  };

  return (
    <div className="h-screen bg-slate-50 overflow-hidden flex flex-col">
      <header className="bg-gradient-to-r from-[#04112f] via-[#071f55] to-[#0b3b91] backdrop-blur-xl border-b border-blue-400/20 shrink-0 z-10 shadow-[0_10px_34px_rgba(7,31,85,0.30)]">
        <div className="container py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="w-11 h-11 rounded-xl bg-white grid place-items-center shadow-lg shadow-blue-950/30 ring-2 ring-sky-300/40 p-1"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.5 }}
            >
              <Work2WishLogo className="w-full h-full" />
            </motion.div>
            <div className="leading-tight">
              <p className="font-extrabold text-white tracking-tight">{me?.extra?.company_name || 'Work2Wish'}</p>
              <p className="text-[10px] text-sky-100/80">Employer portal</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationCenter token={token} userId={me?.profile?.id} channelKey="employer" accent="emerald" onNavigate={handleNotificationNavigate} />
            <GlobalLanguageSelect />
            <ThemeToggle />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button type="button" variant="ghost" size="icon" className="rounded-xl text-sky-100 hover:bg-white/10 hover:text-white" onClick={() => setTab('profile')} title="Profile">
                <UserCircle className="w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className={tab === 'post' || tab === 'chats' ? "w-full flex-1 min-h-0 p-1 md:p-2 overflow-hidden" : "container flex-1 min-h-0 overflow-y-auto py-4 pb-4"}>
        {tab === 'dashboard' && <EmployerDashboard token={token} jobs={jobs} reload={refreshJobs} onChat={openChatWith} onEditJob={(job) => { setEditingJob(job); setTab('post'); }} focusApplicationId={notificationFocusApplicationId} onFocusHandled={() => setNotificationFocusApplicationId(null)} />}
        {tab === 'post'      && <PostJob token={token} initialJob={editingJob} onPosted={() => { setEditingJob(null); refreshJobs(); setTab('dashboard'); }} />}
        {tab === 'hired'     && <HiredJobs token={token} jobs={jobs} reload={refreshJobs} onChat={openChatWith} />}
        {tab === 'chats'     && <ChatScreen token={token} me={{ id: me?.profile?.id, profile: me?.profile }} peerHint={chatPeer} color="emerald" />}
        {tab === 'profile'   && <EmployerProfile token={token} me={me} onSaved={refreshMe} onLogout={onLogout} />}
      </main>

      <nav className="shrink-0 bg-gradient-to-r from-[#04112f] via-[#071f55] to-[#0b3b91] backdrop-blur-xl border-t border-blue-400/20 shadow-[0_-8px_30px_rgba(7,31,85,0.28)]">
        <div className="container grid grid-cols-4">
          {[
            { k: 'dashboard', i: ClipboardList, l: 'Jobs' },
            { k: 'post',      i: Plus,          l: 'Post' },
            { k: 'hired',     i: CheckCircle2,  l: 'Hired' },
            { k: 'chats',     i: MessageSquare, l: 'Chats' },
          ].map(t => {
            const active = tab === t.k;
            return (
              <button key={t.k}
                onClick={() => { setTab(t.k); if (t.k !== 'chats') setChatPeer(null); }}
                className={`py-2.5 flex flex-col items-center gap-1 text-xs font-medium transition-all duration-200 relative ${active ? 'text-white' : 'text-sky-200/70 hover:text-white'}`}>
                {active && (
                  <motion.span
                    layoutId="employer-tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-sky-300"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-white/12 ring-1 ring-sky-300/25' : ''}`}
                >
                  <t.i className="w-5 h-5" />
                </motion.span>
                <span>{t.l}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function EmployerDashboard({ token, jobs, reload, onChat, onEditJob, focusApplicationId = null, onFocusHandled = null }) {
  const [openJob, setOpenJob] = useState(null);
  const [profileView, setProfileView] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApp, setLoadingApp] = useState(false);
  const [decidingId, setDecidingId] = useState(null);
  const [deletingJobId, setDeletingJobId] = useState(null);

  const totalApplicants = jobs.reduce((s, j) => s + (j.applicants_count || 0), 0);
  const totalPending    = jobs.reduce((s, j) => s + (j.pending_count || 0), 0);

  const openProfileDetails = async (profileId) => {
    if (!profileId) return;
    try { setProfileView(await api(`profiles/${profileId}`, { token })); } catch (e) { toast.error(e.message); }
  };

  const openApplicants = async (job) => {
    setOpenJob(job); setLoadingApp(true);
    try { const d = await api(`employer/jobs/${job.id}/applicants`, { token }); setApplicants(d.applicants); }
    catch (e) { toast.error(e.message); } finally { setLoadingApp(false); }
  };

  useEffect(() => {
    if (!focusApplicationId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await api(`applications/${focusApplicationId}`, { token });
        if (cancelled) return;
        const app = d?.application;
        const jobId = app?.job_id || app?.jobs?.id;
        if (!jobId) throw new Error('Related job not found for this notification');
        const jobFromList = jobs.find(j => String(j.id) === String(jobId));
        const job = jobFromList || app.jobs || { id: jobId, title: 'Job' };
        await openApplicants(job);
        onFocusHandled?.();
        toast.success('Opened related applicants');
      } catch (e) {
        toast.error(e.message || 'Unable to open related notification');
        onFocusHandled?.();
      }
    })();
    return () => { cancelled = true; };
  }, [focusApplicationId, token, jobs]);

  const decide = async (appId, status) => {
    try {
      setDecidingId(appId);
      await api(`applications/${appId}`, { method: 'PATCH', token, body: { status } });
      toast.success(status === 'accepted' ? 'Invitation sent to employee' : `Marked ${status}`);
      // refresh
      const d = await api(`employer/jobs/${openJob.id}/applicants`, { token });
      setApplicants(d.applicants);
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setDecidingId(null); }
  };

  const deletePostedJob = async (job) => {
    if (!job?.id) return;
    const ok = confirm(`Delete "${job.title || 'this job'}"? This also removes its applications and cannot be undone.`);
    if (!ok) return;
    try {
      setDeletingJobId(job.id);
      await api(`employer/jobs/${job.id}`, { method: 'DELETE', token });
      toast.success('Job post deleted');
      if (openJob?.id === job.id) setOpenJob(null);
      reload?.();
    } catch (e) {
      toast.error(e.message || 'Failed to delete job');
    } finally {
      setDeletingJobId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <Card key={j.id} className={`rounded-3xl hover:border-emerald-300 hover:shadow-xl transition cursor-pointer premium-job-card company-job-card ${Number(j.pending_count || 0) > 0 ? 'border-amber-300 ring-2 ring-amber-100 shadow-lg shadow-amber-100/60' : 'border-emerald-100'}`} onClick={() => openApplicants(j)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{j.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{j.location_text} · {j.duration_days}d</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {Number(j.pending_count || 0) > 0 && <Badge className="bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">New {Number(j.pending_count || 0)}</Badge>}
                  <Badge className={j.status === 'open' ? 'bg-emerald-100 text-emerald-700' : ''} variant={j.status === 'open' ? 'default' : 'secondary'}>{j.status}</Badge>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <span className="rounded-xl bg-emerald-50 text-emerald-700 px-2 py-2 font-bold"><Banknote className="w-3 h-3 inline mr-1" />{fmtMoney(j.daily_pay)}/day</span>
                <span className="rounded-xl bg-slate-50 px-2 py-2"><Users className="w-3 h-3 inline mr-1" />{j.workers_needed || 1} needed</span>
                <span className="rounded-xl bg-indigo-50 text-indigo-700 px-2 py-2">{j.applicants_count || 0} applicants</span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button type="button" size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); onEditJob?.(j); }}>
                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                <Button type="button" size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={(e) => { e.stopPropagation(); openApplicants(j); }}>
                  <Users className="w-3.5 h-3.5 mr-1" /> Applicants
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={deletingJobId === j.id} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); deletePostedJob(j); }}>
                  {deletingJobId === j.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />} Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {openJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4" onClick={() => setOpenJob(null)}>
          <div className="w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => setOpenJob(null)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="min-w-0">
                  <h3 className="font-bold text-base truncate">Applicants — {openJob?.title}</h3>
                  <p className="text-xs text-muted-foreground">Review applicants and track invitation status</p>
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" className="rounded-xl" onClick={() => setOpenJob(null)}>
                <XCircle className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>

            <div className="max-h-[76vh] overflow-y-auto p-3 sm:p-4">
              {loadingApp && <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}
              {!loadingApp && applicants.length === 0 && <p className="text-sm text-muted-foreground p-6 bg-white rounded-xl border text-center">No applicants yet.</p>}
              <div className="space-y-3">
                {applicants.map(a => {
                  const up = a.workers?.user_profiles || {};
                  return (
                  <div key={a.id} className="border border-slate-200 rounded-2xl p-3 bg-white shadow-sm">
                    <div className="flex items-center gap-3">
                      <Avatar className="cursor-pointer h-12 w-12" onClick={() => openProfileDetails(a.worker_id)}><AvatarImage src={up.photo_url} /><AvatarFallback>{initials(up.full_name || up.email)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <button type="button" onClick={() => openProfileDetails(a.worker_id)} className="font-semibold truncate text-left hover:text-emerald-700 hover:underline">{up.full_name || up.email}</button>
                        <p className="text-xs text-muted-foreground truncate">{(a.workers?.skills || []).join(', ') || 'No skills set'}</p>
                        <p className="text-[11px] text-muted-foreground">Wage ₹{a.workers?.expected_daily_wage || 0}/day · {a.workers?.experience_years || 0}y exp</p>
                      </div>
                      <Badge variant="secondary" className={a.status === 'ongoing' ? 'bg-emerald-100 text-emerald-700' : a.status === 'accepted' ? 'bg-indigo-100 text-indigo-700' : ''}>{a.status === 'accepted' ? 'Waiting worker accept' : a.status}</Badge>
                    </div>
                    {a.status === 'pending' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                        <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => openProfileDetails(a.worker_id)}>
                          <UserCircle className="w-4 h-4 mr-1" /> Profile
                        </Button>
                        <Button type="button" size="sm" disabled={decidingId === a.id} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => decide(a.id, 'accepted')}>
                          {decidingId === a.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />} Send Invitation
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={decidingId === a.id} onClick={() => decide(a.id, 'rejected')}>
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                    {a.status === 'accepted' && (
                      <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-800">
                        Worker selected. Waiting for employee acceptance before moving to work instructions, attendance and payment steps.
                      </div>
                    )}
                    {a.status === 'ongoing' && (
                      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
                        Employee accepted. Continue with reporting time, site contact, attendance and completion update.
                      </div>
                    )}
                    {a.status === 'completed' && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1"
                                onClick={() => {
                                  const rating = prompt('Rate the worker (1-5):');
                                  const feedback = prompt('Feedback for the worker:');
                                  if (rating && feedback) {
                                    api('feedback/worker', { method: 'POST', token, body: { application_id: a.id, rating: parseInt(rating), feedback_text: feedback } })
                                      .then(() => { toast.success('Feedback submitted!'); if (openJob) openApplicants(openJob); })
                                      .catch(e => toast.error(e.message));
                                  }
                                }}>
                          <Star className="w-4 h-4 mr-1" /> Rate Worker
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1"
                                onClick={() => {
                                  const feedback = prompt('Additional feedback for the worker:');
                                  if (feedback) {
                                    api('feedback/employer', { method: 'POST', token, body: { application_id: a.id, rating: 5, feedback_text: feedback } })
                                      .then(() => { toast.success('Feedback submitted!'); if (openJob) openApplicants(openJob); })
                                      .catch(e => toast.error(e.message));
                                  }
                                }}>
                          <MessageSquare className="w-4 h-4 mr-1" /> Feedback
                        </Button>
                      </div>
                    )}
                    <Button size="sm" variant="ghost" className="w-full mt-3 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => onChat?.({ peer_id: a.worker_id, peer_name: up.full_name || up.email, peer_photo: up.photo_url, peer_role: 'worker' })}>
                      <MessageSquare className="w-4 h-4 mr-1" /> Message worker
                    </Button>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const map = { emerald: 'bg-emerald-50 text-emerald-700 shadow-emerald-100', indigo: 'bg-indigo-50 text-indigo-700 shadow-indigo-100', amber: 'bg-amber-50 text-amber-700 shadow-amber-100' };
  const border = { emerald: 'hover:border-emerald-200', indigo: 'hover:border-indigo-200', amber: 'hover:border-amber-200' };
  return (
    <motion.div whileHover={{ y: -3, scale: 1.01 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
      <Card className={`premium-card cursor-default ${border[color]}`}>
        <CardContent className="p-4">
          <div className={`w-10 h-10 rounded-xl grid place-items-center shadow-sm ${map[color]}`}><Icon className="w-5 h-5" /></div>
          <motion.p
            className="text-3xl font-extrabold mt-3 tracking-tight"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >{value}</motion.p>
          <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PostJob({ token, onPosted, initialJob = null }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    title: '', category: 'general', description: '', location_text: '', latitude: '', longitude: '',
    daily_pay: 1000, duration_days: 1, start_date: '', workers_needed: 1,
    shift_timing: 'day', experience: 'beginner', contact_number: '',
    skill_needed: '', accommodation_available: 'no', food_included: 'no', urgent_hiring: false,
    overtime_available: false, transportation_provided: false, post_valid_days: 5, attendance_radius_meters: 20,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialJob?.id) {
      setF((s) => ({ ...s, ...initialJob, post_valid_days: initialJob.post_valid_days || initialJob.valid_days || 5 }));
      setStep(1);
    }
  }, [initialJob?.id]);

  const categories = ['general','construction','electrical','plumbing','painting','carpentry','cleaning','delivery','farming','warehouse','welding','machining','fabrication','metalworking','assembly'];

  const nextStep = (e) => {
    e.preventDefault();
    if (!f.title?.trim() || !f.category || !f.daily_pay || !f.duration_days || !f.start_date || !f.workers_needed) {
      toast.error('Please fill all required fields before continuing');
      return;
    }
    setStep(2);
  };

  const prevStep = () => setStep(1);

  const useCurrentJobGps = () => {
    if (!navigator.geolocation) return toast.error('GPS is not supported on this device');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setF(s => ({
          ...s,
          latitude,
          longitude,
          location_text: s.location_text?.trim() || `Current GPS: ${formatCoordinates(latitude, longitude)}`,
        }));
        toast.success('Current GPS saved for this job attendance check');
      },
      () => toast.error('Allow location permission to save current GPS'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!f.description?.trim() || !f.shift_timing || !f.experience || !f.contact_number?.trim()) {
      toast.error('Please fill all required fields before publishing');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...f,
        daily_pay: Number(f.daily_pay) || 0,
        duration_days: Number(f.duration_days) || 1,
        workers_needed: Number(f.workers_needed) || 1,
        post_valid_days: Number(f.post_valid_days) || 5,
        attendance_radius_meters: Number(f.attendance_radius_meters) || 20,
      };
      await api(initialJob?.id ? `jobs/${initialJob.id}` : 'jobs', { method: initialJob?.id ? 'PATCH' : 'POST', token, body: payload });
      toast.success(initialJob?.id ? 'Job updated successfully!' : 'Job posted successfully!');
      onPosted?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden bg-slate-50 flex items-center justify-center px-1">
      <Card className="w-full max-w-[1320px] h-full max-h-full overflow-hidden rounded-3xl premium-card shadow-xl flex flex-col bg-white">
        <CardHeader className="shrink-0 border-b px-3 py-2 md:px-5 md:py-3 bg-gradient-to-r from-emerald-50 via-white to-indigo-50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" onClick={onPosted} className="h-8 w-8 shrink-0 rounded-full">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <CardTitle className="text-lg md:text-xl leading-tight">{initialJob?.id ? 'Edit job' : 'Post job'}</CardTitle>
                <CardDescription className="text-xs md:text-sm leading-snug truncate md:whitespace-normal">
                  Add work details, pay, location and hiring needs.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <motion.div animate={{ scale: step === 1 ? 1.18 : 1 }} className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-emerald-600' : 'bg-slate-300'}`} />
              <motion.div animate={{ scale: step === 2 ? 1.18 : 1 }} className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-emerald-600' : 'bg-slate-300'}`} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 overflow-hidden p-2 md:p-3 bg-white text-sm">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                onSubmit={nextStep}
                className="h-full min-h-0 flex flex-col justify-between gap-2"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-sm">Job title *</Label>
                    <Input className="h-9" value={f.title} onChange={e => setF(s => ({ ...s, title: e.target.value }))} placeholder="Enter role name, e.g. TIG Welder, CNC Operator" required />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-sm">Category *</Label>
                    <Select value={f.category} onValueChange={(v) => setF(s => ({ ...s, category: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select work category" /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm">Daily pay (₹) *</Label>
                    <Input className="h-9" type="number" value={f.daily_pay} onChange={e => setF(s => ({ ...s, daily_pay: e.target.value }))} min="1" required />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm">Duration (days) *</Label>
                    <Input className="h-9" type="number" value={f.duration_days} onChange={e => setF(s => ({ ...s, duration_days: e.target.value }))} min="1" required />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm">Start date *</Label>
                    <Input className="h-9" type="date" value={f.start_date} onChange={e => setF(s => ({ ...s, start_date: e.target.value }))} required />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm">Workers needed *</Label>
                    <Input className="h-9" type="number" value={f.workers_needed} onChange={e => setF(s => ({ ...s, workers_needed: e.target.value }))} min="1" required />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm">Post visible for (days) *</Label>
                    <Input className="h-9" type="number" value={f.post_valid_days} onChange={e => setF(s => ({ ...s, post_valid_days: e.target.value }))} min="1" max="60" required />
                  </div>
                </div>

                <Button type="submit" className="w-full h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.form>
            )}

            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                onSubmit={submit}
                className="h-full min-h-0 flex flex-col justify-between gap-2"
              >
                <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-2 pr-0">
                  <div className="md:col-span-12 space-y-1">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-emerald-900 flex items-center gap-2"><MapPin className="w-4 h-4" /> Attendance GPS point</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">Use current GPS only when you are at the company/site. Worker daily attendance will be marked automatically when their GPS is within the allowed distance.</p>
                        <p className="text-[11px] text-emerald-800 mt-1 truncate">{f.latitude && f.longitude ? `Saved GPS: ${formatCoordinates(f.latitude, f.longitude)} · Radius ${f.attendance_radius_meters || 20}m` : 'No exact GPS saved yet. Use current GPS while standing at the company/site.'}</p>
                      </div>
                      <Button type="button" size="sm" className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shrink-0" onClick={useCurrentJobGps}>
                        <MapPin className="w-4 h-4 mr-2" /> Use current GPS
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-sm">Attendance radius *</Label>
                        <Select value={String(f.attendance_radius_meters || 20)} onValueChange={(v) => setF(s => ({ ...s, attendance_radius_meters: Number(v) }))}>
                          <SelectTrigger className="h-9 rounded-xl border-emerald-200 bg-white">
                            <SelectValue placeholder="Select allowed distance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 meters</SelectItem>
                            <SelectItem value="20">20 meters</SelectItem>
                            <SelectItem value="25">25 meters</SelectItem>
                            <SelectItem value="50">50 meters</SelectItem>
                            <SelectItem value="100">100 meters</SelectItem>
                            <SelectItem value="200">200 meters</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-[11px] text-emerald-700 leading-snug">Employee attendance is marked automatically when their current GPS is inside this saved job radius. Manual attendance marking is not required.</p>
                    </div>
                  </div>

                  <div className="md:col-span-12 space-y-1">
                    <Label className="text-sm">Description *</Label>
                    <Textarea className="min-h-[44px] h-[44px] resize-none" value={f.description} onChange={e => setF(s => ({ ...s, description: e.target.value }))} placeholder="Work details, materials, shift timing, tools, safety rules and worker requirements." required />
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <Label className="text-sm">Shift timing *</Label>
                    <Select value={f.shift_timing} onValueChange={(v) => setF(s => ({ ...s, shift_timing: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day Shift (8AM-5PM)</SelectItem>
                        <SelectItem value="night">Night Shift (8PM-5AM)</SelectItem>
                        <SelectItem value="flexible">Flexible Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <Label className="text-sm">Experience needed *</Label>
                    <Select value={f.experience} onValueChange={(v) => setF(s => ({ ...s, experience: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner (0-1 year)</SelectItem>
                        <SelectItem value="intermediate">Intermediate (1-3 years)</SelectItem>
                        <SelectItem value="experienced">Experienced (3-5 years)</SelectItem>
                        <SelectItem value="expert">Expert (5+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <Label className="text-sm">Skill needed</Label>
                    <Input className="h-9" value={f.skill_needed} onChange={e => setF(s => ({ ...s, skill_needed: e.target.value }))} placeholder="TIG welding, CNC, helper, fitter" />
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <Label className="text-sm">Contact number *</Label>
                    <Input className="h-9" type="tel" value={f.contact_number} onChange={e => setF(s => ({ ...s, contact_number: e.target.value }))} placeholder="Workers can contact this number directly" required />
                  </div>

                  <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-5 gap-1.5">
                    {[
                      ['accommodation_available', 'Accommodation'],
                      ['food_included', 'Food'],
                      ['urgent_hiring', 'Urgent'],
                      ['overtime_available', 'Overtime'],
                      ['transportation_provided', 'Transport'],
                    ].map(([key, label]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setF(s => ({ ...s, [key]: typeof s[key] === 'boolean' ? !s[key] : (s[key] === 'yes' ? 'no' : 'yes') }))}
                        className={`h-8 rounded-xl border text-xs font-semibold transition ${((typeof f[key] === 'boolean' && f[key]) || f[key] === 'yes') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1.5 shrink-0 border-t bg-white">
                  <Button type="button" variant="outline" onClick={prevStep} className="h-10 rounded-xl border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button type="submit" disabled={busy} className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {initialJob?.id ? 'Update Job' : 'Publish Job'}
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function HiredJobs({ token, jobs, reload, onChat }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApp, setLoadingApp] = useState(false);
  const [attendance, setAttendance] = useState({});
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [completionDialogApp, setCompletionDialogApp] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [removingAppId, setRemovingAppId] = useState(null);

  // Show only jobs that already have an invited or confirmed worker.
  // The API now sends hired_count, so this tab updates correctly after employee acceptance.
  const hiredJobs = jobs.filter(j => (j.hired_count || j.ongoing_count || j.invitation_count || 0) > 0);

  useEffect(() => {
    reload?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Generate all job dates
  const getJobDates = (job) => {
    const start = job.start_date ? new Date(job.start_date) : new Date();
    const dates = [];
    for (let i = 0; i < (job.duration_days || 1); i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const getJobDateRange = (job) => {
    const start = job.start_date ? new Date(job.start_date) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + (job.duration_days || 1) - 1);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const getAttendanceForDate = (attRecs, date) => {
    return attRecs.find(a => (a.attendance_date || a.date) === date);
  };
  
  const openJobDetails = async (job) => {
    setSelectedJob(job);
    setLoadingApp(true);
    setApplicants([]); // Clear previous applicants
    try {
      const d = await api(`employer/jobs/${job.id}/applicants`, { token });
      if (!d || !d.applicants) {
        setApplicants([]);
        toast.error('Unable to load applicants');
        return;
      }
      const hiredApps = d.applicants.filter(a => a.status === 'ongoing' || a.status === 'accepted');
      setApplicants(hiredApps);
      
      // Load attendance data
      const attData = {};
      for (const app of hiredApps) {
        try {
          const att = await api(`applications/${app.id}/attendance`, { token });
          attData[app.id] = att.attendance || [];
        } catch (e) {
          console.log('Attendance load skipped for app', app.id);
          attData[app.id] = [];
        }
      }
      setAttendance(attData);
    } catch (e) {
      console.error('Error loading applicants:', e);
      toast.error(e.message || 'Failed to load applicants');
      setApplicants([]);
    } finally {
      setLoadingApp(false);
    }
  };

  const markAttendance = async (appId, date, status) => {
    setMarkingAttendance(true);
    try {
      if (!date) {
        toast.error('Please select a date first');
        setMarkingAttendance(false);
        return;
      }
      const response = await api(`applications/${appId}/attendance`, {
        method: 'POST',
        token,
        body: { date, status }
      });
      toast.success(`Attendance marked as ${status} for ${new Date(date).toLocaleDateString()}`);
      setSelectedDate(null);
      if (selectedJob) openJobDetails(selectedJob);
    } catch (e) {
      console.error('Attendance error:', e);
      toast.error(e.message || 'Failed to mark attendance');
    } finally {
      setMarkingAttendance(false);
    }
  };

  const completeJobWithPayment = async (appId) => {
    setProcessingPayment(true);
    try {
      // Mark application as completed
      await api(`applications/${appId}`, {
        method: 'PATCH',
        token,
        body: { status: 'completed' }
      });
      
      toast.success('✅ Job marked as completed! Payment processed.');
      setCompletionDialogApp(null);
      
      // Reload to refresh the UI
      setTimeout(() => {
        if (selectedJob) openJobDetails(selectedJob);
        reload?.();
      }, 1000);
    } catch (e) {
      console.error('Completion error:', e);
      toast.error(e.message || 'Failed to complete job');
    } finally {
      setProcessingPayment(false);
    }
  };

  const removeHiredWorker = async (app) => {
    if (!app?.id) return;
    const worker = app.workers?.user_profiles || {};
    const ok = confirm(`Remove ${worker.full_name || worker.email || 'this employee'} from this hired job?`);
    if (!ok) return;
    try {
      setRemovingAppId(app.id);
      await api(`applications/${app.id}`, { method: 'DELETE', token });
      toast.success('Employee removed from hired job');
      if (selectedJob) await openJobDetails(selectedJob);
      reload?.();
    } catch (e) {
      toast.error(e.message || 'Failed to remove employee');
    } finally {
      setRemovingAppId(null);
    }
  };

  const getHiredCount = (job) => {
    return job.hired_count || job.applications?.filter(a => a.status === 'ongoing' || a.status === 'accepted').length || 0;
  };

  return (
    <div className="space-y-4">
      {selectedJob ? (
        <>
          {/* Back Button & Header */}
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedJob(null)}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to jobs
            </Button>
          </div>

          {/* Job Details Card */}
          <Card className="rounded-3xl premium-card border-emerald-100">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedJob.location_text} · {selectedJob.duration_days} days · {fmtMoney(selectedJob.daily_pay)}/day
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium">{getJobDateRange(selectedJob)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-medium">{selectedJob.duration_days} working days</span>
                    </div>
                  </div>
                </div>
                <Badge className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                  {applicants.length} Hired
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Hired Workers List */}
          <div className="space-y-3">
            <h3 className="font-bold text-lg">Hired Workers ({applicants.length})</h3>
            
            {loadingApp ? (
              <div className="py-12 grid place-items-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : applicants.length === 0 ? (
              <Card className="rounded-2xl border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No hired workers yet for this job.
                </CardContent>
              </Card>
            ) : (
              applicants.map(app => {
                const worker = app.workers?.user_profiles || {};
                const attRecs = attendance[app.id] || [];
                const jobDates = getJobDates(selectedJob);
                const presentDays = attRecs.filter(a => a.status === 'present').length;
                const absentDays = attRecs.filter(a => a.status === 'absent').length;
                const unMarkedDays = jobDates.length - attRecs.length;
                const canMarkAttendance = app.status === 'ongoing';

                return (
                  <Card key={app.id} className="rounded-2xl premium-card border-emerald-100 hover:border-emerald-300 transition overflow-hidden">
                    <CardContent className="p-4">
                      {/* Worker Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={worker.photo_url} />
                            <AvatarFallback>{initials(worker.full_name || worker.email)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{worker.full_name || worker.email}</p>
                            <p className="text-xs text-muted-foreground">{(app.workers?.skills || []).join(', ') || 'No skills'}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {app.workers?.experience_years || 0}y exp · ₹{app.workers?.expected_daily_wage || 0}/day
                            </p>
                          </div>
                        </div>
                        <Badge
                          className='bg-emerald-600 hover:bg-emerald-700'
                        >
                          Active - Working
                        </Badge>
                      </div>

                      {/* Attendance Summary */}
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 p-3 text-center">
                          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                            {presentDays}
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Present
                          </p>
                        </div>
                        <div className="rounded-xl bg-red-50 dark:bg-red-950 p-3 text-center">
                          <p className="text-xl font-bold text-red-700 dark:text-red-300">
                            {absentDays}
                          </p>
                          <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                            Absent
                          </p>
                        </div>
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-950 p-3 text-center">
                          <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                            {unMarkedDays}
                          </p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            Unmarked
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-center">
                          <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                            {jobDates.length}
                          </p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                            Total Days
                          </p>
                        </div>
                      </div>

                      {/* Status Note */}
                      {!canMarkAttendance && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-700">
                          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                            ⏳ Waiting for employee acceptance
                          </p>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Once the employee accepts the job, you can start marking attendance.
                          </p>
                        </div>
                      )}

                      {/* Detailed Attendance Calendar */}
                      <div className="mb-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Job Schedule & Attendance</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {jobDates.map((date) => {
                            const attRec = getAttendanceForDate(attRecs, date);
                            const d = new Date(date);
                            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = d.getDate();
                            
                            return (
                              <div
                                key={date}
                                className={`min-h-[96px] p-4 rounded-2xl border text-center transition-all duration-200 shadow-sm hover:shadow-lg ${
                                  canMarkAttendance ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-not-allowed opacity-60'
                                } ${
                                  (attRec?.status === 'present' || attRec?.status === 'completed')
                                    ? 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-slate-900 border-emerald-400 dark:border-emerald-500 shadow-emerald-100 dark:shadow-none'
                                    : attRec?.status === 'absent'
                                    ? 'bg-gradient-to-br from-red-50 to-white dark:from-red-950 dark:to-slate-900 border-red-400 dark:border-red-500 shadow-red-100 dark:shadow-none'
                                    : 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700'
                                }`}
                                onClick={() => canMarkAttendance && setSelectedDate(selectedDate === date ? null : date)}
                              >
                                <p className="text-[11px] font-bold tracking-[0.18em] text-slate-500 dark:text-slate-300 uppercase">
                                  {dayName}
                                </p>
                                <p className="text-2xl font-black my-2 text-slate-950 dark:text-white">
                                  {dayNum}
                                </p>
                                {(attRec?.status === 'present' || attRec?.status === 'completed') && (
                                  <div className="inline-flex items-center justify-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-3 py-1">
                                    <Check className="w-4 h-4 text-emerald-600" />
                                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                      Completed
                                    </span>
                                  </div>
                                )}
                                {attRec?.status === 'absent' && (
                                  <div className="inline-flex items-center justify-center gap-1 rounded-full bg-red-100 dark:bg-red-900/60 px-3 py-1">
                                    <X className="w-4 h-4 text-red-600" />
                                    <span className="text-[10px] font-semibold text-red-700 dark:text-red-300">
                                      Absent
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* GPS Auto Attendance Notice */}
                      {selectedDate && canMarkAttendance && (
                        <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700">
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                            GPS auto attendance for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-300">
                            Attendance is marked automatically from the employee Ongoing job GPS check-in when they are inside the employer selected radius. Manual attendance marking is disabled.
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => setSelectedDate(null)}
                          >
                            Close
                          </Button>
                        </div>
                      )}

                      {/* Buttons Row */}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 text-emerald-700 hover:bg-emerald-50"
                          onClick={() =>
                            onChat?.({
                              peer_id: app.worker_id,
                              peer_name: worker.full_name || worker.email,
                              peer_photo: worker.photo_url,
                              peer_role: 'worker',
                            })
                          }
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Message
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={removingAppId === app.id}
                          className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => removeHiredWorker(app)}
                        >
                          {removingAppId === app.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Remove
                        </Button>

                        {/* Complete & Pay Button */}
                        {app.status === 'ongoing' && (
                          <Button
                            size="sm"
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            onClick={() => setCompletionDialogApp(app)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Complete & Pay
                          </Button>
                        )}

                        {app.status === 'completed' && (
                          <Button
                            size="sm"
                            disabled
                            className="flex-1 bg-green-100 text-green-700 hover:bg-green-100"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Completed
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          {/* Job Selection View */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Hired Workers</h2>
            <Button size="sm" variant="outline" onClick={reload}>
              Refresh
            </Button>
          </div>

          {hiredJobs.length === 0 ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No jobs with hired workers yet.</p>
                <p className="text-xs mt-1">Accept applicants in the Jobs tab first.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {hiredJobs.map(job => {
                const hiredCnt = getHiredCount(job);
                return (
                  <Card
                    key={job.id}
                    className="rounded-3xl border-emerald-100 hover:border-emerald-300 hover:shadow-xl transition cursor-pointer"
                    onClick={() => openJobDetails(job)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{job.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {job.location_text} · {job.duration_days}d
                          </p>
                        </div>
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                          {hiredCnt} hired
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="rounded-xl bg-emerald-50 text-emerald-700 px-2 py-2 font-bold">
                          <Banknote className="w-3 h-3 inline mr-1" />
                          {fmtMoney(job.daily_pay)}/day
                        </span>
                        <span className="rounded-xl bg-slate-50 px-2 py-2">
                          <Users className="w-3 h-3 inline mr-1" />
                          {job.workers_needed || 1} needed
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Completion Dialog with Bank Details */}
      {completionDialogApp && (
        <Dialog open={!!completionDialogApp} onOpenChange={(o) => !o && setCompletionDialogApp(null)}>
          <DialogContent className="max-w-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Complete Job & Process Payment</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Worker Info */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Worker Information</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-semibold">{completionDialogApp?.workers?.user_profiles?.full_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-semibold">{completionDialogApp?.workers?.user_profiles?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-semibold">{completionDialogApp?.workers?.user_profiles?.email || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-3">Payment Calculation</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400">Daily Rate:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">{fmtMoney(selectedJob?.daily_pay || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400">Total Days:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">{selectedJob?.duration_days || 0}d</span>
                  </div>
                  <div className="border-t border-emerald-200 dark:border-emerald-700 pt-2 flex justify-between">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">Total Payment:</span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmtMoney((selectedJob?.daily_pay || 0) * (selectedJob?.duration_days || 0))}</span>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-700">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-3">Bank Account Details</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600 dark:text-blue-400">Account Holder:</span>
                    <span className="font-semibold">{completionDialogApp?.workers?.account_holder_name || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600 dark:text-blue-400">Bank Name:</span>
                    <span className="font-semibold">{completionDialogApp?.workers?.bank_name || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600 dark:text-blue-400">Account Number:</span>
                    <span className="font-mono font-bold">{completionDialogApp?.workers?.bank_account || 'Not provided'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600 dark:text-blue-400">IFSC Code:</span>
                    <span className="font-mono font-bold">{completionDialogApp?.workers?.ifsc_code || 'Not provided'}</span>
                  </div>
                  {completionDialogApp?.workers?.upi_id && (
                    <div className="flex justify-between">
                      <span className="text-blue-600 dark:text-blue-400">UPI ID:</span>
                      <span className="font-mono font-bold">{completionDialogApp.workers.upi_id}</span>
                    </div>
                  )}

                  {completionDialogApp?.workers?.bank_qr_url && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-3 text-center">
                      <p className="text-xs font-bold text-blue-700 mb-2">Worker Payment QR</p>
                      <img
                        src={completionDialogApp.workers.bank_qr_url}
                        alt="Worker payment QR"
                        className="mx-auto h-48 w-48 rounded-xl object-contain border bg-white p-2 shadow-sm"
                      />
                      <a
                        href={completionDialogApp.workers.bank_qr_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Open QR full size
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation Message */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-700">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  ✅ Payment will be transferred to the account above. Click confirm to complete the job.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCompletionDialogApp(null)}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                disabled={processingPayment}
                onClick={() => completeJobWithPayment(completionDialogApp.id)}
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirm & Complete Job
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


function EmployerProfile({ token, me, onSaved, onLogout }) {
  const [f,setF]=useState({});
const [busy,setBusy]=useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finalSaved, setFinalSaved] = useState(false);

const [savedData,setSavedData]=useState({});
const [hasChanges,setHasChanges]=useState(false);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  useEffect(()=>{

if(me){

const profileData={

full_name:me.profile?.full_name || '',
phone:me.profile?.phone || '',
company_name:me.extra?.company_name || '',
industry:me.extra?.industry || '',
company_size:me.extra?.company_size || '',
hr_contact:me.extra?.hr_contact || '',
official_email:me.extra?.official_email || '',
location_text:me.extra?.location_text || '',
latitude:me.extra?.latitude || '',
longitude:me.extra?.longitude || '',
place_id:me.extra?.place_id || '',
place_name:me.extra?.place_name || '',
description:me.extra?.description || '',
company_address:me.extra?.company_address || '',
gst_number:me.extra?.gst_number || '',
pan_number:me.extra?.pan_number || '',
account_holder_name:me.extra?.account_holder_name || '',
bank_name:me.extra?.bank_name || '',
bank_account:me.extra?.bank_account || '',
ifsc_code:me.extra?.ifsc_code || '',
branch_name:me.extra?.branch_name || '',
upi_id:me.extra?.upi_id || '',
bank_qr_url:me.extra?.bank_qr_url || '',
pan_image_url:me.extra?.pan_image_url || '',
pan_back_url:me.extra?.pan_back_url || '',
gst_certificate_url:me.extra?.gst_certificate_url || '',
mobile_verified: !!me.extra?.mobile_verified,
selfie_url: me.extra?.selfie_url || '',
selfie_front_url: me.extra?.selfie_front_url || '',
selfie_left_url: me.extra?.selfie_left_url || '',
selfie_right_url: me.extra?.selfie_right_url || '',
selfie_verified: !!me.extra?.selfie_verified,
selfie_verified_at: me.extra?.selfie_verified_at || '',
verification_status: me.extra?.verification_status || (me.extra?.verified ? 'verified' : 'not_submitted'),
language:me.profile?.language || 'en'

};

setF(profileData);
setSavedData(profileData);

}

},[me]);

useEffect(() => {
  if (!me) return;
  setFinalSaved(localStorage.getItem(finalProfileSaveKey(me, 'employer')) === 'saved');
}, [me]);

useEffect(()=>{

const changed=

JSON.stringify(f)!==
JSON.stringify(savedData);

setHasChanges(changed);

// Employer final Save must behave like employee profile: when profile data changes,
// the disabled Saved state should clear so the button can become Save again after re-verification.
if (changed && finalSaved) {
  localStorage.removeItem(finalProfileSaveKey(me, 'employer'));
  setFinalSaved(false);
}

},[f,savedData,finalSaved,me]);

  const loadAttendanceRows = async () => {
    if (!token) return;
    setAttendanceLoading(true);
    try {
      const d = await api('employer/attendance', { token });
      setAttendanceRows(d.items || []);
    } catch (e) {
      toast.error(e.message || 'Unable to load attendance details');
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceRows();
  }, [token]);

  const markAttendanceFromProfile = async (applicationId, date, status) => {
    if (!applicationId || !date) return toast.error('Attendance date missing');
    setAttendanceLoading(true);
    try {
      await api(`applications/${applicationId}/attendance`, {
        method: 'POST',
        token,
        body: { date, status },
      });
      toast.success(`Attendance marked ${status} for ${new Date(date).toLocaleDateString()}`);
      await loadAttendanceRows();
    } catch (e) {
      toast.error(e.message || 'Unable to mark attendance');
      setAttendanceLoading(false);
    }
  };



  const buildEmployerProfilePayload = () => ({
    full_name: f.full_name || '',
    phone: f.phone || '',
    company_name: f.company_name || '',
    industry: f.industry || '',
    company_size: f.company_size || '',
    hr_contact: f.hr_contact || '',
    official_email: f.official_email || '',
    company_address: f.company_address || '',
    gst_number: f.gst_number || '',
    pan_number: f.pan_number || '',
    location_text: f.location_text || '',
    latitude: f.latitude || null,
    longitude: f.longitude || null,
    place_id: f.place_id || '',
    place_name: f.place_name || '',
    description: f.description || '',
  });

  const buildEmployerDocumentPayload = () => ({
    pan_number: f.pan_number || '',
    gst_number: f.gst_number || '',
    pan_image_url: f.pan_image_url || '',
    pan_back_url: f.pan_back_url || '',
    gst_certificate_url: f.gst_certificate_url || '',
  });

  const buildEmployerBankPayload = () => ({
    account_holder_name: f.account_holder_name || '',
    bank_name: f.bank_name || '',
    bank_account: f.bank_account || '',
    ifsc_code: (f.ifsc_code || '').toUpperCase().replace(/\s/g, ''),
    branch_name: f.branch_name || '',
    upi_id: f.upi_id || '',
    bank_qr_url: f.bank_qr_url || '',
  });

  const requireEmployerBank = () => {
    if (!f.account_holder_name?.trim()) return 'Enter account holder name';
    if (!f.bank_name?.trim()) return 'Enter bank name';
    if (!f.bank_account?.trim()) return 'Enter account number';
    if (!f.ifsc_code?.trim()) return 'Enter IFSC code';
    return '';
  };

  const requireEmployerDocuments = () => {
    if (!f.pan_image_url || !f.pan_back_url) return 'Upload company PAN front and back';
    if (!f.gst_certificate_url) return 'Upload GST certificate';
    return '';
  };

  const employerProfileReviewStatus = sectionReviewState(me, 'profile', me?.extra?.verification_status, !!me.extra?.verified);
  const employerProfileChangedAfterReview = (employerProfileReviewStatus === 'pending' || employerProfileReviewStatus === 'verified') && hasVerifySectionChanged(EMPLOYER_PROFILE_VERIFY_FIELDS, buildEmployerProfilePayload(), me?.profile || {}, me?.extra || {});
  const employerDocumentReviewStatus = sectionReviewState(me, 'documents', me?.extra?.verification_status, !!me.extra?.verified);
  const employerDocumentChangedAfterReview = (employerDocumentReviewStatus === 'pending' || employerDocumentReviewStatus === 'verified') && hasVerifySectionChanged(EMPLOYER_DOCUMENT_VERIFY_FIELDS, buildEmployerDocumentPayload(), me?.profile || {}, me?.extra || {});

  // Employer final save follows the working employee profile pattern, without removed employer bank/mobile checks.
  // Required cards: Company/Profile approval + Documents approval + Selfie verified.
  // Important: employer admin can approve the whole employer profile through the existing final verified flag.
  // Treat that final approval as profile+document verified unless the user edited those sections again.
  const employerSelfieCardVerified = !!(
    f.selfie_verified ||
    me?.extra?.selfie_verified ||
    me?.extra?.selfie_status === 'verified' ||
    me?.extra?.selfie_verification_status === 'verified'
  );
  const employerProfileRawStatus = sectionReviewState(me, 'profile', me?.extra?.verification_status, !!me.extra?.verified);
  const employerDocumentRawStatus = sectionReviewState(me, 'documents', me?.extra?.verification_status, !!me.extra?.verified);
  const employerGloballyVerified = !!me?.extra?.verified && me?.extra?.verification_status === 'verified';
  // Final Save button must follow the visible card status. If cards show Done/Verified, Save must work.
  // Do not block final Save because of stale local comparison data after admin approval or page refresh.
  const employerProfileCardVerified = employerProfileRawStatus === 'verified' || employerGloballyVerified;
  const employerDocumentCardVerified = employerDocumentRawStatus === 'verified' || employerGloballyVerified;
  const employerAllProfileCardsVerified = employerProfileCardVerified && employerDocumentCardVerified && employerSelfieCardVerified;
  const employerAnyProfileCardPending = [employerProfileRawStatus, employerDocumentRawStatus].some((s) => s === 'pending') || employerProfileChangedAfterReview || employerDocumentChangedAfterReview;
  const employerTopStatus = finalSaved && employerAllProfileCardsVerified ? 'verified' : employerAnyProfileCardPending ? 'pending' : 'unverified';

  useEffect(() => {
    if (!employerAllProfileCardsVerified && finalSaved) {
      localStorage.removeItem(finalProfileSaveKey(me, 'employer'));
      setFinalSaved(false);
    }
  }, [employerAllProfileCardsVerified, finalSaved, me]);

  const save = async () => {
    if (!employerAllProfileCardsVerified) {
      toast.error('Verify all required profile cards before final save');
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...buildEmployerProfilePayload(),
        ...buildEmployerDocumentPayload(),
        selfie_url: f.selfie_url || f.selfie_front_url || me?.extra?.selfie_url || me?.extra?.selfie_front_url || '',
        selfie_front_url: f.selfie_front_url || f.selfie_url || me?.extra?.selfie_front_url || me?.extra?.selfie_url || '',
        selfie_left_url: f.selfie_left_url || me?.extra?.selfie_left_url || '',
        selfie_right_url: f.selfie_right_url || me?.extra?.selfie_right_url || '',
        selfie_verified: !!(f.selfie_verified || me?.extra?.selfie_verified),
        selfie_verified_at: f.selfie_verified_at || me?.extra?.selfie_verified_at || null,
        mobile_verified: !!(f.mobile_verified || me?.extra?.mobile_verified),
        language: f.language || me?.profile?.language || 'en',
        verified: true,
        verification_status: 'verified',
      };

      const saved = await api('me/profile', { method: 'PATCH', token, body });
      localStorage.setItem(finalProfileSaveKey(me, 'employer'), 'saved');
      const savedExtra = saved?.extra || {};
      setF((prev) => ({ ...prev, ...body, ...savedExtra }));
      setSavedData((prev) => ({ ...prev, ...body, ...savedExtra }));
      setHasChanges(false);
      setFinalSaved(true);
      toast.success('Profile saved');
      await onSaved?.();
    } catch (e) {
      toast.error(e.message || 'Unable to save employer profile');
    } finally {
      setBusy(false);
    }
  };

  const saveCompanyLocation = async (loc) => {
    const nextStatus = me.extra?.verified
      ? 'pending'
      : (f.verification_status === 'pending' || f.verification_status === 'submitted' ? 'pending' : 'saved');
    const body = {
      location_text: loc.location_text || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      place_id: loc.place_id || f.place_id || '',
      place_name: loc.place_name || f.place_name || '',
      verification_status: nextStatus,
      verification_section: 'location',
    };
    await api('me/profile', { method: 'PATCH', token, body });
    setF((s) => ({ ...s, ...body }));
    setSavedData((s) => ({ ...s, ...body }));
    // Keep the location card saved/closed after refresh; do not reopen or mark unsaved just because location was saved.
    await onSaved();
  };

  const useCompanyCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not supported on this device');
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const locationText = f.location_text?.trim() || `GPS: ${formatCoordinates(latitude, longitude)}`;
        const next = { ...f, latitude, longitude, location_text: locationText };
        setF(next);
        try {
          await api('me/profile', { method: 'PATCH', token, body: next });
          toast.success('Company location saved');
          onSaved();
        } catch (e) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      },
      () => {
        toast.error('Please allow location permission to save company location');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };


  const deleteAccount = async () => {
    const first = confirm('Are you sure you want to permanently delete your account?');
    if (!first) return;

    const second = confirm('This will remove your account and data from Work2Wish permanently. This cannot be undone. Continue?');
    if (!second) return;

    setBusy(true);
    try {
      await api('me/account', { method: 'DELETE', token });
      toast.success('Account deleted successfully');
      onLogout();
    } catch (e) {
      toast.error(e.message || 'Failed to delete account');
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <div className="py-12 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card className="profile-section-card">
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
              {employerTopStatus === 'verified' ? (
                <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verified</Badge>
              ) : employerTopStatus === 'pending' ? (
                <Badge className="border border-amber-200 bg-amber-50 text-amber-700 shadow-sm"><Clock className="w-3.5 h-3.5 mr-1" /> Pending</Badge>
              ) : (
                <Badge className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm"><XCircle className="w-3.5 h-3.5 mr-1" /> Unverified</Badge>
              )}
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

      <VerificationDocumentsCard
        token={token}
        me={me}
        role="employer"
        verified={!!me.extra?.verified}
        form={f}
        setForm={setF}
        onSaved={onSaved}
        color="emerald"
      />

      <Card className="profile-section-card overflow-hidden">
        <CardHeader className="profile-section-header"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><CardTitle className="text-base">Company profile</CardTitle><CardDescription>Company details, address and hiring information.</CardDescription></div></div></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field label="Your name"   v={f.full_name}    on={(v) => setF(s => ({ ...s, full_name: v }))} />
          <Field label="Phone"       v={f.phone}        on={(v) => setF(s => ({ ...s, phone: v }))} />
          <Field label="Company"     v={f.company_name} on={(v) => setF(s => ({ ...s, company_name: v }))} />
          <Field label="Industry type"    v={f.industry}     on={(v) => setF(s => ({ ...s, industry: v }))} />
          <Field label="HR contact person" v={f.hr_contact} on={(v) => setF(s => ({ ...s, hr_contact: v }))} />
          <Field label="Official email" v={f.official_email} on={(v) => setF(s => ({ ...s, official_email: v }))} type="email" />
          <div>
            <Label>Company size</Label>
            <Select value={f.company_size || ''} onValueChange={(v) => setF(s => ({ ...s, company_size: v }))}>
              <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
              <SelectContent><SelectItem value="1-10">1-10 employees</SelectItem><SelectItem value="11-50">11-50 employees</SelectItem><SelectItem value="51-200">51-200 employees</SelectItem><SelectItem value="200+">200+ employees</SelectItem></SelectContent>
            </Select>
          </div>
          <Field label="GST number" v={f.gst_number} on={(v) => setF(s => ({ ...s, gst_number: v }))} />
          <Field label="Company PAN" v={f.pan_number} on={(v) => setF(s => ({ ...s, pan_number: v }))} />
          <div className="sm:col-span-2">
            <Label>Office address / registered address</Label>
            <Textarea rows={3} value={f.company_address || ''} onChange={(e) => setF(s => ({ ...s, company_address: e.target.value }))} placeholder="Manual typing only: door no, street, area, city, state, pincode" />
            <p className="text-xs text-muted-foreground mt-1">This address field is manual only. GPS is selected separately below.</p>
          </div>
          <div className="sm:col-span-2 space-y-3">

            <SavedLocationEditor
              label="Company GPS location"
              value={f.location_text || ''}
              latitude={f.latitude}
              longitude={f.longitude}
              color="emerald"
              placeholder="Search and choose company area, landmark, or current location"
              helper="Search, pin, or use current GPS to save the exact company location for nearby worker matching."
              onChange={(loc) => setF(s => ({ ...s, ...loc }))}
              onSave={saveCompanyLocation}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>About</Label>
            <Textarea rows={3} value={f.description || ''} onChange={(e) => setF(s => ({ ...s, description: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Card className="profile-section-card overflow-hidden border-emerald-100">
              <CardHeader className="profile-section-header">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Identity checks</CardTitle>
                    <CardDescription>Mobile and selfie verification, same as employee profile flow.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid lg:grid-cols-2 gap-4 items-stretch">
                <MobileOtpVerificationBox token={token} phone={f.phone} verified={!!me.extra?.mobile_verified} onVerified={(phone) => { setF(s => ({ ...s, phone: phone || s.phone, mobile_verified: true })); onSaved?.(); }} />
                <SelfieVerificationBox token={token} url={f.selfie_url || me.extra?.selfie_url} frontUrl={f.selfie_front_url || me.extra?.selfie_front_url} leftUrl={f.selfie_left_url || me.extra?.selfie_left_url} rightUrl={f.selfie_right_url || me.extra?.selfie_right_url} verified={!!(f.selfie_verified || me.extra?.selfie_verified)} disabled={busy} onUploaded={(payload) => { setF(s => ({ ...s, ...(typeof payload === 'string' ? { selfie_url: payload, selfie_verified: true } : { selfie_url: payload.selfie_url || payload.selfie_front_url || payload.url || '', selfie_verified: true }), selfie_verified: true, verification_status: 'verified' })); setFinalSaved(false); onSaved?.(); }} />
              </CardContent>
            </Card>
          </div>
          <div className="sm:col-span-2">
            <SectionVerificationAction
              token={token}
              me={me}
              section="profile"
              title="Admin approval required"
              description="Admin checks your company profile details and marks the profile verified."
              color="emerald"
              setForm={setF}
              onSaved={onSaved}
              disabled={!String(f.full_name || '').trim() || !String(f.company_name || '').trim() || !String(f.phone || '').trim()}
              validate={() => {
                if (!String(f.full_name || '').trim()) return 'Enter your name';
                if (!String(f.company_name || '').trim()) return 'Enter company name';
                if (!String(f.phone || '').trim()) return 'Enter phone number';
                return '';
              }}
              payloadBuilder={buildEmployerProfilePayload}
              modified={employerProfileChangedAfterReview}
            />
          </div>
        </CardContent>
      </Card>


      {/* Employee attendance details removed from profile. Attendance is managed from Hired/Ongoing pages only. */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          onClick={save}
          disabled={busy || !employerAllProfileCardsVerified || finalSaved}
          className="h-12 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:!opacity-100 disabled:cursor-not-allowed disabled:bg-emerald-600 disabled:text-white"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : finalSaved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
          {finalSaved ? 'Saved' : 'Save profile'}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setSettingsOpen(true)}
          className="h-12 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
        >
          <ShieldCheck className="w-4 h-4 mr-2" />
          Account settings
        </Button>
        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Account settings</SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Signed in as</p>
                <p className="text-sm text-muted-foreground truncate mt-1">{me.profile?.email}</p>
                {me.profile?.login_id && (
                  <p className="text-xs text-emerald-700 mt-2">Login ID: <b>{me.profile.login_id}</b></p>
                )}
              </div>

              <div className="rounded-2xl border p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">Quick actions</p>
                <AccountActivitySheet token={token} accent="emerald" />
                <Button
                  type="button"
                  onClick={onLogout}
                  disabled={busy}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={deleteAccount}
                  disabled={busy}
                  className="w-full"
                >
                  Delete Account Permanently
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
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
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(peerHint || null);
  const [query, setQuery] = useState('');
  const [authError, setAuthError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profileView, setProfileView] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const loadThreads = async () => {
    if (!token) {
      setLoading(false);
      setAuthError('Session is not ready. Please logout and login again.');
      return;
    }
    setLoading(true);
    setAuthError('');
    try {
      const d = await api('chat/threads', { token });
      const list = d.threads || [];
      setThreads(list);
      if (!active && !peerHint && list.length > 0) setActive(list[0]);
    } catch (e) {
      if (String(e.message || '').toLowerCase().includes('unauthorized')) {
        setAuthError('Chat session expired. Please logout and login again.');
      } else {
        toast.error(e.message || 'Unable to load chats');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadThreads(); }, [token]);
  useEffect(() => { if (peerHint?.peer_id) setActive(peerHint); }, [peerHint?.peer_id]);

  useEffect(() => {
    if (!me?.id || !token) return;
    try {
      const supa = getSupabase();
      supa.realtime.setAuth(token);
      const ch = supa.channel(`thread-list-${me.id}`)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me.id}` },
            () => loadThreads())
        .subscribe();
      return () => { supa.removeChannel(ch); };
    } catch { return undefined; }
  }, [me?.id, token]);

  const openProfileDetails = async (profileId) => {
    if (!profileId) return;
    try { setProfileView(await api(`profiles/${profileId}`, { token })); } catch (e) { toast.error(e.message); }
  };

  const filteredThreads = threads.filter((t) =>
    `${t.peer_name || ''} ${t.last_message?.content || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || !token) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const d = await api(`users/search?q=${encodeURIComponent(term)}`, { token });
        setSearchResults((d.users || []).filter(u => !threads.some(t => t.peer_id === u.peer_id)));
      } catch { setSearchResults([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, token, threads.length]);

  return (
    <div className="h-full min-h-0 overflow-hidden bg-white p-0">
      <Card className="h-full max-w-7xl mx-auto overflow-hidden rounded-none md:rounded-2xl border-slate-200 shadow-none md:shadow-sm bg-white">
        <CardContent className="h-full p-0">
          <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[340px_1fr] bg-white">
            <aside className={`${active ? 'hidden md:flex' : 'flex'} h-full min-h-0 border-r bg-white flex-col`}>
              <div className="shrink-0 p-4 border-b bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Chats</h2>
                    <p className="text-[11px] text-slate-500">Select a conversation to continue.</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={loadThreads} className="rounded-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type worker or company name to start chat" className="pl-9 rounded-full bg-slate-100 border-slate-100" />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                {authError && (
                  <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    {authError}
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="p-3 border-b bg-slate-50 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">People and companies</p>
                    {searchResults.map(u => (
                      <button key={u.peer_id} type="button" onClick={() => { setActive(u); setQuery(''); setSearchResults([]); }} className="w-full rounded-2xl border bg-white p-3 text-left flex items-center gap-3 hover:shadow-md transition">
                        <Avatar className="w-10 h-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); u.peer_photo ? setPhotoPreview({ photo: u.peer_photo, title: u.peer_name }) : openProfileDetails(u.peer_id); }}><AvatarImage src={u.peer_photo} /><AvatarFallback>{initials(u.peer_name)}</AvatarFallback></Avatar>
                        <div className="min-w-0"><p onClick={(e) => { e.stopPropagation(); openProfileDetails(u.peer_id); }} className="font-semibold truncate hover:underline">{u.peer_name}</p><p className="text-xs text-slate-500 truncate">{u.peer_role === 'employer' ? 'Company' : 'Worker'} · {u.location_text || u.email || ''}</p></div>
                      </button>
                    ))}
                  </div>
                )}
                {loading && <div className="py-12 grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>}
                {!loading && !authError && filteredThreads.length === 0 && !peerHint && (
                  <div className="m-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                    <p className="font-semibold">No conversations yet</p>
                    <p className="text-sm text-slate-500 mt-1">Type a worker or company name above, select the profile, then start chatting.</p>
                  </div>
                )}

                {filteredThreads.map(t => {
                  const selected = active?.peer_id === t.peer_id;
                  return (
                    <button
                      key={t.peer_id}
                      type="button"
                      onClick={() => setActive(t)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-slate-100 ${selected ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      <Avatar className="w-11 h-11 shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); t.peer_photo ? setPhotoPreview({ photo: t.peer_photo, title: t.peer_name }) : openProfileDetails(t.peer_id); }}>
                        <AvatarImage src={t.peer_photo} />
                        <AvatarFallback className="bg-emerald-100 text-emerald-700">{initials(t.peer_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p onClick={(e) => { e.stopPropagation(); openProfileDetails(t.peer_id); }} className="font-semibold truncate text-slate-900 hover:underline">{t.peer_name || 'Unknown user'}</p>
                          {t.last_message && <span className="text-[11px] text-slate-500 shrink-0">{new Date(t.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        <p className="text-sm text-slate-500 truncate mt-0.5">{t.last_message?.content || 'Start a conversation'}</p>
                      </div>
                      {t.unread_count > 0 && <span className="inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">{t.unread_count}</span>}
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="hidden md:flex h-full min-h-0 min-w-0 bg-white">
              {active ? (
                <ChatThread token={token} me={me} peer={active} onBack={() => setActive(null)} color={color} onProfile={() => openProfileDetails(active?.peer_id)} />
              ) : (
                <div className="flex-1 grid place-items-center text-center p-8 bg-white">
                  <div>
                    <div className="w-24 h-24 rounded-3xl bg-slate-50 mx-auto grid place-items-center shadow-sm"><MessageSquare className="w-10 h-10 text-slate-500" /></div>
                    <h3 className="text-xl font-bold mt-5">Work2Wish Chat</h3>
                    <p className="text-sm text-slate-500 mt-2">Choose a chat from the left panel.</p>
                  </div>
                </div>
              )}
            </section>

            <section className={`${active ? 'flex' : 'hidden'} md:hidden h-full min-h-0 bg-white`}>
              {active && <ChatThread token={token} me={me} peer={active} onBack={() => setActive(null)} color={color} onProfile={() => openProfileDetails(active?.peer_id)} />}
            </section>
          </div>
        </CardContent>
      </Card>
      <ProfileDetailsDialog data={profileView} onClose={() => setProfileView(null)} onChat={(peer) => setActive(peer)} />
      <PhotoPreviewDialog photo={photoPreview?.photo} title={photoPreview?.title} onClose={() => setPhotoPreview(null)} />
    </div>
  );
}

function ChatThread({ token, me, peer, onBack, color, onProfile }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const scrollRef = useRef(null);

  const load = async () => {
    if (!token || !peer?.peer_id) return;
    setError('');
    try {
      const d = await api(`messages?peer=${peer.peer_id}`, { token });
      setMessages(d.messages || []);
      api('messages/mark-read', { method: 'POST', token, body: { peer_id: peer.peer_id } }).catch(() => {});
    } catch (e) {
      if (String(e.message || '').toLowerCase().includes('unauthorized')) {
        setError('Chat session expired. Please logout and login again.');
      } else {
        setError(e.message || 'Unable to load messages');
      }
    }
  };

  useEffect(() => { load(); }, [peer?.peer_id, token]);

  useEffect(() => {
    if (!me?.id || !peer?.peer_id || !token) return;
    try {
      const supa = getSupabase();
      supa.realtime.setAuth(token);
      const ch = supa.channel(`thread-${me.id}-${peer.peer_id}`)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me.id}` },
            (payload) => {
              const m = payload.new;
              if (m.sender_id === peer.peer_id) {
                setMessages(prev => [...prev, m]);
                api('messages/mark-read', { method: 'POST', token, body: { peer_id: peer.peer_id } }).catch(() => {});
              }
            })
        .subscribe();
      return () => { supa.removeChannel(ch); };
    } catch { return undefined; }
  }, [me?.id, peer?.peer_id, token]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    if (!token || !me?.id || !peer?.peer_id) { setError('Session not ready. Please logout and login again.'); return; }
    const content = text.trim();
    setText('');
    setSending(true);
    setError('');
    if (editingId) {
      try {
        const d = await api(`messages/${editingId}`, { method: 'PATCH', token, body: { content } });
        setMessages(prev => prev.map(m => m.id === editingId ? d.message : m));
        setEditingId(null);
      } catch (e) {
        setError(e.message || 'Message not edited');
      } finally { setSending(false); }
      return;
    }
    const optimistic = { id: 'tmp-' + Date.now(), sender_id: me.id, receiver_id: peer.peer_id, content, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    try {
      const d = await api('messages', { method: 'POST', token, body: { receiver_id: peer.peer_id, content } });
      setMessages(prev => prev.map(m => m.id === optimistic.id ? d.message : m));
    } catch (e) {
      setError(e.message || 'Message not sent');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally { setSending(false); }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setText(m.content || '');
  };

  const deleteMessage = async (m, mode) => {
    try {
      const d = await api(`messages/${m.id}?mode=${mode}`, { method: 'DELETE', token });
      if (mode === 'me' && d.local_only) {
        setMessages(prev => prev.filter(x => x.id !== m.id));
      } else if (d.message) {
        setMessages(prev => prev.filter(x => x.id !== m.id));
      }
      toast.success(mode === 'everyone' ? 'Deleted for everyone' : 'Deleted for you');
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-white">
      <div className="shrink-0 h-14 px-4 border-b bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} className="md:hidden rounded-full shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Avatar className="w-9 h-9 shrink-0 cursor-pointer" onClick={() => peer?.peer_photo ? setPhotoPreview({ photo: peer.peer_photo, title: peer.peer_name }) : onProfile?.()}>
            <AvatarImage src={peer.peer_photo} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700">{initials(peer.peer_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <button type="button" onClick={onProfile} className="font-semibold truncate text-slate-900 hover:underline text-left">{peer.peer_name || 'Chat'}</button>
            <p className="text-[11px] text-slate-500">Active conversation</p>
          </div>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Online</Badge>
      </div>

      {error && <div className="shrink-0 mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-white px-4 py-4 md:px-8 space-y-3">
        {messages.length === 0 && !error && (
          <div className="h-full grid place-items-center text-center">
            <div className="rounded-2xl bg-slate-50 px-6 py-5 shadow-sm">
              <MessageSquare className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">Start a conversation</p>
              <p className="text-sm text-slate-500">Say hi to begin chatting 👋</p>
            </div>
          </div>
        )}
        {messages.filter(m => !m.deleted_for_everyone && m.content !== 'This message was deleted' && !(Array.isArray(m.deleted_for) && m.deleted_for.includes(me.id))).map(m => {
          const mine = m.sender_id === me.id;
          const deleted = m.deleted_for_everyone || m.content === 'This message was deleted';
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && (
                <Avatar className="w-7 h-7 shrink-0 mb-1">
                  <AvatarImage src={peer.peer_photo} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px]">{initials(peer.peer_name)}</AvatarFallback>
                </Avatar>
              )}
              <div className={`group relative max-w-[78%] md:max-w-[62%] rounded-2xl px-4 py-2.5 text-sm shadow-sm border ${mine ? 'bg-emerald-50 border-emerald-100 text-slate-900 rounded-br-md' : 'bg-white border-slate-200 text-slate-900 rounded-bl-md'}`}>
                <p className={`whitespace-pre-wrap break-words leading-relaxed ${deleted ? 'italic text-slate-500' : ''}`}>{m.content}</p>
                <div className="flex items-center justify-end gap-2 mt-1.5">
                  {m.edited_at && !deleted && <span className="text-[10px] text-slate-400">edited</span>}
                  <span className="text-[10px] text-sky-100/80">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {!String(m.id).startsWith('tmp-') && !deleted && (
                  <div className={`mt-2 hidden group-hover:flex gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {mine && <button type="button" onClick={() => startEdit(m)} className="text-[10px] rounded-full bg-white border px-2 py-1 hover:bg-slate-50">Edit</button>}
                    <button type="button" onClick={() => deleteMessage(m, 'me')} className="text-[10px] rounded-full bg-white border px-2 py-1 hover:bg-slate-50">Delete me</button>
                    {mine && <button type="button" onClick={() => deleteMessage(m, 'everyone')} className="text-[10px] rounded-full bg-red-50 border border-red-100 text-red-600 px-2 py-1 hover:bg-red-100">Delete all</button>}
                  </div>
                )}
              </div>
              {mine && (
                <Avatar className="w-7 h-7 shrink-0 mb-1">
                  <AvatarImage src={me.profile?.photo_url} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px]">{initials(me.profile?.full_name || 'Me')}</AvatarFallback>
                </Avatar>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="shrink-0 p-3 border-t bg-white">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-md transition-shadow focus-within:shadow-lg focus-within:border-emerald-300">
          {editingId && <button type="button" onClick={() => { setEditingId(null); setText(''); }} className="text-xs text-slate-500 px-2 hover:text-red-500 transition-colors">✕ Cancel</button>}
          <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !sending && send()} placeholder={editingId ? 'Edit message…' : 'Type a message…'} className="h-10 flex-1 rounded-full bg-transparent border-0 px-4 shadow-none focus-visible:ring-0 text-sm" />
          <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}>
            <Button onClick={send} disabled={sending || !text.trim()} className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-700 p-0 shadow-lg shadow-emerald-500/30">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </motion.div>
        </div>
      </div>
      <PhotoPreviewDialog photo={photoPreview?.photo} title={photoPreview?.title} onClose={() => setPhotoPreview(null)} />
    </div>
  );
}
