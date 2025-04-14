// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(
    "[Background] Received message:",
    request.action,
    "Coords:",
    request.coords
  );

  if (request.action === "testConnection") {
    console.log("[Background] Responding to testConnection");
    sendResponse({ status: "Connected successfully from background!" });
    return false; // 同步回應
  }

  // 處理 fetchNearbyCoffee 請求
  if (request.action === "fetchNearbyCoffee") {
    const currentCoords = request.coords || [22.3193, 114.1694]; // 預設香港座標
    const radius = request.radius || 1500; // 使用传入的半径或默认1500米
    const overpassUrl = "https://overpass-api.de/api/interpreter";

    // --- Overpass 查詢 ---
    // 搜尋標記為 cafe, coffee_shop, cuisine=coffee_shop 或 shop=coffee 的地點
    const query = `
      [out:json][timeout:25];
      (
        nwr["amenity"="cafe"](around:${radius},${currentCoords[0]},${currentCoords[1]});
        nwr["amenity"="coffee_shop"](around:${radius},${currentCoords[0]},${currentCoords[1]});
        nwr["cuisine"="coffee_shop"](around:${radius},${currentCoords[0]},${currentCoords[1]});
        nwr["shop"="coffee"](around:${radius},${currentCoords[0]},${currentCoords[1]});
      );
      out center;
        `;
    // --- 查詢結束 ---

    const encodedQuery = encodeURIComponent(query);
    const apiUrl = `${overpassUrl}?data=${encodedQuery}`;

    console.log(
      "[Background] Fetching cafes and coffee shops from Overpass API:",
      apiUrl
    );

    fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      // Consider adding a timeout, though Overpass query has one
      // signal: AbortSignal.timeout(28000) // Example: Slightly longer than Overpass timeout
    })
      .then((response) => {
        console.log("[Background] Overpass Response Status:", response.status);
        if (!response.ok) {
          // 優先處理特定 HTTP 錯誤
          if (response.status === 429) {
            throw new Error(`Overpass API 錯誤：請求過多 (429)。請稍後再試。`);
          }
          if (response.status === 504) {
            throw new Error(
              `Overpass API 錯誤：閘道超時 (504)。伺服器可能正忙。`
            );
          }
          // 嘗試解析 remark (注意其脆弱性)
          return response.text().then((text) => {
            console.error("[Background] Overpass API 錯誤回應文字:", text);
            // 注意：從 HTML 解析 remark 的方式很脆弱，依賴於 Overpass API 的錯誤頁面格式。
            const remarkMatch = text.match(
              /<p><strong>remark<\/strong>:(.*?)<\/p>/
            );
            const errorDetails = remarkMatch
              ? remarkMatch[1].trim()
              : `HTTP status ${response.status}`;
            throw new Error(`Overpass API 錯誤: ${errorDetails}`);
          });
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          return response.text().then((text) => {
            console.error(
              "[Background] Overpass 意外的內容類型:",
              contentType,
              "回應文字:",
              text
            );
            throw new Error(
              `Overpass API 返回非 JSON 回應。 Content-Type: ${contentType}`
            );
          });
        }
        return response.json();
      })
      .then((data) => {
        if (!data || !data.elements) {
          console.warn("[Background] 從 Overpass 收到無效的資料結構:", data);
          throw new Error("從 Overpass API 收到無效的資料結構。");
        }

        if (data.elements.length === 0) {
          console.warn(
            "[Background] 通過 Overpass 未找到符合條件的咖啡館或咖啡店，座標:",
            currentCoords,
            "查詢:",
            query
          );
          sendResponse({ success: true, data: [] });
        } else {
          console.log(
            "[Background] 通過 Overpass 找到",
            data.elements.length,
            "個元素。"
          );

          // --- 資料格式化與過濾 ---
          const fallbackName = "未命名地點"; // 用於過濾的預設名稱
          const formattedData = data.elements
            .map((element) => {
              let lat, lon;
              if (element.type === "node") {
                lat = element.lat;
                lon = element.lon;
              } else if (element.center) {
                // For ways/relations with a calculated center
                lat = element.center.lat;
                lon = element.center.lon;
              } else if (element.lat && element.lon) {
                // Fallback for elements that might have lat/lon directly
                lat = element.lat;
                lon = element.lon;
              } else {
                console.warn(
                  "[Background] 元素因缺少座標而被跳過:",
                  element.type,
                  element.id
                );
                return null; // Mark for filtering
              }

              const tags = element.tags || {};
              const name = tags["name:en"] || tags.name || fallbackName; // Use English name first, then local, then fallback

              // 提取和組合地址
              let address = "地址未提供";
              const addrParts = [];
              if (tags["addr:full"]) {
                address = tags["addr:full"];
              } else {
                if (tags["addr:street"]) addrParts.push(tags["addr:street"]);
                if (tags["addr:housenumber"])
                  addrParts.push(tags["addr:housenumber"]);
                // Consider adding more details if available: floor, unit, block etc.
                // if (tags["addr:floor"]) addrParts.push(`Floor ${tags["addr:floor"]}`);
                if (tags["addr:district"])
                  addrParts.push(tags["addr:district"]); // Add district to address string
                if (tags["addr:city"]) addrParts.push(tags["addr:city"]); // Add city to address string

                if (addrParts.length > 0) {
                  address = addrParts.join(", ");
                } else if (tags["addr:district"] || tags["addr:city"]) {
                  // If only district/city is available, use that
                  address = [tags["addr:district"], tags["addr:city"]]
                    .filter(Boolean)
                    .join(", ");
                }
              }

              // 提取地區和城市供單獨使用 (例如用於外部連結搜尋)
              const district = tags["addr:district"] || "";
              const city = tags["addr:city"] || "";

              return {
                id: element.id,
                display_name: name, // The processed name
                lat: lat,
                lon: lon,
                address: address, // The formatted address string
                district: district, // Separate district field
                city: city, // Separate city field
                rating: "N/A", // Placeholder, not fetched from OSM
                reviews: [], // Placeholder
                tags: tags, // Keep original tags for potential future use or debugging
              };
            })
            // 過濾掉 null (無座標) 和名稱為預設值的項目
            .filter(
              (shop) => shop !== null && shop.display_name !== fallbackName
            );
          // --- 過濾結束 ---

          console.log(
            `[Background] 過濾掉 null 和 "${fallbackName}" 後，發送的資料數量:`,
            formattedData.length
          );

          if (formattedData.length === 0 && data.elements.length > 0) {
            console.warn(
              "[Background] 所有找到的元素都被過濾掉了 (因無座標或無名稱)。"
            );
          }

          sendResponse({ success: true, data: formattedData });
        }
      })
      .catch((error) => {
        console.error("[Background] Overpass Fetch 失敗:", error);
        sendResponse({
          success: false,
          error:
            error.message ||
            "無法從 Overpass API 獲取資料。請檢查背景腳本日誌。",
        });
      });

    return true; // 標記為異步回應
  }

  // 對於未處理的 action 發出警告
  console.warn("[Background] 未處理的 action:", request.action);
  return false; // 對於未處理的 action 或同步操作返回 false
});

// Service worker 安裝/啟動事件
self.addEventListener("install", (event) => {
  console.log("[Background] Service worker 已安裝");
});
self.addEventListener("activate", (event) => {
  console.log("[Background] Service worker 已啟動");
});
