const estados = {}; // Armazena o estado de cada usuário

async function handleMessage(sock, msg) {
    const sender = msg.key.remoteJid;
    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const entrada = texto?.trim().toLowerCase();
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    if (!estados[sender]) estados[sender] = { etapa: 'inicio' };

    const etapaAtual = estados[sender].etapa;

    switch (etapaAtual) {
        case 'inicio':
            if (!['1', '2', '3', '4'].includes(entrada)) {
                await delay(3000);
                await sock.sendMessage(sender, {
                    text: 'Como posso te ajudar? \n1. 🗓️ Realizar agendamento\n2. 💰 Preços\n3. 🗺️ Endereço \n4. 🔎 Meus agendamentos'
                });
            } else {
                switch (entrada) {
                    case '1':
                        estados[sender].etapa = 'servico';
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Qual serviço você deseja agendar? \n1. Corte\n2. Barba\n3. Sobrancelha\n4. Corte + Barba\n5. Corte + Sobrancelha\n6. Corte + Barba + Sobrancelha'
                        });
                        break;

                    case '2':
                        estados[sender].etapa = 'inicio';
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Os preços são: \nCorte: R$30\nBarba: R$20\nSobrancelha: R$15'
                        });
                        break;

                    case '3':
                        estados[sender].etapa = 'inicio';
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Nosso endereço é Rua Alamedas, 1234 - Centro'
                        });
                        break;

                    case '4':
                        estados[sender].etapa = 'inicio';
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Seus agendamentos são: (exemplo de agendamento aqui)'
                        });
                        break;

                    default:
                        await delay(3000);
                        await sock.sendMessage(sender, {
                            text: 'Opção inválida. Tente novamente.'
                        });
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
                estados[sender].servicoEscolhido = servicos[entrada];
                estados[sender].etapa = 'horario';
                await delay(3000);
                await sock.sendMessage(sender, {
                    text: `📅 Agora escolha um horário para ${servicos[entrada]}:\n1. Sexta - 13h\n2. Sexta - 15h`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: 'Opção inválida. Escolha um número de 1 a 6.'
                });
            }
            break;

        case 'horario':
            const horarios = {
                '1': 'Sexta - 13h',
                '2': 'Sexta - 15h'
            };

            if (horarios[entrada]) {
                estados[sender].horarioEscolhido = horarios[entrada];
                estados[sender].etapa = 'pagamento';
                await delay(3000);
                await sock.sendMessage(sender, {
                    text: '🧾 Agora escolha a forma de pagamento:\n1. Pix\n2. Dinheiro\n3. Cartão'
                });
            } else {
                await sock.sendMessage(sender, {
                    text: 'Opção inválida. Digite 1 ou 2 para escolher um horário.'
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
                estados[sender].pagamentoEscolhido = pagamentos[entrada];
                estados[sender].etapa = 'finalizado';
                await delay(3000);
                await sock.sendMessage(sender, {
                    text: `✅ Agendamento confirmado!\n✂️ Serviço: ${estados[sender].servicoEscolhido}\n🕒 Horário: ${estados[sender].horarioEscolhido}\n💰 Pagamento: ${pagamentos[entrada]}\n\nObrigado! Até breve.`
                });

                // Reinicia o fluxo
                estados[sender] = { etapa: 'inicio' };
            } else {
                await sock.sendMessage(sender, {
                    text: 'Opção inválida. Escolha 1, 2 ou 3.'
                });
            }
            break;
    }
}

module.exports = { handleMessage };
