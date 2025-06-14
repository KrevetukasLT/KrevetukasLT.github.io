document.addEventListener('DOMContentLoaded', async () => {
    const C = {
        API_URL: "https://api.jsonbin.io/v3/b/684db7dd8a456b7966ae2a8a",
        API_FALLBACK_URL: "https://raw.githubusercontent.com/KrevetukasLT/KrevetukasLT.github.io/refs/heads/main/prices.json",
        API_KEY: "$2a$10$arXBN1Yi.R4AhW.LPVkvT.wmvyjCDPtQgK3zj.OqpjAfsF5SBndja",
        CONTENT_SELECTOR: '#content',
        PRICE_SELECTOR: '.price',
        SPA_CONTENT_META: 'meta[content="spa-content-page"]',
        RELOAD_EVENT: 'spa-reload',
        SESSION_STORAGE_KEY: 'spaRedirectUrl'
    };

    const reloadEvent = new Event(C.RELOAD_EVENT);
    let priceData = { result: false };

    async function fetchPriceData(url, isJsonBin = false) {
        const fetchOptions = { cache: "no-store" };
        if (isJsonBin) {
            fetchOptions.headers = {
                "X-Bin-Meta": "false",
                "X-Access-Key": C.API_KEY
            };
        }

        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (isJsonBin && data.hasOwnProperty("success") && data.success === false) {
            throw new Error(`JSONBin.io error: ${data.message || 'Unknown error'}`);
        }
        return data;
    }

    function updatePricesInDom() {
        document.querySelectorAll(C.PRICE_SELECTOR).forEach(elm => {
            if (priceData.result && priceData[elm.id]) {
                elm.textContent = `${priceData[elm.id].price}€`;
            } else {
                elm.textContent = priceData.result ? "X€" : "ERR";
            }
        });
    }

    async function loadPriceData() {
        try {
            const data = await fetchPriceData(C.API_URL, true);
            priceData = { ...data, result: true };
        } catch (error) {
            console.error("Failed to fetch prices from primary source. Attempting fallback.", error);
            try {
                const data = await fetchPriceData(C.API_FALLBACK_URL, false);
                priceData = { ...data, result: true };
                console.log("Prices fetched from fallback successfully.");
            } catch (fallbackError) {
                console.error("Failed to fetch prices from both primary and fallback sources.", fallbackError);
                priceData = { result: false };
            }
        } finally {
            updatePricesInDom();
        }
    }

    async function loadContent(urlPath, updateHistory = true) {
        const isHome = !urlPath || ['/', '/index.html', '/index'].includes(urlPath);
        const finalPath = isHome ? '/' : (urlPath.startsWith('/') ? urlPath : `/${urlPath}`);
        const filePath = isHome ? '/raw/home.html' : `/raw${finalPath}.html`;
        
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(response.status === 404 ? `Specified file not found: ${filePath}` : `Network response: ${response.status} ${response.statusText}`);
            }

            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            if (doc.querySelector(C.SPA_CONTENT_META)) {
                throw new Error('Recursive page load detected. Page not found.');
            }

            document.title = doc.title || "krevetukas.lt";
            document.querySelector(C.CONTENT_SELECTOR).innerHTML = doc.body.innerHTML;

            updatePricesInDom();

            if (updateHistory) {
                history.pushState({ path: finalPath }, document.title, finalPath);
            }
        } catch (error) {
            console.warn(`Error loading content for path "${urlPath}":`, error);
            document.querySelector(C.CONTENT_SELECTOR).innerHTML = `
                <section id="banner">
                    <div class="content">
                        <header><h1>Nepavyko užkrauti puslapio</h1></header>
                        <p>${error.message}</p>
                    </div>
                </section>`;
        } finally {
            window.scrollTo({ top: 0, behavior: 'instant' });
            document.body.dispatchEvent(reloadEvent);
        }
    }

    document.addEventListener('click', event => {
        const anchor = event.target.closest('a');
        if (!anchor) return;

        const url = new URL(anchor.href, window.location.origin);

        const isExternal = window.location.origin !== url.origin;
        const isSpecialLink = url.protocol === 'mailto:' || anchor.target === '_blank' || url.pathname.startsWith('#');

        if (isExternal || isSpecialLink) {
            return; // Let the browser handle it.
        }

        event.preventDefault(); // Let the SPA.js handle it.
        if (url.pathname !== window.location.pathname) {
            loadContent(url.pathname, true);
        }
    });

    window.addEventListener('popstate', event => {
        const path = event.state?.path || '/';
        loadContent(path, false);
    });

    // Initial Load Logic
    await loadPriceData();

    const storedUrl = sessionStorage.getItem(C.SESSION_STORAGE_KEY);
    sessionStorage.removeItem(C.SESSION_STORAGE_KEY);

    let initialPath = window.location.pathname || '/';
    let shouldUpdateHistory = true;

    if (storedUrl) {
        try {
            initialPath = new URL(storedUrl).pathname;
            shouldUpdateHistory = false; // The state should be replaced, not pushed.
        } catch (e) {
            console.error("Invalid URL in sessionStorage:", storedUrl, e);
        }
    }

    await loadContent(initialPath, shouldUpdateHistory);
    // Ensure history state is correct after a redirect-based load.
    if (storedUrl) {
        history.replaceState({ path: initialPath }, document.title, initialPath);
    }
});