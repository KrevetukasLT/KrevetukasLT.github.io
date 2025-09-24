document.addEventListener('DOMContentLoaded', async () => {
    const C = {
        API_URL: "https://api.npoint.io/7547aaecf6594fd448b4",
        CONTENT_SELECTOR: '#content',
        PRICE_SELECTOR: '.price',
        SPA_CONTENT_META: 'meta[content="spa-content-page"]',
        RELOAD_EVENT: 'spa-reload',
        SESSION_STORAGE_KEY: 'spaRedirectUrl'
    };

    const reloadEvent = new Event(C.RELOAD_EVENT);
    let priceData = { result: false };

    async function fetchPriceData() {
        const fetchOptions = { cache: "no-store" };

        const response = await fetch(C.API_URL, fetchOptions);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
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
            const data = await fetchPriceData();
            priceData = { ...data, result: true };
        } catch (error) {
            console.error("Failed to fetch prices from primary source. Attempting fallback.", error);
            priceData = { result: false };
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
