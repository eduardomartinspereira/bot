import puppeteer from "puppeteer";

const conta = {
  email: "diogovitalis2024@gmail.com",
  nome: "Diego Sumanger",
  usuario: "diegosumanger",
  senha: "SenhaForte@123"
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Conta {
    email: string;
    nome: string;
    usuario: string;
    senha: string;
  }
  
  async function criarContaInstagram(conta: Conta) {
  
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Acessando Instagram...");
  await page.goto("https://www.instagram.com/accounts/emailsignup/", {
    waitUntil: "networkidle2"
  });

  console.log("Preenchendo os dados...");

  await page.type('input[name="emailOrPhone"]', conta.email, { delay: 100 }); // 100ms por tecla
  await page.type('input[name="fullName"]', conta.nome, { delay: 100 });
  await page.type('input[name="username"]', conta.usuario, { delay: 120 }); // um pouco mais lento
  await page.type('input[name="password"]', conta.senha, { delay: 120 });

  await sleep(1000); // simula tempo de leitura humana

  const botaoCadastro = await page.$('button[type="submit"]');
  if (botaoCadastro) {
    await botaoCadastro.click();
    console.log("✔️ Formulário enviado.");
  } else {
    console.log("❌ Botão de cadastro não encontrado.");
  }

  console.log("Aguardando etapa seguinte...");
  await sleep(15000); // espera para visualizar próxima etapa ou resolver captcha manualmente

  await browser.close();
  console.log("Navegador fechado.");
}

criarContaInstagram(conta).catch(e => {
  const msg = e instanceof Error ? e.message : String(e);
  console.log("Erro ao criar conta:", msg);
});

