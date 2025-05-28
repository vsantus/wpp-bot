//config de funções x planilhas

const { google } = require('googleapis');
const path = require('path');
const credentials = require('../services/google-credentials.json'); // caminho para seu JSON

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const SPREADSHEET_ID = '1S0M7_PaVv5jk51vzGQyYDOnGkFgaElYzTV5Sb5kOCYU';
;
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

async function cancelarAgendamento({ telefone, horarioEscolhido }) {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // === PASSO 1: Buscar agendamento por telefone e horário e marcar como Cancelado ===
    const resAgendamento = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Agendamento!A2:G',
    });

    const linhasAgendamento = resAgendamento.data.values || [];
    let linhaAgendamentoIndex = -1;

    for (let i = 0; i < linhasAgendamento.length; i++) {
        const linha = linhasAgendamento[i];
        const linhaTelefone = linha[3];
        const linhaHorario = linha[1];
        const status = linha[4];

        if (linhaTelefone === telefone && linhaHorario === horarioEscolhido && status === 'Agendado') {
            linhaAgendamentoIndex = i;
            break;
        }
    }

    if (linhaAgendamentoIndex === -1) {
        console.log('Nenhum agendamento encontrado para esse telefone e horário.');
        return;
    }

    const rangeStatusAgendamento = `Agendamento!E${linhaAgendamentoIndex + 2}`; // +2 porque começa na linha 2
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: rangeStatusAgendamento,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Cancelado']] }
    });

    console.log('Agendamento marcado como Cancelado.');

    // === PASSO 2: Marcar horário como disponível na planilha Disponiveis ===
    const resDisponiveis = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Disponiveis!B2:D',
    });

    const linhasDisponiveis = resDisponiveis.data.values || [];
    let linhaDisponivelIndex = -1;

    for (let i = 0; i < linhasDisponiveis.length; i++) {
        const linha = linhasDisponiveis[i];
        const dia = linha[0];
        const hora = linha[1];
        const horarioFormatado = `${dia} às ${hora}h`;

        if (horarioFormatado === horarioEscolhido) {
            linhaDisponivelIndex = i;
            break;
        }
    }

    if (linhaDisponivelIndex === -1) {
        console.log('Horário não encontrado na planilha Disponiveis.');
        return;
    }

    const rangeDisponivel = `Disponiveis!D${linhaDisponivelIndex + 2}`; // +2 porque começa na linha 2
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: rangeDisponivel,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['sim']] }
    });

    const rangeTelefone = `Agendamento!D${linhaAgendamentoIndex + 2}`; // Coluna D (índice 3)
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: rangeTelefone,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['x']] } // célula vazia
    });

    console.log('Telefone apagado da célula linha[3].');

    console.log(`Horário ${horarioEscolhido} marcado como disponível.`);

    console.log('Cancelamento concluído com sucesso!');
}

module.exports = {
    salvarAgendamento: registrarAgendamento,
    listarHorariosDisponiveis, marcarHorarioComoIndisponivel,
    buscarAgendamentosPorTelefone, cancelarAgendamento
};


