let clientes = [];
let viewAtual = 'colunas';
let draggedId = null;
let modalTentativasTemp = [];

function detectarEpocaComemorativa(data = new Date()) {
  const mes = data.getMonth() + 1;
  const dia = data.getDate();

  if (mes === 12 || (mes === 11 && dia >= 25)) {
    return {
      nome: 'Final de Ano',
      gancho: 'Nesta reta final de ano muitas operadoras ainda mantêm a tabela atual antes dos reajustes de janeiro, então vale a pena avaliarmos com calma.'
    };
  }

  if (mes === 2 || (mes === 1 && dia >= 20) || (mes === 3 && dia <= 10)) {
    return {
      nome: 'Carnaval',
      gancho: 'Com o feriado de Carnaval se aproximando, deixar a cobertura de saúde alinhada garante mais tranquilidade para você e sua família.'
    };
  }

  if (mes === 11 && dia >= 15 && dia < 25) {
    return {
      nome: 'Black Friday',
      gancho: 'Estamos em um período em que algumas operadoras liberam condições diferenciadas de implantação e carência.'
    };
  }

  return null;
}

function nomeDiaSemana(data = new Date()) {
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  return dias[data.getDay()];
}

function saudacaoHorario(data = new Date()) {
  const hora = data.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function primeiroNome(nomeCompleto = '') {
  const limpo = nomeCompleto.trim();
  if (!limpo) return '';
  const p = limpo.split(/\s+/)[0];
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function gerarMensagemPersonalizada(cliente, tentativaIdx = 1, data = new Date()) {
  const nome = primeiroNome(cliente.nome);
  const saudacao = saudacaoHorario(data);
  const dia = nomeDiaSemana(data);
  const epoca = detectarEpocaComemorativa(data);

  const abertura = nome
    ? `Olá, ${nome}! ${saudacao}, tudo bem? Espero que esteja tendo uma excelente ${dia}.`
    : `Olá! ${saudacao}, tudo bem? Espero que esteja tendo uma excelente ${dia}.`;

  const corpo = MENSAGENS_TENTATIVAS[tentativaIdx] || MENSAGENS_TENTATIVAS[1];
  const extraEpoca = (epoca && [1, 3, 5, 7, 9].includes(tentativaIdx)) ? `\n\n${epoca.gancho}` : '';

  return `${abertura}\n\n${corpo}${extraEpoca}`.trim();
}

function atualizarBadgeEpoca() {
  const epoca = detectarEpocaComemorativa(new Date());
  const badge = document.getElementById('badgeEpoca');
  const dia = nomeDiaSemana(new Date());
  badge.textContent = epoca ? `${epoca.nome} • ${dia}` : `${dia}`;
}

function setConexaoStatus(texto, corClass = 'text-[#9aa5b8]') {
  document.getElementById('modoConexao').innerHTML = `<span class="${corClass}">${texto}</span>`;
}

function normalizarTentativas(raw) {
  return Array.isArray(raw) ? raw : [];
}

async function carregarClientes() {
  atualizarBadgeEpoca();
  setConexaoStatus('• Sincronizando...', 'text-[#9aa5b8]');

  const { data, error } = await sb
    .from('clientes')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao carregar clientes:', error);
    setConexaoStatus('• Erro de conexão', 'text-rose-400');
    clientes = [];
  } else {
    setConexaoStatus('• Online', 'text-emerald-400');
    clientes = (data || [])
      .filter(c => c.status !== 'Sem Resposta')
      .map(c => ({ ...c, tentativas: normalizarTentativas(c.tentativas) }));
  }

  renderizar();
}

function setView(view) {
  viewAtual = view;
  const isCol = view === 'colunas';
  document.getElementById('viewColunas').classList.toggle('hidden', !isCol);
  document.getElementById('viewLista').classList.toggle('hidden', isCol);

  document.getElementById('btnColunas').classList.toggle('active', isCol);
  document.getElementById('btnLista').classList.toggle('active', !isCol);

  renderizar();
}

function mascaraTelefone(input) {
  let v = input.value.replace(/\D/g, '');
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d)(\d{4})$/, '$1-$2');
  input.value = v;
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

function getFiltrados() {
  const termo = document.getElementById('campoBusca').value.toLowerCase().trim();
  return clientes.filter(c =>
    c.nome.toLowerCase().includes(termo) ||
    (c.whatsapp || '').toLowerCase().includes(termo) ||
    (c.email || '').toLowerCase().includes(termo) ||
    (c.status || '').toLowerCase().includes(termo)
  );
}

function abrirZapComMensagem(clienteId, tentativaIdx = null) {
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) return;

  const tentativas = normalizarTentativas(cliente.tentativas);
  const proxima = tentativaIdx || Math.min(10, tentativas.length + 1);
  const slot = SLOTS_TENTATIVAS.find(s => s.idx === proxima) || SLOTS_TENTATIVAS[0];

  document.getElementById('zapTitulo').textContent = `${cliente.nome} — Tentativa #${slot.idx} (${slot.hora})`;
  document.getElementById('zapSubtitulo').textContent = `${cliente.whatsapp} • Mensagem consultiva`;
  document.getElementById('zapTexto').value = gerarMensagemPersonalizada(cliente, slot.idx, new Date());

  document.getElementById('btnSoMarcarZap').onclick = async () => {
    await marcarTentativa(cliente.id, slot.idx, true);
    fecharModalZap();
  };

  document.getElementById('btnAbrirZapAgora').onclick = async () => {
    const textoFinal = document.getElementById('zapTexto').value;
    const url = `https://wa.me/${limparNumero(cliente.whatsapp)}?text=${encodeURIComponent(textoFinal)}`;
    window.open(url, '_blank');
    await marcarTentativa(cliente.id, slot.idx, true);
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

async function marcarTentativa(clienteId, idx, forcarMarcar = false) {
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) return;

  let lista = [...normalizarTentativas(cliente.tentativas)];
  const pos = lista.findIndex(t => t.idx === idx);

  if (pos !== -1 && !forcarMarcar) {
    lista.splice(pos, 1);
  } else if (pos === -1) {
    lista.push({ idx, marcadoEm: agoraFormatado() });
  } else {
    lista[pos] = { idx, marcadoEm: agoraFormatado() };
  }

  cliente.tentativas = lista;
  renderizar();

  const { error } = await sb
    .from('clientes')
    .update({ tentativas: lista })
    .eq('id', clienteId);

  if (error) console.error('Erro ao salvar tentativa:', error);
}

function renderBoxTentativasCompacto(c) {
  const tentativas = normalizarTentativas(c.tentativas);
  const total = tentativas.length;

  const caixinhas = SLOTS_TENTATIVAS.map(slot => {
    const marcada = tentativas.find(t => t.idx === slot.idx);
    const titulo = marcada
      ? `Tentativa ${slot.idx} (${slot.hora}) • Registrada em ${marcada.marcadoEm}`
      : `Tentativa ${slot.idx} (${slot.hora}) • Abrir mensagem do dia`;

    return `
      <button
        type="button"
        onclick="event.stopPropagation(); abrirZapComMensagem('${c.id}', ${slot.idx})"
        title="${titulo}"
        class="tentativa-btn h-6 flex items-center justify-center leading-none ${
          marcada ? 'tentativa-feita' : 'tentativa-pendente'
        }"
      >
        <span>${slot.hora.replace(':00', 'h')}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="mt-2.5 pt-2 border-t border-[#232a3b]">
      <div class="flex items-center justify-between text-[11px] mb-1.5">
        <span class="text-[#9aa5b8]">Tentativas Zap</span>
        <span class="font-medium ${total >= 10 ? 'text-rose-400' : total > 0 ? 'text-emerald-400' : 'text-[#687387]'}">${total}/10</span>
      </div>
      <div class="grid grid-cols-5 gap-1">
        ${caixinhas}
      </div>
    </div>
  `;
}

function renderizar() {
  const filtrados = getFiltrados();
  document.getElementById('contadorTotal').textContent = filtrados.length;

  if (viewAtual === 'colunas') {
    renderizarColunas(filtrados);
  } else {
    renderizarLista(filtrados);
  }
}

function renderizarColunas(lista) {
  const container = document.getElementById('viewColunas');
  container.innerHTML = '';

  STATUS_COLUNAS.forEach(status => {
    const cards = lista.filter(c => c.status === status);
    const badgeStyle = CORES_STATUS[status] || 'border-[#232a3b] text-[#9aa5b8] bg-[#171c28]';

    const col = document.createElement('div');
    col.className = 'kanban-coluna w-72 shrink-0 rounded-xl flex flex-col max-h-[78vh] transition-colors';
    col.ondragover = (e) => {
      e.preventDefault();
      col.classList.add('coluna-drop-ativa');
    };
    col.ondragleave = () => col.classList.remove('coluna-drop-ativa');
    col.ondrop = async (e) => {
      e.preventDefault();
      col.classList.remove('coluna-drop-ativa');
      if (draggedId) {
        await mudarStatusCliente(draggedId, status);
        draggedId = null;
      }
    };

    col.innerHTML = `
      <div class="px-3.5 py-2.5 border-b border-[#232a3b] flex items-center justify-between gap-2">
        <span class="text-xs font-medium px-2.5 py-0.5 rounded-md border ${badgeStyle}">${status}</span>
        <span class="text-xs font-medium text-[#9aa5b8] bg-[#0e121a] px-2 py-0.5 rounded-md border border-[#232a3b]">${cards.length}</span>
      </div>
      <div class="p-2.5 space-y-2 overflow-y-auto flex-1 custom-scroll">
        ${cards.length === 0
          ? `<div class="text-center py-8 text-xs text-[#687387]">Arraste um card para esta etapa</div>`
          : cards.map(c => cardHtml(c)).join('')
        }
      </div>
    `;
    container.appendChild(col);
  });
}

function cardHtml(c) {
  return `
    <div
      draggable="true"
      ondragstart="draggedId = '${c.id}'"
      class="kanban-card rounded-lg p-3 transition cursor-grab active:cursor-grabbing"
    >
      <div class="flex items-start justify-between gap-2">
        <button onclick="abrirModal('${c.id}')" class="font-medium text-sm text-[#e6ebf2] hover:text-emerald-400 text-left truncate cursor-pointer transition">
          ${escapeHtml(c.nome)}
        </button>
        <button onclick="excluirCliente('${c.id}')" class="text-[#687387] hover:text-rose-400 text-xs p-1 cursor-pointer transition" title="Excluir">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>

      <div class="mt-1.5 space-y-1 text-xs text-[#9aa5b8]">
        <button type="button" onclick="abrirZapComMensagem('${c.id}')" class="flex items-center gap-1.5 hover:text-emerald-400 transition cursor-pointer text-left">
          <i class="fa-brands fa-whatsapp text-emerald-400/90"></i>
          <span class="text-[#cbd5e1]">${escapeHtml(c.whatsapp)}</span>
        </button>
        ${c.email ? `<div class="truncate text-[#9aa5b8]"><i class="fa-regular fa-envelope text-[#687387] mr-1.5"></i>${escapeHtml(c.email)}</div>` : ''}
      </div>

      ${renderBoxTentativasCompacto(c)}
    </div>
  `;
}

function renderizarLista(lista) {
  const tbody = document.getElementById('tbodyLista');
  const vazio = document.getElementById('vazioLista');
  tbody.innerHTML = '';

  if (lista.length === 0) {
    vazio.classList.remove('hidden');
    return;
  }
  vazio.classList.add('hidden');

  lista.forEach(c => {
    const tentativas = normalizarTentativas(c.tentativas);

    const caixinhasLinha = SLOTS_TENTATIVAS.map(slot => {
      const marcada = tentativas.find(t => t.idx === slot.idx);
      const titulo = marcada
        ? `Tentativa ${slot.idx} (${slot.hora}) • Registrada em ${marcada.marcadoEm}`
        : `Tentativa ${slot.idx} (${slot.hora})`;
      return `
        <button
          type="button"
          onclick="abrirZapComMensagem('${c.id}', ${slot.idx})"
          title="${titulo}"
          class="tentativa-btn px-1.5 py-1 ${
            marcada ? 'tentativa-feita' : 'tentativa-pendente'
          }"
        >
          ${slot.hora.replace(':00', 'h')}
        </button>
      `;
    }).join('');

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[#171c28]/80 transition';
    tr.innerHTML = `
      <td class="py-3 px-4 font-medium text-[#e6ebf2]">
        <button onclick="abrirModal('${c.id}')" class="hover:text-emerald-400 transition cursor-pointer text-left">
          ${escapeHtml(c.nome)}
        </button>
      </td>
      <td class="py-3 px-4 whitespace-nowrap">
        <button type="button" onclick="abrirZapComMensagem('${c.id}')" class="inline-flex items-center gap-1.5 text-[#cbd5e1] hover:text-emerald-400 cursor-pointer transition">
          <i class="fa-brands fa-whatsapp text-emerald-400/90"></i>
          ${escapeHtml(c.whatsapp)}
        </button>
      </td>
      <td class="py-3 px-4">
        <div class="flex items-center gap-1 flex-wrap">
          ${caixinhasLinha}
          <span class="ml-1.5 text-xs font-medium text-emerald-400">${tentativas.length}/10</span>
        </div>
      </td>
      <td class="py-3 px-4 text-[#9aa5b8]">${c.email ? escapeHtml(c.email) : '<span class="text-[#687387]">—</span>'}</td>
      <td class="py-3 px-4">
        <select
          onchange="mudarStatusCliente('${c.id}', this.value)"
          class="bg-[#0e121a] border border-[#232a3b] rounded-lg px-2.5 py-1 text-xs text-[#e6ebf2] focus:outline-none focus:border-emerald-500/60 cursor-pointer"
        >
          ${STATUS_COLUNAS.map(st => `<option value="${st}" ${st === c.status ? 'selected' : ''}>${st}</option>`).join('')}
          <option value="Sem Resposta">Sem Resposta (apagar)</option>
        </select>
      </td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        <button onclick="abrirModal('${c.id}')" class="p-1.5 text-[#9aa5b8] hover:text-[#e6ebf2] hover:bg-[#1c2231] rounded-lg cursor-pointer transition" title="Editar">
          <i class="fa-solid fa-pen text-xs"></i>
        </button>
        <button onclick="excluirCliente('${c.id}')" class="p-1.5 text-[#9aa5b8] hover:text-rose-400 hover:bg-[#1c2231] rounded-lg cursor-pointer transition" title="Excluir">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderModalTentativas() {
  const grid = document.getElementById('modalGradeTentativas');
  document.getElementById('modalContadorTentativas').textContent = `${modalTentativasTemp.length}/10`;

  grid.innerHTML = SLOTS_TENTATIVAS.map(slot => {
    const marcada = modalTentativasTemp.find(t => t.idx === slot.idx);
    return `
      <button
        type="button"
        onclick="toggleTentativaModal(${slot.idx})"
        class="p-2 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
          marcada
            ? 'bg-emerald-500/15 border-emerald-500/45 text-[#6ee7b7]'
            : 'bg-[#171c28] border-[#232a3b] text-[#9aa5b8] hover:border-[#313b52]'
        }"
      >
        <div class="flex items-center justify-between w-full">
          <span class="text-[11px] font-semibold">#${slot.idx}</span>
          <i class="fa-solid ${marcada ? 'fa-square-check text-emerald-400' : 'fa-regular fa-square text-[#687387]'} text-xs"></i>
        </div>
        <span class="text-xs font-semibold mt-1 text-[#e6ebf2]">${slot.hora}</span>
        <span class="text-[9px] text-[#9aa5b8] mt-0.5 truncate">${marcada ? marcada.marcadoEm : 'Pendente'}</span>
      </button>
    `;
  }).join('');
}

function toggleTentativaModal(idx) {
  const pos = modalTentativasTemp.findIndex(t => t.idx === idx);
  if (pos !== -1) {
    modalTentativasTemp.splice(pos, 1);
  } else {
    modalTentativasTemp.push({ idx, marcadoEm: agoraFormatado() });
  }
  renderModalTentativas();
}

async function mudarStatusCliente(id, novoStatus) {
  if (novoStatus === 'Sem Resposta') {
    clientes = clientes.filter(c => c.id !== id);
    renderizar();
    const { error } = await sb.from('clientes').delete().eq('id', id);
    if (error) console.error('Erro ao apagar Sem Resposta:', error);
    return;
  }

  const idx = clientes.findIndex(c => c.id === id);
  if (idx !== -1) {
    clientes[idx].status = novoStatus;
  }
  renderizar();

  const { error } = await sb.from('clientes').update({ status: novoStatus }).eq('id', id);
  if (error) console.error('Erro ao atualizar status:', error);
}

function abrirModal(id = null) {
  document.getElementById('formCliente').reset();
  document.getElementById('clienteId').value = '';
  document.getElementById('status').value = 'Leads';
  document.getElementById('modalTitulo').textContent = 'Novo Cliente';
  modalTentativasTemp = [];

  if (id) {
    const c = clientes.find(item => item.id === id);
    if (c) {
      document.getElementById('modalTitulo').textContent = 'Editar Ficha';
      document.getElementById('clienteId').value = c.id;
      document.getElementById('nome').value = c.nome;
      document.getElementById('whatsapp').value = c.whatsapp;
      document.getElementById('email').value = c.email || '';
      document.getElementById('status').value = c.status || 'Leads';
      modalTentativasTemp = [...normalizarTentativas(c.tentativas)];
    }
  }

  renderModalTentativas();

  const modal = document.getElementById('modalCliente');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('nome').focus();
}

function fecharModal() {
  const modal = document.getElementById('modalCliente');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function salvarCliente(e) {
  e.preventDefault();
  const id = document.getElementById('clienteId').value;
  const nome = document.getElementById('nome').value.trim();
  const whatsapp = document.getElementById('whatsapp').value.trim();
  const email = document.getElementById('email').value.trim();
  const status = document.getElementById('status').value;
  const tentativas = [...modalTentativasTemp];

  const numeroLimpo = limparNumero(whatsapp);
  const duplicado = clientes.find(c => c.id !== id && limparNumero(c.whatsapp) === numeroLimpo);

  if (duplicado) {
    alert(`Este WhatsApp já está cadastrado para "${duplicado.nome}" (${duplicado.status}). Abrindo a ficha existente.`);
    abrirModal(duplicado.id);
    return;
  }

  if (status === 'Sem Resposta') {
    if (id) {
      clientes = clientes.filter(c => c.id !== id);
      await sb.from('clientes').delete().eq('id', id);
    }
    renderizar();
    fecharModal();
    return;
  }

  if (id) {
    const idx = clientes.findIndex(c => c.id === id);
    if (idx !== -1) {
      clientes[idx] = { ...clientes[idx], nome, whatsapp, email, status, tentativas };
    }
    const { error } = await sb
      .from('clientes')
      .update({ nome, whatsapp, email, status, tentativas })
      .eq('id', id);
    if (error) console.error('Erro ao atualizar cliente:', error);
  } else {
    const { data, error } = await sb
      .from('clientes')
      .insert([{ nome, whatsapp, email, status, tentativas }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir cliente:', error);
    } else if (data) {
      clientes.unshift({ ...data, tentativas: normalizarTentativas(data.tentativas) });
    }
  }

  renderizar();
  fecharModal();
}

async function excluirCliente(id) {
  if (!confirm('Excluir este cliente?')) return;
  clientes = clientes.filter(c => c.id !== id);
  renderizar();
  const { error } = await sb.from('clientes').delete().eq('id', id);
  if (error) console.error('Erro ao excluir cliente:', error);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    fecharModal();
    fecharModalZap();
  }
});

carregarClientes();