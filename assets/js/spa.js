document.addEventListener('DOMContentLoaded', async () => {
    const C = {
        CONTENT_SELECTOR: '#content',
        SPA_CONTENT_META: 'meta[content="spa-content-page"]',
        RELOAD_EVENT: 'spa-reload',
        BASE_DIR: "/raw"
    };

    const mainContentDiv = document.querySelector(C.CONTENT_SELECTOR);
    const reloadEvent = new Event(C.RELOAD_EVENT);
    let unmounts = [];

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

    async function executeScripts(path, scopeDocument, scopeId, fills, targetUnmounts) {
        const scripts = Array.from(scopeDocument.body.querySelectorAll('script'));
        const toMount = [];

        if (scripts.length === 0) return toMount;

        const wrapper = scopeDocument.createElement('div');
        wrapper.setAttribute('data-scope-id', scopeId);
        wrapper.append(...scopeDocument.body.childNodes);
        scopeDocument.body.appendChild(wrapper);

        const promises = [];
        for (const script of scripts) {
            try {
                let module;
                if (script.src) {
                    module = await import(new URL(script.src, window.location.href).href);
                } else if (script.textContent) {
                    const url = URL.createObjectURL(new Blob([script.textContent], { type: 'text/javascript' }));
                    module = await import(url);
                    URL.revokeObjectURL(url);
                }
                
                if (module) {
                    if (typeof module.init === 'function') {
                        promises.push(module.init(scopeDocument, fills)); 
                    }
                    if (typeof module.mount === 'function') {
                        toMount.push(module);
                    }
                    if (typeof module.unmount === 'function') {
                        targetUnmounts.push(module);
                    }
                }
            } catch (error) {
                console.error(`Error executing a script from '${path}'`, error);
            }
        }

        await Promise.all(promises);

        scripts.forEach(s => s.remove());

        return toMount;
    }

    async function loadContent(urlPath) {
        let loaderShown = false;
        const loaderTimer = setTimeout(() => {
            loaderShown = true;
            for (let module of unmounts) module.unmount();
            unmounts = [];
            mainContentDiv.innerHTML = '<br/><div class="loader"></div>';
        }, 100);
        
        let newUnmounts = [];

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
            
            let doc = contentDoc;
            let fills = {};
            const mounts = new Map();
            let scopeId = 0;

            const pageScopeId = `scope-${scopeId++}`;
            let pageMounts = await executeScripts(contentFilePath, doc, pageScopeId, fills, newUnmounts);
            if (pageMounts.length > 0) {
                mounts.set(pageScopeId, pageMounts);
            }
            formatPage(doc.body, fills);

            let currentPath = contentFilePath.substring(0, contentFilePath.lastIndexOf('/'));

            while (currentPath && currentPath.length >= C.BASE_DIR.length)
            {
                const layoutPath = currentPath + '/layout.html';
                const layout = await fetchHtmlAsDom(layoutPath);
                if (layout) {
                    layout.querySelector(C.CONTENT_SELECTOR).innerHTML = doc.body.innerHTML;
                    
                    const layoutScopeId = `scope-${scopeId++}`;
                    let layoutMounts = await executeScripts(layoutPath, layout, layoutScopeId, fills, newUnmounts);
                    if (layoutMounts.length > 0) {
                        mounts.set(layoutScopeId, layoutMounts);
                    }

                    formatPage(layout.body, fills);
                    doc = layout;
                }

                if (currentPath === C.BASE_DIR) break;
                currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            }

            // closing logic
            clearTimeout(loaderTimer);
            if (!loaderShown) for (let module of unmounts) module.unmount();
            
            unmounts = newUnmounts;

            // load new page
            document.title = fills["page-title"] || "krevetukas.lt";
            mainContentDiv.innerHTML = doc.body.innerHTML;

            // run mounts
            for (const [scope, modules] of mounts.entries()) {
                const live = document.querySelector(`[data-scope-id="${scope}"]`)
                if (live) {
                    live.removeAttribute('data-scope-id');
                    for (const module of modules) {
                        module.mount(live);
                    }
                } else {
                    console.warn(`Could not find live element for scopeId: ${scope}`);
                }
            }
        } catch (error) {
            console.warn(`Error loading content for path "${urlPath}":`, error);
            mainContentDiv.innerHTML = `
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

        if (isExternal || isSpecialLink) return;

        event.preventDefault();
        if (window.location.hash !== `#${url.pathname}`) window.location.hash = url.pathname;
    });

    function getPathFromHash() {
        const hash = window.location.hash;
        return hash.startsWith('#/') ? hash.substring(1) : '/';
    }

    window.addEventListener('hashchange', () => { loadContent(getPathFromHash()); });

    await loadContent(getPathFromHash());
});
