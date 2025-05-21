const { salvarAgendamento, listarHorariosDisponiveis} = require('./sheets');
const { salvarNomeUsuario, buscarCliente } = require('./firebase');
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
        await sock.sendMessage(sender, { text: '✅ Atendimento encerrado. \n Quando quiser, é só mandar mensagem de novo!' });
        return;
    }

    // Voltar à etapa anterior
    if (entrada === 'voltar' && estado.historico.length > 0) {
        estado.etapa = estado.historico.pop();
        await sock.sendMessage(sender, { text: '🔙 Voltando à etapa anterior...' });
        return handleMessage(sock, msg); // Reprocessa a mensagem atual
    }

    if (!estado.nomeVerificado) {
        const cliente = await buscarCliente(sender);
        if (!cliente) {
            estado.etapa = 'solicitar_nome';
            estado.nomeVerificado = true;
            await sock.sendMessage(sender, {
                text: '👋 Olá! Antes de começarmos, qual o seu *nome*?'
            });
            return;
        } else {
            estado.nome = cliente.nome;
            estado.nomeVerificado = true;
        }
    }

    switch (etapaAtual) {
        case 'solicitar_nome':
            if (entrada.length < 2) {
                await sock.sendMessage(sender, {
                    text: '❌ Nome inválido. Digite seu nome completo, por favor.'
                });
                return;
            }

            estado.nome = texto;
            await salvarNomeUsuario(sender, texto);
            estado.etapa = 'inicio';
            await sock.sendMessage(sender, {
                text: `✅ Obrigado, ${texto}! Agora sim, vamos começar.`
            });
            return handleMessage(sock, msg);

        case 'inicio':
            if (!['1', '2', '3', '4'].includes(entrada)) {
                await delay(2000);
                await sock.sendMessage(sender, {
                    text: `Olá ${estado.nome}, Como posso te ajudar?\n1. 🗓️ Realizar agendamento\n2. 💰 Preços\n3. 📍 Endereço\n4. 🔎 Meus agendamentos\n\n↩️ _Digite "Sair" para encerrar o Atendimento._`
                });
            } else {
                estado.historico.push('inicio');
                switch (entrada) {
                    case '1':
                        estado.etapa = 'servico';
                        await delay(2000);
                        await sock.sendMessage(sender, {
                            text: 'Qual serviço você deseja agendar?\n1. Corte\n2. Barba\n3. Sobrancelha\n4. Corte + Barba\n5. Corte + Sobrancelha\n6. Corte + Barba + Sobrancelha\n\n↩️ _Digite "Voltar" para retornar._'
                        });
                        break;
                    case '2':
                        await delay(1000);
                        await sock.sendMessage(sender, {
                            text: '💈 *Preços:*\nCorte: R$30\nBarba: R$20\nSobrancelha: R$15\nCorte + Barba: R$45\nCorte + Sobrancelha: R$40\nCorte + Barba + Sobrancelha: R$60\n\n↩️ _Digite "Voltar" para retornar._'
                        });
                        break;
                    case '3':
                        await delay(1000);
                        await sock.sendMessage(sender, {
                            text: '📍 Nosso endereço é Rua Alamedas, 1234 - Centro\n\n↩️ _Digite "Voltar" para retornar._'
                        });
                        break;
                    case '4':
                        await delay(1000);
                        await sock.sendMessage(sender, {
                            text: '📅 Seus agendamentos são: (exemplo de agendamento aqui)'
                        });
                        break;
                }
            }
            break;

        case 'servico':
            const servicos = {
                '1': { nome: 'Corte', valor: 30 },
                '2': { nome: 'Barba', valor: 20 },
                '3': { nome: 'Sobrancelha', valor: 15 },
                '4': { nome: 'Corte + Barba', valor: 45 },
                '5': { nome: 'Corte + Sobrancelha', valor: 40 },
                '6': { nome: 'Corte + Barba + Sobrancelha', valor: 60 }
            };

            if (servicos[entrada]) {
                const servico = servicos[entrada];
                estado.servicoEscolhido = servico.nome;
                estado.valorEscolhido = servico.valor;
                estado.historico.push('servico');
                estado.etapa = 'horario';

                const horarios = await listarHorariosDisponiveis();
                estado.horariosDisponiveis = horarios;

                if (horarios.length === 0) {
                    await sock.sendMessage(sender, {
                        text: '⚠️ No momento não há horários disponíveis. Tente novamente mais tarde.'
                    });
                    estado.etapa = 'inicio';
                    return;
                }

                const listaHorarios = horarios.map((h, i) => `${i + 1}. ${h}`).join('\n');
                await delay(2000);
                await sock.sendMessage(sender, {
                    text: `📅 Escolha um horário disponível:\n${listaHorarios}\n\n↩️ _Digite "Voltar" para retornar._`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Opção inválida. Escolha um número de 1 a 6 ou digite "Voltar".'
                });
            }
            break;

        case 'horario':
            const idx = parseInt(entrada);
            const lista = estado.horariosDisponiveis || [];

            if (!isNaN(idx) && idx >= 1 && idx <= lista.length) {
                estado.horarioEscolhido = lista[idx - 1];
                estado.historico.push('horario');
                estado.etapa = 'pagamento';

                await delay(2000);
                await sock.sendMessage(sender, {
                    text: '🧾 Agora escolha a forma de pagamento:\n1. Pix\n2. Dinheiro\n3. Cartão\n\n↩️ _Digite "Voltar" para retornar._'
                });

            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Opção inválida. Escolha um número válido da lista de horários ou digite "Voltar".'
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
                await delay(2000);

                try {
                    await salvarAgendamento({
                        nome: estado.nome,
                        telefone: sender,
                        servico: estado.servicoEscolhido,
                        valor: estado.valorEscolhido,
                        horario: estado.horarioEscolhido,
                        pagamento: estado.pagamentoEscolhido,
                        data: new Date().toLocaleString()
                    });
                } catch (error) {
                    console.error('Erro ao salvar no Sheets:', error);
                    await sock.sendMessage(sender, {
                        text: '⚠️ Ocorreu um problema ao salvar seu agendamento. Por favor, tente novamente mais tarde.'
                    });
                    return;
                }

                await sock.sendMessage(sender, {
                    text:
                        `✅ *Agendamento confirmado!*\n\n` +
                        `💈 *Serviço:* ${estado.servicoEscolhido}\n` +
                        `💰 *Valor:* R$${estado.valorEscolhido}\n` +
                        `🕒 *Horário:* ${estado.horarioEscolhido}\n` +
                        `💳 *Pagamento:* ${estado.pagamentoEscolhido}\n\n` +
                        `Agradecemos pela preferência, ${estado.nome}! 😊`
                });

                delete estados[sender];
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Opção inválida. Escolha uma forma de pagamento ou digite "Voltar".'
                });
            }
            break;
    }
}

module.exports = { handleMessage };
