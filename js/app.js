/* =========================================================
   CONFIGURAÇÃO
   Ajuste aqui as regras de direcionamento da sobra.
   ========================================================= */
const CONFIG = {
  // Meta da reserva de emergência: quantos meses de despesas
  mesesReserva: 6,

  // Enquanto a reserva NÃO estiver completa
  divisaoReservaPendente: { reserva: 0.70, investimento: 0.20, lazer: 0.10 },

  // Depois que a reserva estiver completa
  divisaoReservaCompleta: { reserva: 0, investimento: 0.70, lazer: 0.30 },
};

const CORES_GRAFICO = [
  "#2f6bff", "#12a37f", "#e8870e", "#7a5af8", "#e5484d",
  "#0ea5c6", "#d6409f", "#8b9a2b", "#f06a3c", "#5b6b84",
];

/* =========================================================
   ESTADO (listas guardadas)
   ========================================================= */
const CHAVES = {
  rendas: "financeiro:rendas",
  despesas: "financeiro:despesas",
  reserva: "financeiro:reserva-atual",
};

let rendas = carregar(CHAVES.rendas, []);       // [{ nome, valor }]
let despesas = carregar(CHAVES.despesas, []);   // [{ nome, valor, fixa }]
let reservaAtual = carregar(CHAVES.reserva, 0); // número

function carregar(chave, padrao) {
  try {
    const salvo = localStorage.getItem(chave);
    return salvo ? JSON.parse(salvo) : padrao;
  } catch {
    return padrao;
  }
}

function salvar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem localStorage: continua funcionando enquanto a página estiver aberta
  }
}

/* =========================================================
   ELEMENTOS DA PÁGINA
   ========================================================= */
const $ = (id) => document.getElementById(id);

/* =========================================================
   FUNÇÕES AUXILIARES
   ========================================================= */
function moeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function percentual(valor) {
  return valor.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 0 });
}

function somar(lista) {
  return lista.reduce((soma, item) => soma + item.valor, 0);
}

function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

function mostrarErro(elemento, mensagem) {
  elemento.textContent = mensagem;
  elemento.hidden = false;
}

function limparErro(elemento) {
  elemento.textContent = "";
  elemento.hidden = true;
}

function criarBotaoRemover(nome, aoClicar) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "remover";
  botao.textContent = "Remover";
  botao.setAttribute("aria-label", `Remover ${nome}`);
  botao.addEventListener("click", aoClicar);
  return botao;
}

/* =========================================================
   CÁLCULOS
   ========================================================= */
function calcularTotais() {
  const renda = somar(rendas);
  const fixas = somar(despesas.filter((d) => d.fixa));
  const variaveis = somar(despesas.filter((d) => !d.fixa));
  const totalDespesas = fixas + variaveis;
  const sobra = renda - totalDespesas;
  return { renda, fixas, variaveis, totalDespesas, sobra };
}

function distribuirSobra(sobra, faltaReserva) {
  const regra = faltaReserva > 0 ? CONFIG.divisaoReservaPendente : CONFIG.divisaoReservaCompleta;

  let reserva = sobra * regra.reserva;
  let investimento = sobra * regra.investimento;

  // Não faz sentido guardar mais do que falta para completar a reserva:
  // o excedente vai para investimento.
  if (reserva > faltaReserva) {
    investimento += reserva - faltaReserva;
    reserva = faltaReserva;
  }

  reserva = arredondar(reserva);
  investimento = arredondar(investimento);
  const lazer = arredondar(sobra - reserva - investimento); // fecha o centavo

  return { reserva, investimento, lazer };
}

/* =========================================================
   RENDERIZAÇÃO
   ========================================================= */
function renderizarRendas() {
  const lista = $("lista-rendas");
  lista.innerHTML = "";

  rendas.forEach((renda, indice) => {
    const li = document.createElement("li");

    const nome = document.createElement("span");
    nome.className = "nome";
    const ordem = document.createElement("span");
    ordem.className = "ordem";
    ordem.textContent = `${indice + 1}ª renda:`;
    nome.append(ordem, renda.nome);

    const valor = document.createElement("span");
    valor.className = "valor";
    valor.textContent = moeda(renda.valor);

    li.append(nome, valor, criarBotaoRemover(renda.nome, () => removerRenda(indice)));
    lista.appendChild(li);
  });

  $("vazio-rendas").hidden = rendas.length > 0;
}

function renderizarDespesas() {
  const lista = $("lista-despesas");
  lista.innerHTML = "";

  despesas.forEach((despesa, indice) => {
    const li = document.createElement("li");
    if (despesa.fixa) li.classList.add("fixa");

    const nome = document.createElement("span");
    nome.className = "nome";
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = despesa.fixa ? "Fixa" : "Variável";
    nome.append(despesa.nome, tag);

    const valor = document.createElement("span");
    valor.className = "valor";
    valor.textContent = moeda(despesa.valor);

    li.append(nome, valor, criarBotaoRemover(despesa.nome, () => removerDespesa(indice)));
    lista.appendChild(li);
  });

  $("vazio-despesas").hidden = despesas.length > 0;
}

function renderizarResumo(t) {
  $("resumo-renda").textContent = moeda(t.renda);
  $("resumo-despesas").textContent = moeda(t.totalDespesas);
  $("total-fixas").textContent = moeda(t.fixas);
  $("total-variaveis").textContent = moeda(t.variaveis);

  const pct = t.renda > 0 ? t.totalDespesas / t.renda : 0;
  $("resumo-percentual").textContent = `${percentual(pct)} da renda`;

  const card = $("card-sobra");
  const negativa = t.sobra < 0;
  card.classList.toggle("negativa", negativa);
  $("rotulo-sobra").textContent = negativa ? "Falta" : "Sobra";
  $("resumo-sobra").textContent = moeda(Math.abs(t.sobra));
}

function renderizarGrafico(t) {
  const svg = $("grafico-pizza");
  const legenda = $("legenda-grafico");
  svg.innerHTML = "";
  legenda.innerHTML = "";

  const temDespesas = t.totalDespesas > 0;
  $("area-grafico").hidden = !temDespesas;
  $("vazio-grafico").hidden = temDespesas;
  if (!temDespesas) return;

  // Maiores gastos primeiro
  const ordenadas = [...despesas].sort((a, b) => b.valor - a.valor);

  // Pizza feita com círculos: raio 25 + traço de 50 = círculo cheio
  const raio = 25;
  const circunferencia = 2 * Math.PI * raio;
  const folga = ordenadas.length > 1 ? 0.5 : 0;
  let acumulado = 0;

  ordenadas.forEach((despesa, i) => {
    const fatia = despesa.valor / t.totalDespesas;
    const comprimento = fatia * circunferencia;
    const cor = CORES_GRAFICO[i % CORES_GRAFICO.length];

    const circulo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circulo.setAttribute("cx", "50");
    circulo.setAttribute("cy", "50");
    circulo.setAttribute("r", String(raio));
    circulo.setAttribute("fill", "none");
    circulo.setAttribute("stroke", cor);
    circulo.setAttribute("stroke-width", String(raio * 2));
    circulo.setAttribute("stroke-dasharray", `${Math.max(comprimento - folga, 0)} ${circunferencia}`);
    circulo.setAttribute("stroke-dashoffset", String(-acumulado));
    circulo.setAttribute("transform", "rotate(-90 50 50)");

    const titulo = document.createElementNS("http://www.w3.org/2000/svg", "title");
    titulo.textContent = `${despesa.nome}: ${moeda(despesa.valor)} (${percentual(fatia)})`;
    circulo.appendChild(titulo);
    svg.appendChild(circulo);

    acumulado += comprimento;

    const li = document.createElement("li");
    const quadrado = document.createElement("span");
    quadrado.className = "cor";
    quadrado.style.background = cor;
    const nome = document.createElement("span");
    nome.textContent = despesa.nome;
    const info = document.createElement("span");
    info.className = "info";
    info.innerHTML = `<strong>${percentual(fatia)}</strong> · ${moeda(despesa.valor)}`;
    li.append(quadrado, nome, info);
    legenda.appendChild(li);
  });
}

function renderizarDirecionamento(t) {
  const meta = CONFIG.mesesReserva * t.totalDespesas;
  const falta = Math.max(meta - reservaAtual, 0);

  $("info-reserva").textContent =
    t.totalDespesas > 0
      ? `Meta: ${CONFIG.mesesReserva} meses de despesas = ${moeda(meta)}. ` +
        (falta > 0 ? `Faltam ${moeda(falta)}.` : "Meta atingida.")
      : "";

  const msg = $("msg-direcionamento");
  const area = $("area-direcionamento");
  const regra = $("texto-regra");
  msg.classList.remove("perigo");

  // Sem dados suficientes
  if (t.renda === 0) {
    msg.textContent = "Cadastre suas rendas e despesas para ver o direcionamento.";
    msg.hidden = false;
    area.hidden = true;
    regra.textContent = "";
    return;
  }

  // Sem sobra
  if (t.sobra <= 0) {
    msg.classList.add("perigo");
    msg.textContent =
      t.sobra === 0
        ? "Não sobrou nada: suas despesas consomem toda a renda. Revise as despesas variáveis primeiro."
        : `As despesas passam da renda em ${moeda(-t.sobra)}. Sem sobra para direcionar: corte primeiro nas despesas variáveis.`;
    msg.hidden = false;
    area.hidden = true;
    regra.textContent = "";
    return;
  }

  msg.hidden = true;
  area.hidden = false;

  const d = distribuirSobra(t.sobra, falta);
  $("dest-reserva").textContent = moeda(d.reserva);
  $("dest-invest").textContent = moeda(d.investimento);
  $("dest-lazer").textContent = moeda(d.lazer);
  $("pct-reserva").textContent = `${percentual(d.reserva / t.sobra)} da sobra`;
  $("pct-invest").textContent = `${percentual(d.investimento / t.sobra)} da sobra`;
  $("pct-lazer").textContent = `${percentual(d.lazer / t.sobra)} da sobra`;

  regra.textContent =
    falta > 0
      ? "Reserva primeiro: a prioridade é completar a reserva de emergência antes de aumentar investimentos (princípio de pagar-se primeiro). O lazer fica com uma fatia pequena e fixa, para o plano ser sustentável."
      : "Reserva completa: a sobra passa a ser dividida entre investimento e lazer.";
}

function renderizarTudo() {
  const totais = calcularTotais();
  renderizarRendas();
  renderizarDespesas();
  renderizarResumo(totais);
  renderizarGrafico(totais);
  renderizarDirecionamento(totais);
}

/* =========================================================
   AÇÕES
   ========================================================= */
function adicionarRenda(nome, valor) {
  rendas.push({ nome, valor });
  salvar(CHAVES.rendas, rendas);
  renderizarTudo();
}

function removerRenda(indice) {
  rendas.splice(indice, 1);
  salvar(CHAVES.rendas, rendas);
  renderizarTudo();
}

function adicionarDespesa(nome, valor, fixa) {
  despesas.push({ nome, valor, fixa });
  salvar(CHAVES.despesas, despesas);
  renderizarTudo();
}

function removerDespesa(indice) {
  despesas.splice(indice, 1);
  salvar(CHAVES.despesas, despesas);
  renderizarTudo();
}

/* =========================================================
   EVENTOS
   ========================================================= */
$("form-renda").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const erro = $("erro-renda");
  limparErro(erro);

  const nome = $("renda-nome").value.trim();
  const valor = parseFloat($("renda-valor").value);

  if (!nome) return mostrarErro(erro, "Digite o nome da renda.");
  if (Number.isNaN(valor) || valor <= 0) return mostrarErro(erro, "Digite um valor maior que zero.");

  adicionarRenda(nome, valor);
  evento.target.reset();
  $("renda-nome").focus();
});

const btnFixa = $("btn-fixa");

btnFixa.addEventListener("click", () => {
  const ativo = btnFixa.getAttribute("aria-pressed") === "true";
  btnFixa.setAttribute("aria-pressed", String(!ativo));
});

$("form-despesa").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const erro = $("erro-despesa");
  limparErro(erro);

  const nome = $("despesa-nome").value.trim();
  const valor = parseFloat($("despesa-valor").value);
  const fixa = btnFixa.getAttribute("aria-pressed") === "true";

  if (!nome) return mostrarErro(erro, "Digite o nome da despesa.");
  if (Number.isNaN(valor) || valor <= 0) return mostrarErro(erro, "Digite um valor maior que zero.");

  adicionarDespesa(nome, valor, fixa);
  evento.target.reset();
  btnFixa.setAttribute("aria-pressed", "false");
  $("despesa-nome").focus();
});

$("reserva-atual").value = reservaAtual;
$("reserva-atual").addEventListener("input", (evento) => {
  const valor = parseFloat(evento.target.value);
  reservaAtual = Number.isNaN(valor) || valor < 0 ? 0 : valor;
  salvar(CHAVES.reserva, reservaAtual);
  renderizarTudo();
});

renderizarTudo();
