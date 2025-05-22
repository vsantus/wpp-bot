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

async function marcarHorarioComoIndisponivel(horarioEscolhido) {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const resposta = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Disponiveis!A2:C', // Considerando que os dados começam na linha 2
    });

    const linhas = resposta.data.values || [];

    // Procura a linha que contém o horário escolhido
    const linhaIndex = linhas.findIndex(linha => linha[1] === horarioEscolhido);

    if (linhaIndex === -1) {
        throw new Error(`Horário ${horarioEscolhido} não encontrado na planilha`);
    }

    // A planilha começa na linha 2, então somamos 2 ao índice
    const linhaParaAtualizar = linhaIndex + 2;

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Disponiveis!C${linhaParaAtualizar}`, // Coluna C = Disponível?
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [['não']]
        }
    });
}

async function buscarAgendamentosPorTelefone(telefone) {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const resposta = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Agendamento!A2:G',
    });

    const linhas = resposta.data.values || [];

    // Filtra os agendamentos que correspondem ao telefone
    const agendamentos = linhas.filter(linha => linha[3] === telefone);

    return agendamentos.map(linha => ({
        data: linha[0],
        horario: linha[1],
        nome: linha[2],
        telefone: linha[3],
        status: linha[4],
        servico: linha[5],
        pagamento: linha[6]
    }));
}

module.exports = {
    salvarAgendamento: registrarAgendamento,
    listarHorariosDisponiveis,
    buscarAgendamentosPorTelefone, // <-- nova função exportada
};



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
    listarHorariosDisponiveis, marcarHorarioComoIndisponivel, buscarAgendamentosPorTelefone
};


