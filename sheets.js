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
        range: 'Disponiveis!B2:D', // B = dia, C = hora, D = disponível
    });

    const linhas = resposta.data.values || [];

    // Encontrar a linha com o horário exato
    const linhaIndex = linhas.findIndex(linha => {
        const dia = linha[0];
        const hora = linha[1];
        const horarioFormatado = `${dia} às ${hora}h`;
        return horarioFormatado === horarioEscolhido;
    });

    if (linhaIndex === -1) {
        throw new Error(`Horário ${horarioEscolhido} não encontrado na planilha`);
    }

    const linhaParaAtualizar = linhaIndex + 2; // +2 porque começa na linha 2

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Disponiveis!D${linhaParaAtualizar}`, // Coluna D = Disponível?
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [['não']]
        }
    });

    console.log(`Horário ${horarioEscolhido} marcado como indisponível.`);
}

async function buscarAgendamentosPorTelefone(telefone) {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const resposta = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Agendamento!A2:G',
    });

    const linhas = resposta.data.values || [];

    return linhas
        .filter(linha => linha[3] === telefone)
        .map(linha => ({
            criado: linha[0],
            horario: linha[1],
            nome: linha[2],
            telefone: linha[3],
            status: linha[4],
            servico: linha[5],
            pagamento: linha[6]
        }));
}

async function listarHorariosDisponiveis() {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const resposta = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Disponiveis!B2:D', // Ignora o cabeçalho
    });

    const linhas = resposta.data.values || [];

    const horariosDisponiveis = linhas
        .filter(linha => linha[2]?.toLowerCase() === 'sim') // Disponível (coluna D)
        .map(linha => `${linha[0]} às ${linha[1]}h`); // Dia + Horário

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
        range: 'Agendamento!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: novaLinha
        }
    });
}





module.exports = {
    salvarAgendamento: registrarAgendamento,
    listarHorariosDisponiveis, marcarHorarioComoIndisponivel, buscarAgendamentosPorTelefone, cancelarAgendamento
};


