const estados = {}; // Armazena o estado de cada usuário

async function handleMessage(sock, msg) {
    const sender = msg.key.remoteJid;
    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const entrada = texto?.trim().toLowerCase();
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    if (!estados[sender]) {
        estados[sender] = { etapa: 'inicio', historico: [] };

        estados[sender].timeout = setTimeout(async () => {
            await sock.sendMessage(sender, {
                text: '⏳ O atendimento foi encerrado por inatividade ou tempo limite.\nCaso precise de algo, é só mandar uma nova mensagem!'
            });
            delete estados[sender];
        }, 10 * 60 * 1000); // 10 minutos
    }

    const estado = estados[sender];
    const etapaAtual = estado.etapa;

    // Encerrar manualmente
    if (entrada === 'sair') {
        clearTimeout(estado.timeout);
        delete estados[sender];
        await sock.sendMessage(sender, { text: '✅ Atendimento encerrado. Quando quiser, é só mandar mensagem de novo!' });
        return;
    }

    // Voltar à etapa anterior
    if (entrada === 'voltar' && estado.historico.length > 0) {
        estado.etapa = estado.historico.pop();
        await sock.sendMessage(sender, { text: '🔙 Voltando à etapa anterior...' });
        return handleMessage(sock, msg); // Reprocessa a mensagem atual
    }

    switch (etapaAtual) {
        case 'inicio':
            if (!['1', '2', '3', '4'].includes(entrada)) {
                await delay(3000);
                await sock.sendMessage(sender, {
                    text: 'Como posso te ajudar?\n1. 🗓️ Realizar agendamento\n2. 💰 Preços\n3. 🗺️ Endereço\n4. 🔎 Meus agendamentos\n\n↩️ Digite "sair" para encerrar o Atendimento.'
                });
            } else {
                estado.historico.push('inicio');
                switch (entrada) {
                    case '1':
                        estado.etapa = 'servico';
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Qual serviço você deseja agendar?\n1. Corte\n2. Barba\n3. Sobrancelha\n4. Corte + Barba\n5. Corte + Sobrancelha\n6. Corte + Barba + Sobrancelha\n\n↩️ Digite "voltar" para retornar.'
                        });
                        break;
                    case '2':
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Os preços são:\nCorte: R$30\nBarba: R$20\nSobrancelha: R$15'
                        });
                        break;
                    case '3':
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Nosso endereço é Rua Alamedas, 1234 - Centro'
                        });
                        break;
                    case '4':
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Seus agendamentos são: (exemplo de agendamento aqui)'
                        });
                        break;
                }
            }
            break;

        case 'servico':
            const servicos = {
                '1': 'Corte',
                '2': 'Barba',
                '3': 'Sobrancelha',
                '4': 'Corte + Barba',
                '5': 'Corte + Sobrancelha',
                '6': 'Corte + Barba + Sobrancelha'
            };
            if (servicos[entrada]) {
                estado.servicoEscolhido = servicos[entrada];
                estado.historico.push('servico');
                estado.etapa = 'horario';
                await delay(3000);
                await sock.sendMessage(sender, {
                    text: `📅 Agora escolha um horário para ${servicos[entrada]}:\n1. Sexta - 13h\n2. Sexta - 15h\n\n↩️ Digite "voltar" para retornar.`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: 'Opção inválida. Escolha um número de 1 a 6 ou digite "voltar".'
                });
            }
            break;

        case 'horario':
            const horarios = {
                '1': 'Sexta - 13h',
                '2': 'Sexta - 15h'
            };
            if (horarios[entrada]) {
                estado.horarioEscolhido = horarios[entrada];
                estado.historico.push('horario');
                estado.etapa = 'pagamento';
                await delay(3000);
                await sock.sendMessage(sender, {
                    text: '🧾 Agora escolha a forma de pagamento:\n1. Pix\n2. Dinheiro\n3. Cartão\n\n↩️ Digite "voltar" para retornar.'
                });
            } else {
                await sock.sendMessage(sender, {
                    text: 'Opção inválida. Digite 1 ou 2 para escolher um horário ou "voltar".'
                });
            }
            break;

        case 'pagamento':
            const pagamentos = {
                '1': 'Pix',
                '2': 'Dinheiro',
                '3': 'Cartão'
            };
            if (pagamentos[entrada]) {
                estado.pagamentoEscolhido = pagamentos[entrada];
                estado.etapa = 'finalizado';
                await delay(3000);
                await sock.sendMessage(sender, {
                    text: `✅ Agendamento confirmado!\n✂️ Serviço: ${estado.servicoEscolhido}\n🕒 Horário: ${estado.horarioEscolhido}\n💰 Pagamento: ${pagamentos[entrada]}\n\nObrigado! Até breve.`
                });
                clearTimeout(estado.timeout);
                delete estados[sender];
            } else {
                await sock.sendMessage(sender, {
                    text: 'Opção inválida. Escolha 1, 2 ou 3 ou digite "voltar".'
                });
            }
            break;
    }
}

module.exports = { handleMessage };
