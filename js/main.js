// --- 移动端底部弹窗交互逻辑 ---
const controlPanel = document.getElementById('control-panel');
const mobileBackdrop = document.getElementById('mobile-backdrop');
const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
const closePanelBtn = document.getElementById('close-panel-btn');

function openMobilePanel() {
    controlPanel.classList.remove('translate-y-full');
    mobileBackdrop.classList.remove('hidden');
    setTimeout(() => mobileBackdrop.classList.remove('opacity-0'), 10);
}

function closeMobilePanel() {
    controlPanel.classList.add('translate-y-full');
    mobileBackdrop.classList.add('opacity-0');
    setTimeout(() => mobileBackdrop.classList.add('hidden'), 300);
}

mobileToggleBtn.addEventListener('click', openMobilePanel);
closePanelBtn.addEventListener('click', closeMobilePanel);
mobileBackdrop.addEventListener('click', closeMobilePanel);

// --- 坐标系转换 (WGS84 -> GCJ02) 国内地图纠偏 ---
const PI = 3.1415926535897932384626;
const a = 6378245.0;
const ee = 0.00669342162296594323;

function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
}

function transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
}

function wgs84togcj02(lng, lat) {
    if (outOfChina(lng, lat)) return [lng, lat];
    let dlat = transformLat(lng - 105.0, lat - 35.0);
    let dlng = transformLng(lng - 105.0, lat - 35.0);
    let radlat = lat / 180.0 * PI;
    let magic = Math.sin(radlat);
    magic = 1 - ee * magic * magic;
    let sqrtmagic = Math.sqrt(magic);
    dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * PI);
    dlng = (dlng * 180.0) / (a / sqrtmagic * Math.cos(radlat) * PI);
    return [lng + dlng, lat + dlat];
}

function outOfChina(lng, lat) {
    return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271);
}

// --- 地图初始化与主题逻辑 (固定为无文字底图) ---
const mapTiles = {
    light: 'https://s.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    dark: 'https://s.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
};

let currentMapTheme = 'light';
const map = L.map('map', { zoomControl: false }).setView([31.2304, 121.4737], 13);
let currentTileLayer = L.tileLayer(mapTiles.light, { maxZoom: 19, crossOrigin: true }).addTo(map);

function setUserTheme(theme) {
    updateMapTheme(theme);
    document.getElementById('theme-indicator').innerText = theme === 'dark' ? '(手动: 深色)' : '(手动: 浅色)';
}

function updateMapTheme(theme) {
    currentMapTheme = theme;
    map.removeLayer(currentTileLayer);
    currentTileLayer = L.tileLayer(mapTiles[theme], { maxZoom: 19, crossOrigin: true }).addTo(map);
    
    const btnLight = document.getElementById('theme-light-btn');
    const btnDark = document.getElementById('theme-dark-btn');
    const contentArea = document.getElementById('content-area');
    const mapWrapper = document.getElementById('map-wrapper');

    if (theme === 'light') {
        btnLight.className = "px-3 py-1 text-xs font-medium rounded-md bg-white shadow-sm text-gray-800 transition";
        btnDark.className = "px-3 py-1 text-xs font-medium rounded-md text-gray-500 hover:text-gray-800 transition";
        contentArea.style.backgroundColor = '#ffffff';
        mapWrapper.style.backgroundColor = '#f3f4f6';
    } else {
        btnDark.className = "px-3 py-1 text-xs font-medium rounded-md bg-white shadow-sm text-gray-800 transition";
        btnLight.className = "px-3 py-1 text-xs font-medium rounded-md text-gray-500 hover:text-gray-800 transition";
        contentArea.style.backgroundColor = '#000000';
        mapWrapper.style.backgroundColor = '#111827';
    }
    
    if (currentLayout === 'blend') {
        const imgContainer = document.getElementById('image-container');
        imgContainer.style.mixBlendMode = theme === 'dark' ? 'screen' : 'multiply';
    }
}

const colorThief = new ColorThief();

// --- 辅助函数 ---
function convertDMSToDD(degrees, minutes, seconds, direction) {
    let dd = degrees + minutes / 60 + seconds / (60 * 60);
    if (direction === "S" || direction === "W") dd = dd * -1;
    return dd;
}

function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s, l];
}

function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function getContrastColor(r, g, b) {
    let [h, s, l] = rgbToHsl(r, g, b);
    let contrastH = (h + 180) % 360;
    let contrastS = Math.max(s * 100, 50); 
    let contrastL = 40; 
    return hslToHex(contrastH, contrastS, contrastL);
}

function isDarkPalette(palette) {
    let totalLuminance = 0;
    palette.forEach(rgb => {
        totalLuminance += (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
    });
    return (totalLuminance / palette.length) < 120;
}

// --- 逆向地理编码 ---
async function fetchPlaceName(lat, lng) {
    try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh-cn`);
        const data = await res.json();
        if (data) {
            return data.city || data.locality || data.principalSubdivision || "Unknown Area";
        }
        return "Unknown Area";
    } catch (e) {
        return "Photo Location";
    }
}

// --- 动态文字自适应缩放 ---
function getTextWidth(text, font) {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    context.font = font;
    return context.measureText(text).width;
}

function fitText() {
    const poster = document.getElementById('poster');
    const maxW = poster.clientWidth * 0.8; 
    
    const nameEl = document.getElementById('location-name');
    const coordsEl = document.getElementById('location-coords');
    const nameStyle = window.getComputedStyle(nameEl);
    const coordsStyle = window.getComputedStyle(coordsEl);

    const nameFont = `${nameStyle.fontWeight} 24px ${nameStyle.fontFamily}`;
    const nameNaturalWidth = getTextWidth(nameEl.innerText, nameFont);
    if (nameNaturalWidth > maxW) {
        const scale = maxW / nameNaturalWidth;
        nameEl.style.fontSize = Math.floor(24 * scale) + 'px';
    } else {
        nameEl.style.fontSize = '24px';
    }

    const coordsFont = `${coordsStyle.fontWeight} 14px ${coordsStyle.fontFamily}`;
    const coordsNaturalWidth = getTextWidth(coordsEl.innerText, coordsFont);
    if (coordsNaturalWidth > maxW) {
        const scale = maxW / coordsNaturalWidth;
        coordsEl.style.fontSize = Math.floor(14 * scale) + 'px';
    } else {
        coordsEl.style.fontSize = '14px';
    }

    const bNameEl = document.getElementById('bottom-location-name');
    const bCoordsEl = document.getElementById('bottom-location-coords');
    const bContainer = document.getElementById('bottom-text-content');
    const bMaxW = bContainer.clientWidth;
    
    if (bMaxW > 0) {
        const bNameStyle = window.getComputedStyle(bNameEl);
        const bCoordsStyle = window.getComputedStyle(bCoordsEl);
        
        const bNameFont = `${bNameStyle.fontWeight} 14px ${bNameStyle.fontFamily}`;
        const bNameNatW = getTextWidth(bNameEl.innerText, bNameFont);
        if (bNameNatW > bMaxW) {
            bNameEl.style.fontSize = Math.floor(14 * (bMaxW / bNameNatW)) + 'px';
        } else {
            bNameEl.style.fontSize = '14px';
        }

        const bCoordsFont = `${bCoordsStyle.fontWeight} 10px ${bCoordsStyle.fontFamily}`;
        const bCoordsNatW = getTextWidth(bCoordsEl.innerText, bCoordsFont);
        if (bCoordsNatW > bMaxW) {
            bCoordsEl.style.fontSize = Math.floor(10 * (bMaxW / bCoordsNatW)) + 'px';
        } else {
            bCoordsEl.style.fontSize = '10px';
        }
    }
}

window.addEventListener('resize', fitText);

// --- UI 同步 ---
const titleInput = document.getElementById('title-input');
const subtitleInput = document.getElementById('subtitle-input');
const locName = document.getElementById('location-name');
const locCoords = document.getElementById('location-coords');
const mapTint = document.getElementById('map-tint');

titleInput.addEventListener('input', (e) => {
    locName.innerText = e.target.value;
    document.getElementById('bottom-location-name').innerText = e.target.value;
    fitText();
});
subtitleInput.addEventListener('input', (e) => {
    locCoords.innerText = e.target.value;
    document.getElementById('bottom-location-coords').innerText = e.target.value;
    fitText();
});

document.getElementById('map-color-input').addEventListener('input', (e) => {
    mapTint.style.backgroundColor = e.target.value;
});

document.getElementById('text-color-input').addEventListener('input', (e) => {
    const color = e.target.value;
    locName.style.color = color;
    locCoords.style.color = color;
    document.getElementById('bottom-location-name').style.color = color;
    document.getElementById('bottom-location-coords').style.color = color;
    document.getElementById('logo-2ur').style.color = color;
});

function updateLocationUI(lat, lng, name, isFictional = false) {
    map.setView([lat, lng], 13);
    titleInput.value = name;
    subtitleInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    locName.innerText = titleInput.value;
    locCoords.innerText = subtitleInput.value;
    document.getElementById('bottom-location-name').innerText = titleInput.value;
    document.getElementById('bottom-location-coords').innerText = subtitleInput.value;
    
    fitText();

    const statusBar = document.getElementById('status-bar');
    const manualArea = document.getElementById('manual-input-area');
    
    if (isFictional) {
        statusBar.innerHTML = `<span class="text-red-500">⚠️ 未找到 GPS。已降落至虚拟世界。</span>`;
        manualArea.classList.remove('hidden');
    } else {
        statusBar.innerHTML = `<span class="text-green-500">✅ 成功提取位置信息！</span>`;
        manualArea.classList.remove('hidden');
    }
}

function setRatio(ratio) {
    document.getElementById('poster').style.aspectRatio = ratio;
    setTimeout(() => { map.invalidateSize(); clampImageTransform(); updateImgTransform(); fitText(); }, 350);
}

// --- 布局模式与图层控制逻辑 ---
let currentLayout = 'split';
let activeLayer = 'image';
let currentTextLayout = 'center';
let textOpacity = 1;
let mapOpacity = 1;

function updateControlVisibility() {
    const textOpacityControl = document.getElementById('text-opacity-control');
    const mapOpacityControl = document.getElementById('map-opacity-control');

    if (currentLayout === 'blend' && currentTextLayout === 'center') {
        textOpacityControl.classList.remove('hidden');
    } else {
        textOpacityControl.classList.add('hidden');
        document.getElementById('poster-text-overlay').style.opacity = 1;
    }

    if (currentLayout === 'blend') {
        mapOpacityControl.classList.remove('hidden');
    } else {
        mapOpacityControl.classList.add('hidden');
        document.getElementById('map-wrapper').style.opacity = 1;
    }
}

function setLayoutMode(mode) {
    currentLayout = mode;
    const mapWrapper = document.getElementById('map-wrapper');
    const imgContainer = document.getElementById('image-container');
    const layerControl = document.getElementById('layer-control');
    const overlay = document.getElementById('poster-text-overlay');
    
    const btnSplit = document.getElementById('btn-mode-split');
    const btnBlend = document.getElementById('btn-mode-blend');

    if (mode === 'blend') {
        btnBlend.className = "flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium transition focus:outline-none";
        btnSplit.className = "flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition focus:outline-none";
        layerControl.classList.remove('hidden');
        
        mapWrapper.classList.remove('relative', 'flex-1');
        mapWrapper.classList.add('absolute', 'inset-0', 'h-full');
        mapWrapper.style.opacity = mapOpacity; 
        
        imgContainer.classList.remove('relative', 'flex-1');
        imgContainer.classList.add('absolute', 'inset-0', 'h-full');
        imgContainer.style.mixBlendMode = currentMapTheme === 'dark' ? 'screen' : 'multiply';
        imgContainer.style.opacity = '0.85';
        
        overlay.classList.remove('h-1/2');
        overlay.classList.add('h-full');
        
        setActiveLayer('image');
    } else {
        btnSplit.className = "flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium transition focus:outline-none";
        btnBlend.className = "flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition focus:outline-none";
        layerControl.classList.add('hidden');
        
        mapWrapper.classList.remove('absolute', 'inset-0', 'h-full');
        mapWrapper.classList.add('relative', 'flex-1');
        mapWrapper.style.opacity = 1; 
        
        imgContainer.classList.remove('absolute', 'inset-0', 'h-full');
        imgContainer.classList.add('relative', 'flex-1');
        imgContainer.style.mixBlendMode = 'normal';
        imgContainer.style.opacity = '1';
        
        overlay.classList.remove('h-full');
        overlay.classList.add('h-1/2');
        
        setActiveLayer('image');
    }
    
    updateControlVisibility();
    setTimeout(() => { map.invalidateSize(); clampImageTransform(); updateImgTransform(); fitText(); }, 350);
}

function setActiveLayer(layer) {
    activeLayer = layer;
    const imgContainer = document.getElementById('image-container');
    const btnImg = document.getElementById('btn-layer-image');
    const btnMap = document.getElementById('btn-layer-map');

    if (layer === 'image') {
        imgContainer.style.pointerEvents = 'auto';
        btnImg.className = "flex-1 py-1.5 bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-medium transition focus:outline-none";
        btnMap.className = "flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 rounded-lg text-xs font-medium transition focus:outline-none";
    } else {
        imgContainer.style.pointerEvents = 'none';
        btnMap.className = "flex-1 py-1.5 bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-medium transition focus:outline-none";
        btnImg.className = "flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 rounded-lg text-xs font-medium transition focus:outline-none";
    }
}

function setTextLayout(layout) {
    currentTextLayout = layout;
    const btnCenter = document.getElementById('btn-text-center');
    const btnBottom = document.getElementById('btn-text-bottom');
    const overlay = document.getElementById('poster-text-overlay');
    const bottomBar = document.getElementById('bottom-text-bar');

    if (layout === 'center') {
        btnCenter.className = "flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium transition focus:outline-none";
        btnBottom.className = "flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition focus:outline-none";
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        bottomBar.classList.add('hidden');
        bottomBar.classList.remove('flex');
        if (currentLayout === 'blend') overlay.style.opacity = textOpacity;
    } else {
        btnBottom.className = "flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium transition focus:outline-none";
        btnCenter.className = "flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition focus:outline-none";
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
        bottomBar.classList.remove('hidden');
        bottomBar.classList.add('flex');
    }
    updateControlVisibility();
    setTimeout(() => { map.invalidateSize(); clampImageTransform(); updateImgTransform(); fitText(); }, 350);
}

document.getElementById('text-opacity-input').addEventListener('input', (e) => {
    textOpacity = e.target.value;
    document.getElementById('text-opacity-val').innerText = parseFloat(textOpacity).toFixed(2);
    if (currentLayout === 'blend' && currentTextLayout === 'center') {
        document.getElementById('poster-text-overlay').style.opacity = textOpacity;
    }
});

document.getElementById('map-opacity-input').addEventListener('input', (e) => {
    mapOpacity = e.target.value;
    document.getElementById('map-opacity-val').innerText = parseFloat(mapOpacity).toFixed(2);
    if (currentLayout === 'blend') {
        document.getElementById('map-wrapper').style.opacity = mapOpacity;
    }
});

// --- 图片拖拽与缩放 (含移动端触摸支持) ---
const imgContainer = document.getElementById('image-container');
const posterImg = document.getElementById('poster-img');

let userScale = 1, baseScale = 1, imgTranslateX = 0, imgTranslateY = 0;
let isDraggingImg = false, startX, startY;

// 移动端双指缩放变量
let initialPinchDistance = null;
let lastScale = 1;

function clampImageTransform() {
    if (posterImg.classList.contains('hidden')) return;
    const contRect = imgContainer.getBoundingClientRect();
    const natW = posterImg.naturalWidth, natH = posterImg.naturalHeight;
    if (!natW || !natH) return;
    
    baseScale = Math.max(contRect.width / natW, contRect.height / natH);
    if (userScale < 1) userScale = 1;
    
    const currentW = natW * baseScale * userScale;
    const currentH = natH * baseScale * userScale;
    const maxX = Math.max(0, (currentW - contRect.width) / 2);
    const maxY = Math.max(0, (currentH - contRect.height) / 2);
    
    imgTranslateX = Math.max(-maxX, Math.min(maxX, imgTranslateX));
    imgTranslateY = Math.max(-maxY, Math.min(maxY, imgTranslateY));
}

function updateImgTransform() {
    if (posterImg.classList.contains('hidden')) return;
    posterImg.style.width = `${posterImg.naturalWidth}px`;
    posterImg.style.height = `${posterImg.naturalHeight}px`;
    const totalScale = baseScale * userScale;
    posterImg.style.transform = `translate(calc(-50% + ${imgTranslateX}px), calc(-50% + ${imgTranslateY}px)) scale(${totalScale})`;
}

// 桌面端鼠标事件
imgContainer.addEventListener('wheel', (e) => {
    if (posterImg.classList.contains('hidden')) return;
    e.preventDefault(); 
    userScale = e.deltaY < 0 ? userScale + 0.05 : Math.max(1, userScale - 0.05);
    clampImageTransform(); updateImgTransform();
});

imgContainer.addEventListener('mousedown', (e) => {
    if (posterImg.classList.contains('hidden')) return;
    isDraggingImg = true;
    startX = e.clientX - imgTranslateX;
    startY = e.clientY - imgTranslateY;
    imgContainer.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDraggingImg) return;
    imgTranslateX = e.clientX - startX;
    imgTranslateY = e.clientY - startY;
    clampImageTransform(); updateImgTransform();
});

window.addEventListener('mouseup', () => { isDraggingImg = false; imgContainer.style.cursor = 'move'; });

// 移动端触摸事件 (拖拽 + 双指缩放)
function getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

imgContainer.addEventListener('touchstart', (e) => {
    if (posterImg.classList.contains('hidden')) return;
    if (e.touches.length === 1) {
        isDraggingImg = true;
        startX = e.touches[0].clientX - imgTranslateX;
        startY = e.touches[0].clientY - imgTranslateY;
    } else if (e.touches.length === 2) {
        isDraggingImg = false; // 捏合时停止拖拽
        initialPinchDistance = getDistance(e.touches);
        lastScale = userScale;
    }
}, { passive: false });

imgContainer.addEventListener('touchmove', (e) => {
    if (posterImg.classList.contains('hidden')) return;
    e.preventDefault(); // 阻止页面滚动
    if (e.touches.length === 1 && isDraggingImg) {
        imgTranslateX = e.touches[0].clientX - startX;
        imgTranslateY = e.touches[0].clientY - startY;
        clampImageTransform(); updateImgTransform();
    } else if (e.touches.length === 2 && initialPinchDistance) {
        const currentDistance = getDistance(e.touches);
        const scaleFactor = currentDistance / initialPinchDistance;
        userScale = lastScale * scaleFactor;
        if (userScale < 1) userScale = 1;
        clampImageTransform(); updateImgTransform();
    }
}, { passive: false });

window.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
        initialPinchDistance = null;
    }
    if (e.touches.length === 0) {
        isDraggingImg = false;
    }
});

// --- 处理图片上传 ---
document.getElementById('upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    userScale = 1; imgTranslateX = 0; imgTranslateY = 0; lastScale = 1;
    posterImg.src = URL.createObjectURL(file);
    posterImg.classList.remove('hidden');
    document.getElementById('placeholder-text').classList.add('hidden');
    document.getElementById('status-bar').innerText = "正在分析照片数据...";

    // 移动端上传后自动收起面板，方便预览
    if (window.innerWidth < 768) {
        closeMobilePanel();
    }

    posterImg.onload = function() {
        clampImageTransform(); updateImgTransform();
        
        const palette = colorThief.getPalette(posterImg, 5);
        const paletteContainer = document.getElementById('palette-container');
        paletteContainer.innerHTML = '';
        
        if(palette && palette.length > 0) {
            const isDark = isDarkPalette(palette);
            updateMapTheme(isDark ? 'dark' : 'light');
            document.getElementById('theme-indicator').innerText = isDark ? '(自动: 深色)' : '(自动: 浅色)';

            palette.forEach((rgb) => {
                const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
                const swatch = document.createElement('div');
                swatch.className = 'w-6 h-6 rounded cursor-pointer shadow-sm border border-gray-200 hover:scale-110 transition-transform';
                swatch.style.backgroundColor = hex;
                swatch.title = hex;
                
                swatch.onclick = () => {
                    document.getElementById('map-color-input').value = hex;
                    mapTint.style.backgroundColor = hex;
                    
                    const contrastHex = getContrastColor(rgb[0], rgb[1], rgb[2]);
                    document.getElementById('text-color-input').value = contrastHex;
                    
                    locName.style.color = contrastHex;
                    locCoords.style.color = contrastHex;
                    document.getElementById('bottom-location-name').style.color = contrastHex;
                    document.getElementById('bottom-location-coords').style.color = contrastHex;
                    document.getElementById('logo-2ur').style.color = contrastHex;
                };
                paletteContainer.appendChild(swatch);
            });
            paletteContainer.firstChild.click();
        }

        EXIF.getData(file, async function() {
            const latDMS = EXIF.getTag(this, "GPSLatitude");
            const lngDMS = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef");
            const lngRef = EXIF.getTag(this, "GPSLongitudeRef");

            if (latDMS && lngDMS) {
                const wgsLat = convertDMSToDD(latDMS[0], latDMS[1], latDMS[2], latRef);
                const wgsLng = convertDMSToDD(lngDMS[0], lngDMS[1], lngDMS[2], lngRef);
                
                // WGS84 转换为国内 GCJ02 火星坐标系，修正地图偏移
                const [gcjLng, gcjLat] = wgs84togcj02(wgsLng, wgsLat);

                document.getElementById('status-bar').innerText = "正在逆向解析地理位置...";
                const placeName = await fetchPlaceName(gcjLat, gcjLng);
                updateLocationUI(gcjLat, gcjLng, placeName);
            } else {
                const fictionalLocations = [
                    { name: "King's Landing", lat: 42.6403, lng: 18.1083 }, 
                    { name: "The Shire", lat: -37.8575, lng: 175.6800 }, 
                    { name: "Winterfell", lat: 54.3683, lng: -5.5813 }
                ];
                const randomLoc = fictionalLocations[Math.floor(Math.random() * fictionalLocations.length)];
                updateLocationUI(randomLoc.lat, randomLoc.lng, randomLoc.name, true);
            }
        });
    }
});

// --- 下拉搜索 ---
const searchInput = document.getElementById('manual-location');
const searchResults = document.getElementById('search-results');
const searchBtn = document.getElementById('search-btn');

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target) && !searchBtn.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

searchBtn.addEventListener('click', async function() {
    const query = searchInput.value.trim();
    if(!query) return;
    
    document.getElementById('status-bar').innerText = "正在搜索...";
    searchResults.innerHTML = '<li class="px-4 py-3 text-sm text-gray-500 text-center">加载中...</li>';
    searchResults.classList.remove('hidden');

    try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        
        searchResults.innerHTML = '';
        if(data && data.features && data.features.length > 0) {
            document.getElementById('status-bar').innerHTML = `<span class="text-green-500">✅ 找到 ${data.features.length} 个结果</span>`;
            
            data.features.forEach(item => {
                const li = document.createElement('li');
                li.className = "px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 transition";
                
                const shortName = item.properties.name || item.properties.city || "未知地点";
                const displayName = [item.properties.name, item.properties.city, item.properties.state].filter(Boolean).join(', ');
                
                li.innerHTML = `
                    <div class="font-medium text-sm text-gray-800">${shortName}</div>
                    <div class="text-xs text-gray-500 truncate mt-0.5">${displayName}</div>
                `;
                
                li.addEventListener('click', () => {
                    const lng = parseFloat(item.geometry.coordinates[0]);
                    const lat = parseFloat(item.geometry.coordinates[1]);
                    // 搜索结果通常也是 WGS84，转换为 GCJ02
                    const [gcjLng, gcjLat] = wgs84togcj02(lng, lat);
                    updateLocationUI(gcjLat, gcjLng, shortName, false);
                    searchResults.classList.add('hidden');
                    
                    // 移动端搜索完成后自动收起面板
                    if (window.innerWidth < 768) {
                        closeMobilePanel();
                    }
                });
                
                searchResults.appendChild(li);
            });
        } else {
            document.getElementById('status-bar').innerHTML = `<span class="text-red-500">❌ 未找到该地点。</span>`;
            searchResults.innerHTML = '<li class="px-4 py-3 text-sm text-gray-500 text-center">无匹配结果</li>';
        }
    } catch (error) {
        document.getElementById('status-bar').innerHTML = `<span class="text-red-500">❌ 网络请求失败。</span>`;
        searchResults.innerHTML = '<li class="px-4 py-3 text-sm text-red-500 text-center">请求失败，请重试</li>';
    }
});

searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// --- 高清无损导出逻辑 ---
document.getElementById('export-btn').addEventListener('click', async function() {
    const originalText = this.innerHTML;
    this.innerHTML = "正在生成海报...";
    
    try {
        const posterElement = document.getElementById('poster');
        const rect = posterElement.getBoundingClientRect();
        const targetWidth = 1440;
        const exportScale = targetWidth / rect.width;
        
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = rect.width * exportScale;
        finalCanvas.height = rect.height * exportScale;
        const ctx = finalCanvas.getContext('2d');
        
        ctx.scale(exportScale, exportScale);
        
        ctx.fillStyle = currentMapTheme === 'dark' ? '#000000' : '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        
        // 1. 渲染地图
        const mapContainer = document.getElementById('map').parentElement;
        const mapRect = mapContainer.getBoundingClientRect();
        const mapOffsetY = mapRect.top - rect.top;
        
        const mapTintEl = document.getElementById('map-tint');
        const originalTintDisplay = mapTintEl.style.display;
        mapTintEl.style.display = 'none';
        
        const mapCanvas = await html2canvas(mapContainer, {
            useCORS: true,
            scale: exportScale,
            backgroundColor: currentMapTheme === 'dark' ? '#111827' : '#f3f4f6'
        });
        
        mapTintEl.style.display = originalTintDisplay;
        
        ctx.save();
        if (currentLayout === 'blend') ctx.globalAlpha = parseFloat(mapOpacity);
        ctx.drawImage(mapCanvas, 0, mapOffsetY, mapRect.width, mapRect.height);
        
        // 2. 渲染地图遮罩
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = mapTintEl.style.backgroundColor;
        ctx.globalAlpha = currentLayout === 'blend' ? 0.75 * parseFloat(mapOpacity) : 0.75;
        ctx.fillRect(0, mapOffsetY, mapRect.width, mapRect.height);
        ctx.restore();
        
        // 3. 渲染原图
        const imgContainer = document.getElementById('image-container');
        const imgRect = imgContainer.getBoundingClientRect();
        const imgOffsetY = imgRect.top - rect.top; 
        
        if (!posterImg.classList.contains('hidden')) {
            const natW = posterImg.naturalWidth, natH = posterImg.naturalHeight;
            const contW = imgRect.width, contH = imgRect.height;
            
            ctx.save();
            ctx.translate(0, imgOffsetY);
            ctx.beginPath();
            ctx.rect(0, 0, contW, contH);
            ctx.clip();
            
            ctx.translate(contW / 2, contH / 2);
            ctx.translate(imgTranslateX, imgTranslateY);
            const totalScale = baseScale * userScale;
            ctx.scale(totalScale, totalScale);
            
            if (currentLayout === 'blend') {
                ctx.globalCompositeOperation = currentMapTheme === 'dark' ? 'screen' : 'multiply';
                ctx.globalAlpha = 0.85;
            }

            ctx.drawImage(posterImg, -natW / 2, -natH / 2, natW, natH);
            ctx.restore();
        }

        // 4. 渲染文字
        if (currentTextLayout === 'center') {
            const nameStyle = window.getComputedStyle(locName);
            const coordsStyle = window.getComputedStyle(locCoords);
            
            ctx.save();
            ctx.globalAlpha = currentLayout === 'blend' ? parseFloat(textOpacity) : 1.0;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const nameH = parseFloat(nameStyle.fontSize), coordsH = parseFloat(coordsStyle.fontSize);
            const gap = 4, totalH = nameH + gap + coordsH;
            
            const overlayEl = document.getElementById('poster-text-overlay');
            const overlayRect = overlayEl.getBoundingClientRect();
            const overlayOffsetY = overlayRect.top - rect.top;
            const startY = overlayOffsetY + (overlayRect.height - totalH) / 2;
            
            ctx.font = `${nameStyle.fontWeight} ${nameStyle.fontSize} ${nameStyle.fontFamily}`;
            ctx.fillStyle = nameStyle.color;
            ctx.fillText(locName.innerText, rect.width / 2, startY + nameH / 2);
            
            ctx.font = `${coordsStyle.fontWeight} ${coordsStyle.fontSize} ${coordsStyle.fontFamily}`;
            ctx.fillStyle = coordsStyle.color;
            ctx.fillText(locCoords.innerText, rect.width / 2, startY + nameH + gap + coordsH / 2);
            ctx.restore();
        } else {
            const bottomBar = document.getElementById('bottom-text-bar');
            const barRect = bottomBar.getBoundingClientRect();
            const barOffsetY = barRect.top - rect.top;

            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, barOffsetY, rect.width, barRect.height);
            
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            const logoY = barOffsetY + barRect.height / 2;
            
            // 绘制二维码
            const qrImg = document.getElementById('watermark-qr');
            const qrSize = 32; // 二维码尺寸
            let textStartX = 16; // 默认文字起始X坐标
            
            // 确保图片已加载且有效，才绘制到 Canvas 上
            if (qrImg && qrImg.complete && qrImg.naturalWidth > 0) {
                const qrY = barOffsetY + (barRect.height - qrSize) / 2;
                ctx.drawImage(qrImg, 16, qrY, qrSize, qrSize);
                textStartX = 16 + qrSize + 8; // 16(左边距) + 32(二维码宽) + 8(间距)
            }
            
            // 绘制 Pho2ur 文字 (坐标动态后移)
            ctx.font = `bold 16px sans-serif`;
            ctx.fillStyle = '#1f2937';
            ctx.fillText('Pho', textStartX, logoY);
            const customColor = window.getComputedStyle(document.getElementById('logo-2ur')).color;
            ctx.fillStyle = customColor;
            ctx.fillText('2ur', textStartX + ctx.measureText('Pho').width, logoY);

            ctx.textAlign = 'right';
            const bName = document.getElementById('bottom-location-name');
            const bCoords = document.getElementById('bottom-location-coords');
            const bNameStyle = window.getComputedStyle(bName);
            const bCoordsStyle = window.getComputedStyle(bCoords);
            
            const bNameH = parseFloat(bNameStyle.fontSize), bCoordsH = parseFloat(bCoordsStyle.fontSize), bGap = 2;
            const bTotalH = bNameH + bGap + bCoordsH;
            const bStartY = barOffsetY + (barRect.height - bTotalH) / 2;

            ctx.font = `${bNameStyle.fontWeight} ${bNameStyle.fontSize} ${bNameStyle.fontFamily}`;
            ctx.fillStyle = bNameStyle.color;
            ctx.fillText(bName.innerText, rect.width - 16, bStartY + bNameH / 2);

            ctx.font = `${bCoordsStyle.fontWeight} ${bCoordsStyle.fontSize} ${bCoordsStyle.fontFamily}`;
            ctx.fillStyle = bCoordsStyle.color;
            ctx.fillText(bCoords.innerText, rect.width - 16, bStartY + bNameH + bGap + bCoordsH / 2);
            ctx.restore();
        }
        
        
        // 【修改部分】将 canvas 转为 Blob，并调用原生分享或下载
        finalCanvas.toBlob(async (blob) => {
            const fileName = `Pho2ur_HQ_${new Date().getTime()}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });
            let useFallback = true;

            // 尝试调用系统原生分享菜单 (iOS/Android 支持)，用户可直接选择"存储图像"到相册
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Pho2ur Poster'
                    });
                    useFallback = false; // 分享成功，不需要回退下载
                } catch (error) {
                    // 用户取消分享或发生错误，继续走回退下载逻辑
                    console.log('原生分享取消或失败:', error);
                }
            }

            // 如果不支持原生分享，或用户取消了分享，则使用传统下载方式
            if (useFallback) {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = URL.createObjectURL(blob);
                link.click();
                URL.revokeObjectURL(link.href);
            }
            
            this.innerHTML = originalText;

            // 【新增逻辑】控制弹窗每次进入网站只显示一次
            if (!window.hasShownAboutModal) {
                setTimeout(openAboutModal, 800);
                window.hasShownAboutModal = true;
            }
            
        }, 'image/png', 1.0);
        
    } catch (err) {
        console.error("导出失败:", err);
        alert("导出失败，请重试。");
        this.innerHTML = originalText;
    }
});

// 确保页面加载时初始化文字排版
window.onload = () => setTimeout(fitText, 100);

// --- 取色滴管功能 ---
function setupEyeDropper(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    
    // 检查浏览器是否支持原生的 EyeDropper API
    if (window.EyeDropper) {
        btn.classList.remove('hidden'); // 支持则显示滴管按钮
        btn.addEventListener('click', async () => {
            try {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                input.value = result.sRGBHex;
                // 手动触发 input 事件，让你的 UI 实时更新颜色
                input.dispatchEvent(new Event('input'));
            } catch (e) {
                // 用户按 Esc 取消取色时会进入这里，静默处理即可
            }
        });
    }
}
setupEyeDropper('map-eyedropper-btn', 'map-color-input');
setupEyeDropper('text-eyedropper-btn', 'text-color-input');

// --- About Us 弹窗逻辑 ---
const aboutBackdrop = document.getElementById('about-modal-backdrop');
const aboutModal = document.getElementById('about-modal');
const closeAboutBtn = document.getElementById('close-about-btn');

function openAboutModal() {
    aboutBackdrop.classList.remove('hidden');
    setTimeout(() => {
        aboutBackdrop.classList.remove('opacity-0');
        aboutModal.classList.remove('scale-95');
        aboutModal.classList.add('scale-100');
    }, 10);
}

function closeAboutModal() {
    aboutBackdrop.classList.add('opacity-0');
    aboutModal.classList.remove('scale-100');
    aboutModal.classList.add('scale-95');
    setTimeout(() => {
        aboutBackdrop.classList.add('hidden');
    }, 300);
}

closeAboutBtn.addEventListener('click', closeAboutModal);
aboutBackdrop.addEventListener('click', (e) => {
    if (e.target === aboutBackdrop) closeAboutModal(); // 点击背景关闭
});