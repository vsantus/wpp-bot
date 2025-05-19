const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// IMPORTA A CHAVE DO SERVIÇO
const serviceAccount = require('./bot-wpp-baileys-firebase-adminsdk-fbsvc-30b0f09704.json');

// INICIALIZA O FIREBASE USANDO A CHAVE
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();

async function salvarNomeUsuario(numero, nome) {
    const clienteRef = db.collection('clientes').doc(numero);
    await clienteRef.set({
        nome,
        criadoEm: new Date()
    }, { merge: true });
}

async function buscarCliente(numero) {
    const doc = await db.collection('clientes').doc(numero).get();
    return doc.exists ? doc.data() : null;
}

module.exports = { salvarNomeUsuario, buscarCliente };
