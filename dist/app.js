// app.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup loaded");

  const mapDiv = document.getElementById("map");
  const findCoffeeButton = document.getElementById("findCoffee");
  const resultsDiv = document.getElementById("results");
  const statusDiv = document.getElementById("status");

  let map;
  let userMarker;
  let coffeeShopMarkers = [];
  let currentUserCoords = [22.3193, 114.1694]; // 預設

  initMap(currentUserCoords, 13);

  // 香港 18 區的經緯度（示例座標，建議使用精確數據）
  const hongKongDistricts = {
    "central-western": [22.2864, 114.1549], // 中西區
    eastern: [22.2841, 114.224], // 東區
    southern: [22.2473, 114.1586], // 南區
    "wan-chai": [22.279, 114.1725], // 灣仔區
    "kowloon-city": [22.3282, 114.1916], // 九龍城區
    "kwun-tong": [22.3133, 114.2258], // 觀塘區
    "sham-shui-po": [22.3302, 114.1595], // 深水埗區
    "wong-tai-sin": [22.3419, 114.1931], // 黃大仙區
    "yau-tsim-mong": [22.3027, 114.1716], // 油尖旺區
    islands: [22.2611, 113.9461], // 離島區
    "kwai-tsing": [22.3639, 114.1289], // 葵青區
    north: [22.4947, 114.1381], // 北區
    "sai-kung": [22.3813, 114.2709], // 西貢區
    "sha-tin": [22.3771, 114.1974], // 沙田區
    "tai-po": [22.4501, 114.1688], // 大埔區
    "tsuen-wan": [22.3707, 114.1048], // 荃灣區
    "tuen-mun": [22.3918, 113.9773], // 屯門區
    "yuen-long": [22.4445, 114.0222], // 元朗區
  };

  function initMap(coords, zoomLevel) {
    if (map) {
      map.remove();
    }
    map = L.map(mapDiv).setView(coords, zoomLevel);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    console.log("Map initialized at:", coords);
  }

  function searchCoffeeShops(coords) {
    setStatus("正在搜索附近咖啡店...");
    currentUserCoords = coords || [22.3193, 114.1694];
    const radius = 1500; // 固定為 1500 米

    console.log(
      "[App] Sending search request with coords:",
      currentUserCoords,
      "radius:",
      radius
    );
    resultsDiv.innerHTML = "";

    chrome.runtime.sendMessage(
      {
        action: "fetchNearbyCoffee",
        coords: currentUserCoords,
        radius: radius,
      },
      (response) => {
        console.log("[App] Search Response:", response);
        if (chrome.runtime.lastError) {
          showError("與背景腳本通信失敗: " + chrome.runtime.lastError.message);
          return;
        }
        if (!response) {
          showError("未收到背景腳本的回應");
          return;
        }
        if (response.success) {
          displayResults(response.data, currentUserCoords);
        } else {
          showError("搜索失敗: " + response.error);
        }
      }
    );
  }

  function displayResults(data, userCoords) {
    coffeeShopMarkers.forEach((marker) => map.removeLayer(marker));
    coffeeShopMarkers = [];
    resultsDiv.innerHTML = "";

    const coffeeIcon = L.icon({
      iconUrl: "coffee-icon.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    if (data?.length > 0) {
      resultsDiv.innerHTML = "<h3>附近咖啡店 ：</h3>";
      data.forEach((shop) => {
        const shopName = shop.display_name || "未命名地點";
        const shopLat = shop.lat;
        const shopLon = shop.lon;
        const shopAddress = shop.address || "地址未提供";
        const shopDistrict = shop.district || "";
        const shopCity = shop.city || "";

        if (shopLat === undefined || shopLon === undefined) {
          console.warn("Skipping shop due to invalid coordinates:", shop);
          return;
        }

        const itemDiv = document.createElement("div");
        itemDiv.className = "coffee-item";

        const title = document.createElement("h4");
        title.textContent = shopName;
        itemDiv.appendChild(title);

        const addressP = document.createElement("p");
        addressP.className = "shop-address";
        addressP.textContent = shopAddress;
        itemDiv.appendChild(addressP);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "shop-actions";

        const locationHint = (shopDistrict || shopCity).trim();
        const combinedSearchTerm = `${shopName}${
          locationHint ? " " + locationHint : ""
        }`;
        console.log(
          `[App] Combined search term for ${shopName}: "${combinedSearchTerm}"`
        );

        const openriceQuery = encodeURIComponent(combinedSearchTerm);
        const openriceUrl = `https://www.openrice.com/zh/hongkong/restaurants?what=${openriceQuery}`;
        const openriceLink = document.createElement("a");
        openriceLink.href = openriceUrl;
        openriceLink.target = "_blank";
        openriceLink.className = "external-link-btn openrice";
        openriceLink.textContent = "在 OpenRice 尋找";
        actionsDiv.appendChild(openriceLink);

        const tripadvisorQuery = encodeURIComponent(combinedSearchTerm);
        const tripadvisorUrl = `https://www.tripadvisor.com/Search?q=${tripadvisorQuery}`;
        const tripadvisorLink = document.createElement("a");
        tripadvisorLink.href = tripadvisorUrl;
        tripadvisorLink.target = "_blank";
        tripadvisorLink.className = "external-link-btn tripadvisor";
        tripadvisorLink.textContent = "在 TripAdvisor 尋找";
        actionsDiv.appendChild(tripadvisorLink);

        itemDiv.appendChild(actionsDiv);
        resultsDiv.appendChild(itemDiv);

        const popupContent = `<b>${shopName}</b><br>${shopAddress}<br>
                             <a href="${openriceUrl}" target="_blank">OpenRice</a> |
                             <a href="${tripadvisorUrl}" target="_blank">TripAdvisor</a>`;
        const shopCoords = [shopLat, shopLon];
        const marker = L.marker(shopCoords, { icon: coffeeIcon })
          .addTo(map)
          .bindPopup(popupContent);
        coffeeShopMarkers.push(marker);
      });

      if (coffeeShopMarkers.length > 0) {
        const group = L.featureGroup(coffeeShopMarkers);
        if (userMarker) {
          group.addLayer(userMarker);
        }
        try {
          map.fitBounds(group.getBounds().pad(0.15));
        } catch (e) {
          console.error("FitBounds error:", e);
          if (userMarker) map.setView(userMarker.getLatLng(), 15);
        }
      }
    } else {
      resultsDiv.innerHTML =
        '<p style="text-align: center; margin-top: 20px;">在附近沒有找到咖啡店 (數據來自 OpenStreetMap)。</p>';
    }

    const attributionP = document.createElement("p");
    attributionP.className = "osm-attribution";
    attributionP.innerHTML =
      '地圖數據 © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';
    resultsDiv.appendChild(attributionP);

    setStatus("");
  }

  function setStatus(msg) {
    if (statusDiv) {
      statusDiv.textContent = msg;
    }
    if (msg !== "") console.log("Status:", msg);
  }

  function showError(msg) {
    setStatus(msg);
    console.error(msg);
  }

  findCoffeeButton.addEventListener("click", () => {
    console.log("Find coffee button clicked");
    setStatus("正在獲取您的位置或地區...");
    resultsDiv.innerHTML = "";
    if (userMarker) {
      map.removeLayer(userMarker);
      userMarker = null;
    }
    coffeeShopMarkers.forEach((marker) => map.removeLayer(marker));
    coffeeShopMarkers = [];

    const districtSelect = document.getElementById("districtSelect");
    const selectedDistrict = districtSelect.value;

    if (selectedDistrict === "current") {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userCoords = [
              position.coords.latitude,
              position.coords.longitude,
            ];
            console.log("User location obtained:", userCoords);
            setStatus("位置已獲取，開始搜索...");
            map.setView(userCoords, 15);
            userMarker = L.marker(userCoords)
              .addTo(map)
              .bindPopup("您的位置")
              .openPopup();
            searchCoffeeShops(userCoords);
          },
          (error) => {
            console.error("Geolocation error:", error);
            let errorMsg = "無法獲取位置";
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMsg += ": 您拒絕了位置權限請求。";
                break;
              case error.POSITION_UNAVAILABLE:
                errorMsg += ": 位置資訊不可用。";
                break;
              case error.TIMEOUT:
                errorMsg += ": 獲取位置超時。";
                break;
              default:
                errorMsg += ": 發生未知錯誤。";
            }
            showError(errorMsg + " 將使用預設位置搜索。");
            searchCoffeeShops();
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      } else {
        showError("您的瀏覽器不支持地理定位功能。將使用預設位置搜索。");
        searchCoffeeShops();
      }
    } else {
      const districtCoords = hongKongDistricts[selectedDistrict];
      console.log(
        `Selected district: ${selectedDistrict}, coords: ${districtCoords}`
      );
      setStatus(
        `正在搜索 ${
          districtSelect.options[districtSelect.selectedIndex].text
        } 附近的咖啡店...`
      );
      map.setView(districtCoords, 13);
      userMarker = L.marker(districtCoords)
        .addTo(map)
        .bindPopup(
          `${districtSelect.options[districtSelect.selectedIndex].text} 中心`
        )
        .openPopup();
      searchCoffeeShops(districtCoords);
    }
  });

  console.log("Popup script finished loading.");
});
