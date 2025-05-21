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

async function listarHorariosDisponiveis() {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const resposta = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Disponiveis!A2:C', // Começa da linha 2 para ignorar o cabeçalho
    });

    const linhas = resposta.data.values || [];

    const horariosDisponiveis = linhas
        .filter(linha => linha[2]?.toLowerCase() === 'sim') // coluna C (índice 2)
        .map(linha => linha[1]); // coluna B (índice 1) = horário

    return horariosDisponiveis;
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
        `${servico}`, 
        `${pagamento}`
    ]];

    await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Agendamento!A2', // <- corrigido aqui
    valueInputOption: 'USER_ENTERED',
    requestBody: {
        values: novaLinha
    }
});

}

module.exports = {
    salvarAgendamento: registrarAgendamento,
    listarHorariosDisponiveis
};


