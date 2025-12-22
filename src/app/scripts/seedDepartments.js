// scripts/seedDepartments.js
// Script para adicionar departamentos padrão ao Firestore
// Execute com: node scripts/seedDepartments.js

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // Você precisará baixar isso do Firebase Console

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const defaultDepartments = [
    {
        code: 'support',
        name: 'Suporte Técnico',
        description: 'Atendimento técnico e suporte aos usuários',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
        code: 'financial',
        name: 'Financeiro',
        description: 'Questões financeiras e pagamentos',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    {
        code: 'hr',
        name: 'Recursos Humanos',
        description: 'Gestão de pessoas e benefícios',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
];

async function seedDepartments() {
    console.log('🌱 Iniciando seed de departamentos...');

    try {
        for (const dept of defaultDepartments) {
            const deptRef = db.collection('departments').doc(dept.code);
            const deptDoc = await deptRef.get();

            if (deptDoc.exists) {
                console.log(`⏭️  Departamento "${dept.name}" já existe, pulando...`);
            } else {
                await deptRef.set(dept);
                console.log(`✅ Departamento "${dept.name}" criado com sucesso!`);
            }
        }

        console.log('\n🎉 Seed de departamentos concluído!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao criar departamentos:', error);
        process.exit(1);
    }
}

seedDepartments();
