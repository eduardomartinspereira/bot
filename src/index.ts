import puppeteer, { Page, ElementHandle } from "puppeteer";
import readline from "readline";
import * as fs from "fs";
import { faker } from "@faker-js/faker";

// ======================================================
// ===           CONFIGURE SEU E-MAIL AQUI           ===
// ======================================================
const emailManual = "canikef713@misehub.com";  // ←←←<<< Substitua pelo seu e-mail

// --- Helpers ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

// --- Geração de credenciais ---
interface Credenciais {
  nome: string;
  usuario: string;
  senha: string;
}
function gerarCredenciais(): Credenciais {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const fullName = `${firstName} ${lastName}`;
  const normalized = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const usuario = normalized + faker.string.alphanumeric(4).toLowerCase();
  const senha = `${normalized}@${faker.number.int({ min: 10, max: 99 })}`;
  return { nome: fullName, usuario, senha };
}

// --- Função para clicar no botão “Avançar” ---
async function clicarAvancar(page: Page, tentativa: number): Promise<boolean> {
  console.log(`⏳ Tentando clicar no "Avançar" (${tentativa}ª)...`);
  await sleep(1000);
  const handles = await page.$$('[role="button"], button');
  for (const handle of handles) {
    const txt =
      (await page.evaluate((el) => el.textContent?.trim().toLowerCase(), handle)) || "";
    if (txt.includes("avançar")) {
      await handle.click();
      console.log(`✔️ Clique no "Avançar" (${tentativa}ª) bem-sucedido.`);
      return true;
    }
  }
  console.log(`❌ Botão "Avançar" não encontrado (${tentativa}ª).`);
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
  await page.goto("https://www.instagram.com/accounts/emailsignup/", {
    waitUntil: "networkidle2",
  });

  console.log("✍️ Preenchendo e-mail, senha, nome completo e usuário…");
  const campos = [
    { sel: 'input[name="emailOrPhone"]', valor: emailManual },
    { sel: 'input[name="password"]', valor: senha },
    { sel: 'input[name="fullName"]', valor: nome },
    { sel: 'input[name="username"]', valor: usuario },
  ] as const;

  for (const { sel, valor } of campos) {
    const input = await page.waitForSelector(sel, { visible: true });
    if (!input) throw new Error(`Campo ${sel} não encontrado`);
    await (input as ElementHandle<HTMLInputElement>).click({ clickCount: 3 });
    await page.type(sel, valor, { delay: 150 });
    await page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLInputElement | null;
      el?.blur();
    }, sel);
    await sleep(700);
  }

  const submitButton = await page.waitForSelector(
    'button[type="submit"]:not([disabled])',
    { visible: true, timeout: 10000 }
  );
  if (!submitButton) throw new Error("Botão de signup ainda não habilitado");
  await (submitButton as ElementHandle<HTMLButtonElement>).click();
  console.log("✔️ Formulário enviado.");

  // 4) Data de nascimento
  await sleep(5000);
  console.log("📅 Preenchendo data de nascimento...");
  const data = { dia: "19", mes: "8", ano: "2005" };
  for (const [title, val] of [
    ["Dia:", data.dia],
    ["Mês:", data.mes],
    ["Ano:", data.ano],
  ] as const) {
    await page.evaluate(
      (t, v) => {
        const selector = `select[title="${t}"]`;
        const el = document.querySelector(selector) as HTMLSelectElement | null;
        if (!el) throw new Error(`Select ${selector} não encontrado`);
        el.value = v;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      title,
      val
    );
    await sleep(700);
  }
  if (!(await clicarAvancar(page, 1))) {
    throw new Error("Erro ao avançar após data de nascimento");
  }

  // 5) Verificação por código
  console.log("⏳ Aguardando campo de verificação…");
  await page.waitForSelector(
    'input[name="email_confirmation_code"], input[name="confirmationCode"]',
    { visible: true, timeout: 120000 }
  );
  const code = await askQuestion("🔑 Código recebido no e-mail: ");
  await page.type(
    'input[name="email_confirmation_code"], input[name="confirmationCode"]',
    code,
    { delay: 100 }
  );
  if (!(await clicarAvancar(page, 2))) {
    throw new Error("Erro ao avançar após código");
  }

  console.log("⏳ Finalizando signup…");
  await sleep(8000);

  // 6) Salvar credenciais
  const file = "contas.json";
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : [];
  existing.push({ usuario, senha });
  fs.writeFileSync(file, JSON.stringify(existing, null, 2), "utf-8");
  console.log(`📄 Salvo em ${file}`);

  // 7) Menu lateral: “Mais” → “Configurações” → “Central de Contas”
  console.log("🔓 Aguardando o menu lateral...");
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("span")).some((s) => s.textContent?.trim() === "Mais"),
    { timeout: 15000 }
  );
  console.log("🔧 Clicando em 'Mais'...");
  await page.evaluate(() => {
    const span = Array.from(document.querySelectorAll("span")).find((s) => s.textContent?.trim() === "Mais");
    if (!span) throw new Error("Span 'Mais' não encontrado");
    let node: HTMLElement | null = span;
    while (node && !(node.tagName === "A" || node.tagName === "BUTTON" || node.getAttribute("role") === "link")) {
      node = node.parentElement;
    }
    node?.click();
  });
  await sleep(1000);

  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("span")).some((s) => s.textContent?.trim() === "Configurações"),
    { timeout: 10000 }
  );
  console.log("🔧 Clicando em 'Configurações'...");
  await page.evaluate(() => {
    const span = Array.from(document.querySelectorAll("span")).find((s) => s.textContent?.trim() === "Configurações");
    if (!span) throw new Error("Span 'Configurações' não encontrado");
    let node: HTMLElement | null = span;
    while (node && !(node.tagName === "A" || node.tagName === "BUTTON" || node.getAttribute("role") === "link")) {
      node = node.parentElement;
    }
    node?.click();
  });

  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("div")).some((div) => div.textContent?.trim() === "Central de Contas"),
    { timeout: 10000 }
  );
  console.log("✔️ Página de Configurações carregada.");

  console.log("🔧 Clicando em 'Central de Contas'...");
  await page.$$eval("div", (divs) => {
    const target = divs.find((div) => div.textContent?.trim() === "Central de Contas");
    if (!target) throw new Error("Caixa 'Central de Contas' não encontrada");
    (target as HTMLElement).scrollIntoView({ behavior: "auto", block: "center" });
    (target as HTMLElement).click();
  });
  console.log("✔️ Caixa de 'Central de Contas' clicada.");

  // 8) Fechar manualmente
  await askQuestion("Pressione ENTER para fechar o navegador…");
  await browser.close();
  console.log("✅ Fim do script.");
}

criarContaInstagram().catch((e) => console.error("❌", e));
