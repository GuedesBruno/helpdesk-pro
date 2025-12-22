// src/components/AuthScreen.jsx
'use client';
import { useState } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { LogIn, UserPlus, AlertCircle, Loader2, Mail } from 'lucide-react';
import { getAuthErrorMessage } from '@/lib/auth';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name.trim()) throw new Error('Nome é obrigatório.');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: name });

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: name,
          email: email,
          role: 'user',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(getAuthErrorMessage(err.code) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Create user if first time
        await setDoc(userDocRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          role: 'user',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Google Auth error:", err);
      setError(getAuthErrorMessage(err.code) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Digite seu email para recuperar a senha.');
      return;
    }
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      console.error("Reset Password error:", err);
      setError(getAuthErrorMessage(err.code) || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">Recuperar Senha</h1>
            <p className="mt-2 text-slate-600">Digite seu email para receber o link de redefinição.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-100 rounded-md">
              <AlertCircle className="w-4 h-4" /> <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 text-sm text-green-700 bg-green-100 rounded-md">
              <Mail className="w-4 h-4" /> <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold text-white transition-colors bg-tec-blue rounded-md hover:bg-tec-blue-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tec-blue disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Email'}
            </button>
          </form>
          <div className="text-center">
            <button onClick={() => setShowForgotPassword(false)} className="text-sm text-slate-600 hover:text-slate-800">
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800">Helpdesk Tecassistiva</h1>
          <p className="mt-2 text-slate-600">
            {isLogin ? 'Faça login para continuar' : 'Crie sua conta'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-100 rounded-md">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-slate-700 transition-colors bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Entrar com Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 bg-white text-slate-500">Ou com email</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 mt-1 border rounded-md shadow-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
              minLength={6}
            />
            {isLogin && (
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold text-white transition-colors bg-tec-blue rounded-md hover:bg-tec-blue-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tec-blue disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
          </button>
        </div>
      </div>
    </div>
  );
}
