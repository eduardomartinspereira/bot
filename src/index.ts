import puppeteer, { Page } from "puppeteer";
import readline from "readline";

// --- Interface e dados da conta ---
interface Conta {
  email: string;
  nome: string;
  usuario: string;
  senha: string;
  dataNascimento: { dia: string; mes: string; ano: string };
}

const conta: Conta = {
  email: "bosahi1747@im5z.com",
  nome: "Diogo Alburquerque",
  usuario: "sdjhjsu7347",
  senha: "SenhaForte@123",
  dataNascimento: { dia: "15", mes: "6", ano: "2001" }
};

// --- Helpers ---
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve =>
    rl.question(query, ans => { rl.close(); resolve(ans.trim()); })
  );
}

// --- Clica no botão “Avançar” sem waitForSelector, só com pequena pausa ---
async function clicarAvancar(page: Page, tentativa: number) {
  console.log(`⏳ Tentando clicar no “Avançar” (${tentativa}ª)...`);
  // pequena espera para o botão aparecer/renderizar
  await sleep(1000);

  const clicou = await page.evaluate(() => {
    const txt = "avançar";
    const btn = Array.from(document.querySelectorAll("button"))
      .find(b => b.textContent?.toLowerCase().includes(txt));
    if (btn) { (btn as HTMLElement).click(); return true; }
    return false;
  });

  console.log(
    clicou
      ? `✔️ Clique no “Avançar” (${tentativa}ª) bem-sucedido.`
      : `❌ Botão Avançar não encontrado (${tentativa}ª).`
  );
}

async function criarContaInstagram(conta: Conta) {
  const browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox"] });
  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("🔗 Acessando Instagram...");
  await page.goto("https://www.instagram.com/accounts/emailsignup/", {
    waitUntil: "networkidle2"
  });

  console.log("✍️ Preenchendo e-mail, nome, usuário e senha...");
  await page.type('input[name="emailOrPhone"]', conta.email, { delay: 200 });
  await page.type('input[name="fullName"]',     conta.nome,    { delay: 200 });
  await page.type('input[name="username"]',     conta.usuario, { delay: 220 });
  await page.type('input[name="password"]',     conta.senha,   { delay: 220 });
  await sleep(1000);

  const btnSubmit = await page.$('button[type="submit"]');
  if (!btnSubmit) {
    console.log("❌ Botão de cadastro não encontrado.");
    await browser.close();
    return;
  }
  await btnSubmit.click();
  console.log("✔️ Formulário enviado.");

  console.log("⏳ Aguardando tela de data de nascimento...");
  await sleep(5000);

  console.log("📅 Preenchendo data de nascimento...");
  for (const [sel, val] of [
    ['select[title="Dia:"]', conta.dataNascimento.dia],
    ['select[title="Mês:"]', conta.dataNascimento.mes],
    ['select[title="Ano:"]', conta.dataNascimento.ano]
  ] as [string,string][]) {
    await page.evaluate((s,v) => {
      const el = document.querySelector(s) as HTMLSelectElement;
      el.value = v;
      el.dispatchEvent(new Event("change",{bubbles:true}));
    }, sel, val);
    await sleep(700);
  }

  // 1ª tentativa de avançar
  await clicarAvancar(page, 1);
  console.log("⏳ Aguardando campo de verificação…");
  await sleep(3000);

  // === Etapa de VERIFICAÇÃO POR CÓDIGO ===
  await page.waitForSelector(
    'input[name="email_confirmation_code"], input[name="confirmationCode"]',
    { visible: true, timeout: 120000 }
  );

  const code = await askQuestion("🔑 Digite o código enviado ao e-mail: ");
  await page.type(
    'input[name="email_confirmation_code"], input[name="confirmationCode"]',
    code,
    { delay: 100 }
  );

  // delay extra antes de avançar
  await sleep(1000);
  await clicarAvancar(page, 2);

  console.log("⏳ Finalizando...");
  await sleep(8000);
  await browser.close();
  console.log("✅ Conta criada. Navegador fechado.");
}

criarContaInstagram(conta).catch(err => console.error("❌ Erro ao criar conta:", err));
