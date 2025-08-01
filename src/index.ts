import puppeteer, { Page } from "puppeteer";

interface Conta {
  email: string;
  nome: string;
  usuario: string;
  senha: string;
  dataNascimento: {
    dia: string;
    mes: string;
    ano: string;
  };
}

const conta: Conta = {
  email: "eduardopereirajordani@gmail.com",
  nome: "Luiz Joger",
  usuario: "luizj_oger",
  senha: "SenhaForte@123",
  dataNascimento: {
    dia: "10",
    mes: "1",   // janeiro
    ano: "1995"
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Clica no botão “Avançar” buscando pelo texto exato */
async function clicarAvancar(page: Page, tentativa: number) {
  const clicou = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Avançar');
    if (btn) {
      (btn as HTMLElement).click();
      return true;
    }
    return false;
  });
  console.log(
    clicou
      ? `✔️ Clique no botão Avançar (${tentativa}ª tentativa).`
      : `❌ Botão Avançar não encontrado (${tentativa}ª tentativa).`
  );
}

async function criarContaInstagram(conta: Conta) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox","--disable-setuid-sandbox"]
  });

  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/115.0.0.0 Safari/537.36"
  );

  console.log("🔗 Acessando Instagram...");
  await page.goto("https://www.instagram.com/accounts/emailsignup/", {
    waitUntil: "networkidle2"
  });

  console.log("✍️  Preenchendo e-mail, nome, usuário e senha...");
  await page.type('input[name="emailOrPhone"]', conta.email, { delay: 200 });
  await page.type('input[name="fullName"]',     conta.nome,   { delay: 200 });
  await page.type('input[name="username"]',     conta.usuario,{ delay: 220 });
  await page.type('input[name="password"]',     conta.senha,  { delay: 220 });

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
  // 1) Dia
  await page.evaluate((d: string) => {
    const el = document.querySelector('select[title="Dia:"]') as HTMLSelectElement;
    el.value = d; el.dispatchEvent(new Event('change',{bubbles:true}));
  }, conta.dataNascimento.dia);
  await sleep(700);

  // 2) Mês
  await page.evaluate((m: string) => {
    const el = document.querySelector('select[title="Mês:"]') as HTMLSelectElement;
    el.value = m; el.dispatchEvent(new Event('change',{bubbles:true}));
  }, conta.dataNascimento.mes);
  await sleep(700);

  // 3) Ano
  await page.evaluate((y: string) => {
    const el = document.querySelector('select[title="Ano:"]') as HTMLSelectElement;
    el.value = y; el.dispatchEvent(new Event('change',{bubbles:true}));
  }, conta.dataNascimento.ano);
  await sleep(700);

  // 4) Clicar no botão Avançar
  await clicarAvancar(page, 1);

  console.log("⏳ Aguardando resultado...");
  await sleep(8000);

  await browser.close();
  console.log("✅ Navegador fechado. Fluxo concluído.");
}

criarContaInstagram(conta).catch(err => {
  console.error("❌ Erro ao criar conta:", err);
});
