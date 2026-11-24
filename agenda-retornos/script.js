let clientesAgenda = [];
let filtroAtual = 'todos';
let suporteColunaRetorno = true;
let toastTimer = null;

const STORAGE_RETORNOS_FALLBACK = 'meu_crm_datas_retorno_v1';

function mostrarToast(mensagem) {
  const toast = document.getElementById('toastFeedback');
  const textoEl = document.getElementById('toastTexto');
  if (!toast || !textoEl) return;

  textoEl.textContent = mensagem;
  toast.classList.add('visivel');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visivel');
  }, 2800);
}

function formatarDiaMes(isoStr) {
  if (!isoStr) return '';
  const partes = String(isoStr).split('T')[0].split('-');
  if (partes.length !== 3) return isoStr;
  return `${partes[2]}/${partes[1]}`;
}

function lerRetornosLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_RETORNOS_FALLBACK)) || {};
  } catch {
    return {};
  }
}

function salvarRetornoLocal(clienteId, dataStr) {
  const mapa = lerRetornosLocal();
  if (dataStr) {
    mapa[clienteId] = dataStr;
  } else {
    delete mapa[clienteId];
  }
  localStorage.setItem(STORAGE_RETORNOS_FALLBACK, JSON.stringify(mapa));
}

function dataParaIsoLocal(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function hojeIsoLocal() {
  return dataParaIsoLocal(new Date());
}

function formatarDataBr(isoStr) {
  if (!isoStr) return '';
  const partes = String(isoStr).split('T')[0].split('-');
  if (partes.length !== 3) return isoStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function normalizarTentativas(raw) {
  return Array.isArray(raw) ? raw : [];
}

function proximaTentativaIdx(cliente) {
  const feitas = normalizarTentativas(cliente.tentativas).map(t => Number(t.idx));
  for (let i = 1; i <= 10; i++) {
    if (!feitas.includes(i)) return i;
  }
  return null;
}

function obterUltimaAtividadeMs(cliente) {
  const tentativas = normalizarTentativas(cliente.tentativas);
  let maiorMs = cliente.criado_em ? new Date(cliente.criado_em).getTime() : 0;

  tentativas.forEach(t => {
    if (t.marcadoEm) {
      const match = String(t.marcadoEm).match(/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
      if (match) {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mesIdx = Number(match[2]) - 1;
        const dia = Number(match[1]);
        const hora = Number(match[3]);
        const min = Number(match[4]);
        let candidato = new Date(ano, mesIdx, dia, hora, min, 0).getTime();
        if (candidato > Date.now() + 86400000 * 7) {
          candidato = new Date(ano - 1, mesIdx, dia, hora, min, 0).getTime();
        }
        if (candidato > maiorMs) maiorMs = candidato;
      }
    }
  });

  return maiorMs || Date.now();
}

function horasParado(cliente) {
  const ultimaMs = obterUltimaAtividadeMs(cliente);
  return Math.max(0, Math.floor((Date.now() - ultimaMs) / (1000 * 60 * 60)));
}

function classificarClienteAgenda(cliente) {
  const hoje = hojeIsoLocal();
  const retornoData = cliente.data_retorno ? String(cliente.data_retorno).split('T')[0] : '';
  const temRetornoHojeOuAtrasado = Boolean(retornoData && retornoData <= hoje);
  const paradoHoras = horasParado(cliente);
  const paradoMais24h = paradoHoras >= 24 && !['Pós-Venda', 'Sem Interesse'].includes(cliente.status);
  const proxTentativa = proximaTentativaIdx(cliente);
  const precisaTentarAgora = proxTentativa !== null && !['Pós-Venda', 'Sem Interesse'].includes(cliente.status);

  let prioridade = 99;
  let blocoUrgencia = 'tentativas';

  if (temRetornoHojeOuAtrasado) {
    prioridade = 1;
    blocoUrgencia = 'retornos';
  } else if (paradoMais24h) {
    prioridade = 2;
    blocoUrgencia = 'parados24h';
  } else if (precisaTentarAgora) {
    prioridade = 3;
    blocoUrgencia = 'tentativas';
  }

  return {
    retornoData,
    temRetornoHojeOuAtrasado,
    paradoHoras,
    paradoMais24h,
    proxTentativa,
    precisaTentarAgora,
    prioridade,
    blocoUrgencia
  };
}

function primeiroNome(nomeCompleto = '') {
  const limpo = nomeCompleto.trim();
  if (!limpo) return '';
  const p = limpo.split(/\s+/)[0];
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function saudacaoHorario(data = new Date()) {
  const hora = data.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function nomeDiaSemana(data = new Date()) {
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  return dias[data.getDay()];
}

function gerarMensagemAgenda(cliente, tentativaIdx = 1) {
  const nome = primeiroNome(cliente.nome);
  const saudacao = saudacaoHorario(new Date());
  const dia = nomeDiaSemana(new Date());
  const abertura = nome
    ? `Olá, ${nome}! ${saudacao}, tudo bem? Espero que esteja tendo uma excelente ${dia}.`
    : `Olá! ${saudacao}, tudo bem? Espero que esteja tendo uma excelente ${dia}.`;

  if (cliente.data_retorno) {
    return `${abertura}\n\nConforme combinamos para ${formatarDataBr(cliente.data_retorno)}, estou retornando o contato sobre sua cotação de plano de saúde. Posso te ajudar com alguma dúvida ou simulação agora?`;
  }

  const corpo = MENSAGENS_TENTATIVAS[tentativaIdx] || MENSAGENS_TENTATIVAS[1];
  return `${abertura}\n\n${corpo}`;
}

function limparNumero(tel) {
  const nums = (tel || '').replace(/\D/g, '');
  return nums.startsWith('55') ? nums : '55' + nums;
}

function agoraFormatado() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
         d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function setConexaoStatus(texto, corClass = 'text-[#9aa5b8]') {
  document.getElementById('modoConexao').innerHTML = `<span class="${corClass}">${texto}</span>`;
}

async function carregarAgenda() {
  setConexaoStatus('• Sincronizando...', 'text-[#9aa5b8]');
  const mapaLocal = lerRetornosLocal();

  const { data, error } = await sb
    .from('clientes')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao carregar clientes na agenda:', error);
    setConexaoStatus('• Erro de conexão', 'text-rose-400');
    clientesAgenda = [];
  } else {
    setConexaoStatus('• Online', 'text-emerald-400');
    suporteColunaRetorno = Array.isArray(data) && data.length > 0 && ('data_retorno' in data[0]);

    clientesAgenda = (data || [])
      .filter(c => c.status !== 'Sem Resposta')
      .map(c => ({
        ...c,
        tentativas: normalizarTentativas(c.tentativas),
        data_retorno: c.data_retorno || mapaLocal[c.id] || ''
      }));
  }

  renderizarFila();
}

function setFiltroAgenda(filtro) {
  filtroAtual = filtro;
  document.querySelectorAll('.filtro-chip').forEach(btn => {
    btn.classList.toggle('ativo', btn.dataset.filtro === filtro);
  });
  renderizarFila();
}

function abrirZapAgenda(clienteId, tentativaIdx = null) {
  const cliente = clientesAgenda.find(c => c.id === clienteId);
  if (!cliente) return;

  const prox = tentativaIdx || proximaTentativaIdx(cliente) || 1;
  const slot = SLOTS_TENTATIVAS.find(s => s.idx === prox) || SLOTS_TENTATIVAS[0];

  document.getElementById('zapTitulo').textContent = `${cliente.nome} — Tentativa #${slot.idx} (${slot.hora})`;
  document.getElementById('zapSubtitulo').textContent = `${cliente.whatsapp} • Etapa: ${cliente.status}`;
  document.getElementById('zapTexto').value = gerarMensagemAgenda(cliente, slot.idx);

  document.getElementById('btnSoMarcarZap').onclick = async () => {
    await registrarTentativaAgenda(cliente.id, slot.idx, { semAbrirZap: true });
    fecharModalZap();
  };

  document.getElementById('btnAbrirZapAgora').onclick = async () => {
    const textoFinal = document.getElementById('zapTexto').value;
    const url = `https://wa.me/${limparNumero(cliente.whatsapp)}?text=${encodeURIComponent(textoFinal)}`;
    window.open(url, '_blank');
    await registrarTentativaAgenda(cliente.id, slot.idx, { semAbrirZap: false });
    fecharModalZap();
  };

  const modal = document.getElementById('modalZap');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function fecharModalZap() {
  const modal = document.getElementById('modalZap');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function registrarTentativaAgenda(clienteId, idx, opcoes = { semAbrirZap: false }) {
  const cliente = clientesAgenda.find(c => c.id === clienteId);
  if (!cliente) return;

  const lista = [...normalizarTentativas(cliente.tentativas)];
  const pos = lista.findIndex(t => t.idx === idx);
  if (pos !== -1) {
    lista[pos] = { idx, marcadoEm: agoraFormatado() };
  } else {
    lista.push({ idx, marcadoEm: agoraFormatado() });
  }

  cliente.tentativas = lista;
  const hoje = hojeIsoLocal();
  let novaDataRetorno = cliente.data_retorno || '';
  if (novaDataRetorno && novaDataRetorno <= hoje) {
    novaDataRetorno = '';
    cliente.data_retorno = '';
    salvarRetornoLocal(clienteId, '');
  }

  renderizarFila();

  if (opcoes.semAbrirZap) {
    mostrarToast(`Tentativa #${idx} registrada para ${primeiroNome(cliente.nome) || cliente.nome}`);
  }

  const payload = { tentativas: lista };
  if (suporteColunaRetorno && cliente.data_retorno !== undefined) {
    payload.data_retorno = novaDataRetorno || null;
  }

  const { error } = await sb
    .from('clientes')
    .update(payload)
    .eq('id', clienteId);

  if (error) console.error('Erro ao registrar tentativa:', error);
}

function aplicarAtalhoData(tipo) {
  const alvo = new Date();
  if (tipo === 'amanha') {
    alvo.setDate(alvo.getDate() + 1);
  } else if (tipo === '2dias') {
    alvo.setDate(alvo.getDate() + 2);
  } else if (tipo === '3dias') {
    alvo.setDate(alvo.getDate() + 3);
  } else if (tipo === 'segunda') {
    const diaSemana = alvo.getDay();
    const diasAteSegunda = diaSemana === 0 ? 1 : (8 - diaSemana);
    alvo.setDate(alvo.getDate() + diasAteSegunda);
  }

  document.getElementById('retornoDataInput').value = dataParaIsoLocal(alvo);
}

function abrirModalRetorno(clienteId) {
  const cliente = clientesAgenda.find(c => c.id === clienteId);
  if (!cliente) return;

  document.getElementById('retornoClienteId').value = cliente.id;
  document.getElementById('retornoNomeCliente').textContent = `Retorno — ${cliente.nome}`;
  document.getElementById('retornoDataInput').value = cliente.data_retorno || hojeIsoLocal();

  const modal = document.getElementById('modalRetorno');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function fecharModalRetorno() {
  const modal = document.getElementById('modalRetorno');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function salvarDataRetorno(e) {
  e.preventDefault();
  const id = document.getElementById('retornoClienteId').value;
  const dataStr = document.getElementById('retornoDataInput').value;
  const cliente = clientesAgenda.find(c => c.id === id);
  if (!cliente) return;

  cliente.data_retorno = dataStr;
  salvarRetornoLocal(id, dataStr);
  renderizarFila();
  fecharModalRetorno();

  if (dataStr) {
    mostrarToast(`Retorno agendado para ${formatarDiaMes(dataStr)}`);
  } else {
    mostrarToast('Data de retorno removida');
  }

  if (suporteColunaRetorno) {
    const { error } = await sb
      .from('clientes')
      .update({ data_retorno: dataStr || null })
      .eq('id', id);
    if (error) console.error('Erro ao salvar data_retorno:', error);
  }
}

async function limparDataRetorno() {
  document.getElementById('retornoDataInput').value = '';
  const fakeEvent = { preventDefault: () => {} };
  await salvarDataRetorno(fakeEvent);
}

function criarSeparadorBloco(titulo, qtd, iconeClass, corTextoClass, primeiroBloco = false) {
  const div = document.createElement('div');
  div.className = `${primeiroBloco ? 'pt-0.5' : 'pt-3 mt-1 border-t border-[#232a3b]/80'} pb-1.5 flex items-center justify-between`;
  div.innerHTML = `
    <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${corTextoClass}">
      <i class="${iconeClass}"></i>
      <span>${titulo}</span>
    </div>
    <span class="text-[11px] font-medium text-[#687387]">${qtd}</span>
  `;
  return div;
}

function criarCardItemAgenda(cliente, info) {
  const badgeStatus = CORES_STATUS[cliente.status] || 'border-[#232a3b] text-[#9aa5b8] bg-[#171c28]';
  const tentativasCount = normalizarTentativas(cliente.tentativas).length;

  const tags = [];
  if (info.retornoData) {
    tags.push(`<span class="tag-retorno-hoje text-[11px] font-medium px-2 py-0.5 rounded-md"><i class="fa-regular fa-calendar mr-1"></i>Retorno: ${formatarDataBr(info.retornoData)}</span>`);
  }
  if (info.paradoMais24h) {
    tags.push(`<span class="tag-alerta-24h text-[11px] font-medium px-2 py-0.5 rounded-md"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Parado há ${info.paradoHoras}h</span>`);
  }
  if (info.precisaTentarAgora) {
    const slot = SLOTS_TENTATIVAS.find(s => s.idx === info.proxTentativa);
    tags.push(`<span class="tag-fila-agora text-[11px] font-medium px-2 py-0.5 rounded-md">Próx: #${info.proxTentativa} (${slot ? slot.hora : ''}) • ${tentativasCount}/10</span>`);
  }

  const item = document.createElement('div');
  item.className = 'fila-item flex flex-col sm:flex-row sm:items-center justify-between gap-3';
  item.innerHTML = `
    <div class="min-w-0 space-y-1.5">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-medium text-sm text-[#e6ebf2]">${escapeHtml(cliente.nome)}</span>
        <span class="text-[11px] px-2 py-0.5 rounded-md border ${badgeStatus}">${escapeHtml(cliente.status)}</span>
        <span class="text-xs text-[#9aa5b8]"><i class="fa-brands fa-whatsapp text-emerald-400/90 mr-1"></i>${escapeHtml(cliente.whatsapp)}</span>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${tags.join('')}
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <button type="button" onclick="abrirModalRetorno('${cliente.id}')"
        class="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#12161f] hover:bg-[#0e121a] text-[#cbd5e1] border border-[#232a3b] cursor-pointer transition">
        <i class="fa-regular fa-calendar-plus mr-1 text-[#9aa5b8]"></i>
        Data retorno
      </button>

      <button type="button" onclick="abrirZapAgenda('${cliente.id}', ${info.proxTentativa || 1})"
        class="btn-primario font-semibold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer">
        <i class="fa-brands fa-whatsapp text-sm"></i>
        <span>Chamar</span>
      </button>
    </div>
  `;
  return item;
}

function renderizarFila() {
  const termo = document.getElementById('campoBuscaAgenda').value.toLowerCase().trim();

  const avaliados = clientesAgenda
    .map(c => ({ cliente: c, info: classificarClienteAgenda(c) }))
    .filter(({ cliente, info }) => {
      const bateBusca =
        !termo ||
        cliente.nome.toLowerCase().includes(termo) ||
        (cliente.whatsapp || '').toLowerCase().includes(termo) ||
        (cliente.status || '').toLowerCase().includes(termo);

      if (!bateBusca) return false;

      if (filtroAtual === 'agora') return info.precisaTentarAgora;
      if (filtroAtual === 'retorno') return Boolean(info.retornoData);
      if (filtroAtual === '24h') return info.paradoMais24h;

      return info.temRetornoHojeOuAtrasado || info.paradoMais24h || info.precisaTentarAgora || Boolean(info.retornoData);
    })
    .sort((a, b) => a.info.prioridade - b.info.prioridade || b.info.paradoHoras - a.info.paradoHoras);

  const todosAvaliados = clientesAgenda.map(c => classificarClienteAgenda(c));
  document.getElementById('countFilaAgora').textContent = todosAvaliados.filter(x => x.precisaTentarAgora).length;
  document.getElementById('countRetornoData').textContent = todosAvaliados.filter(x => x.temRetornoHojeOuAtrasado).length;
  document.getElementById('countParados24h').textContent = todosAvaliados.filter(x => x.paradoMais24h).length;
  document.getElementById('contadorVisivel').textContent = `${avaliados.length} ${avaliados.length === 1 ? 'item' : 'itens'}`;

  const listaEl = document.getElementById('listaFilaDia');
  const vazioEl = document.getElementById('vazioFilaDia');
  listaEl.innerHTML = '';

  if (avaliados.length === 0) {
    vazioEl.classList.remove('hidden');
    return;
  }
  vazioEl.classList.add('hidden');

  const grupos = [
    {
      chave: 'retornos',
      titulo: 'Retornos do dia / Atrasados',
      icone: 'fa-regular fa-calendar-check',
      cor: 'text-sky-300',
      itens: avaliados.filter(x => x.info.blocoUrgencia === 'retornos')
    },
    {
      chave: 'parados24h',
      titulo: 'Parados há mais de 24h',
      icone: 'fa-solid fa-triangle-exclamation',
      cor: 'text-amber-300',
      itens: avaliados.filter(x => x.info.blocoUrgencia === 'parados24h')
    },
    {
      chave: 'tentativas',
      titulo: 'Fila de tentativas',
      icone: 'fa-brands fa-whatsapp',
      cor: 'text-emerald-300',
      itens: avaliados.filter(x => x.info.blocoUrgencia === 'tentativas')
    }
  ];

  let renderizouAlgumBloco = false;

  grupos.forEach(grupo => {
    if (grupo.itens.length === 0) return;

    if (filtroAtual === 'todos') {
      listaEl.appendChild(
        criarSeparadorBloco(
          grupo.titulo,
          grupo.itens.length,
          grupo.icone,
          grupo.cor,
          !renderizouAlgumBloco
        )
      );
    }

    grupo.itens.forEach(({ cliente, info }) => {
      listaEl.appendChild(criarCardItemAgenda(cliente, info));
    });

    renderizouAlgumBloco = true;
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    fecharModalRetorno();
    fecharModalZap();
  }
});

carregarAgenda();