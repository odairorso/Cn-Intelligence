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

  // Google registration states
  const [googleRegistrationRequired, setGoogleRegistrationRequired] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleCredential, setGoogleCredential] = useState('');

  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    const savedLogo = localStorage.getItem('cn_brand_logo');
    if (savedLogo) setLogo(savedLogo);
    const savedEmail = localStorage.getItem('cn_last_logged_email');
    if (savedEmail) setEmail(savedEmail);
    const savedPassword = localStorage.getItem('cn_last_logged_pw');
    if (savedPassword) setPassword(savedPassword);

    // Processar retorno do OAuth do Google (redirect flow)
    const hash = window.location.hash;
    if (hash && hash.includes('id_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const idToken = params.get('id_token');
      if (idToken) {
        window.history.replaceState(null, '', window.location.pathname);
        setLoading(true);
        apiAuth.googleLogin(idToken).then(res => {
          if (res.success) {
            if (res.user?.email) localStorage.setItem('cn_last_logged_email', res.user.email);
            window.location.reload();
          } else if (res.registrationRequired) {
            apiAuth.googleRegister(res.email!, res.name || '', '', idToken).then(() => {
              if (res.email) localStorage.setItem('cn_last_logged_email', res.email);
              window.location.reload();
            }).catch(err => setError(err.message || 'Erro ao cadastrar com Google.'));
          } else {
            setError('Falha na autenticação com Google.');
          }
        }).catch(err => setError(err.message || 'Erro ao autenticar com Google.'))
          .finally(() => setLoading(false));
      }
    }
  }, []);

  // Google Sign-In initialization
  useEffect(() => {
    if (isAuthorized) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "139195051788-6l3qj8v9a20r1d6ii6u3edukvshh4ebn.apps.googleusercontent.com";

    const initializeGoogle = () => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        g.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        setGoogleReady(true);
      }
    };

    const timer = setInterval(() => {
      if ((window as any).google?.accounts?.id) {
        initializeGoogle();
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, [isAuthorized]);

  const handleGoogleButtonClick = () => {
    const g = (window as any).google;
    if (g?.accounts?.id) {
      // SDK disponível — usa One-Tap
      g.accounts.id.prompt();
    } else {
      // SDK bloqueado (Kaspersky/CSP) — usa redirect OAuth
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '139195051788-6l3qj8v9a20r1d6ii6u3edukvshh4ebn.apps.googleusercontent.com';
      const redirectUri = encodeURIComponent(window.location.origin);
      const nonce = Math.random().toString(36).substring(2, 15);
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=openid+email+profile&nonce=${nonce}&prompt=select_account`;
      window.location.href = url;
    }
  };

  const handleGoogleCallback = async (response: any) => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiAuth.googleLogin(response.credential);
      if (res.success) {
        localStorage.setItem('cn_last_logged_email', res.user.email);
        window.location.reload();
      } else if (res.registrationRequired) {
        // Auto-registrar direto sem pedir senha da empresa
        const success = await apiAuth.googleRegister(
          res.email,
          res.name,
          '', // sem senha da empresa
          response.credential
        );
        if (success) {
          localStorage.setItem('cn_last_logged_email', res.email);
          window.location.reload();
        } else {
          setError('Não foi possível completar o cadastro com Google. Tente novamente.');
        }
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
    if (!registerName || !registerEmail || !registerPassword) return;
    
    setLoading(true);
    setError(false);
    try {
      const success = await apiAuth.register(
        registerName,
        registerEmail,
        registerPassword,
        '' // companyPassword não é mais necessária
      );
      if (success) {
        const loginSuccess = await onLogin(registerEmail, registerPassword);
        if (loginSuccess) {
          localStorage.setItem('cn_last_logged_email', registerEmail);
          localStorage.setItem('cn_last_logged_pw', registerPassword); // Salva a senha para preenchimento automático
        } else {
          setError('Cadastro realizado, mas falha ao logar automaticamente. Tente logar manualmente.');
          setIsRegistering(false);
        }
      } else {
        setError('Erro ao realizar cadastro. Tente novamente.');
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
        localStorage.removeItem('cn_last_logged_pw');
      } else {
        localStorage.setItem('cn_last_logged_email', email);
        localStorage.setItem('cn_last_logged_pw', password); // salva senha para próximo acesso
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
                  {isRegistering ? 'Primeiro Acesso' : 'Acesso Restrito'}
                </p>
                <span className="h-px w-6 bg-white/10"></span>
              </div>
            </div>

            {isRegistering ? (
              /* FLOW: Standard Signup */
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

                {/* Botão Google no Cadastro */}
                <div className="flex items-center gap-3">
                  <span className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">ou</span>
                  <span className="flex-1 h-px bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleButtonClick}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-100 transition-all shadow-md disabled:opacity-50 text-sm"
                >
                  <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#4285F4" d="M47.532 24.552c0-1.636-.147-3.2-.422-4.701H24.48v8.89h12.984c-.56 3.018-2.26 5.578-4.817 7.29v6.055h7.796c4.56-4.202 7.09-10.396 7.09-17.534z"/>
                    <path fill="#34A853" d="M24.48 48c6.516 0 11.982-2.161 15.976-5.865l-7.796-6.055c-2.161 1.447-4.927 2.303-8.18 2.303-6.294 0-11.624-4.25-13.528-9.963H2.87v6.253C6.845 42.938 15.076 48 24.48 48z"/>
                    <path fill="#FBBC05" d="M10.952 28.42A14.558 14.558 0 0 1 10.2 24c0-1.534.264-3.026.752-4.42V13.327H2.87A23.997 23.997 0 0 0 .48 24c0 3.868.925 7.527 2.39 10.673l8.082-6.253z"/>
                    <path fill="#EA4335" d="M24.48 9.617c3.546 0 6.727 1.22 9.231 3.617l6.922-6.922C36.457 2.43 30.992 0 24.48 0 15.076 0 6.845 5.062 2.87 13.327l8.082 6.253c1.904-5.713 7.234-9.963 13.528-9.963z"/>
                  </svg>
                  {googleReady ? 'Cadastrar com Google' : 'Carregando Google...'}
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
                    autoComplete="email"
                    name="email"
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
                    autoComplete="current-password"
                    name="password"
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

                {/* Botão Google no Login */}
                <div className="pt-2 border-t border-white/5 flex flex-col items-center gap-3">

                  <button
                    type="button"
                    onClick={handleGoogleButtonClick}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-100 transition-all shadow-md disabled:opacity-50 text-sm"
                  >
                    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M47.532 24.552c0-1.636-.147-3.2-.422-4.701H24.48v8.89h12.984c-.56 3.018-2.26 5.578-4.817 7.29v6.055h7.796c4.56-4.202 7.09-10.396 7.09-17.534z"/>
                      <path fill="#34A853" d="M24.48 48c6.516 0 11.982-2.161 15.976-5.865l-7.796-6.055c-2.161 1.447-4.927 2.303-8.18 2.303-6.294 0-11.624-4.25-13.528-9.963H2.87v6.253C6.845 42.938 15.076 48 24.48 48z"/>
                      <path fill="#FBBC05" d="M10.952 28.42A14.558 14.558 0 0 1 10.2 24c0-1.534.264-3.026.752-4.42V13.327H2.87A23.997 23.997 0 0 0 .48 24c0 3.868.925 7.527 2.39 10.673l8.082-6.253z"/>
                      <path fill="#EA4335" d="M24.48 9.617c3.546 0 6.727 1.22 9.231 3.617l6.922-6.922C36.457 2.43 30.992 0 24.48 0 15.076 0 6.845 5.062 2.87 13.327l8.082 6.253c1.904-5.713 7.234-9.963 13.528-9.963z"/>
                    </svg>
                    {googleReady ? 'Entrar com Google' : 'Carregando Google...'}
                  </button>

                  <div className="flex justify-between w-full text-[10px] font-bold tracking-widest uppercase">
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