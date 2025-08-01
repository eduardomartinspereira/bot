// importa puppeteer
import puppeteer from "puppeteer";



// inicializa o browser 
//  cria a funcao assincrona
async function main() {
    console.log("Iniciando o navegador...");    
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Navegador iniciado com sucesso!");

    
}

main();