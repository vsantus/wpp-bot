const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { handleMessage } = require('./flow'); // <-- importa o fluxo aqui

let sock;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, './auth'));
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom &&
        statusCode !== DisconnectReason.loggedOut;

      console.log('🔁 Conexão fechada. Reconectar?', shouldReconnect);

      if (shouldReconnect) {
        startBot();
      } else if (statusCode === DisconnectReason.loggedOut) {
        console.log('⚠️ Bot foi deslogado. Será necessário escanear o QR Code novamente.');
      }
    } else if (connection === 'open') {
      console.log('✅ Bot conectado com sucesso!');
    }
  });

  // Chama o handler de mensagens
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages || !messages[0]) return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    await handleMessage(sock, msg);
  });
}

startBot();
