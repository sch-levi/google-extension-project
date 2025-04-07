document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup loaded');

    const mapDiv = document.getElementById('map');
    const findCoffeeButton = document.getElementById('findCoffee');
    const resultsDiv = document.getElementById('results');
    const statusDiv = document.createElement('div');
    statusDiv.style.color = 'red';
    document.body.prepend(statusDiv);

    let map;
    let userMarker;
    let coffeeShopMarkers = [];

    function initMap(coords) {
        const initialCoords = coords ||  [22.3193, 114.1694]; // 預設為香港
        map = L.map(mapDiv).setView(initialCoords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        if (coords) {
            userMarker = L.marker(coords).addTo(map).bindPopup('您的位置').openPopup();
        }
    }

    function testBackgroundConnection() {
        chrome.runtime.sendMessage(
            { action: "testConnection" },
            (response) => {
                if (chrome.runtime.lastError || !response) {
                    showError('擴展功能初始化失敗，請重新加载');
                    console.error('Background error:', chrome.runtime.lastError);
                } else {
                    console.log('Background connected:', response.status);
                    initMap(); // 在連接成功後初始化地圖（使用預設位置）
                }
            }
        );
    }

    function searchCoffeeShops(coords) {
        const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coords[0]},${coords[1]}&radius=1000&type=cafe`;
        chrome.runtime.sendMessage(
            { action: "fetchCoffeeShops", url: apiUrl },
            (response) => {
                if (chrome.runtime.lastError) {
                    showError('通信失敗: ' + chrome.runtime.lastError.message);
                    return;
                }
                if (!response) {
                    showError('沒有收到回應');
                    return;
                }
                if (response.success) {
                    displayResults(response.data);
                } else {
                    showError('API錯誤: ' + response.error);
                }
            }
        );
    }

    function displayResults(data) {
        resultsDiv.innerHTML = '<h3>附近咖啡店：</h3>';
        coffeeShopMarkers.forEach(marker => map.removeLayer(marker));
        coffeeShopMarkers = [];
        if (data.results?.length > 0) {
            data.results.forEach(shop => {
                resultsDiv.innerHTML += `
                    <div class="shop">
                        <h4>${shop.name}</h4>
                        <p>${shop.vicinity}</p>
                    </div>
                `;
                const shopCoords = [shop.geometry.location.lat, shop.geometry.location.lng];
                const marker = L.marker(shopCoords).addTo(map).bindPopup(shop.name);
                coffeeShopMarkers.push(marker);
            });
            if (coffeeShopMarkers.length > 0) {
                const group = L.featureGroup(coffeeShopMarkers);
                map.fitBounds(group.getBounds());
            }
        } else {
            resultsDiv.innerHTML += '<p>附近沒有找到咖啡店</p>';
        }
        statusDiv.textContent = '';
    }

    function showError(msg) {
        statusDiv.textContent = msg;
        console.error(msg);
    }

    findCoffeeButton.addEventListener('click', () => {
        console.log('Find coffee button clicked');
        statusDiv.textContent = '搜索中...';
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const userCoords = [position.coords.latitude, position.coords.longitude];
                    if (!map) {
                        initMap(userCoords);
                    } else {
                        map.setView(userCoords, 15);
                        if (userMarker) {
                            userMarker.setLatLng(userCoords).bindPopup('您的位置').openPopup();
                        } else {
                            userMarker = L.marker(userCoords).addTo(map).bindPopup('您的位置').openPopup();
                        }
                    }
                    searchCoffeeShops(userCoords);
                },
                error => {
                    console.error('Geolocation error:', error);
                    showError('無法獲取位置，將使用默認位置');
                    initMap([22.3193, 114.1694]); // 初始化地圖到香港
                    searchCoffeeShops([22.3193, 114.1694]);
                }
            );
        } else {
            showError('瀏覽器不支持定位，將使用默認位置');
            initMap([22.3193, 114.1694]); // 初始化地圖到香港
            searchCoffeeShops([22.3193, 114.1694]);
        }
    });

    testBackgroundConnection(); // 在頁面載入後測試連接並初始化地圖
});