const reload = new Event('spa-reload');

const pricesURL = "https://raw.githubusercontent.com/KrevetukasLT/prices/refs/heads/main/main.json"
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

        fetch(filePath)
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

                pelm = document.querySelectorAll(".price");
                pelm.forEach(elm => {
                    if (pricesData["result"]) {
                        const id = elm.id;
                        if (!pricesData.hasOwnProperty(id)) {
                            elm.textContent = "ERR";
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

    // This first click listener seems to only check if a click is inside a link
    // but doesn't prevent default or initiate navigation. It might be redundant
    // if the second click listener handles all link clicks appropriately.
    // If it's for a different purpose, ensure it's not interfering.
    /*
    document.addEventListener('click', function(event) {
        let clickedElement = event.target;
        let isInsideLink = false;
      
        while (clickedElement) {
          if (clickedElement.tagName === 'A') {
            isInsideLink = true;
            break;
          }
          clickedElement = clickedElement.parentElement;
        }
      
        if (!isInsideLink) {
            return;
        }
    });
    */

    fetch(pricesURL)
        .then(response => {
            if (!response.ok)
            {
                throw new Error("Failed to fetch prices");
            }
            pricesData = response.json();
            pricesData["result"] = true;
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

            // Let the browser handle clicks on:
            // - Links with target="_blank"
            // - Absolute URLs (links to other websites)
            // - Mailto links
            // - Hash links (unless your SPA specifically handles them, this setup does not)
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

    // Initial load:
    // For the very first load, it's okay to update history if, for example,
    // the server serves /index.html but you want the URL to show as /.
    // `loadContent` normalizes this and `updateHistory=true` will clean up the URL.
    window.loadContent(window.location.pathname || '/', true);
});