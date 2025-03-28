const { timeout } = require('puppeteer');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function fetchPageProducts(page, pageNum, baseUrl) {
    console.log(`Recuperando produtos da página ${pageNum}`);
    const url = `${baseUrl}${pageNum}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

    const products = await page.evaluate(() => {
        const div = document.querySelector('div[data-fs-product-listing-results="true"] ul');
        if (!div) return [];

        return Array.from(div.querySelectorAll('li')).map((item) => {
            const name = item.querySelector('a[data-testid="product-link"]');
            const price = item.querySelector('span[data-test-id="price"]');
            const discount = item.querySelector('div[data-test="discount-badge"]');
            const discountValue = discount ? discount.querySelector('div span')?.innerText.match(/\d+/g)?.join('') : null;
            const discountNumeric = discountValue ? parseInt(discountValue, 10) : null;
            const priceWithoutDiscount = price ? parseInt(price.getAttribute('data-value'), 10) * 100 / (100 - discountNumeric) : null;

            return {
                name: name ? name.innerText.trim() : 'Nome não encontrado',
                price: discountNumeric ? `R$ ${priceWithoutDiscount.toFixed(2)}` : price ? `R$ ${price.getAttribute('data-value')}` : 'Preço não encontrado',
                discount: discountNumeric,
                priceWithDiscount: discountNumeric ? `R$ ${price.getAttribute('data-value')}` : null,
            };
        });
    });

    console.log(`Produtos da página ${pageNum} recuperados com sucesso!`);
    return products;
}

async function getProducts() {
    const pages = await getNumberofPages();

    const browser = await puppeteer.launch({ headless: true });
    const baseUrl = 'https://mercado.carrefour.com.br/bebidas?category-1=bebidas&category-1=4599&facets=category-1&sort=score_desc&page=';

    let allProducts = [
        { totalProducts: pages.totalProducts },
    ];

    const pagePromises = [];
    for (let pageNum = pages.firstPage; pageNum <= pages.lastPage; pageNum++) {
        const page = await browser.newPage();
        pagePromises.push(fetchPageProducts(page, pageNum, baseUrl));
    }

    const startTime = new Date();

    const results = await Promise.all(pagePromises);
    results.forEach(result => allProducts.push(result));

    await fs.writeFile('output.json', JSON.stringify(allProducts, null, 2));

    const endTime = new Date();
    const elapsedTime = (endTime - startTime) / 1000;

    console.log('Produtos recuperados com sucesso!');
    console.log(`Tempo total de execução: ${elapsedTime} segundos`);
    //125 segundos

    await browser.close();
}

getProducts();
