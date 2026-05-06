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
  const [signup, setSignup] = useState({ role: null, full_name: '', email: '', password: '', confirm_password: '' });
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
          onBack={() => setScreen('login')}
          onAdminAuthed={handleAuthed} />
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
        <ShieldCheck className="w-4 h-4 mr-2" /> Admin Panel
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
  const [messages, setMessages] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

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
    setBusy(true);
    try {
      await api(`admin/users/${id}/verify`, { method: 'PATCH', token, body: { verified } });
      toast.success(verified ? 'Account verified' : 'Verification rejected');
      await loadUsers();
      if (selected?.id === id) await openDetails(selected);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Work2Wish</p>
            <h1 className="text-2xl font-extrabold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-indigo-600" /> Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">View users, documents, card numbers, chats and verification status.</p>
          </div>
          <div className="flex gap-2">
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
                <CardDescription>Filter like Supabase, inspect documents/chats, verify, block or delete accounts.</CardDescription>
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
            <DialogDescription>Complete user record, documents and recent chats.</DialogDescription>
          </DialogHeader>
          {loadingDetails ? <div className="py-10 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin" /></div> : selected && (
            <div className="space-y-5">
              <div className="grid md:grid-cols-3 gap-3">
                <InfoTile label="Email" value={selected.email} />
                <InfoTile label="Role" value={selected.role} />
                <InfoTile label="Login ID" value={selected.login_id} />
                <InfoTile label="Phone" value={selected.phone} />
                <InfoTile label="Location" value={selected.location_text} />
                <InfoTile label="Address" value={selected.role === 'employer' ? selected.company_address : selected.address} />
                <InfoTile label="Coordinates" value={selected.latitude && selected.longitude ? formatCoordinates(selected.latitude, selected.longitude) : '—'} />
                {selected.role === 'worker' && <InfoTile label="Aadhaar" value={selected.aadhaar_number} />}
                <InfoTile label={selected.role === 'employer' ? 'Company PAN' : 'PAN'} value={selected.pan_number} />
                {selected.role === 'employer' && <InfoTile label="GST" value={selected.gst_number} />}
                <InfoTile label="Verification" value={selected.verified ? 'Verified' : (selected.verification_status || 'Not submitted')} />
              </div>

              <div>
                <h3 className="font-bold mb-2">Uploaded documents</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {selected.role === 'worker' && <AdminDocPreview title="Aadhaar front" url={selected.aadhaar_front_url} />}
                  {selected.role === 'worker' && <AdminDocPreview title="Aadhaar back" url={selected.aadhaar_back_url} />}
                  <AdminDocPreview title={selected.role === 'employer' ? 'Company PAN front' : 'PAN front'} url={selected.pan_image_url} />
                  <AdminDocPreview title={selected.role === 'employer' ? 'Company PAN back' : 'PAN back'} url={selected.pan_back_url} />
                  {selected.role === 'employer' && <AdminDocPreview title="GST certificate" url={selected.gst_certificate_url} />}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || selected.role === 'admin'} onClick={() => verifyUser(selected.id, true)} className="bg-emerald-600 hover:bg-emerald-700"><ShieldCheck className="w-4 h-4 mr-2" /> Verify this account</Button>
                <Button disabled={busy || selected.role === 'admin'} variant="outline" onClick={() => verifyUser(selected.id, false)}><XCircle className="w-4 h-4 mr-2" /> Reject verification</Button>
                <Button disabled={busy || selected.role === 'admin'} variant="outline" onClick={() => blockUser(selected.id, !selected.blocked)}>{selected.blocked ? 'Unblock user' : 'Block user'}</Button>
                <Button disabled={busy || selected.role === 'admin'} variant="destructive" onClick={() => deleteUser(selected.id, selected.email)}>Delete user</Button>
              </div>

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

function InfoTile({ label, value }) {
  return <div className="rounded-xl border bg-white p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold break-words">{value || '—'}</p></div>;
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
function LoginPage({ onAuthed, onGotoSignup, onGotoForgot, onAdminAuthed }) {
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
      className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50 grid lg:grid-cols-2 relative">
      <div className="absolute right-5 top-5 z-20">
        <AdminAccessButton onAuthed={onAdminAuthed} />
      </div>
      {/* left: marketing with 3D depth */}
      <div className="hidden lg:flex flex-col justify-center p-10 bg-gradient-to-br from-indigo-700 via-blue-600 to-emerald-500 text-white relative overflow-hidden">
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
function SignupRolePicker({ onPick, onBack, onAdminAuthed }) {
  return (
    <motion.div key="signup-role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6 flex flex-col relative overflow-hidden">
      <GradientMesh />
      <div className="relative z-10 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="relative"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
        <AdminAccessButton onAuthed={onAdminAuthed} />
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
              data.role === 'employer' ? 'bg-gradient-to-br from-emerald-600 to-teal-500' : 'bg-gradient-to-br from-indigo-600 to-blue-500'
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
                      <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
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
              <SheetContent className="p-0 overflow-hidden">
                <SheetHeader className="px-5 py-4 border-b bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                  <SheetTitle className="text-white flex items-center gap-2">
                    <Bell className="w-5 h-5" /> Notifications
                  </SheetTitle>
                  <p className="text-xs text-white/80">Live updates for jobs, chats, applications and verification.</p>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-94px)] bg-slate-50">
                  {notifs.length === 0 && (
                    <div className="m-4 p-6 rounded-2xl bg-white border text-center">
                      <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-semibold">No notifications yet</p>
                      <p className="text-xs text-muted-foreground mt-1">New updates will appear here instantly.</p>
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    {notifs.map(n => {
                      const isChat = n.type === 'message' || n.type === 'chat';
                      const isVerification = n.type === 'verification';
                      const isApplication = n.type === 'application';
                      const tone = isChat ? 'emerald' : isVerification ? 'indigo' : isApplication ? 'amber' : 'slate';
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={async () => {
                            try { await api(`notifications/${n.id}/read`, { method: 'POST', token }); await refreshNotifs(); } catch {}
                          }}
                          className={`w-full text-left p-3 rounded-2xl border bg-white hover:shadow-md transition flex gap-3 ${!n.read ? `ring-1 ring-${tone}-100` : 'opacity-80'}`}
                        >
                          <div className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : tone === 'indigo' ? 'bg-indigo-100 text-indigo-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {isChat ? <MessageSquare className="w-5 h-5" /> : isVerification ? <ShieldCheck className="w-5 h-5" /> : isApplication ? <ClipboardList className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-sm leading-snug truncate">{n.title}</p>
                              {!n.read && <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${tone === 'emerald' ? 'bg-emerald-500' : tone === 'indigo' ? 'bg-indigo-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-400'}`} />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container py-4">
        {tab === 'home'    && <WorkerHome token={token} me={me} onChat={openChatWith} />}
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

function formatCoordinates(lat, lng) {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return '';
  const a = Number(lat);
  const b = Number(lng);
  if (Number.isNaN(a) || Number.isNaN(b)) return '';
  return `${a.toFixed(5)}, ${b.toFixed(5)}`;
}


function getGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
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

async function reverseGeocodeLocation(lat, lng) {
  try {
    const google = await loadGoogleMapsPlaces();
    const geocoder = new google.maps.Geocoder();
    const result = await geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } });
    return result?.results?.[0]?.formatted_address || `GPS: ${formatCoordinates(lat, lng)}`;
  } catch {
    return `GPS: ${formatCoordinates(lat, lng)}`;
  }
}

async function getPlacePredictions(query) {
  const q = (query || '').trim();
  if (q.length < 2) return [];

  const google = await loadGoogleMapsPlaces();
  const service = new google.maps.places.AutocompleteService();
  const sessionToken = new google.maps.places.AutocompleteSessionToken();

  const requestBase = {
    input: q,
    componentRestrictions: { country: 'in' },
    sessionToken,
  };

  const getPredictions = (request) => new Promise((resolve) => {
    service.getPlacePredictions(request, (predictions, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
        resolve([]);
        return;
      }
      resolve(predictions);
    });
  });

  const getQueries = () => new Promise((resolve) => {
    service.getQueryPredictions(requestBase, (predictions, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
        resolve([]);
        return;
      }
      resolve(predictions);
    });
  });

  const [businesses, allPlaces, addresses, queries] = await Promise.all([
    getPredictions({ ...requestBase, types: ['establishment'] }),
    getPredictions(requestBase),
    getPredictions({ ...requestBase, types: ['geocode'] }),
    getQueries(),
  ]);

  const seen = new Set();
  return [...businesses, ...allPlaces, ...queries, ...addresses]
    .filter((item) => {
      const key = item.place_id || item.description;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

async function getPlaceDetails(placeId, fallbackText = '') {
  if (!placeId && fallbackText) return geocodeTypedAddress(fallbackText);

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
        locationBias: { lat: 12.9716, lng: 77.5946 },
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
        region: 'in',
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

  const google = await loadGoogleMapsPlaces();
  const geocoder = new google.maps.Geocoder();

  const geocodeResult = await new Promise((resolve) => {
    geocoder.geocode(
      {
        address: q,
        componentRestrictions: { country: 'IN' },
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        const first = results[0];
        resolve({
          location_text: first.formatted_address || q,
          place_name: '',
          place_id: first.place_id || '',
          latitude: first.geometry.location.lat(),
          longitude: first.geometry.location.lng(),
        });
      }
    );
  });

  if (geocodeResult) return geocodeResult;

  try {
    return await findPlaceFromText(q);
  } catch {
    throw new Error('Unable to find this company/place/address. Try full company name with area, or select a Google suggestion.');
  }
}

function LocationSearchBox({
  label = 'Location',
  value = '',
  latitude,
  longitude,
  onChange,
  color = 'indigo',
  placeholder = 'Search company, shop, landmark, area or full address',
  helper = 'Type like Google Maps. Choose a company/place suggestion to save exact latitude and longitude.',
}) {
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const blurRef = useRef(null);
  const [query, setQuery] = useState(value || '');
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    let active = true;
    loadGoogleMapsPlaces()
      .then(() => { if (active) setReady(true); })
      .catch(() => { if (active) setReady(false); });
    return () => { active = false; };
  }, []);

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
    if (q.length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setLoading(true);
    try {
      const list = await getPlacePredictions(q);
      setPredictions(list || []);
      setShowPredictions(true);
    } catch (e) {
      setPredictions([]);
      setShowPredictions(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange?.({ location_text: v, latitude: null, longitude: null });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(v), 250);
  };

  const selectPrediction = async (prediction) => {
    if (!prediction?.place_id) return;
    setLoading(true);
    try {
      const loc = await getPlaceDetails(prediction.place_id, prediction.description);
      applyLocation(loc, 'Location selected from suggestions');
    } catch (e) {
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
      const loc = await geocodeTypedAddress(q);
      applyLocation(loc, 'Typed address converted to exact GPS');
    } catch (e) {
      toast.error(e.message || 'Unable to find this company/place/address. Please choose from suggestions.');
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {ready ? 'Search ready' : 'Loading search'}
        </span>
      </div>

      <div className="relative">
        <div className={`relative rounded-xl border bg-white shadow-sm transition-all focus-within:ring-4 ${borderClass}`}>
          <MapPin className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${activeColor === 'emerald' ? 'text-emerald-600' : 'text-indigo-600'}`} />
          <Input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (query.trim().length >= 2) {
                fetchPredictions(query);
                setShowPredictions(true);
              }
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
            className="pl-9 pr-32 border-0 shadow-none focus-visible:ring-0 h-11 rounded-xl"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
            <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={handleManualSearch} disabled={loading} className="h-8 px-2" title="Search typed address">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
            <Button type="button" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={useCurrent} disabled={gpsLoading} className={`h-8 px-2 text-white ${buttonClass}`} title="Use current GPS">
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {showPredictions && predictions.length > 0 && (
          <div className="absolute z-[999999] mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-2xl ring-1 ring-slate-200">
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

      <p className="text-xs text-muted-foreground px-1">{helper}</p>

      {selectedText ? (
        <div className={`text-xs rounded-lg px-3 py-2 ${selectedClass}`}>
          Exact GPS saved: <b>{selectedText}</b>
        </div>
      ) : (
        <div className="text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-700">
          Type and choose one suggestion. Nearby matching needs exact GPS.
        </div>
      )}
    </div>
  );
}

function WorkerHome({ token, me }) {
  const [jobs, setJobs] = useState([]);
  const [nearbyJobs, setNearbyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [hasCheckedNearby, setHasCheckedNearby] = useState(false);
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

  const findNearbyFromCoords = async (userLat, userLng, sourceLabel = 'selected location') => {
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
        .filter((job) => job.distance_km !== null && job.distance_km <= 10)
        .sort((a, b) => a.distance_km - b.distance_km);

      setNearbyJobs(filtered);
      if (filtered.length > 0) toast.success(`${filtered.length} nearby job(s) found within 10 km from your ${sourceLabel}`);
      if (filtered.length === 0) toast.info(`No jobs found within 10 km from your ${sourceLabel}`);
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

      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center">
              <MapPin className="w-5 h-5" />
            </span>
            Jobs near you within 10 km
          </CardTitle>
          <CardDescription>
            Allow location access to find nearby day-work opportunities based on your current location.
          </CardDescription>
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
              Use current location
            </Button>
            <Button
              type="button"
              onClick={loadNearbyFromSavedLocation}
              disabled={locationLoading}
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Use saved/home location
            </Button>
          </div>

          {locationError && <p className="text-sm text-red-500 mt-3">{locationError}</p>}

          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {nearbyJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelected(job)}
                className="text-left bg-white rounded-xl border p-4 hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate group-hover:text-indigo-700">{job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.employers?.company_name} · {job.location_text || 'Location not added'}</p>
                  </div>
                  <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 shrink-0">
                    {job.distance_km.toFixed(1)} km
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
            <p className="text-sm text-muted-foreground mt-3">
              No jobs found within 10 km right now. Try again later or search all jobs below.
            </p>
          )}

          {!hasCheckedNearby && (
            <p className="text-sm text-muted-foreground mt-3">
              Click “Find nearby jobs” to check jobs within 10 km.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="font-bold text-lg mb-2">All open jobs</h2>
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
                <DialogDescription>
                  {selected.employers?.company_name} · {selected.location_text}
                  {selected.distance_km !== undefined && selected.distance_km !== null ? ` · ${selected.distance_km.toFixed(1)} km away` : ''}
                </DialogDescription>
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


function SavedLocationEditor({ label, value, latitude, longitude, color = 'indigo', placeholder, helper, onChange }) {
  const hasSaved = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && !!value;
  const [editing, setEditing] = useState(!hasSaved);

  useEffect(() => {
    const freshSaved = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && !!value;
    setEditing(!freshSaved);
  }, [value, latitude, longitude]);

  const colorClasses = color === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
    : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100';

  if (hasSaved && !editing) {
    return (
      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <Label>{label}</Label>
            <p className="text-sm font-semibold text-slate-900 mt-1 break-words">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">Saved GPS: {formatCoordinates(latitude, longitude)}</p>
          </div>
          <Button type="button" variant="outline" className={`shrink-0 ${colorClasses}`} onClick={() => setEditing(true)}>
            <MapPin className="w-4 h-4 mr-2" /> Change location
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">This saved location will be reused after login until you change it.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-slate-50 p-4 space-y-3">
      {hasSaved && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Editing enabled. Select a new place or use current GPS.</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      )}
      <LocationSearchBox
        label={label}
        value={value || ''}
        latitude={latitude}
        longitude={longitude}
        color={color}
        placeholder={placeholder}
        helper={helper}
        onChange={onChange}
      />
    </div>
  );
}



function VerificationDocumentsCard({ token, role, verified, form, setForm, onSaved, color = 'indigo' }) {
  const [busy, setBusy] = useState(false);
  const status = form.verification_status || (verified ? 'verified' : 'not_submitted');
  const accent = color === 'emerald' ? 'emerald' : 'indigo';
  const isEmployer = role === 'employer';

  const cleanAadhaar = (value) => String(value || '').replace(/\D/g, '').slice(0, 12);
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
      setForm((s) => ({ ...s, [field]: url, verification_status: 'submitted' }));
      toast.success('Document uploaded');
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
        return toast.error('Upload Aadhaar front/back and PAN front/back images');
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
            verification_status: 'submitted',
          }
        : {
            address: form.address,
            aadhaar_number: cleanAadhaar(form.aadhaar_number),
            pan_number: pan,
            aadhaar_front_url: form.aadhaar_front_url,
            aadhaar_back_url: form.aadhaar_back_url,
            pan_image_url: form.pan_image_url,
            pan_back_url: form.pan_back_url,
            verification_status: 'submitted',
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
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className={`${accent === 'emerald' ? 'bg-emerald-50/70' : 'bg-indigo-50/70'} border-b`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${verified ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isEmployer ? 'Company verification' : 'Worker verification'}
            </CardTitle>
            <CardDescription>
              {isEmployer
                ? 'Submit GST and company PAN documents for admin approval.'
                : 'Submit Aadhaar/PAN and address details for admin approval.'}
            </CardDescription>
          </div>
          {verified ? (
            <Badge className="bg-emerald-100 text-emerald-700">Verified</Badge>
          ) : status === 'submitted' ? (
            <Badge className="bg-amber-100 text-amber-700">Pending review</Badge>
          ) : status === 'rejected' ? (
            <Badge className="bg-red-100 text-red-700">Rejected</Badge>
          ) : (
            <Badge variant="outline">Unverified</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4" onKeyDown={(e) => { if (e.key === 'Enter' && e.target?.tagName !== 'TEXTAREA') { e.preventDefault(); if (!busy && !verified) submitVerification(); } }}>
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

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <DocumentUploadBox label="Company PAN front" url={form.pan_image_url} disabled={busy} onFile={(file) => uploadDoc(file, 'pan_image_url', 'company-pan-front')} />
              <DocumentUploadBox label="Company PAN back" url={form.pan_back_url} disabled={busy} onFile={(file) => uploadDoc(file, 'pan_back_url', 'company-pan-back')} />
              <DocumentUploadBox label="GST certificate" url={form.gst_certificate_url} disabled={busy} onFile={(file) => uploadDoc(file, 'gst_certificate_url', 'gst-certificate')} />
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

            <div>
              <Label>Full address</Label>
              <Textarea
                rows={3}
                value={form.address || ''}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                placeholder="Door no, street, area, city, district, state, pincode"
                className="rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-offset-0 resize-none"
              />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <DocumentUploadBox label="Aadhaar front" url={form.aadhaar_front_url} disabled={busy} onFile={(file) => uploadDoc(file, 'aadhaar_front_url', 'aadhaar-front')} />
              <DocumentUploadBox label="Aadhaar back" url={form.aadhaar_back_url} disabled={busy} onFile={(file) => uploadDoc(file, 'aadhaar_back_url', 'aadhaar-back')} />
              <DocumentUploadBox label="PAN front" url={form.pan_image_url} disabled={busy} onFile={(file) => uploadDoc(file, 'pan_image_url', 'pan-front')} />
              <DocumentUploadBox label="PAN back" url={form.pan_back_url} disabled={busy} onFile={(file) => uploadDoc(file, 'pan_back_url', 'pan-back')} />
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between rounded-xl bg-slate-50 border p-3">
          <div>
            <p className="text-sm font-semibold">Admin approval required</p>
            <p className="text-xs text-muted-foreground">After submission, admin checks your details and clicks Verify account.</p>
            {form.verification_notes && <p className="text-xs text-red-600 mt-1">Note: {form.verification_notes}</p>}
          </div>
          <Button type="button" onClick={submitVerification} disabled={busy || verified} className={`${accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : verified ? 'Already verified' : 'Submit verification'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentUploadBox({ label, url, onFile, disabled }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <Label>{label}</Label>
      <div className="mt-2 flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg border bg-slate-50 grid place-items-center overflow-hidden shrink-0">
          {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <ImgIcon className="w-6 h-6 text-slate-400" />}
        </div>
        <label className="inline-flex items-center justify-center px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-slate-50">
          <Upload className="w-4 h-4 mr-2" /> Upload
          <input type="file" accept="image/*,.pdf" className="hidden" disabled={disabled} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      {url && <a className="text-xs text-indigo-600 hover:underline mt-2 inline-block" href={url} target="_blank" rel="noreferrer">View uploaded file</a>}
    </div>
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

      <VerificationDocumentsCard
        token={token}
        role="worker"
        verified={!!me.extra?.verified}
        form={form}
        setForm={setForm}
        onSaved={onSaved}
        color="indigo"
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Edit profile</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name"  v={form.full_name}           on={(v) => setForm(f => ({ ...f, full_name: v }))} />
          <Field label="Phone"      v={form.phone}               on={(v) => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Age"        v={form.age}                 on={(v) => setForm(f => ({ ...f, age: v }))} type="number" />
          <Field label="Experience (years)" v={form.experience_years} on={(v) => setForm(f => ({ ...f, experience_years: v }))} type="number" />
          <Field label="Expected daily wage (₹)" v={form.expected_daily_wage} on={(v) => setForm(f => ({ ...f, expected_daily_wage: v }))} type="number" />
          <div className="sm:col-span-2">
            <SavedLocationEditor
              label="Home / preferred work location"
              value={form.location_text || ''}
              latitude={form.latitude}
              longitude={form.longitude}
              color="indigo"
              placeholder="Search home area, landmark, city"
              helper="Workers can use this saved location or current GPS to find jobs within 10 km."
              onChange={(loc) => setForm(f => ({ ...f, ...loc }))}
            />
          </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          onClick={save}
          disabled={busy}
          className="h-12 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4 mr-2" />}
          Save profile
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="h-12 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Account settings
            </Button>
          </SheetTrigger>
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

              <div className="rounded-2xl border p-4">
                <p className="text-sm font-semibold text-slate-900">Session</p>
                <p className="text-xs text-muted-foreground mt-1">Use logout when you only want to leave this device.</p>
                <Button
                  onClick={onLogout}
                  disabled={busy}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">Danger zone</p>
                <p className="text-xs text-red-600/80 mt-1">Deleting your account permanently removes your profile, applications, messages, notifications, and Supabase Auth user.</p>
                <Button
                  variant="destructive"
                  onClick={deleteAccount}
                  disabled={busy}
                  className="w-full mt-4"
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
    title: '', category: 'general', description: '', location_text: '', latitude: '', longitude: '',
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
      <CardHeader><CardTitle>Post a new job</CardTitle><CardDescription>Reach workers near your saved company location instantly. If you leave job location empty, your company location will be used automatically.</CardDescription></CardHeader>
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
          <div className="sm:col-span-2">
            <LocationSearchBox
              label="Job location override (optional)"
              value={f.location_text || ''}
              latitude={f.latitude}
              longitude={f.longitude}
              color="emerald"
              placeholder="Search job site, landmark, area"
              helper="Leave this empty to automatically use your saved company location. Use this only if the job site is different."
              onChange={(loc) => setF(s => ({ ...s, ...loc }))}
            />
          </div>
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
      latitude: me.extra?.latitude || '',
      longitude: me.extra?.longitude || '',
      place_id: me.extra?.place_id || '',
      place_name: me.extra?.place_name || '',
      description: me.extra?.description || '',
      company_address: me.extra?.company_address || '',
      gst_number: me.extra?.gst_number || '',
      gst_certificate_url: me.extra?.gst_certificate_url || '',
      aadhaar_number: me.extra?.aadhaar_number || '',
      pan_number: me.extra?.pan_number || '',
      aadhaar_front_url: me.extra?.aadhaar_front_url || '',
      aadhaar_back_url: me.extra?.aadhaar_back_url || '',
      pan_image_url: me.extra?.pan_image_url || '',
      pan_back_url: me.extra?.pan_back_url || '',
      verification_status: me.extra?.verification_status || (me.extra?.verified ? 'verified' : 'not_submitted'),
      verification_notes: me.extra?.verification_notes || '',
    });
  }, [me]);

  const save = async () => {
    setBusy(true);
    try { await api('me/profile', { method: 'PATCH', token, body: f }); toast.success('Saved'); onSaved(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
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

      <VerificationDocumentsCard
        token={token}
        role="employer"
        verified={!!me.extra?.verified}
        form={f}
        setForm={setF}
        onSaved={onSaved}
        color="emerald"
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Company profile</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field label="Your name"   v={f.full_name}    on={(v) => setF(s => ({ ...s, full_name: v }))} />
          <Field label="Phone"       v={f.phone}        on={(v) => setF(s => ({ ...s, phone: v }))} />
          <Field label="Company"     v={f.company_name} on={(v) => setF(s => ({ ...s, company_name: v }))} />
          <Field label="Industry"    v={f.industry}     on={(v) => setF(s => ({ ...s, industry: v }))} />
          <div className="sm:col-span-2">
            <SavedLocationEditor
              label="Company fixed location"
              value={f.location_text || ''}
              latitude={f.latitude}
              longitude={f.longitude}
              color="emerald"
              placeholder="Search company name, area, landmark, city"
              helper="This fixed company location is used automatically when posting jobs and for worker nearby matching."
              onChange={(loc) => setF(s => ({ ...s, ...loc }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>About</Label>
            <Textarea rows={3} value={f.description || ''} onChange={(e) => setF(s => ({ ...s, description: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          onClick={save}
          disabled={busy}
          className="h-12 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4 mr-2" />}
          Save profile
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="h-12 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Account settings
            </Button>
          </SheetTrigger>
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

              <div className="rounded-2xl border p-4">
                <p className="text-sm font-semibold text-slate-900">Session</p>
                <p className="text-xs text-muted-foreground mt-1">Use logout when you only want to leave this device.</p>
                <Button
                  onClick={onLogout}
                  disabled={busy}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">Danger zone</p>
                <p className="text-xs text-red-600/80 mt-1">Deleting your account permanently removes your company profile, jobs, applications, messages, notifications, and Supabase Auth user.</p>
                <Button
                  variant="destructive"
                  onClick={deleteAccount}
                  disabled={busy}
                  className="w-full mt-4"
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
