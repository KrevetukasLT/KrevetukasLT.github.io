document.addEventListener('DOMContentLoaded', async () => {
    const C = {
        API_URL: "https://api.npoint.io/7547aaecf6594fd448b4",
        CONTENT_SELECTOR: '#content',
        PRICE_SELECTOR: '.price',
        SPA_CONTENT_META: 'meta[content="spa-content-page"]',
        RELOAD_EVENT: 'spa-reload',
        SESSION_STORAGE_KEY: 'spaRedirectUrl',
        BASE_DIR: "/raw"
    };

    const reloadEvent = new Event(C.RELOAD_EVENT);
    const formatter = new Intl.NumberFormat('lt-LT', {
        style: 'currency',
        currency: 'EUR',
    });
    let priceData = { result: false };

    async function fetchHtmlAsDom(path) {
        const response = await fetch(path);
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`Network response: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        return new DOMParser().parseFromString(html, 'text/html');
    }

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

    function formatPage(contentBody, fills) {
        contentBody.querySelectorAll('spa-slot').forEach(elm => {
            const name = elm.getAttribute('name');
            const fill = name ? fills[name] : undefined;

            const temp = document.createElement('span');
            if (fill)
            {
                temp.innerHTML = fill;
                elm.replaceWith(...temp.childNodes);
            }
            else {
                temp.innerHTML = elm.innerHTML;
                elm.replaceWith(...temp.childNodes);
            }
        })

        contentBody.querySelectorAll('spa-fill').forEach(elm => {
            const name = elm.getAttribute('name');
            if (name) {
                fills[name] = elm.innerHTML;
            }
            elm.remove();
        });
    }

    async function loadContent(urlPath, updateHistory = true) {
        const isHome = !urlPath || ['/', '/index.html', '/index', '/home.html', '/home'].includes(urlPath);
        const finalPath = isHome ? '/' : (urlPath.startsWith('/') ? urlPath : `/${urlPath}`);
        const contentFilePath = isHome ? `${C.BASE_DIR}/home.html` : `${C.BASE_DIR}${finalPath}.html`;

        try {
            const contentDoc = await fetchHtmlAsDom(contentFilePath);
            if (!contentDoc) {
                throw new Error(`Specified page not found: ${contentFilePath}`);
            }
            if (contentDoc.querySelector(C.SPA_CONTENT_META)) {
                throw new Error('Recursive page load detected. Page not found');
            }
            
            let doc = contentDoc.body;
            let fills = {};
            formatPage(doc, fills);
            let currentPath = contentFilePath.substring(0, contentFilePath.lastIndexOf('/'));

            while (currentPath && currentPath.length >= C.BASE_DIR.length)
            {
                const style = await fetchHtmlAsDom(currentPath + '/style.html');
                if (style) {
                    formatPage(style.body, fills);
                    style.querySelector(C.CONTENT_SELECTOR).innerHTML = doc.innerHTML;
                    doc = style.body;
                }

                if (currentPath === C.BASE_DIR) {
                    break;
                }
                currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            }
            
            // closing logic
            document.title = fills["page-title"] || "krevetukas.lt";
            document.querySelector(C.CONTENT_SELECTOR).innerHTML = doc.innerHTML;
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
