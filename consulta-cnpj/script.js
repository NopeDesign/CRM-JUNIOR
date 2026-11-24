const STORAGE_HISTORICO_CNPJ = 'meu_crm_historico_cnpj_v1';
let ultimoResultado = null;
let autoBuscaTimer = null;

function limparCnpj(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

function formatarCnpj(valor) {
  const n = limparCnpj(valor);
  return n
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function cnpjValido(cnpj) {
  const n = limparCnpj(cnpj);
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;

  const calcDigito = (base, pesos) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigito(n.slice(0, 12), pesos1);
  const d2 = calcDigito(n.slice(0, 12) + d1, pesos2);

  return Number(n[12]) === d1 && Number(n[13]) === d2;
}

function calcularTempoAbertura(dataAberturaStr) {
  if (!dataAberturaStr) return { meses: 0, texto: 'Não informada', dataFormatada: '—' };

  const partes = String(dataAberturaStr).split('T')[0].split('-');
  if (partes.length !== 3) return { meses: 0, texto: dataAberturaStr, dataFormatada: dataAberturaStr };

  const ano = Number(partes[0]);
  const mes = Number(partes[1]) - 1;
  const dia = Number(partes[2]);
  const inicio = new Date(ano, mes, dia);
  const hoje = new Date();

  let meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
  if (hoje.getDate() < inicio.getDate()) {
    meses -= 1;
  }
  meses = Math.max(0, meses);

  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;

  let tempoTexto = '';
  if (anos > 0 && restoMeses > 0) {
    tempoTexto = `${anos}a e ${restoMeses}m (${meses} meses)`;
  } else if (anos > 0) {
    tempoTexto = `${anos} ${anos === 1 ? 'ano' : 'anos'} (${meses} meses)`;
  } else {
    tempoTexto = `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  }

  return {
    meses,
    texto: tempoTexto,
    dataFormatada: `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`
  };
}

function setStatusCnpj(texto, corClass = 'text-[#9aa5b8]') {
  document.getElementById('statusConsultaCnpj').innerHTML = `<span class="${corClass}">${texto}</span>`;
}

function aoDigitarCnpj(input) {
  input.value = formatarCnpj(input.value);
  const limpo = limparCnpj(input.value);

  if (autoBuscaTimer) clearTimeout(autoBuscaTimer);
  if (limpo.length === 14) {
    autoBuscaTimer = setTimeout(() => {
      executarConsultaCnpj(limpo);
    }, 250);
  }
}

async function consultarCnpjSubmit(e) {
  e.preventDefault();
  const limpo = limparCnpj(document.getElementById('inputCnpj').value);
  await executarConsultaCnpj(limpo);
}

async function executarConsultaCnpj(cnpjLimpo) {
  if (!cnpjValido(cnpjLimpo)) {
    setStatusCnpj('• CNPJ inválido', 'text-rose-400');
    exibirBanner('alerta-situacao-inativa', 'fa-solid fa-circle-xmark', 'CNPJ inválido. Confira os 14 dígitos informados.');
    return;
  }

  const btn = document.getElementById('btnConsultarCnpj');
  btn.disabled = true;
  setStatusCnpj('• Consultando Receita...', 'text-amber-300');

  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const dados = await resp.json();
    processarResultadoCnpj(dados, cnpjLimpo);
    setStatusCnpj('• Atualizado', 'text-emerald-400');
  } catch (err) {
    console.error('Erro na consulta CNPJ:', err);
    setStatusCnpj('• Falha na consulta', 'text-rose-400');
    exibirBanner(
      'alerta-situacao-inativa',
      'fa-solid fa-triangle-exclamation',
      'Não foi possível consultar este CNPJ agora. Tente novamente em alguns instantes.'
    );
  } finally {
    btn.disabled = false;
  }
}

function exibirBanner(classeEstilo, iconeClass, mensagem) {
  const banner = document.getElementById('bannerValidacao');
  banner.className = `rounded-xl p-3.5 text-xs sm:text-sm flex items-start gap-3 ${classeEstilo}`;
  banner.innerHTML = `<i class="${iconeClass} mt-0.5 shrink-0"></i><span>${CRMUtils.escapeHtml(mensagem)}</span>`;
  banner.classList.remove('hidden');
}

function processarResultadoCnpj(dados, cnpjLimpo) {
  document.getElementById('estadoInicialCnpj').classList.add('hidden');
  document.getElementById('resultadoDetalhes').classList.remove('hidden');

  const isMei = Boolean(dados.opcao_pelo_mei);
  const situacao = String(dados.descricao_situacao_cadastral || 'Não informada').toUpperCase();
  const abertura = calcularTempoAbertura(dados.data_inicio_atividade);
  const socios = Array.isArray(dados.qsa) ? dados.qsa : [];
  const cnaeTexto = dados.cnae_fiscal_descricao
    ? `${dados.cnae_fiscal || ''} — ${dados.cnae_fiscal_descricao}`.trim()
    : 'Não informado';

  const aptoMei6Meses = !isMei || abertura.meses >= 6;
  const ativa = situacao === 'ATIVA';

  document.getElementById('badgeEnquadramento').textContent = isMei ? 'MEI (Microempreendedor Individual)' : 'PME / Empresa';
  document.getElementById('resRazaoSocial').textContent = dados.razao_social || '—';
  document.getElementById('resNomeFantasia').textContent = dados.nome_fantasia || 'Não informado';
  document.getElementById('resSituacao').textContent = situacao;
  document.getElementById('resAbertura').textContent = `${abertura.dataFormatada} • ${abertura.texto}`;
  document.getElementById('resCnae').textContent = cnaeTexto;
  document.getElementById('resCnpjFormatado').textContent = `CNPJ: ${formatarCnpj(cnpjLimpo)}`;
  document.getElementById('resQtdSocios').textContent = `${socios.length} ${socios.length === 1 ? 'sócio' : 'sócios'}`;

  if (!ativa) {
    exibirBanner(
      'alerta-situacao-inativa',
      'fa-solid fa-ban',
      `Empresa com situação "${situacao}". A maioria das operadoras exige situação ATIVA para emissão de plano de saúde.`
    );
  } else if (isMei && abertura.meses < 6) {
    const faltam = 6 - abertura.meses;
    exibirBanner(
      'alerta-mei-pendente',
      'fa-solid fa-hourglass-half',
      `MEI com ${abertura.meses} ${abertura.meses === 1 ? 'mês' : 'meses'} de abertura (${abertura.dataFormatada}). Ainda não atingiu os 6 meses mínimos exigidos pela maioria das operadoras (faltam ${faltam} ${faltam === 1 ? 'mês' : 'meses'}).`
    );
  } else if (isMei) {
    exibirBanner(
      'alerta-mei-apto',
      'fa-solid fa-circle-check',
      `MEI ativo com ${abertura.meses} meses de abertura (${abertura.dataFormatada}). Já cumpre o critério de 6 meses mínimos da maioria das operadoras.`
    );
  } else {
    exibirBanner(
      'alerta-mei-apto',
      'fa-solid fa-circle-check',
      `Empresa PME ativa com ${abertura.texto} de abertura (${abertura.dataFormatada}). Elegível para análise de planos empresariais.`
    );
  }

  const listaSociosEl = document.getElementById('listaSocios');
  listaSociosEl.innerHTML = '';

  if (socios.length === 0) {
    listaSociosEl.innerHTML = `
      <div class="cnpj-box-dado col-span-full text-xs text-[#687387]">
        Nenhum sócio listado no QSA para este CNPJ.
      </div>
    `;
  } else {
    socios.forEach(socio => {
      const card = document.createElement('div');
      card.className = 'cnpj-box-dado';
      card.innerHTML = `
        <div class="font-medium text-xs sm:text-sm text-[#e6ebf2]">${CRMUtils.escapeHtml(socio.nome_socio || 'Sócio não informado')}</div>
        <div class="text-[11px] text-[#9aa5b8] mt-0.5">${CRMUtils.escapeHtml(socio.qualificacao_socio || 'Qualificação não informada')}</div>
      `;
      listaSociosEl.appendChild(card);
    });
  }

  ultimoResultado = {
    cnpj: formatarCnpj(cnpjLimpo),
    razaoSocial: dados.razao_social || '—',
    situacao,
    isMei,
    aptoMei6Meses,
    aberturaTexto: `${abertura.dataFormatada} (${abertura.texto})`,
    socios: socios.map(s => s.nome_socio).filter(Boolean)
  };

  salvarNoHistorico(ultimoResultado);
}

function copiarResumoCnpj() {
  if (!ultimoResultado) return;

  const linhas = [
    `*Validação CNPJ:* ${ultimoResultado.cnpj}`,
    `*Empresa:* ${ultimoResultado.razaoSocial}`,
    `*Situação:* ${ultimoResultado.situacao}`,
    `*Abertura:* ${ultimoResultado.aberturaTexto}`,
    `*Enquadramento:* ${ultimoResultado.isMei ? (ultimoResultado.aptoMei6Meses ? 'MEI (6m+ ok)' : 'MEI (< 6 meses)') : 'PME'}`
  ];

  if (ultimoResultado.socios.length > 0) {
    linhas.push(`*Quadro societário:* ${ultimoResultado.socios.join(', ')}`);
  }

  navigator.clipboard?.writeText(linhas.join('\n')).then(() => {
    setStatusCnpj('• Resumo copiado', 'text-emerald-400');
  });
}

function lerHistoricoCnpj() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_HISTORICO_CNPJ)) || [];
  } catch {
    return [];
  }
}

function salvarNoHistorico(item) {
  let hist = lerHistoricoCnpj().filter(h => h.cnpj !== item.cnpj);
  hist.unshift({
    cnpj: item.cnpj,
    razaoSocial: item.razaoSocial,
    situacao: item.situacao,
    isMei: item.isMei,
    aptoMei6Meses: item.aptoMei6Meses
  });
  hist = hist.slice(0, 12);
  localStorage.setItem(STORAGE_HISTORICO_CNPJ, JSON.stringify(hist));
  renderizarHistorico();
}

function limparHistoricoCnpj() {
  localStorage.removeItem(STORAGE_HISTORICO_CNPJ);
  renderizarHistorico();
}

function renderizarHistorico() {
  const hist = lerHistoricoCnpj();
  const container = document.getElementById('listaHistoricoCnpj');
  const vazio = document.getElementById('vazioHistoricoCnpj');
  container.innerHTML = '';

  if (hist.length === 0) {
    vazio.classList.remove('hidden');
    return;
  }
  vazio.classList.add('hidden');

  hist.forEach(item => {
    const div = document.createElement('div');
    div.className = 'historico-item';
    div.onclick = () => {
      document.getElementById('inputCnpj').value = item.cnpj;
      executarConsultaCnpj(limparCnpj(item.cnpj));
    };

    const tagStatus = item.isMei
      ? (item.aptoMei6Meses ? 'text-emerald-400' : 'text-amber-300')
      : 'text-sky-300';

    div.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-[#e6ebf2]">${CRMUtils.escapeHtml(item.cnpj)}</span>
        <span class="text-[11px] font-medium ${tagStatus}">${item.isMei ? (item.aptoMei6Meses ? 'MEI 6m+' : 'MEI <6m') : 'PME'}</span>
      </div>
      <div class="text-xs text-[#9aa5b8] truncate mt-0.5">${CRMUtils.escapeHtml(item.razaoSocial)}</div>
    `;
    container.appendChild(div);
  });
}

renderizarHistorico();