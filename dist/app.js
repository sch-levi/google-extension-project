// app.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup loaded");

  // --- DOM Element References ---
  const mapDiv = document.getElementById("map");
  const findCoffeeButton = document.getElementById("findCoffee");
  const resultsDiv = document.getElementById("results");
  const statusDiv = document.getElementById("status");
  const toggleResultsButton = document.getElementById("toggleResults");
  const districtSelect = document.getElementById("districtSelect");

  // --- State Variables ---
  let map;
  let userMarker;
  let coffeeShopMarkers = [];
  let currentUserCoords = [22.3193, 114.1694]; // Default coordinates (Hong Kong)
  const defaultZoom = 13;
  const locatedZoom = 15;

  // --- Hong Kong District Coordinates (Approximate Centers) ---
  const hongKongDistricts = {
    "central-western": [22.2864, 114.1549],
    eastern: [22.2841, 114.224],
    southern: [22.2473, 114.1586],
    "wan-chai": [22.279, 114.1725],
    "kowloon-city": [22.3282, 114.1916],
    "kwun-tong": [22.3133, 114.2258],
    "sham-shui-po": [22.3302, 114.1595],
    "wong-tai-sin": [22.3419, 114.1931],
    "yau-tsim-mong": [22.3027, 114.1716],
    islands: [22.2611, 113.9461],
    "kwai-tsing": [22.3639, 114.1289],
    north: [22.4947, 114.1381],
    "sai-kung": [22.3813, 114.2709],
    "sha-tin": [22.3771, 114.1974],
    "tai-po": [22.4501, 114.1688],
    "tsuen-wan": [22.3707, 114.1048],
    "tuen-mun": [22.3918, 113.9773],
    "yuen-long": [22.4445, 114.0222],
  };

  // --- Initialization ---
  initMap(currentUserCoords, defaultZoom);
  setupEventListeners();
  // testBackgroundConnection();

  // --- Helper Functions ---

  /**
   * Calculates the Haversine distance between two points on the Earth.
   * @param {number[]} coords1 - First coordinates [lat, lon].
   * @param {number[]} coords2 - Second coordinates [lat, lon].
   * @returns {number} Distance in meters.
   */
  function calculateDistance(coords1, coords2) {
    if (!coords1 || !coords2 || coords1.length !== 2 || coords2.length !== 2) {
      return Infinity; // Return a large number if coordinates are invalid
    }
    const lat1 = coords1[0];
    const lon1 = coords1[1];
    const lat2 = coords2[0];
    const lon2 = coords2[1];

    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // Distance in meters
    return d;
  }

  /**
   * Formats distance in meters to a readable string (meters or kilometers).
   * @param {number} distanceMeters - Distance in meters.
   * @returns {string} Formatted distance string (e.g., "約 550 公尺", "約 1.2 公里").
   */
  function formatDistance(distanceMeters) {
    if (distanceMeters === Infinity || isNaN(distanceMeters)) {
      return ""; // Don't display if distance is invalid
    }
    if (distanceMeters < 1000) {
      return `約 ${Math.round(distanceMeters)} 公尺`;
    } else {
      return `約 ${(distanceMeters / 1000).toFixed(1)} 公里`; // Keep one decimal place for km
    }
  }

  // --- Core Functions ---

  function initMap(coords, zoomLevel) {
    if (map) {
      map.remove();
      map = null;
    }
    map = L.map(mapDiv).setView(coords, zoomLevel);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    console.log("Map initialized at:", coords, "Zoom:", zoomLevel);
  }

  function setupEventListeners() {
    findCoffeeButton.addEventListener("click", handleFindCoffeeClick);
    toggleResultsButton.addEventListener("click", handleToggleResultsClick);
  }

  function handleFindCoffeeClick() {
    console.log("Find coffee button clicked");
    setStatus("正在準備搜尋...");
    clearPreviousResults();

    const selectedDistrict = districtSelect.value;

    if (selectedDistrict === "current") {
      setStatus("正在獲取您的位置...");
      getUserLocation();
    } else {
      const districtCoords = hongKongDistricts[selectedDistrict];
      const districtName =
        districtSelect.options[districtSelect.selectedIndex].text;
      console.log(
        `Selected district: ${districtName} (${selectedDistrict}), coords: ${districtCoords}`
      );
      if (districtCoords) {
        currentUserCoords = districtCoords; // Set search origin
        setStatus(`正在搜尋 ${districtName} 附近的咖啡店...`);
        map.setView(currentUserCoords, defaultZoom);
        addUserMarker(currentUserCoords, `${districtName} 中心 (搜尋起點)`);
        searchCoffeeShops(currentUserCoords);
      } else {
        showError(`錯誤：找不到地區 ${selectedDistrict} 的座標。`);
      }
    }
  }

  function getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentUserCoords = [
            // Set search origin
            position.coords.latitude,
            position.coords.longitude,
          ];
          console.log("User location obtained:", currentUserCoords);
          setStatus("位置已獲取，開始搜索...");
          map.setView(currentUserCoords, locatedZoom);
          addUserMarker(currentUserCoords, "您的位置 (搜尋起點)");
          searchCoffeeShops(currentUserCoords);
        },
        handleGeolocationError,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      currentUserCoords = [22.3193, 114.1694]; // Use default if no geolocation
      showError("您的瀏覽器不支持地理定位功能。將使用預設位置搜索。");
      searchCoffeeShops(currentUserCoords);
    }
  }

  function handleGeolocationError(error) {
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
    currentUserCoords = [22.3193, 114.1694]; // Use default on error
    showError(errorMsg + " 將使用預設位置（香港中心）搜索。");
    map.setView(currentUserCoords, defaultZoom);
    searchCoffeeShops(currentUserCoords);
  }

  function searchCoffeeShops(coords) {
    const radius = 1500;
    setStatus("正在搜索附近咖啡店...");
    console.log(
      "[App] Sending search request with coords:",
      coords,
      "radius:",
      radius
    );
    chrome.runtime.sendMessage(
      { action: "fetchNearbyCoffee", coords: coords, radius: radius },
      handleSearchResponse // Pass the callback
    );
  }

  /**
   * Handles the response, calculates distance, sorts, and initiates display.
   * @param {object} response - The response object from background.js.
   */
  function handleSearchResponse(response) {
    console.log("[App] Search Response:", response);
    if (chrome.runtime.lastError) {
      showError("與背景腳本通信失敗: " + chrome.runtime.lastError.message);
      return;
    }
    if (!response) {
      showError("未收到背景腳本的回應。");
      return;
    }

    if (response.success && Array.isArray(response.data)) {
      setStatus("處理搜尋結果..."); // Update status

      // 1. Calculate distance for each shop
      const shopsWithDistance = response.data
        .map((shop) => {
          const shopCoords = [shop.lat, shop.lon];
          // Calculate distance from the *actual search origin*
          shop.distance = calculateDistance(currentUserCoords, shopCoords);
          return shop;
        })
        .filter((shop) => shop.distance !== Infinity); // Filter out any with invalid coords if calc failed

      // 2. Sort shops by distance (ascending)
      shopsWithDistance.sort((a, b) => a.distance - b.distance);

      console.log(
        `[App] Found ${shopsWithDistance.length} shops, sorted by distance.`
      );

      // 3. Display the sorted results
      setStatus(""); // Clear status before display
      displayResults(shopsWithDistance); // Pass sorted data

      // Auto-expand logic
      if (shopsWithDistance.length > 0) {
        resultsDiv.style.display = "block";
        toggleResultsButton.textContent = "隱藏咖啡店清單";
        toggleResultsButton.setAttribute("aria-expanded", "true");
      } else {
        // Show the 'no results' message inside the container
        resultsDiv.style.display = "block";
        toggleResultsButton.textContent = "顯示咖啡店清單";
        toggleResultsButton.setAttribute("aria-expanded", "false");
      }
    } else {
      // Handle search failure reported by background or invalid data format
      showError("搜索失敗: " + (response.error || "回傳資料格式錯誤"));
      resultsDiv.style.display = "none";
      toggleResultsButton.textContent = "顯示咖啡店清單";
      toggleResultsButton.setAttribute("aria-expanded", "false");
    }
  }

  /**
   * Displays the (now sorted) coffee shops in the list and on the map.
   * @param {object[]} sortedData - Array of coffee shop objects, sorted by distance.
   */
  function displayResults(sortedData) {
    clearCoffeeShopMarkers();
    resultsDiv.innerHTML = ""; // Clear previous list

    const coffeeIcon = L.icon({
      iconUrl: "coffee-icon.png",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    if (sortedData?.length > 0) {
      resultsDiv.innerHTML = "<h3>附近咖啡店/咖啡館 (依距離排序)：</h3>"; // Update header

      sortedData.forEach((shop) => {
        const shopName = shop.display_name;
        const shopLat = shop.lat;
        const shopLon = shop.lon;
        const shopAddress = shop.address || "地址未提供";
        const shopDistance = shop.distance; // Get pre-calculated distance

        // Skip if coordinates are invalid (should be filtered earlier)
        if (shopLat === undefined || shopLon === undefined) return;

        // --- Create List Item ---
        const itemDiv = document.createElement("div");
        itemDiv.className = "coffee-item";

        // Container for Title and Distance
        const titleDiv = document.createElement("div");
        titleDiv.className = "shop-title-distance";

        const title = document.createElement("h4");
        title.textContent = shopName;
        titleDiv.appendChild(title);

        // Display Formatted Distance
        const distanceSpan = document.createElement("span");
        distanceSpan.className = "shop-distance";
        distanceSpan.textContent = formatDistance(shopDistance); // Use helper function
        titleDiv.appendChild(distanceSpan);

        itemDiv.appendChild(titleDiv); // Add title/distance container

        // Display Address
        if (shopAddress !== "地址未提供") {
          const addressP = document.createElement("p");
          addressP.className = "shop-address";
          addressP.textContent = `地址: ${shopAddress}`;
          itemDiv.appendChild(addressP);
        }

        // Create action buttons (Google Maps)
        const actionsDiv = createActionButtons(shopName, shopLat, shopLon);
        itemDiv.appendChild(actionsDiv);

        resultsDiv.appendChild(itemDiv);

        // --- Create Map Marker ---
        const shopCoords = [shopLat, shopLon];
        // Pass distance to popup content creator as well (optional)
        const popupContent = createPopupContent(
          shopName,
          shopAddress,
          shopLat,
          shopLon,
          shopDistance
        );
        const marker = L.marker(shopCoords, { icon: coffeeIcon })
          .addTo(map)
          .bindPopup(popupContent);

        // Click list item pans map
        itemDiv.addEventListener("click", () => {
          map.setView(shopCoords, locatedZoom);
          marker.openPopup();
        });

        coffeeShopMarkers.push(marker);
      });

      fitMapToBounds(); // Adjust map view
    } else {
      // Handle case where data was received but empty after filtering/sorting
      resultsDiv.innerHTML =
        '<p class="no-results">在附近範圍內沒有找到符合條件的咖啡店或咖啡館 (數據來自 OpenStreetMap)。</p>';
    }

    // Add OSM attribution
    const attributionP = document.createElement("p");
    attributionP.className = "osm-attribution";
    attributionP.innerHTML =
      '地圖數據 © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';
    resultsDiv.appendChild(attributionP);
  }

  /**
   * Creates action buttons (Google Maps Navigation).
   */
  function createActionButtons(shopName, shopLat, shopLon) {
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "shop-actions";

    if (
      currentUserCoords &&
      currentUserCoords.length === 2 &&
      shopLat !== undefined &&
      shopLon !== undefined
    ) {
      const originCoords = `${currentUserCoords[0]},${currentUserCoords[1]}`;
      const destinationCoords = `${shopLat},${shopLon}`;
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destinationCoords}&travelmode=walking`;

      const googleMapsLink = document.createElement("a");
      googleMapsLink.href = googleMapsUrl;
      googleMapsLink.target = "_blank";
      googleMapsLink.rel = "noopener noreferrer";
      googleMapsLink.className = "external-link-btn google-maps";
      googleMapsLink.textContent = "Google 導覽";
      googleMapsLink.title = `從目前搜尋位置導航至 ${shopName}`;
      actionsDiv.appendChild(googleMapsLink);
    } else {
      console.warn("Cannot create Google Maps link: Missing coordinates.", {
        currentUserCoords,
        shopLat,
        shopLon,
      });
      const disabledText = document.createElement("span");
      disabledText.textContent = "(無法產生導航連結)";
      disabledText.className = "navigation-unavailable";
      actionsDiv.appendChild(disabledText);
    }
    return actionsDiv;
  }

  /**
   * Creates the HTML content for a map marker's popup.
   * @param {string} shopName
   * @param {string} shopAddress
   * @param {number} shopLat
   * @param {number} shopLon
   * @param {number} [shopDistance] - Optional distance in meters.
   * @returns {string} HTML string for the popup.
   */
  function createPopupContent(
    shopName,
    shopAddress,
    shopLat,
    shopLon,
    shopDistance
  ) {
    let content = `<b>${shopName}</b>`;
    // Optionally display distance in popup
    if (shopDistance !== undefined) {
      content += ` <small>(${formatDistance(shopDistance)})</small>`;
    }
    if (shopAddress && shopAddress !== "地址未提供") {
      content += `<br>${shopAddress}`;
    }

    // Add Google Maps link
    if (
      currentUserCoords &&
      currentUserCoords.length === 2 &&
      shopLat !== undefined &&
      shopLon !== undefined
    ) {
      const originCoords = `${currentUserCoords[0]},${currentUserCoords[1]}`;
      const destinationCoords = `${shopLat},${shopLon}`;
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destinationCoords}&travelmode=walking`;
      content += `<br><a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" title="Google 導覽 (步行)">Google 導覽</a>`;
    } else {
      content += `<br><small class="navigation-unavailable">(無法產生導航連結)</small>`;
    }
    return content;
  }

  /**
   * Adjusts the map view to fit all markers (user + coffee shops).
   */
  function fitMapToBounds() {
    const markersToFit = [...coffeeShopMarkers];
    if (userMarker) {
      markersToFit.push(userMarker);
    }
    if (markersToFit.length > 0) {
      const group = L.featureGroup(markersToFit);
      try {
        map.fitBounds(group.getBounds().pad(0.15));
      } catch (e) {
        console.error("FitBounds error:", e);
        if (userMarker) map.setView(userMarker.getLatLng(), locatedZoom);
        else if (coffeeShopMarkers.length > 0)
          map.setView(coffeeShopMarkers[0].getLatLng(), locatedZoom);
      }
    } else {
      console.log("No markers found to fit bounds.");
    }
  }

  /**
   * Adds or updates the user's location marker.
   */
  function addUserMarker(coords, popupText) {
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker(coords).addTo(map).bindPopup(popupText).openPopup();
  }

  /**
   * Clears coffee shop markers.
   */
  function clearCoffeeShopMarkers() {
    coffeeShopMarkers.forEach((marker) => map.removeLayer(marker));
    coffeeShopMarkers = [];
  }

  /**
   * Clears all previous results (markers, list).
   */
  function clearPreviousResults() {
    if (userMarker) {
      map.removeLayer(userMarker);
      userMarker = null;
    }
    clearCoffeeShopMarkers();
    resultsDiv.innerHTML = "";
    resultsDiv.style.display = "none";
    toggleResultsButton.textContent = "顯示咖啡店清單";
    toggleResultsButton.setAttribute("aria-expanded", "false");
    setStatus(""); // Clear status
  }

  /**
   * Handles toggle results button click.
   */
  function handleToggleResultsClick() {
    const isHidden =
      resultsDiv.style.display === "none" || resultsDiv.style.display === "";
    resultsDiv.style.display = isHidden ? "block" : "none";
    toggleResultsButton.textContent = isHidden
      ? "隱藏咖啡店清單"
      : "顯示咖啡店清單";
    toggleResultsButton.setAttribute("aria-expanded", String(isHidden));
  }

  /**
   * Sets the status message.
   */
  function setStatus(msg) {
    if (statusDiv) {
      statusDiv.textContent = msg;
      statusDiv.style.display = msg ? "block" : "none";
      statusDiv.className =
        msg.toLowerCase().includes("錯誤") || msg.toLowerCase().includes("失敗")
          ? "error-message"
          : "";
      statusDiv.setAttribute("role", "status");
      statusDiv.setAttribute("aria-live", "polite");
    }
    if (msg) console.log("Status:", msg);
  }

  /**
   * Displays an error message.
   */
  function showError(msg) {
    setStatus(msg);
    console.error("Error:", msg);
  }

  /**
   * Optional: Test background connection.
   */
  function testBackgroundConnection() {
    chrome.runtime.sendMessage({ action: "testConnection" }, (response) => {
      if (chrome.runtime.lastError)
        console.error(
          "Background connection test failed:",
          chrome.runtime.lastError.message
        );
      else if (response && response.status)
        console.log(
          "[App] Background connection test successful:",
          response.status
        );
      else
        console.warn(
          "[App] Background connection test: No response or invalid response."
        );
    });
  }

  console.log("Popup script finished loading and setup complete.");
}); // End of DOMContentLoaded listener
