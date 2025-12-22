// src/components/OnlineToggle.jsx
'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { redistributeOrphanTickets } from '@/lib/queueDistribution';

export default function OnlineToggle({ user }) {
    const [isOnline, setIsOnline] = useState(user.isOnline || false);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        setIsOnline(user.isOnline || false);
    }, [user.isOnline]);

    const handleToggle = async () => {
        setUpdating(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const newStatus = !isOnline;

            await updateDoc(userRef, {
                isOnline: newStatus,
                lastOnlineAt: new Date(),
            });

            setIsOnline(newStatus);

            // Se ficou online, redistribuir chamados órfãos
            if (newStatus === true) {
                console.log('Atendente ficou online, redistribuindo chamados órfãos...');
                const redistributed = await redistributeOrphanTickets();
                if (redistributed > 0) {
                    console.log(`${redistributed} chamado(s) redistribuído(s)`);
                }
            }
        } catch (error) {
            console.error('Erro ao atualizar status online:', error);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-indigo-200 font-medium">
                {isOnline ? 'Online' : 'Offline'}
            </span>

            <button
                onClick={handleToggle}
                disabled={updating}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isOnline ? 'bg-green-500' : 'bg-gray-400'
                    } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={isOnline ? 'Clique para ficar offline' : 'Clique para ficar online'}
            >
                <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isOnline ? 'translate-x-5' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );
}
