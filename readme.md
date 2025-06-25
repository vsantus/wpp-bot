# 🤖 Bot de Agendamento via WhatsApp - Baileys

Este projeto é um **chatbot de agendamento para barbearia** desenvolvido com **Node.js** e a biblioteca **[Baileys](https://github.com/WhiskeySockets/Baileys)**, que utiliza engenharia reversa para se comunicar com o WppWeb.

---

## ✅ Funcionalidades atuais

O bot está **funcionando com base em mensagens de texto simples** e oferece as seguintes funcionalidades:

- 👤 **Captura de nome** e identificação do cliente via Firebase
- 📅 **Agendamento de serviços** (corte, barba, sobrancelha, combos)
- 📋 **Listagem de horários disponíveis** via integração com Google Sheets
- 🗑️ **Cancelamento de agendamentos existentes**
- 📍 Exibição de **endereço** e **valores** dos serviços
- 🔁 **Navegação entre etapas** com comandos como `Menu`, `Voltar`, `Sair` (por escrito)
- ⏳ **Encerramento automático do atendimento por inatividade**

---

## 📦 Tecnologias utilizadas

- **Node.js**
- **Baileys** (WhatsApp Web API não oficial)
- **Firebase** (para persistência de usuários)
- **Google Sheets API** (para controle de horários)

---

## ⚠️ Limitações encontradas

Apesar de funcionar bem com mensagens de texto, o projeto está sendo **descontinuado** devido às seguintes limitações da biblioteca Baileys:

- ❌ **Não há suporte estável para menus interativos**, como:
  - List Messages (menus suspensos)
  - Botões nativos de ação
  - Enquetes (Polls) com retorno funcional
- ⚠️ Os recursos interativos do WhatsApp podem **não ser renderizados corretamente** ou nem aparecer dependendo do cliente (WhatsApp normal ou Business).
- ❌ Não há garantia de **compatibilidade futura** com mudanças do WppWeb.


## 📁 Estrutura básica

```bash
📦 wpp-bot/
├── 📁 controllers/
│   ├── firebase.js           # Lógica de integração com o Firebase (ex: salvar dados, buscar usuário)
│   ├── flow.js               # Lógica principal do fluxo de atendimento do bot
│   └── sheets.js             # Integração com Google Sheets (ex: salvar agendamento, listar horários)
│
├── 📁 services/
│   ├── bot-wpp-baileys.js    # Credencial para controle dos usuarios no firebase
│   └── google-credentials.json # Credenciais da conta de serviço do Google (usadas para acesso ao Sheets)
│
├── 📁 node_modules/           # Dependências instaladas pelo npm
│
├── .env                       # Variáveis de ambiente (tokens, URLs, configurações sensíveis)
├── .gitignore                 # Arquivos e pastas ignorados pelo Git (keys)
├── nanobot.js                 # Arquivo principal que inicia o bot (entry point) - node nanobot.js
├── package.json               # Configuração do projeto Node.js (scripts, dependências)
├── package-lock.json          # Travamento de versões exatas das dependências
└── README.md                  # Documentação do projeto
