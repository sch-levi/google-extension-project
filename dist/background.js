// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Background] Received message:", request.action, "Coords:", request.coords);

    if (request.action === "testConnection") {
        console.log("[Background] Responding to testConnection");
        sendResponse({ status: "Connected successfully from background!" });
        return false; // 同步回應
    }

    if (request.action === "fetchNearbyCoffee") {
        const currentCoords = request.coords || [22.3193, 114.1694]; // 預設香港座標
        const radius = 1500;
        const overpassUrl = "https://overpass-api.de/api/interpreter";
        const query = `
        [out:json][timeout:25];
        (
          nwr["amenity"="cafe"](around:${radius},${currentCoords[0]},${currentCoords[1]});
          // 你可以取消註解下面這行來同時搜尋 shop=coffee
          // nwr["shop"="coffee"](around:${radius},${currentCoords[0]},${currentCoords[1]});
        );
        out center;
        `;
        const encodedQuery = encodeURIComponent(query);
        const apiUrl = `${overpassUrl}?data=${encodedQuery}`;

        console.log("[Background] Fetching from Overpass API:", apiUrl);

        fetch(apiUrl, { /* ... fetch options ... */ })
        .then(response => {
            console.log("[Background] Overpass Response Status:", response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    console.error("[Background] Overpass API error response text:", text);
                    const remarkMatch = text.match(/<p><strong>remark<\/strong>:(.*?)<\/p>/);
                    const errorDetails = remarkMatch ? remarkMatch[1].trim() : `HTTP status ${response.status}`;
                    throw new Error(`Overpass API error: ${errorDetails}`);
                });
            }
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                 return response.text().then(text => {
                    console.error("[Background] Overpass unexpected content type:", contentType, "Response text:", text);
                    throw new Error(`Overpass API returned non-JSON response. Content-Type: ${contentType}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.elements) {
                 console.warn("[Background] Invalid data structure received from Overpass:", data);
                 throw new Error("Received invalid data structure from Overpass API.");
            }

            if (data.elements.length === 0) {
                console.warn("[Background] No coffee shops found via Overpass for coords:", currentCoords);
                sendResponse({ success: true, data: [] });
            } else {
                console.log("[Background] Found", data.elements.length, "elements via Overpass.");
                const formattedData = data.elements.map(element => {
                    let lat, lon;
                    if (element.type === "node") {
                        lat = element.lat;
                        lon = element.lon;
                    } else if (element.center) {
                        lat = element.center.lat;
                        lon = element.center.lon;
                    } else if (element.lat && element.lon) {
                         lat = element.lat;
                         lon = element.lon;
                    } else {
                        console.warn("[Background] Element skipped, missing coordinates:", element.type, element.id);
                        return null;
                    }

                    const tags = element.tags || {};
                    const name = tags['name:en'] || tags.name || "未命名地點";

                    // 提取地址 (保持不變)
                    let address = "地址未提供";
                    const addrParts = [];
                    if (tags['addr:full']) {
                        address = tags['addr:full'];
                    } else {
                        if (tags['addr:street']) addrParts.push(tags['addr:street']);
                        if (tags['addr:housenumber']) addrParts.push(tags['addr:housenumber']);
                        if (addrParts.length > 0) {
                            address = addrParts.join(', ');
                        }
                    }

                    // --- 新增：提取地區和城市 ---
                    const district = tags['addr:district'] || ''; // 嘗試獲取地區
                    const city = tags['addr:city'] || '';       // 嘗試獲取城市
                    // --- 新增結束 ---

                    return {
                        id: element.id,
                        display_name: name,
                        lat: lat,
                        lon: lon,
                        address: address, // 地址欄位
                        district: district, // 新增地區欄位
                        city: city,         // 新增城市欄位
                        rating: "N/A",
                        reviews: [],
                        tags: tags
                    };
                }).filter(shop => shop !== null);

                console.log("[Background] Sending formatted data count:", formattedData.length);
                sendResponse({ success: true, data: formattedData });
            }
        })
        .catch(error => {
            console.error("[Background] Overpass Fetch failed:", error);
            sendResponse({
                success: false,
                error: error.message || "Failed to fetch from Overpass API. Check background logs."
            });
        });

        return true; // 異步
    }

    console.warn("[Background] Unhandled action:", request.action);
    return false;
});

// Service worker install/activate events (保持不變)
self.addEventListener('install', event => {
  console.log('[Background] Service worker installed');
});
self.addEventListener('activate', event => {
  console.log('[Background] Service worker activated');
});