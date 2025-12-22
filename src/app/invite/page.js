// src/app/invite/page.js
'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

function InvitePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(true);
    const [invite, setInvite] = useState(null);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Token de convite inválido');
            setLoading(false);
            return;
        }

        loadInvite();
    }, [token]);

    const loadInvite = async () => {
        try {
            const inviteRef = doc(db, 'invites', token);
            const inviteDoc = await getDoc(inviteRef);

            if (!inviteDoc.exists()) {
                setError('Convite não encontrado');
                setLoading(false);
                return;
            }

            const inviteData = inviteDoc.data();

            // Verificar se já foi usado
            if (inviteData.status === 'accepted') {
                setError('Este convite já foi utilizado');
                setLoading(false);
                return;
            }

            // Verificar se expirou (7 dias)
            const expiresAt = inviteData.expiresAt.toDate();
            if (new Date() > expiresAt) {
                setError('Este convite expirou');
                setLoading(false);
                return;
            }

            setInvite(inviteData);
            setLoading(false);
        } catch (error) {
            console.error('Erro ao carregar convite:', error);
            setError('Erro ao carregar convite');
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        setSubmitting(true);

        try {
            // Criar conta no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                invite.email,
                password
            );

            const user = userCredential.user;

            // Criar documento do usuário com role do convite
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                name: name,
                email: invite.email,
                role: invite.role,
                department: invite.department,
                departmentName: invite.departmentName || '',
                createdAt: new Date(),
                isOnline: false,
                ticketsAssigned: 0,
            });

            // Marcar convite como aceito
            await updateDoc(doc(db, 'invites', token), {
                status: 'accepted',
                usedAt: new Date(),
                acceptedBy: user.uid,
            });

            // Redirecionar para home
            router.push('/');
        } catch (error) {
            console.error('Erro ao criar conta:', error);
            if (error.code === 'auth/email-already-in-use') {
                setError('Este email já está em uso');
            } else {
                setError('Erro ao criar conta: ' + error.message);
            }
            setSubmitting(false);
        }
    };

    const getRoleLabel = (role) => {
        const labels = {
            colaborador: 'Colaborador',
            atendente: 'Atendente',
            admin: 'Administrador'
        };
        return labels[role] || role;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
                <Loader2 className="w-8 h-8 text-tec-blue animate-spin" />
            </div>
        );
    }

    if (error && !invite) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
                <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-red-600">❌ Erro</h1>
                        <p className="mt-4 text-slate-600">{error}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="px-6 py-2 mt-6 text-white bg-tec-blue rounded-md hover:bg-tec-blue-light"
                        >
                            Ir para Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-tec-blue">Helpdesk Teca</h1>
                    <p className="mt-2 text-slate-600">Complete seu cadastro</p>
                </div>

                <div className="p-4 mb-6 bg-blue-50 rounded-lg">
                    <p className="text-sm text-slate-700">
                        Você foi convidado como <strong>{getRoleLabel(invite.role)}</strong>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                        Email: <strong>{invite.email}</strong>
                    </p>
                </div>

                {error && (
                    <div className="p-4 mb-4 text-red-700 bg-red-100 border border-red-400 rounded">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                            Nome Completo
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                            required
                            placeholder="Seu nome"
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                            Senha
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                            required
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                            Confirmar Senha
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-1 focus:ring-tec-blue"
                            required
                            placeholder="Digite a senha novamente"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full px-4 py-3 text-white bg-tec-blue rounded-md hover:bg-tec-blue-light disabled:opacity-50 font-semibold"
                    >
                        {submitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Criando conta...
                            </span>
                        ) : (
                            'Criar Conta'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function InvitePage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
                <Loader2 className="w-8 h-8 text-tec-blue animate-spin" />
            </div>
        }>
            <InvitePageContent />
        </Suspense>
    );
}
