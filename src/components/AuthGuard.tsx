import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Lock, AlertCircle, Loader2, Eye, EyeOff, UserPlus, LogIn, ChevronLeft } from 'lucide-react';
import { apiAuth } from '../api';

interface AuthGuardProps {
  children: React.ReactNode;
  isAuthorized: boolean;
  onLogin: (email: string, password: string) => Promise<boolean>;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, isAuthorized, onLogin }) => {
  // Login standard states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | boolean>(false);
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState<string>('');

  // Register states
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCompanyPassword, setRegisterCompanyPassword] = useState('');

  // Google registration states
  const [googleRegistrationRequired, setGoogleRegistrationRequired] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleCredential, setGoogleCredential] = useState('');
  const [googleCompanyPassword, setGoogleCompanyPassword] = useState('');

  useEffect(() => {
    const savedLogo = localStorage.getItem('cn_brand_logo');
    if (savedLogo) setLogo(savedLogo);

    const savedEmail = localStorage.getItem('cn_last_logged_email');
    if (savedEmail) setEmail(savedEmail);
  }, []);

  // Google Sign-In initialization
  useEffect(() => {
    if (isAuthorized) return;
    
    // Client ID padrão para rodar local e na Vercel (pode ser sobrescrito com env)
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "1015694292102-kbgmlq6pcf1eafcrh5g2kcrer6s6u2ig.apps.googleusercontent.com";
    
    const initializeGoogle = () => {
      const g = (window as any).google;
      if (g) {
        g.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCallback,
        });
        
        const btnElement = document.getElementById("google-signin-btn");
        if (btnElement) {
          g.accounts.id.renderButton(
            btnElement,
            { theme: "outline", size: "large", width: 384, text: "signin_with" }
          );
        }
      }
    };

    const timer = setInterval(() => {
      if ((window as any).google) {
        initializeGoogle();
        clearInterval(timer);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isAuthorized, isRegistering, googleRegistrationRequired]);

  const handleGoogleCallback = async (response: any) => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiAuth.googleLogin(response.credential);
      if (res.success) {
        localStorage.setItem('cn_last_logged_email', res.user.email);
        window.location.reload();
      } else if (res.registrationRequired) {
        setGoogleRegistrationRequired(true);
        setGoogleEmail(res.email);
        setGoogleName(res.name);
        setGoogleCredential(response.credential);
      } else {
        setError('Falha na autenticação do Google.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com o Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleCompanyPassword) return;
    setLoading(true);
    setError(false);
    try {
      const success = await apiAuth.googleRegister(
        googleEmail,
        googleName,
        googleCompanyPassword,
        googleCredential
      );
      if (success) {
        localStorage.setItem('cn_last_logged_email', googleEmail);
        window.location.reload();
      } else {
        setError('Senha da empresa incorreta.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao vincular conta do Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPassword || !registerCompanyPassword) return;
    
    setLoading(true);
    setError(false);
    try {
      const success = await apiAuth.register(
        registerName,
        registerEmail,
        registerPassword,
        registerCompanyPassword
      );
      if (success) {
        const loginSuccess = await onLogin(registerEmail, registerPassword);
        if (loginSuccess) {
          localStorage.setItem('cn_last_logged_email', registerEmail);
        } else {
          setError('Cadastro realizado, mas falha ao logar automaticamente. Tente logar manualmente.');
          setIsRegistering(false);
        }
      } else {
        setError('Senha da empresa inválida.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError(false);
    
    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError('E-mail ou Senha incorretos.');
        setPassword('');
      } else {
        localStorage.setItem('cn_last_logged_email', email);
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#0a0c14] p-6 font-sans">
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-10 w-full max-w-md border border-white/10 shadow-2xl text-center bg-[#111420]/80 backdrop-blur-2xl"
        >
          <div className="flex flex-col items-center gap-6">
            {/* Logo Wrapper */}
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-2xl shadow-primary/10">
                {logo ? (
                  <img src={logo} alt="Logo" className="h-12 w-12 object-contain" />
                ) : (
                  <Lock className="text-primary w-8 h-8" />
                )}
              </div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-4 border-[#0a0c14]"
              >
                <Lock size={10} className="text-background" />
              </motion.div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tighter text-white font-headline">Portal CN</h1>
              <div className="flex items-center justify-center gap-2">
                <span className="h-px w-6 bg-white/10"></span>
                <p className="text-[9px] text-primary font-black uppercase tracking-[0.3em]">
                  {googleRegistrationRequired ? 'Vincular Google' : isRegistering ? 'Primeiro Acesso' : 'Acesso Restrito'}
                </p>
                <span className="h-px w-6 bg-white/10"></span>
              </div>
            </div>

            {/* FLOW 1: Google Registration (Needs Company Password to activate) */}
            {googleRegistrationRequired ? (
              <form onSubmit={handleGoogleRegisterSubmit} className="w-full space-y-4 text-left">
                <p className="text-xs text-on-surface-variant text-center bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  Olá <strong>{googleName}</strong> ({googleEmail})! <br />
                  Este e-mail do Google não está cadastrado. Para liberá-lo no sistema, insira a <strong>Senha da Empresa</strong> abaixo:
                </p>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Senha da Empresa</label>
                  <input
                    type="password"
                    placeholder="Chave de segurança mestre"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-center text-sm text-white outline-none focus:border-primary/50"
                    value={googleCompanyPassword}
                    onChange={(e) => setGoogleCompanyPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-tertiary text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleRegistrationRequired(false);
                      setError(false);
                    }}
                    className="w-1/3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl py-3.5 text-xs font-bold transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-2/3 bg-primary text-background py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirmar Acesso
                  </button>
                </div>
              </form>
            ) : isRegistering ? (
              /* FLOW 2: Standard Signup */
              <form onSubmit={handleRegisterSubmit} className="w-full space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nome Completo</label>
                  <input
                    type="text"
                    placeholder="Seu Nome"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">E-mail</label>
                  <input
                    type="email"
                    placeholder="Seu E-mail"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Senha Pessoal</label>
                  <input
                    type="password"
                    placeholder="Escolha uma senha"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Senha da Empresa (Segurança)</label>
                  <input
                    type="password"
                    placeholder="Chave de segurança mestre"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-primary/50"
                    value={registerCompanyPassword}
                    onChange={(e) => setRegisterCompanyPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <p className="text-tertiary text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-background py-3.5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Finalizar Cadastro
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(false);
                    setError(false);
                  }}
                  className="w-full text-center text-[10px] uppercase font-bold tracking-widest text-primary/60 hover:text-primary transition-all flex items-center justify-center gap-1.5 py-1"
                >
                  <ChevronLeft size={14} /> Voltar para o Login
                </button>
              </form>
            ) : (
              /* FLOW 3: Standard Login */
              <form onSubmit={handleSubmit} className="w-full space-y-4">
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="E-mail de Acesso"
                    className={cn(
                      "w-full bg-white/5 border rounded-2xl px-4 py-4 text-center text-lg text-white outline-none transition-all placeholder:text-white/20",
                      error 
                        ? "border-tertiary shadow-[0_0_25px_rgba(239,68,68,0.15)] ring-1 ring-tertiary/50" 
                        : "border-white/10 focus:border-primary/50 focus:bg-white/10"
                    )}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(false);
                    }}
                    autoFocus={!email}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Senha de Acesso"
                    className={cn(
                      "w-full bg-white/5 border rounded-2xl px-4 py-4 text-center text-lg text-white outline-none transition-all placeholder:text-white/20",
                      error 
                        ? "border-tertiary shadow-[0_0_25px_rgba(239,68,68,0.15)] ring-1 ring-tertiary/50" 
                        : "border-white/10 focus:border-primary/50 focus:bg-white/10"
                    )}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(false);
                    }}
                    autoFocus={!!email}
                    disabled={loading}
                    required
                  />
                  
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-2"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {error && (
                  <p className="text-tertiary text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-background py-4.5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Autenticando...' : 'Autenticar Sistema'}
                </button>

                {/* Google Sign-in Button Wrapper */}
                <div className="pt-2 border-t border-white/5 flex flex-col items-center gap-3">
                  <div id="google-signin-btn" className="w-full flex justify-center"></div>
                  
                  <div className="flex justify-between w-full text-[10px] font-bold tracking-widest uppercase pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setError(false);
                      }}
                      className="text-primary/60 hover:text-primary transition-all flex items-center gap-1.5"
                    >
                      <UserPlus size={14} /> Primeiro Acesso
                    </button>
                    <span className="text-white/20">|</span>
                    <span className="text-white/30 flex items-center gap-1">
                      <LogIn size={12} /> CN Security
                    </span>
                  </div>
                </div>
              </form>
            )}

            <div className="pt-4 space-y-1">
              <p className="text-[9px] text-white/20 font-medium uppercase tracking-widest">
                CN Intelligence Security Protocol v2.7
              </p>
              <p className="text-[9px] text-white/10">
                © 2025 Todos os direitos reservados.
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};