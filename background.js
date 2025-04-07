console.log("[Background] Script loaded!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Background] Received message:", request);

    if (request.action === "testConnection") {
        sendResponse({ status: "Background ready!" });
        return true;
    }

    if (request.action === "fetchNearbyCoffee") { // 監聽新的 action
        const { coords } = request;
        const apiUrl = `https://nominatim.openstreetmap.org/search?q=coffee shop&format=jsonv2&lat=<span class="math-inline">\{coords\[0\]\}&lon\=</span>{coords[1]}&radius=1000&limit=10`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                sendResponse({
                    success: true,
                    data: data
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });
        return true;
    }
});