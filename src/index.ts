import puppeteer, { Page } from "puppeteer";
import readline from "readline";
import * as fs from "fs";
import { faker } from "@faker-js/faker";

// --- Helpers ---
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve =>
    rl.question(query, ans => { rl.close(); resolve(ans.trim()); })
  );
}

// --- Configuração manual do e-mail ---
const emailManual = "miveyo8212@im5z.com";

// --- Geração automática de nome, usuário e senha ---
interface Credenciais {
  nome: string;
  usuario: string;
  senha: string;
}

function gerarCredenciais(): Credenciais {
  const firstName = faker.name.firstName();
  const lastName  = faker.name.lastName();
  const fullName  = `${firstName} ${lastName}`;

  // remove acentos e espaços para normalizar
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

  // username = nome+sobrenome + 4 caracteres aleatórios
  const usuario = normalized + faker.string.alphanumeric(4).toLowerCase();

  // senha = nome (sem acento/espaço) + '@' + dois dígitos
  const senha = `${normalized}@${faker.number.int({ min: 10, max: 99 })}`;

  return { nome: fullName, usuario, senha };
}

// --- Função para clicar em "Avançar" ---
async function clicarAvancar(page: Page, tentativa: number): Promise<boolean> {
  console.log(`⏳ Tentando clicar no “Avançar” (${tentativa}ª)...`);
  await sleep(1000);
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = (await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn)) || "";
    if (text.includes("avançar")) {
      await btn.click();
      console.log(`✔️ Clique no “Avançar” (${tentativa}ª) bem-sucedido.`);
      return true;
    }
  }
  console.log(`❌ Botão Avançar não encontrado (${tentativa}ª).`);
  return false;
}

// --- Fluxo principal ---
async function criarContaInstagram() {
  const { nome, usuario, senha } = gerarCredenciais();
  console.log("🆕 Credenciais geradas:", { nome, usuario, senha, email: emailManual });

  const browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox"] });
  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 1) Cadastro inicial
  console.log("🔗 Acessando Instagram signup...");
  await page.goto("https://www.instagram.com/accounts/emailsignup/", { waitUntil: "networkidle2" });

  console.log("✍️ Preenchendo e-mail, nome, usuário e senha...");
  await page.type('input[name="emailOrPhone"]', emailManual, { delay: 200 });
  await page.type('input[name="fullName"]',     nome,       { delay: 200 });
  await page.type('input[name="username"]',     usuario,    { delay: 220 });
  await page.type('input[name="password"]',     senha,      { delay: 220 });
  await sleep(1000);

  const btnSubmit = await page.$('button[type="submit"]');
  if (!btnSubmit) throw new Error("Botão de cadastro não encontrado.");
  await btnSubmit.click();
  console.log("✔️ Formulário enviado.");

  // 2) Data de nascimento
  await sleep(5000);
  console.log("📅 Preenchendo data de nascimento...");
  const data = { dia: "19", mes: "8", ano: "2005" };
  for (const [sel, val] of [
    ['select[title="Dia:"]', data.dia],
    ['select[title="Mês:"]', data.mes],
    ['select[title="Ano:"]', data.ano]
  ] as [string,string][]) {
    await page.evaluate((s,v) => {
      const el = document.querySelector(s) as HTMLSelectElement;
      el.value = v;
      el.dispatchEvent(new Event("change",{ bubbles: true }));
    }, sel, val);
    await sleep(700);
  }

  if (!await clicarAvancar(page, 1)) throw new Error("Falha ao avançar após data de nascimento");

  // 3) Verificação por código
  console.log("⏳ Aguardando campo de verificação…");
  await page.waitForSelector(
    'input[name="email_confirmation_code"], input[name="confirmationCode"]',
    { visible: true, timeout: 120000 }
  );

  const code = await askQuestion("🔑 Digite o código enviado ao e-mail: ");
  await page.type(
    'input[name="email_confirmation_code"], input[name="confirmationCode"]',
    code, { delay: 100 }
  );

  if (!await clicarAvancar(page, 2)) throw new Error("Falha ao avançar após inserir o código");

  console.log("⏳ Finalizando criação de conta...");
  await sleep(8000);
  await browser.close();
  console.log("✅ Conta criada. Navegador fechado.");

  // 4) Salvar usuário e senha
  const filePath = "contas.json";
  const entry = { usuario, senha };
  const lista = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : [];
  lista.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(lista, null, 2), "utf-8");
  console.log(`📄 Credenciais salvas em ${filePath}`);
}

criarContaInstagram().catch(err => console.error("❌ Erro:", err));
