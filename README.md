SIGAP - Sistema de Gerenciamento de Pauta (Defensoria)

Este projeto é uma Single Page Application (SPA) para gestão de filas de atendimento jurídico (Kanban), com suporte a múltiplos utilizadores, pautas dinâmicas, estatísticas e funcionalidades offline/online com Firebase.

📂 Estrutura de Pastas e Ficheiros

O projeto segue uma arquitetura MVC (Model-View-Controller) adaptada para JavaScript Vanilla + Firebase, visando organização, segurança e performance.

/ (Raiz do Projeto)
│
├── index.html                 # VIEW PRINCIPAL (O esqueleto visual da aplicação)
├── manifest.json              # Configuração PWA (ícone, nome, cores para instalação mobile)
├── firestore.rules            # Regras de Segurança do Firebase (Copiar para o Console)
├── README.md                  # Este ficheiro (Documentação)
│
├── assets/                    # RECURSOS (Lógica e Estilos)
│   │
│   ├── css/                   # ESTILOS
│   │   └── style.css          # Todos os estilos visuais, animações e responsividade.
│   │
│   └── js/                    # CONTROLADORES E MÓDULOS (Lógica JS)
│       ├── firebase-init.js   # [CONFIG] Inicialização única do Firebase (App, Auth, DB).
│       ├── main.js            # [CORE] O "Cérebro" do sistema. Gerencia o Kanban, Drag&Drop e Eventos.
│       ├── auth-service.js    # [AUTH] Funções de Login, Registo, Logout e Recuperação de Senha.
│       ├── detalhes.js        # [MODAL] Lógica completa dos Modais de Detalhes e Checklists Jurídicos.
│       ├── estatisticas.js    # [STATS] Geração de Gráficos e Relatórios PDF.
│       ├── assuntos.js        # [DATA] Lista estática (Árvore) de assuntos jurídicos e descrições.
│       └── utils.js           # [HELPERS] Funções puras (formatar data/moeda, notificações, normalizar texto).
│
└── pages/                     # PÁGINAS SECUNDÁRIAS (Links Externos)
    ├── acompanhamento.html    # Link Público (Apenas Leitura) para visualização da fila em TV/Recepção.
    └── atendimento_externo.html # Link de Delegação (Ação Específica) para colaboradores finalizarem via E-mail.


🚀 Guia Rápido dos Ficheiros

1. Raiz

index.html: O ponto de entrada. Contém apenas a estrutura HTML (divs, modais ocultos) e importa o style.css e o main.js. Não deve conter lógica complexa.

firestore.rules: Define QUEM pode ler/escrever o QUÊ.

Regra de Ouro: Bloqueia edições críticas de utilizadores não logados, mas permite que o "Link Externo" altere apenas o status para "atendido".

2. Assets/JS (A Lógica)

firebase-init.js:

Função: Centraliza as chaves de API.

Uso: Todos os outros ficheiros importam db e auth daqui. Evita inicializar o Firebase múltiplas vezes.

main.js:

Função: O Maestro. Ouve o carregamento da página (DOMContentLoaded), verifica se o utilizador está logado, carrega as pautas e desenha o quadro Kanban. Contém os "Listeners" globais (cliques em botões).

detalhes.js:

Função: Controla o modal complexo que abre ao clicar num assistido. Gerencia checklists, dados do réu e gera o PDF do atendimento.

estatisticas.js:

Função: Calcula tempos médios, conta atendimentos por tipo e gera o PDF de relatório gerencial.

3. Pages (Externos)

Estes arquivos são independentes do main.js. Eles têm sua própria mini-lógica embutida (ou importada) para serem leves e funcionarem em contextos específicos (ex: abrir rápido no telemóvel de um colaborador externo).

🛠️ Como Manter o Projeto

Adicionar um Novo Assunto Jurídico

Abra assets/js/assuntos.js.

Adicione o novo objeto na lista subjectTree. O sistema atualizará automaticamente o autocomplete.

Alterar Cores ou Design

Abra assets/css/style.css.

As classes de prioridade (.priority-urgente, etc.) e estilos de scrollbar estão lá.

Mudar Regras de Negócio (ex: quem pode deletar)

Edite firestore.rules.

Copie o conteúdo e publique no Console do Firebase. (Alterar este ficheiro localmente não muda nada no servidor sem publicar).

Corrigir Bug no Kanban (Arrastar e Soltar)

Abra assets/js/main.js.

Procure pela secção // --- 5. DRAG AND DROP LOGIC ---.

📦 Deploy (Publicação)

Para publicar esta estrutura, certifique-se de subir todas as pastas (assets, pages) mantendo a hierarquia exata acima. O index.html deve estar na raiz do servidor.