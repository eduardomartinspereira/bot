import puppeteer, { Page } from "puppeteer";
import readline from "readline";
import * as fs from "fs";
import { faker } from "@faker-js/faker";


const emailManual = "gagog73438@misehub.com";  

// --- Helpers ---
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve =>
    rl.question(query, ans => { rl.close(); resolve(ans.trim()); })
  );
}

// --- Geração de credenciais ---
interface Credenciais { nome: string; usuario: string; senha: string; }
function gerarCredenciais(): Credenciais {
  const firstName = faker.person.firstName();
  const lastName  = faker.person.lastName();
  const fullName  = `${firstName} ${lastName}`;
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const usuario = normalized + faker.string.alphanumeric(4).toLowerCase();
  const senha   = `${normalized}@${faker.number.int({ min: 10, max: 99 })}`;
  return { nome: fullName, usuario, senha };
}

// --- Função para clicar no botão “Avançar” ---
async function clicarAvancar(page: Page, tentativa: number): Promise<boolean> {
  console.log(`⏳ Tentando clicar no “Avançar” (${tentativa}ª)...`);
  await sleep(1000);
  const handles = await page.$$('[role="button"], button');
  for (const handle of handles) {
    const txt = (await page.evaluate(el => el.textContent?.trim().toLowerCase(), handle)) || "";
    if (txt.includes("avançar")) {
      await handle.click();
      console.log(`✔️ Clique no “Avançar” (${tentativa}ª) bem-sucedido.`);
      return true;
    }
  }
  console.log(`❌ Botão Avançar não encontrado (${tentativa}ª).`);
  return false;
}

// --- Fluxo principal ---
async function criarContaInstagram() {
  // 1) Gerar credenciais
  const { nome, usuario, senha } = gerarCredenciais();
  console.log("🆕 Credenciais geradas:", { nome, usuario, senha, email: emailManual });

  // 2) Iniciar Puppeteer
  const browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox"] });
  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 3) Signup
  console.log("🔗 Acessando Instagram signup...");
  await page.goto("https://www.instagram.com/accounts/emailsignup/", { waitUntil: "networkidle2" });
  console.log("✍️ Preenchendo e-mail, nome, usuário e senha...");
  await page.type('input[name="emailOrPhone"]', emailManual, { delay: 200 });
  await page.type('input[name="fullName"]',     nome, { delay: 200 });
  await page.type('input[name="username"]',     usuario, { delay: 220 });
  await page.type('input[name="password"]',     senha, { delay: 220 });
  await sleep(1000);
  const btn = await page.$('button[type="submit"]');
  if (!btn) throw new Error("Botão de signup não encontrado");
  await btn.click();
  console.log("✔️ Formulário enviado.");

  // 4) Data de nascimento
  await sleep(5000);
  console.log("📅 Preenchendo data de nascimento...");
  const data = { dia: "19", mes: "8", ano: "2005" };
  for (const [sel, val] of [
    ['select[title="Dia:"]', data.dia],
    ['select[title="Mês:"]', data.mes],
    ['select[title="Ano:"]', data.ano]
  ] as [string,string][]) {
    await page.evaluate((s, v) => {
      const el = document.querySelector(s) as HTMLSelectElement;
      el.value = v;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, sel, val);
    await sleep(700);
  }
  if (!await clicarAvancar(page, 1)) throw new Error("Erro ao avançar após data de nascimento");

  // 5) Verificação por código
  console.log("⏳ Aguardando campo de verificação…");
  await page.waitForSelector(
    'input[name="email_confirmation_code"],input[name="confirmationCode"]',
    { visible: true, timeout: 120_000 }
  );
  const code = await askQuestion("🔑 Código recebido no e-mail: ");
  await page.type(
    'input[name="email_confirmation_code"],input[name="confirmationCode"]',
    code, { delay: 100 }
  );
  if (!await clicarAvancar(page, 2)) throw new Error("Erro ao avançar após código");

  console.log("⏳ Finalizando signup…");
  await sleep(8000);

  // 6) Salvar credenciais
  const file = "contas.json";
  const list = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf-8"))
    : [];
  list.push({ usuario, senha });
  fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf-8");
  console.log(`📄 Salvo em ${file}`);

  // 7) Manter aberto e navegar no menu lateral
  console.log("🔓 Browser aberto, aguardando o menu lateral...");

  // 7.1) Espera até aparecer o <span> “Mais”
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("span"))
               .some(s => s.textContent?.trim() === "Mais"),
    { timeout: 15_000 }
  );

  // 7.2) Clica em “Mais”
  console.log("🔧 Clicando em 'Mais'...");
  await page.evaluate(() => {
    const span = Array.from(document.querySelectorAll("span"))
                      .find(s => s.textContent?.trim() === "Mais");
    if (!span) throw new Error("Span 'Mais' não encontrado");
    let node: HTMLElement | null = span;
    while (node && !(node.tagName === "A" ||
                     node.tagName === "BUTTON" ||
                     node.getAttribute("role") === "link")) {
      node = node.parentElement;
    }
    if (!node) throw new Error("Elemento clicável para 'Mais' não encontrado");
    node.click();
  });
  await sleep(1000);

  // 7.3) Espera até aparecer o <span> “Configurações”
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("span"))
               .some(s => s.textContent?.trim() === "Configurações"),
    { timeout: 10_000 }
  );

  // 7.4) Clica em “Configurações”
  console.log("🔧 Clicando em 'Configurações'...");
  await page.evaluate(() => {
    const span = Array.from(document.querySelectorAll("span"))
                      .find(s => s.textContent?.trim() === "Configurações");
    if (!span) throw new Error("Span 'Configurações' não encontrado");
    let node: HTMLElement | null = span;
    while (node && !(node.tagName === "A" ||
                     node.tagName === "BUTTON" ||
                     node.getAttribute("role") === "link")) {
      node = node.parentElement;
    }
    if (!node) throw new Error("Elemento clicável para 'Configurações' não encontrado");
    node.click();
  });
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log("✔️ Agora em Configurações.");

  // 8) Fechar manualmente
  await askQuestion("ENTER para fechar o browser…");
  await browser.close();
  console.log("✅ Fim do script.");
}

criarContaInstagram().catch(e => console.error("❌", e));
