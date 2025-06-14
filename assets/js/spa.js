const reload = new Event('spa-reload');

const pricesURL = "https://api.jsonbin.io/v3/b/684db7dd8a456b7966ae2a8a?t=" + new Date().getTime()
let pricesData = {"result": false};

document.addEventListener('DOMContentLoaded', function() {
    // Add an 'updateHistory' parameter, defaulting to true
    window.loadContent = function(urlPath, updateHistory = true) {
        let filePath;

        // Normalize path and determine filePath
        if (urlPath === '' || urlPath === '/' || urlPath === '/index.html' || urlPath === '/index') {
            urlPath = '/';
            filePath = '/raw/home.html';
        } else {
            urlPath = urlPath.startsWith('/') ? urlPath : '/' + urlPath;
            filePath = '/raw' + urlPath + '.html';
        }

        return fetch(filePath)
            .then(response => {
                if (response.ok) {
                    return response.text();
                }
                console.warn("Response not OK for filePath:", filePath, "Status:", response.status);
                if (response.status === 404) {
                    throw new Error(`Specified file not found: ${filePath}`);
                }
                throw new Error(`Network response: ${response.status} ${response.statusText}`);
            })
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                
                if (doc.title === "") { 
                    console.warn(`Page at "${filePath}" has an empty title.`);
                }

                document.title = doc.title || "krevetukas.lt";

                if (doc.querySelector('meta[content="spa-content-page"]') != null) {
                    console.warn('Almost tried to load main page inside itself');
                    throw new Error('Page not found');
                }

                doc.body.querySelectorAll(".price").forEach(elm => {
                    if (pricesData["result"]) {
                        const id = elm.id;
                        if (!pricesData.hasOwnProperty(id)) {
                            elm.textContent = "X€";
                            return;
                        }

                        elm.textContent = pricesData[id]["price"] + '€';
                    }
                    else {
                        elm.textContent = "ERR";
                    }
                });

                document.querySelector('#content').innerHTML = doc.body.innerHTML;
                
                // Only push state if updateHistory is true (i.e., not a popstate call)
                if (updateHistory) {
                    history.pushState({ path: urlPath }, document.title, urlPath);
                }
            })
            .catch(error => {
                console.warn('Error loading content for path "' + urlPath + '", trying to fetch "' + filePath + '":', error);
                
                document.querySelector('#content').innerHTML = `
<section id="banner">
    <div class="content">
        <header>
            <h1>Nepavyko užkrauti puslapio</h1>
        </header>
        <p>${error.message}</p>
    </div>
</section>
`;
            })
            .finally(_ => {
                window.scrollTo({
                    top: 0,
                    behavior: 'instant'
                });
                document.body.dispatchEvent(reload);
            });
    }

    fetch(pricesURL, {
        cache: "no-store",
        headers: {
            "X-Bin-Meta": false,
            "X-Access-Key": "$2a$10$arXBN1Yi.R4AhW.LPVkvT.wmvyjCDPtQgK3zj.OqpjAfsF5SBndja" // It's read-only
        }})
        .then(response => {
            if (!response.ok)
            {
                throw new Error("Failed to fetch prices");
            }
            pricesData = response.json()
                .then(pdata => {
                    pricesData = pdata;
                    pricesData["result"] = true;

                    document.body.querySelectorAll(".price").forEach(elm => {
                        if (pricesData["result"]) {
                            const id = elm.id;
                            if (!pricesData.hasOwnProperty(id)) {
                                elm.textContent = "X€";
                                return;
                            }

                            elm.textContent = pricesData[id]["price"] + '€';
                        }
                        else {
                            elm.textContent = "ERR";
                        }
                    });
                });
        })
        .catch(error => {
            console.error("Error fetching prices:", error);
            pricesData = {"result": false};
        });

    document.addEventListener('click', function(event) {
        const tag = event.target.closest('a');
        if (tag) {
            const urlPath = tag.getAttribute('href');
            const target = tag.getAttribute('target');
            
            if (target === '_blank' ||
                (urlPath && (urlPath.startsWith('http://') || urlPath.startsWith('https://')) && !urlPath.startsWith(window.location.origin)) ||
                (urlPath && urlPath.startsWith('mailto:')) ||
                (urlPath && urlPath.startsWith('#'))) {
                return; // Do not prevent default, let browser handle it.
            }
            
            event.preventDefault(); // Prevent default for SPA-handled links

            if (urlPath && urlPath !== window.location.pathname) {
                // Call loadContent with updateHistory = true for link clicks
                window.loadContent(urlPath, true);
            }
        }
    });

    window.addEventListener('popstate', function(event) {
        const currentPath = window.location.pathname || '/';
        console.log('popstate triggered, loading path:', currentPath, 'with state:', event.state);
        // Call loadContent with updateHistory = false for popstate events
        window.loadContent(currentPath, false);
    });
    
    const storedUrl = sessionStorage.getItem('spaRedirectUrl');
    sessionStorage.removeItem('spaRedirectUrl');

    if (storedUrl) {
        let pathToGo;
        try {
            pathToGo = new URL(storedUrl).pathname;
        } catch (e) {
            console.error("Invalid URL in sessionStorage:", storedUrl, e);
            pathToGo = '/'; // Fallback to home
        }
        window.loadContent(pathToGo, false)
            .then(() => {
                history.replaceState({ path: pathToGo }, document.title, pathToGo);
            })
            .catch(error => {
                console.error("Error during sessionStorage redirect content load:", error);
            });
    } else {
        window.loadContent(window.location.pathname || '/', true);
    }
});