import React from 'react';
import ReactDOM from 'react-dom';
import './app.css'; // 

const App = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isResultsPage, setIsResultsPage] = React.useState(false);
  const [favorites, setFavorites] = React.useState([]);
  const [coffeeShops, setCoffeeShops] = React.useState([]);
  const [map, setMap] = React.useState(null);

  // 初始化收藏列表
  React.useEffect(() => {
    const savedFavorites = JSON.parse(localStorage.getItem('favorites')) || [];
    setFavorites(savedFavorites);
  }, []);

  // 動態載入 Google Maps
  React.useEffect(() => {
    if (isResultsPage && !window.google) {
      const script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?key=你的API金鑰&libraries=places'; // 請替換為你的實際 API 金鑰
      script.async = true;
      script.onload = () => {
        const mapInstance = new google.maps.Map(document.getElementById('map'), {
          center: { lat: 22.3193, lng: 114.1694 }, // 香港中心
          zoom: 12,
        });
        setMap(mapInstance);
      };
      document.body.appendChild(script);
    }
  }, [isResultsPage]);

  // 更新地圖標記
  const updateMap = (shops, center) => {
    if (map) {
      map.setCenter(center);
      shops.forEach((shop) => {
        new google.maps.Marker({
          position: { lat: shop.lat, lng: shop.lng },
          map: map,
          title: shop.name,
        });
      });
    }
  };

  // 搜尋附近咖啡店
  const handleNearby = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const location = new google.maps.LatLng(latitude, longitude);
          const service = new google.maps.places.PlacesService(map);
          service.nearbySearch(
            {
              location: location,
              radius: 2000, // 2公里範圍
              type: 'cafe',
            },
            (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK) {
                const shops = results.map((place) => ({
                  place_id: place.place_id,
                  name: place.name,
                  rating: place.rating || 'N/A',
                  address: place.vicinity,
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                }));
                setCoffeeShops(shops);
                updateMap(shops, location);
                setIsResultsPage(true);
              }
            }
          );
        },
        (error) => {
          console.error('Geolocation 錯誤:', error);
          alert('無法獲取位置，請允許定位或用關鍵字搜尋');
        }
      );
    } else {
      alert('瀏覽器不支持定位');
    }
  };

  // 關鍵字搜尋
  const handleSearch = () => {
    if (searchQuery.trim() && map) {
      const service = new google.maps.places.PlacesService(map);
      service.textSearch(
        {
          query: `${searchQuery} cafe`,
          type: 'cafe',
          region: 'hk',
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            const shops = results.map((place) => ({
              place_id: place.place_id,
              name: place.name,
              rating: place.rating || 'N/A',
              address: place.formatted_address,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            }));
            setCoffeeShops(shops);
            updateMap(shops, shops[0] ? { lat: shops[0].lat, lng: shops[0].lng } : { lat: 22.3193, lng: 114.1694 });
            setIsResultsPage(true);
          }
        }
      );
    } else {
      alert('請輸入地區或店名！');
    }
  };

  // 導航
  const navigateTo = (shopName) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shopName)}`, '_blank');
  };

  // 收藏
  const toggleFavorite = (shop) => {
    const isFavorited = favorites.some((fav) => fav.place_id === shop.place_id);
    let updatedFavorites = isFavorited
      ? favorites.filter((fav) => fav.place_id !== shop.place_id)
      : [...favorites, shop];
    setFavorites(updatedFavorites);
    localStorage.setItem('favorites', JSON.stringify(updatedFavorites));
  };

  // 返回搜尋頁
  const goBack = () => {
    setIsResultsPage(false);
    setSearchQuery('');
  };

  return (
    <div className="app-container">
      {!isResultsPage ? (
        <div className="search-container">
          <h2 className="title">☕ Hong Kong CAFE Finder</h2>
          <input
            type="text"
            placeholder="輸入地區或店名"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <div className="button-group">
            <button onClick={handleSearch} className="search-btn">🔍 搜尋</button>
            <button onClick={handleNearby} className="nearby-btn">📍 附近</button>
          </div>
        </div>
      ) : (
        <div className="results-container">
          <div id="map" className="map-container">
            <button onClick={goBack} className="back-btn">⬅ 返回</button>
          </div>
          <div className="list-section">
            <h3 className="list-title">咖啡店清單</h3>
            <ul className="coffee-list">
              {coffeeShops.map((shop) => (
                <li key={shop.place_id} className="coffee-item">
                  <div className="shop-info">
                    <strong>☕ {shop.name}</strong> ⭐ {shop.rating}
                  </div>
                  <div className="shop-address">📍 {shop.address}</div>
                  <div className="shop-actions">
                    <button onClick={() => navigateTo(shop.name)} className="navigate-btn">
                      🚗 導航
                    </button>
                    <button
                      onClick={() => toggleFavorite(shop)}
                      className={`favorite-btn ${
                        favorites.some((fav) => fav.place_id === shop.place_id) ? 'favorited' : ''
                      }`}
                    >
                      ❤️ 收藏
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));