//flow de conversa do bot com usuario

const { salvarAgendamento, listarHorariosDisponiveis, marcarHorarioComoIndisponivel, buscarAgendamentosPorTelefone, cancelarAgendamento } = require('./sheets');
const { salvarNomeUsuario, buscarCliente } = require('./firebase');
const estados = {}; // Armazena o estado de cada usuário

async function handleMessage(sock, msg) {
    const sender = msg.key.remoteJid;
    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const entrada = texto.trim().toLowerCase();
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Inicializa estado se não existir
    if (!estados[sender]) {
        estados[sender] = { etapa: 'inicio', historico: [], nomeVerificado: false };
        iniciarTimeout(sender, sock);
    } else {
        // Resetar timeout a cada interação do usuário
        clearTimeout(estados[sender].timeout);
        iniciarTimeout(sender, sock);
    }

    const estado = estados[sender];
    const etapaAtual = estado.etapa;


    // Função de encerramento 
    async function encerrarAtendimento(user, sock, motivo = 'inatividade') {
        const estado = estados[user];
        if (!estado) return;

        clearTimeout(estado.timeout);

        let mensagem = motivo === 'manual'
            ? '✅ Atendimento encerrado. Se precisar, é só chamar novamente!'
            : '⏳ O atendimento foi encerrado por inatividade ou tempo limite.\nCaso precise de algo, é só mandar uma nova mensagem!';

        await sock.sendMessage(user, { text: mensagem });

        delete estados[user];
        console.log('encerrando sem limpar estado -> ' + estado.historico);
    }

    // Encerrar atendimento 
    if (entrada === 'sair') {
        await encerrarAtendimento(sender, sock, 'manual');

        return;
    }

    async function voltarInicio(sock, user) { //criar uma function dessa em cada case, alterar delete para excluir etapa atual
        const estado = estados[user];
        if (!estado) return;

        clearTimeout(estado.timeout);
        estado.etapa = 'inicio';
        estado.historico.push = [];
        estado.nomeVerificado = false;
        delete estado.servicoEscolhido;
        delete estado.valorEscolhido;
        delete estado.horarioEscolhido;
        delete estado.pagamentoEscolhido;
        delete estado.horariosDisponiveis;

        await sock.sendMessage(user, {
            text: `🔄 Você voltou ao Menu. Como posso te ajudar?\n` +
                `1. 🗓️ Realizar agendamento\n` +
                `2. 💰 Valores\n` +
                `3. 📍 Endereço\n` +
                `4. 🔎 Meus agendamentos\n\n` +
                `↩️ _Digite "Sair" para encerrar o atendimento._`
        });

    }

    async function voltarEtapa(sock, user, etapa, texto, callback) {
    const estado = estados[user];
    if (!estado) return;

    if (estado.historico.length > 0) {
        estado.etapa = estado.historico.pop();
    } else {
        estado.etapa = etapa; // fallback
    }

    await sock.sendMessage(user, { text: texto });
    await callback(sock, user);
}


    async function voltarServico(sock, user) { // funcionando se o outro voltar estiver comentado ???

        const estado = estados[user];
        if (!estado) return;

        clearTimeout(estado.timeout);
        estado.historico = [];
        estado.nomeVerificado = false;
        delete estado.servicoEscolhido;


        await sock.sendMessage(sender, {
            text: 'Qual serviço você deseja agendar?\n' +
                '1. Corte\n2. Barba\n3. Sobrancelha\n4. Corte + Barba\n5. Corte + Sobrancelha\n6. Corte + Barba + Sobrancelha\n\n' +
                '↩️ _Digite "M" para retornar ao Menu._'
        });
        ;

    }

    async function voltarHorario(sock, user) { // funcionando se o outro voltar estiver comentado ??

        const estado = estados[user];
        if (!estado) return;

        clearTimeout(estado.timeout);
        estado.historico = [];
        estado.nomeVerificado = false;
        delete estado.horarioEscolhido;
    
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
                    text: `📅 Escolha um horário disponível:\n${listaHorarios}\n\n↩️ _Digite "Voltar" para retornar ao serviço._`
                });

                estado.historico.push('horario');
                return;


    }//criar uma function dessa em cada case, alterar delete para excluir etapa atual

    // Iniciar timeout
    function iniciarTimeout(user, sock) {
        estados[user].timeout = setTimeout(() => encerrarAtendimento(user, sock, 'inatividade'), 5 * 60 * 1000);
    }

    if (entrada === 'voltars') {
    await voltarEtapa(sock, sender, 'servico', '🔙 Voltando para Serviço...', voltarServico);
    return;
}

if (entrada === 'voltarh') {
    await voltarEtapa(sock, sender, 'horario', '🔙 Voltando para Horário...', voltarHorario);
    return;
}



    // Voltar para o Inicio *obs: lugares que nao tem estado, funciona a chamada para o menu
    if (entrada === 'Menu' && estado.historico.length >= 0) {
        await sock.sendMessage(sender, { text: '🔙 Voltando ao Menu...' });
        await voltarInicio(sock, sender);
        return;
    }

    // Verifica se nome do usuário já foi buscado ou salvo
    if (!estado.nomeVerificado) {
        const cliente = await buscarCliente(sender);
        if (!cliente) {
            estado.etapa = 'solicitar_nome';
            estado.nomeVerificado = true;
            await sock.sendMessage(sender, {
                text: '👋 Olá! Antes de começarmos, qual o seu *nome completo*? \n_Obs: Nome e Sobrenome_'
            });
            return;
        } else {
            estado.nome = cliente.nome;
            estado.nomeVerificado = true;
        }
    }



    // Atendimento por etapa
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
                text: `✅ Obrigado, ${texto}! \n Agora sim, vamos começar, como posso te ajudar?\n` +
                    `1. 🗓️ Realizar agendamento\n` +
                    `2. 💰 Valores\n` +
                    `3. 📍 Endereço\n` +
                    `4. 🔎 Meus agendamentos\n\n` +
                    `↩️ _Digite "Sair" para encerrar o atendimento._`
            });
            return;

        case 'inicio':
            if (!['1', '2', '3', '4'].includes(entrada)) {
                await delay(2000);
                await sock.sendMessage(sender, {
                    text: `Olá ${estado.nome}, como posso te ajudar?\n` +
                        `1. 🗓️ Realizar agendamento\n` +
                        `2. 💰 Valores\n` +
                        `3. 📍 Endereço\n` +
                        `4. 🔎 Meus agendamentos\n\n` +
                        `↩️ _Digite "Sair" para encerrar o atendimento._`
                });
                return;
            }
            estado.historico.push('inicio');
            console.log(estado.historico);

            switch (entrada) {
                case '1':
                    estado.etapa = 'servico'; // primeiro estado 
                    await delay(2000);
                    await sock.sendMessage(sender, {
                        text: 'Qual serviço você deseja agendar?\n' +
                            '1. Corte\n2. Barba\n3. Sobrancelha\n4. Corte + Barba\n5. Corte + Sobrancelha\n6. Corte + Barba + Sobrancelha\n\n' +
                            '↩️ _Digite "Menu" para retornar ao Menu._'
                    });
                    return;

                case '2':
                    await delay(1000);
                    await sock.sendMessage(sender, {
                        text: '💈 *Valores:*\n' +
                            'Corte: R$30\nBarba: R$20\nSobrancelha: R$15\nCorte + Barba: R$45\nCorte + Sobrancelha: R$40\nCorte + Barba + Sobrancelha: R$60\n\n' +
                            '↩️ _Digite "Menu" para retornar ao Menu._'
                    });
                    return;

                case '3':
                    await delay(1000);
                    await sock.sendMessage(sender, {
                        text: '📍 Nosso endereço é Rua Alamedas, 1234 - Centro\n\n ↩️ _Digite "Menu" para retornar ao Menu._'
                    });
                    return;

                case '4':
                    const agendamentos = await buscarAgendamentosPorTelefone(sender);
                    if (agendamentos.length === 0) {
                        await sock.sendMessage(sender, {
                            text: '📭 Você não possui nenhum agendamento até o momento.'
                        });
                        return;
                    } else {
                        // Armazenar os agendamentos no estado para usar na etapa seguinte
                        estado.agendamentos = agendamentos;
                        estado.etapa = 'cancelar_ou_ver'; // segundo estado 

                        const resposta = agendamentos.map((a, i) =>
                            `${i + 1}. 🗓️ *${a.horario}*\n` +
                            `• *Serviço:* ${a.servico}\n` +
                            `• *Status:* ${a.status}`
                        ).join('\n\n');

                        await sock.sendMessage(sender, {
                            text: `📅 *Seus agendamentos:*\n\n${resposta}\n\n` +
                                `Digite o *Número do agendamento* para cancelar \n\n *"M"* para voltar ao menu principal.`
                        });
                        return;
                    }

            }

        case 'cancelar_ou_ver':
            if (entrada === 'voltar') {
                estado.etapa = 'inicio';
                return;
            }

            const num = parseInt(entrada);
            const agendamentosAtuais = estado.agendamentos || [];

            if (!isNaN(num) && num >= 1 && num <= agendamentosAtuais.length) {
                const agendamentoSelecionado = agendamentosAtuais[num - 1];

                if (agendamentoSelecionado.status !== 'Agendado') {
                    await sock.sendMessage(sender, {
                        text: '❌ Esse agendamento não pode ser cancelado pois não está ativo.'
                    });
                    return;
                }

                // Chama a função cancelarAgendamento com telefone e horário
                try {
                    await cancelarAgendamento({
                        telefone: sender,
                        horarioEscolhido: agendamentoSelecionado.horario
                    });

                    await sock.sendMessage(sender, {
                        text: `✅ Agendamento no horário *${agendamentoSelecionado.horario}* foi *cancelado* com sucesso! \n Digite "Menu" para sair.`
                    });

                    await sock.sendMessage('5511934916872@s.whatsapp.net', { text: `*CANCELADO ❌* \n ${estado.nome}, ${agendamentoSelecionado.horario} ` });

                    // Após cancelar, volta para o início
                    estado.etapa = 'inicio';
                    return;

                } catch (error) {
                    console.error('Erro ao cancelar agendamento:', error);
                    await sock.sendMessage(sender, {
                        text: '⚠️ Ocorreu um erro ao cancelar o agendamento. Por favor, tente novamente.'
                    });
                    return;
                }

            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Número inválido. Por favor, digite um número válido da lista ou "voltar".'
                });
                return;
            }

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
                console.log(estado.historico);
                estado.etapa = 'horario'; // terceiro estado

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
                    text: `📅 Escolha um horário disponível:\n${listaHorarios}\n\n↩️ _Digite "voltarS" para retornar ao serviço._`
                });
                return;
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Opção inválida. \nEscolha um número válido ou digite "Voltar" para retornar ao serviço.'
                });
                return;
            }

        case 'horario':
            const idx = parseInt(entrada);
            const lista = estado.horariosDisponiveis || [];

            if (!isNaN(idx) && idx >= 1 && idx <= lista.length) {
                estado.horarioEscolhido = lista[idx - 1];
                estado.historico.push('horario');
                console.log(estado.historico);
                estado.etapa = 'pagamento'; // quarto estado
                estado.historico.push('pagamento');
                console.log(estado.historico);

                await delay(2000);
                await sock.sendMessage(sender, {
                    text: '🧾 Agora escolha a forma de pagamento:\n1. Pix\n2. Dinheiro\n3. Cartão\n\n↩️ _Digite "voltarH" para retornar ao horario._'
                });
                return;
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Opção inválida. Escolha um número válido da lista de horários ou digite "Voltar1" para retornar ao horario.'
                });
                return;
            }

        case 'pagamento':
            const pagamentos = {
                '1': 'Pix',
                '2': 'Dinheiro',
                '3': 'Cartão'
            };

            if (pagamentos[entrada]) {
                estado.pagamentoEscolhido = pagamentos[entrada];
                estado.etapa = 'finalizado';
                estado.historico.push('finalizado');
                console.log(estado.historico);
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

                    await marcarHorarioComoIndisponivel(estado.horarioEscolhido);

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

                await encerrarAtendimento(sender, sock, 'manual');

                await sock.sendMessage('5511934916872@s.whatsapp.net', { text: `*Uhu! temos um novo agendamento:* \n ${estado.nome} vem ${estado.horarioEscolhido} \n *Serviço:* ${estado.servicoEscolhido} \n *FP:* ${estado.pagamentoEscolhido} ` });
                //numero do dono do estabelecimento
                delete estados[sender];
                return;
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Opção inválida. Escolha uma forma de pagamento válida ou digite "Voltar".'
                });
                return;
            }
    }
}

module.exports = { handleMessage };