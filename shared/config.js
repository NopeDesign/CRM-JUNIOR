const SUPABASE_URL = 'https://anvjkgeneuwjskdxkgiw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KefegnmGE3L9z_RiuwvqHQ_pJjj3zxl';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUS_COLUNAS = [
  'Leads',
  'Contato',
  'Respondeu',
  'Interessado',
  'Documentos',
  'Pós-Venda',
  'Sem Interesse'
];

const SLOTS_TENTATIVAS = [
  { idx: 1, hora: '10:00' },
  { idx: 2, hora: '10:50' },
  { idx: 3, hora: '11:40' },
  { idx: 4, hora: '12:30' },
  { idx: 5, hora: '13:20' },
  { idx: 6, hora: '14:10' },
  { idx: 7, hora: '15:00' },
  { idx: 8, hora: '16:00' },
  { idx: 9, hora: '17:00' },
  { idx: 10, hora: '18:00' }
];

const CORES_STATUS = {
  'Leads': 'border-sky-400/25 text-sky-300 bg-sky-400/10',
  'Contato': 'border-indigo-400/25 text-indigo-300 bg-indigo-400/10',
  'Respondeu': 'border-amber-400/25 text-amber-300 bg-amber-400/10',
  'Interessado': 'border-emerald-400/25 text-emerald-300 bg-emerald-400/10',
  'Documentos': 'border-violet-400/25 text-violet-300 bg-violet-400/10',
  'Pós-Venda': 'border-teal-400/25 text-teal-300 bg-teal-400/10',
  'Sem Interesse': 'border-rose-400/25 text-rose-300 bg-rose-400/10'
};

const MENSAGENS_TENTATIVAS = {
  1: 'Recebi sua solicitação de cotação para plano de saúde. Para eu te apresentar as opções com melhor custo-benefício e rede credenciada na sua região, você busca o plano para você, sua família ou via CNPJ?',
  2: 'Passando por aqui apenas para confirmar se você recebeu minha mensagem anterior sobre o estudo do seu plano de saúde. Fico à disposição caso queira tirar alguma dúvida sobre hospitais ou valores.',
  3: 'Como a rotina costuma ser corrida, estou retomando nosso contato de forma breve. Se você já tiver preferência por algum hospital ou operadora específica, me avise que já preparo um comparativo objetivo para você.',
  4: 'Caso ainda esteja avaliando opções de plano de saúde, consigo te enviar uma simulação comparando valores com e sem coparticipação para facilitar sua análise.',
  5: 'Estou passando no meio do dia caso esse horário seja mais tranquilo para você. Se quiser, posso te enviar os valores resumidos por aqui mesmo, sem compromisso.',
  6: 'Apenas dando continuidade ao seu atendimento sobre o plano de saúde. Caso tenha mudado de ideia ou já tenha fechado por outro canal, pode me avisar tranquilamente.',
  7: 'Retomando brevemente nosso contato: se você tiver interesse em reduzir custos ou melhorar a rede de atendimento atual, fico à disposição para montar uma proposta sob medida.',
  8: 'Estou organizando os atendimentos do dia e deixei seu estudo de plano de saúde separado aqui. Quando tiver um minutinho, me diga qual faixa etária devo considerar na cotação.',
  9: 'Caso ainda faça sentido analisarmos as opções de plano de saúde para você, continuo à disposição por aqui para te ajudar no que precisar.',
  10: 'Este é apenas um último contato de acompanhamento sobre sua cotação de plano de saúde. Para não incomodar, vou encerrar por aqui, mas se precisar retomar no futuro, será um prazer te atender.'
};

// === HELPERS COMPARTILHADOS ENTRE MÓDULOS ===
const CRMUtils = {
  limparTelefone(tel) {
    const nums = String(tel || '').replace(/\D/g, '');
    if (!nums) return '';
    return nums.startsWith('55') ? nums : '55' + nums;
  },

  mascararTelefone(valor) {
    let v = String(valor || '').replace(/\D/g, '').slice(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d)(\d{4})$/, '$1-$2');
    return v;
  },

  formatarMoeda(valor) {
    const numero = Number(valor);
    if (Number.isNaN(numero)) return 'R$ 0,00';
    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  },

  formatarDataBr(isoStr) {
    if (!isoStr) return '';
    const partes = String(isoStr).split('T')[0].split('-');
    if (partes.length !== 3) return String(isoStr);
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  },

  formatarDataHoraCurta(data = new Date()) {
    const d = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(d.getTime())) return '';
    return (
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    );
  },

  hojeIsoLocal(data = new Date()) {
    const d = data instanceof Date ? data : new Date(data);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }
};