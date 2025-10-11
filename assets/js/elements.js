document.addEventListener('DOMContentLoaded', () => {
    const API_URL = "https://api.npoint.io/7547aaecf6594fd448b4";
    const PRICE_SELECTOR = '.price';
    const RELOAD_EVENT = 'spa-reload';

    const formatter = new Intl.NumberFormat('lt-LT', {
        style: 'currency',
        currency: 'EUR',
    });

    let priceData = { result: false };

    async function fetchPriceData() {
        const fetchOptions = { cache: "no-store" };
        const response = await fetch(API_URL, fetchOptions);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    }

    function updatePricesInDom() {
        document.querySelectorAll(PRICE_SELECTOR).forEach(elm => {
            if (priceData.result && priceData[elm.id]) {
                if (!priceData[elm.id].inStock) {
                    elm.textContent = 'NETURIME';
                } else {
                    elm.textContent = formatter.format(priceData[elm.id].price);
                }
            } else {
                elm.textContent = priceData.result ? "X€" : "ERR";
            }
        });
    }

    async function loadPriceData() {
        try {
            const data = await fetchPriceData();
            priceData = { ...data, result: true };
        } catch (error) {
            console.error("Failed to fetch prices", error);
            priceData = { result: false };
        } finally {
            updatePricesInDom();
        }
    }
    
    document.body.addEventListener(RELOAD_EVENT, updatePricesInDom);
    
    loadPriceData();
});