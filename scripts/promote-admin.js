// scripts/promote-admin.js
// Script para promover um usuário a admin
// Execute: node scripts/promote-admin.js SEU_EMAIL@example.com

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function promoteToAdmin(email) {
    try {
        console.log(`Procurando usuário com email: ${email}...`);

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.error('❌ Usuário não encontrado!');
            return;
        }

        const userDoc = querySnapshot.docs[0];
        const userRef = doc(db, 'users', userDoc.id);

        await updateDoc(userRef, {
            role: 'admin'
        });

        console.log('✅ Usuário promovido a ADMIN com sucesso!');
        console.log(`   Nome: ${userDoc.data().name}`);
        console.log(`   Email: ${userDoc.data().email}`);
        console.log(`   Role: admin`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }

    process.exit(0);
}

const email = process.argv[2];

if (!email) {
    console.error('❌ Uso: node scripts/promote-admin.js SEU_EMAIL@example.com');
    process.exit(1);
}

promoteToAdmin(email);
