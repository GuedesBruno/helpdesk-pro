// src/lib/firebase-test.js
// Script de diagnóstico para verificar configuração do Firebase
// Execute este arquivo temporariamente para debugar

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

console.log("🔍 DIAGNÓSTICO FIREBASE - INICIANDO...\n");

// 1. Verificar variáveis de ambiente
console.log("1️⃣ Verificando variáveis de ambiente:");
const envVars = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

Object.entries(envVars).forEach(([key, value]) => {
  const status = value ? "✅" : "❌";
  const display = value ? `${value.substring(0, 20)}...` : "MISSING";
  console.log(`  ${status} ${key}: ${display}`);
});

const allDefined = Object.values(envVars).every(v => v);
console.log(`\n  Resultado: ${allDefined ? "✅ Todas definidas" : "❌ Variáveis faltando!"}\n`);

if (!allDefined) {
  console.error("❌ ERRO: Configure o arquivo .env.local na raiz do projeto!");
  console.log("\nExemplo de .env.local:");
  console.log("NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...");
  console.log("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com");
  console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto-id");
  console.log("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com");
  console.log("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789");
  console.log("NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123\n");
  process.exit(1);
}

// 2. Tentar inicializar Firebase
console.log("2️⃣ Inicializando Firebase App:");
try {
  const app = !getApps().length ? initializeApp(envVars) : getApps()[0];
  console.log(`  ✅ App inicializado: ${app.name}`);
  console.log(`  ✅ Project ID: ${app.options.projectId}\n`);
} catch (error) {
  console.error(`  ❌ Erro ao inicializar: ${error.message}\n`);
  process.exit(1);
}

// 3. Verificar Auth
console.log("3️⃣ Verificando Firebase Authentication:");
try {
  const auth = getAuth();
  console.log(`  ✅ Auth configurado`);
  console.log(`  ✅ Auth Domain: ${auth.config.authDomain}\n`);
} catch (error) {
  console.error(`  ❌ Erro no Auth: ${error.message}\n`);
}

// 4. Verificar Firestore
console.log("4️⃣ Verificando Firestore Database:");
try {
  const db = getFirestore();
  console.log(`  ✅ Firestore instance criada`);
  console.log(`  ℹ️  Tentando conectar ao Firestore...\n`);
  
  // Tentar ler uma coleção (teste de conexão)
  console.log("5️⃣ Testando conexão com Firestore:");
  getDocs(collection(db, "users"))
    .then((snapshot) => {
      console.log(`  ✅ CONEXÃO ESTABELECIDA!`);
      console.log(`  ✅ Documentos na coleção 'users': ${snapshot.size}`);
      console.log("\n✅ DIAGNÓSTICO COMPLETO - TUDO OK!\n");
    })
    .catch((error) => {
      console.error(`  ❌ ERRO DE CONEXÃO: ${error.code}`);
      console.error(`  ❌ Mensagem: ${error.message}\n`);
      
      if (error.code === "unavailable") {
        console.log("💡 SOLUÇÃO:");
        console.log("  1. Verifique se o Firestore Database está CRIADO no Firebase Console");
        console.log("  2. Acesse: https://console.firebase.google.com/");
        console.log("  3. Vá em 'Firestore Database' e crie o banco de dados");
        console.log("  4. Configure as regras de segurança (veja firebase_debug_guide.md)\n");
      }
      
      if (error.code === "permission-denied") {
        console.log("💡 SOLUÇÃO:");
        console.log("  1. As regras de segurança do Firestore estão bloqueando o acesso");
        console.log("  2. Vá em Firebase Console → Firestore Database → Regras");
        console.log("  3. Use as regras fornecidas no firebase_debug_guide.md\n");
      }
    });
} catch (error) {
  console.error(`  ❌ Erro ao criar Firestore: ${error.message}\n`);
}

export {};
