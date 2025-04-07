// app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup loaded');

    const mapDiv = document.getElementById('map');
    const findCoffeeButton = document.getElementById('findCoffee');
    const resultsDiv = document.getElementById('results');
    const statusDiv = document.getElementById('status');

    let map;
    let userMarker;
    let coffeeShopMarkers = [];
    let currentUserCoords = [22.3193, 114.1694]; // 預設香港座標

    initMap(currentUserCoords, 13);

    function initMap(coords, zoomLevel) {
        if (map) {
            map.remove();
        }
        map = L.map(mapDiv).setView(coords, zoomLevel);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);
        console.log('Map initialized at:', coords);
    }

    function searchCoffeeShops(coords) {
        setStatus('正在從 OpenStreetMap 搜索附近咖啡店...');
        currentUserCoords = coords || [22.3193, 114.1694];
        console.log("[App] Sending search request with coords:", currentUserCoords);
        resultsDiv.innerHTML = '';

        chrome.runtime.sendMessage(
            { action: "fetchNearbyCoffee", coords: currentUserCoords },
            (response) => {
                console.log("[App] Search Response:", response);
                if (chrome.runtime.lastError) {
                    showError('與背景腳本通信失敗: ' + chrome.runtime.lastError.message);
                    return;
                }
                if (!response) {
                    showError('未收到背景腳本的回應');
                    return;
                }
                if (response.success) {
                    displayResults(response.data, currentUserCoords);
                } else {
                    showError('搜索失敗: ' + response.error);
                }
            }
        );
    }

    function displayResults(data, userCoords) {
        coffeeShopMarkers.forEach(marker => map.removeLayer(marker));
        coffeeShopMarkers = [];
        resultsDiv.innerHTML = '';

        if (data?.length > 0) {
            resultsDiv.innerHTML = '<h3>附近咖啡店 (來自 OpenStreetMap)：</h3>';
            data.forEach(shop => {
                const shopName = shop.display_name || "未命名地點";
                const shopLat = shop.lat;
                const shopLon = shop.lon;
                const shopAddress = shop.address || "地址未提供";
                const shopDistrict = shop.district || ""; // 從 background.js 獲取地區
                const shopCity = shop.city || "";       // 從 background.js 獲取城市

                if (shopLat === undefined || shopLon === undefined) {
                    console.warn("Skipping shop due to invalid coordinates:", shop);
                    return;
                }

                const itemDiv = document.createElement('div');
                itemDiv.className = 'coffee-item';

                const title = document.createElement('h4');
                title.textContent = shopName;
                itemDiv.appendChild(title);

                const addressP = document.createElement('p');
                addressP.className = 'shop-address';
                addressP.textContent = shopAddress;
                itemDiv.appendChild(addressP);

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'shop-actions';

                // --- 修改：組合搜尋關鍵字 (店名 + 地區/城市) ---
                // 優先使用地區，如果沒有則用城市，如果都沒有就留空
                const locationHint = (shopDistrict || shopCity).trim();
                // 組合最終搜尋字串，只有當 locationHint 非空時才加上空格和 hint
                const combinedSearchTerm = `${shopName}${locationHint ? ' ' + locationHint : ''}`;
                console.log(`[App] Combined search term for ${shopName}: "${combinedSearchTerm}"`); // Log 組合後的字串

                // 1. OpenRice 搜尋連結 (使用組合關鍵字)
                const openriceQuery = encodeURIComponent(combinedSearchTerm);
                const openriceUrl = `https://www.openrice.com/zh/hongkong/restaurants?what=${openriceQuery}`;
                const openriceLink = document.createElement('a');
                openriceLink.href = openriceUrl;
                openriceLink.target = '_blank';
                openriceLink.className = 'external-link-btn openrice';
                openriceLink.textContent = '在 OpenRice 尋找';
                actionsDiv.appendChild(openriceLink);

                // 2. TripAdvisor 搜尋連結 (使用組合關鍵字)
                const tripadvisorQuery = encodeURIComponent(combinedSearchTerm);
                const tripadvisorUrl = `https://www.tripadvisor.com/Search?q=${tripadvisorQuery}`;
                const tripadvisorLink = document.createElement('a');
                tripadvisorLink.href = tripadvisorUrl;
                tripadvisorLink.target = '_blank';
                tripadvisorLink.className = 'external-link-btn tripadvisor';
                tripadvisorLink.textContent = '在 TripAdvisor 尋找';
                actionsDiv.appendChild(tripadvisorLink);
                // --- 修改結束 ---

                itemDiv.appendChild(actionsDiv);
                resultsDiv.appendChild(itemDiv);

                // 地圖標記 (Popup 內容可保持簡單或加入連結)
                const shopCoords = [shopLat, shopLon];
                const popupContent = `<b>${shopName}</b><br>${shopAddress}`;
                // 可選：在 Popup 加入連結
                // const popupContent = `<b>${shopName}</b><br>${shopAddress}<br>
                //                     <a href="${openriceUrl}" target="_blank">OpenRice</a> |
                //                     <a href="${tripadvisorUrl}" target="_blank">TripAdvisor</a>`;
                const marker = L.marker(shopCoords)
                                .addTo(map)
                                .bindPopup(popupContent);
                coffeeShopMarkers.push(marker);
            });

            // 調整地圖視野
            if (coffeeShopMarkers.length > 0) {
                const group = L.featureGroup(coffeeShopMarkers);
                if (userMarker) {
                    group.addLayer(userMarker);
                }
                 try {
                    map.fitBounds(group.getBounds().pad(0.15));
                 } catch (e) {
                    console.error("FitBounds error:", e);
                     if(userMarker) map.setView(userMarker.getLatLng(), 15);
                 }
            }

        } else {
            resultsDiv.innerHTML = '<p style="text-align: center; margin-top: 20px;">在附近沒有找到咖啡店 (數據來自 OpenStreetMap)。</p>';
        }

        // OSM 版權署名
        const attributionP = document.createElement('p');
        attributionP.className = 'osm-attribution';
        attributionP.innerHTML = '地圖數據 © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';
        resultsDiv.appendChild(attributionP);

        setStatus(''); // 清除狀態訊息
    }

    function setStatus(msg) {
        if (statusDiv) {
            statusDiv.textContent = msg;
        }
        if(msg !== '') console.log('Status:', msg);
    }

    function showError(msg) {
        setStatus(msg);
        console.error(msg);
    }

    findCoffeeButton.addEventListener('click', () => {
        console.log('Find coffee button clicked');
        setStatus('正在獲取您的位置...');
        resultsDiv.innerHTML = '';
        if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }
         coffeeShopMarkers.forEach(marker => map.removeLayer(marker));
         coffeeShopMarkers = [];

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const userCoords = [position.coords.latitude, position.coords.longitude];
                    console.log('User location obtained:', userCoords);
                    setStatus('位置已獲取，開始搜索...');
                    map.setView(userCoords, 15);
                    userMarker = L.marker(userCoords)
                                  .addTo(map)
                                  .bindPopup('您的位置')
                                  .openPopup();
                    searchCoffeeShops(userCoords);
                },
                error => {
                    console.error('Geolocation error:', error);
                    let errorMsg = '無法獲取位置';
                    switch(error.code) {
                        case error.PERMISSION_DENIED: errorMsg += ": 您拒絕了位置權限請求。"; break;
                        case error.POSITION_UNAVAILABLE: errorMsg += ": 位置資訊不可用。"; break;
                        case error.TIMEOUT: errorMsg += ": 獲取位置超時。"; break;
                        default: errorMsg += ": 發生未知錯誤。";
                    }
                    showError(errorMsg + " 將使用預設位置搜索。");
                    searchCoffeeShops(); // 使用預設座標
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        } else {
            showError('您的瀏覽器不支持地理定位功能。將使用預設位置搜索。');
            searchCoffeeShops(); // 使用預設座標
        }
    });

    console.log('Popup script finished loading.');
});