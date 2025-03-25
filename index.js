const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function getNumberofPages() {
    console.log('Primeiramente, vamos recuperar o número de páginas disponíveis no site.');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const firstPageUrl = 'https://mercado.carrefour.com.br/bebidas?category-1=bebidas&category-1=4599&facets=category-1&sort=score_desc&page=1';

    await page.goto(firstPageUrl, { waitUntil: 'networkidle2' });

    const totalProducts = await page.evaluate(() => {
        const totalProductsElement = document.querySelector('div[data-fs-product-listing-results-count="true"]');
        return totalProductsElement.getAttribute('data-count');
    });

    const divContent = await page.evaluate(() => {
        const divs = document.querySelectorAll('div[data-fs-product-listing-results="true"]');
        const pages = [];
        divs.forEach((div) => {
            const buttons = div.querySelectorAll('[data-testid="store-button"]');
            buttons.forEach((button) => {
                if (button) {
                    pages.push(button.innerText);
                }
            });
        });
        return pages;
    });

    await browser.close();

    console.log(`Número de páginas encontrado: ${divContent[4]}`);

    return {
        totalProducts: Number(totalProducts),
        firstPage: Number(divContent[0]),
        lastPage: Number(divContent[4]),
    };
}

async function getProducts() {
    const pages = await getNumberofPages();

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const baseUrl = 'https://mercado.carrefour.com.br/bebidas?category-1=bebidas&category-1=4599&facets=category-1&sort=score_desc&page=';

    let allProducts = [
        { totalProducts: pages.totalProducts },
    ];

    for (let pageNum = pages.firstPage; pageNum <= pages.lastPage; pageNum++) {
        console.log(`Recuperando produtos da página ${pageNum} de ${pages.lastPage}`);
        const url = `${baseUrl}${pageNum}`;

        await page.goto(url, { waitUntil: 'networkidle2' });

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

        allProducts.push({
            page: pageNum,
            products
        })
    }

    await fs.writeFile('output.json', JSON.stringify(allProducts, null, 2));

    console.log('Produtos recuperados com sucesso!');

    await browser.close();
}

getProducts();
