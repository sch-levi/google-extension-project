document.addEventListener('DOMContentLoaded', () => {
    const mapDiv = document.getElementById('map');
    const findCoffeeButton = document.getElementById('findCoffee');
    const resultsDiv = document.getElementById('results');
    let map;
    let userMarker;
    let coffeeShopMarkers = [];

    function initMap(coords) {
        map = L.map(mapDiv).setView(coords, 15); // 設定初始視圖

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        userMarker = L.marker(coords).addTo(map).bindPopup('您的位置').openPopup();
    }

    function findNearbyCoffee(coords) {
        const apiUrl = `https://nominatim.openstreetmap.org/search?q=coffee shop&format=jsonv2&lat=<span class="math-inline">\{coords\[0\]\}&lon\=</span>{coords[1]}&radius=1000&limit=10`; // 搜尋半徑 1 公里，最多 10 個結果

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                resultsDiv.innerHTML = '<h3>附近咖啡店：</h3><ul>';
                coffeeShopMarkers.forEach(marker => map.removeLayer(marker)); // 移除之前的標記
                coffeeShopMarkers = [];

                if (data && data.length > 0) {
                    data.forEach(shop => {
                        const shopCoords = [parseFloat(shop.lat), parseFloat(shop.lon)];
                        const marker = L.marker(shopCoords).addTo(map).bindPopup(shop.display_name);
                        coffeeShopMarkers.push(marker);
                        resultsDiv.innerHTML += `<li>${shop.display_name}</li>`;
                    });
                } else {
                    resultsDiv.innerHTML += '<li>附近沒有找到咖啡店。</li>';
                }
                resultsDiv.innerHTML += '</ul>';
            })
            .catch(error => {
                console.error('搜尋咖啡店時發生錯誤:', error);
                resultsDiv.innerHTML = '<p>搜尋咖啡店時發生錯誤。</p>';
            });
    }

    findCoffeeButton.addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const userCoords = [position.coords.latitude, position.coords.longitude];
                    if (!map) {
                        initMap(userCoords);
                    } else {
                        map.setView(userCoords, 15);
                        userMarker.setLatLng(userCoords).bindPopup('您的位置').openPopup();
                    }
                    findNearbyCoffee(userCoords);
                },
                error => {
                    console.error('獲取地理位置失敗:', error);
                    resultsDiv.innerHTML = '<p>無法獲取您的位置，請檢查瀏覽器設定。</p>';
                }
            );
        } else {
            resultsDiv.innerHTML = '<p>您的瀏覽器不支持地理位置。</p>';
        }
    });

    // 首次載入時不主動獲取位置，等待使用者點擊按鈕
});