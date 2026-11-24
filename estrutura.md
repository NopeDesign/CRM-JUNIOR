meu-crm/
├── index.html               (entrada -> abre painel-clientes/)
├── shared/
│   ├── config.js            (Supabase, status, 10 tentativas, mensagens e CRMUtils)
│   └── global.css           (variáveis escuras, botões, inputs e scroll)
├── painel-clientes/
│   ├── index.html           (HTML do painel de clientes)
│   ├── style.css            (CSS específico do painel de clientes)
│   └── script.js            (JS específico do painel de clientes)
├── agenda-retornos/
│   ├── index.html           (Central de Follow-up do Dia)
│   ├── style.css            (CSS específico da agenda de retornos)
│   └── script.js            (Fila do dia, retornos agendados e alerta +24h)
└── consulta-cnpj/
    ├── index.html           (Validador MEI e PME por CNPJ)
    ├── style.css            (CSS específico da consulta de CNPJ)
    └── script.js            (Consulta BrasilAPI, regra dos 6 meses MEI e QSA)