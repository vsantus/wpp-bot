const { google } = require('googleapis');
const path = require('path');
const credentials = require('./google-credentials.json'); // caminho para seu JSON

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const SPREADSHEET_ID = '1S0M7_PaVv5jk51vzGQyYDOnGkFgaElYzTV5Sb5kOCYU';

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES
});

async function getClient() {
    return await auth.getClient();
}

async function registrarAgendamento({ nome, telefone, servico, horario, pagamento }) {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const novaLinha = [[
        new Date().toLocaleDateString('pt-BR'),
        horario,
        nome,
        telefone,
        'Agendado',
        `Serviço: ${servico}, Pagamento: ${pagamento}`
    ]];

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Agendamentos!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: novaLinha
        }
    });
}

module.exports = { salvarAgendamento: registrarAgendamento };

