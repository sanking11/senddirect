// Dashboard Widgets - Futuristic System Monitors
class DashboardWidgets {
    constructor() {
        this.networkData = [];
        this.maxDataPoints = 30;
        this.sessionStartTime = Date.now();
        this.init();
    }

    init() {
        this.initClock();
        this.initSystemStatus();
        this.initWeather();
        this.initNetworkMonitor();
        this.initUptime();
    }

    // Cosmic Clock Widget
    initClock() {
        // Get user's longitude for solar time calculation
        this.userLongitude = 0; // Default to 0 (Greenwich)
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => { this.userLongitude = pos.coords.longitude; },
                () => { this.userLongitude = 0; }
            );
        }

        this.updateCosmicClock();
        setInterval(() => this.updateCosmicClock(), 1000);
    }

    updateCosmicClock() {
        const now = new Date();

        // True Solar Time (based on actual sun position)
        const solarTime = document.getElementById('solarTime');
        if (solarTime) {
            const solarTimeValue = this.calculateSolarTime(now, this.userLongitude);
            solarTime.textContent = solarTimeValue;
        }

        // Mars Time (MTC - Mars Coordinated Time)
        const marsTime = document.getElementById('marsTime');
        if (marsTime) {
            const marsTimeValue = this.calculateMarsTime(now);
            marsTime.textContent = marsTimeValue;
        }

        // Jupiter Time (based on Jupiter's rotation period ~9.93 hours)
        const jupiterTime = document.getElementById('jupiterTime');
        if (jupiterTime) {
            const jupiterTimeValue = this.calculateJupiterTime(now);
            jupiterTime.textContent = jupiterTimeValue;
        }

        // Saturn Time (based on Saturn's rotation period ~10.7 hours)
        const saturnTime = document.getElementById('saturnTime');
        if (saturnTime) {
            const saturnTimeValue = this.calculateSaturnTime(now);
            saturnTime.textContent = saturnTimeValue;
        }

        // Black Hole Time (Sagittarius A* - time dilation effect)
        const blackholeTime = document.getElementById('blackholeTime');
        if (blackholeTime) {
            const bhTimeValue = this.calculateBlackholeTime(now);
            blackholeTime.textContent = bhTimeValue;
        }
    }

    // Calculate True Solar Time based on longitude
    calculateSolarTime(date, longitude) {
        // Solar time differs from clock time based on:
        // 1. Longitude (4 minutes per degree from timezone meridian)
        // 2. Equation of Time (variation due to Earth's elliptical orbit)

        const dayOfYear = this.getDayOfYear(date);

        // Equation of Time (in minutes) - approximation
        const B = (360 / 365) * (dayOfYear - 81) * (Math.PI / 180);
        const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

        // Longitude correction (4 minutes per degree)
        // Standard timezone meridian is timezone offset * 15 degrees
        const timezoneOffset = -date.getTimezoneOffset() / 60;
        const standardMeridian = timezoneOffset * 15;
        const longitudeCorrection = (longitude - standardMeridian) * 4; // minutes

        // Total correction in minutes
        const totalCorrection = EoT + longitudeCorrection;

        // Apply correction to current time
        const solarDate = new Date(date.getTime() + totalCorrection * 60 * 1000);

        const hours = String(solarDate.getHours()).padStart(2, '0');
        const minutes = String(solarDate.getMinutes()).padStart(2, '0');
        const seconds = String(solarDate.getSeconds()).padStart(2, '0');

        return `${hours}:${minutes}:${seconds}`;
    }

    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }

    // Calculate Mars Time (MTC - Martian Coordinated Time)
    calculateMarsTime(earthDate) {
        // Mars sol (day) is 24 hours, 39 minutes, 35.244 seconds
        // Reference: Mars Sol Date (MSD) epoch is December 29, 1873 at midnight

        const MARS_SOL_IN_MS = 88775244; // milliseconds in a Mars sol
        const EARTH_DAY_IN_MS = 86400000;

        // Julian Date calculation
        const JD = (earthDate.getTime() / EARTH_DAY_IN_MS) + 2440587.5;

        // Mars Sol Date (MSD) - days since Mars epoch
        // MSD = (JD - 2405522) / 1.0274912517
        const MSD = (JD - 2405522) / 1.0274912517;

        // Coordinated Mars Time (MTC) - time of day on Mars
        const MTC = (MSD % 1) * 24; // hours into the current sol

        const marsHours = Math.floor(MTC);
        const marsMinutes = Math.floor((MTC - marsHours) * 60);
        const marsSeconds = Math.floor(((MTC - marsHours) * 60 - marsMinutes) * 60);

        return `${String(marsHours).padStart(2, '0')}:${String(marsMinutes).padStart(2, '0')}:${String(marsSeconds).padStart(2, '0')}`;
    }

    // Calculate Jupiter Time (based on ~9.93 hour rotation)
    calculateJupiterTime(earthDate) {
        // Jupiter's rotation period: 9 hours 55 minutes 30 seconds
        const JUPITER_DAY_IN_MS = (9 * 3600 + 55 * 60 + 30) * 1000; // ~35730000 ms

        // Use arbitrary epoch (J2000.0 - January 1, 2000, 12:00 TT)
        const J2000 = new Date('2000-01-01T12:00:00Z').getTime();

        const timeSinceEpoch = earthDate.getTime() - J2000;
        const jupiterDayFraction = (timeSinceEpoch % JUPITER_DAY_IN_MS) / JUPITER_DAY_IN_MS;

        // Convert to hours (Jupiter day is ~9.93 hours, but we display as 24-hour format scaled)
        const jupiterHours24 = jupiterDayFraction * 24;

        const hours = Math.floor(jupiterHours24);
        const minutes = Math.floor((jupiterHours24 - hours) * 60);
        const seconds = Math.floor(((jupiterHours24 - hours) * 60 - minutes) * 60);

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // Calculate Saturn Time (based on ~10.7 hour rotation)
    calculateSaturnTime(earthDate) {
        // Saturn's rotation period: 10 hours 33 minutes 38 seconds
        const SATURN_DAY_IN_MS = (10 * 3600 + 33 * 60 + 38) * 1000; // ~38018000 ms

        // Use arbitrary epoch (J2000.0 - January 1, 2000, 12:00 TT)
        const J2000 = new Date('2000-01-01T12:00:00Z').getTime();

        const timeSinceEpoch = earthDate.getTime() - J2000;
        const saturnDayFraction = (timeSinceEpoch % SATURN_DAY_IN_MS) / SATURN_DAY_IN_MS;

        // Convert to 24-hour format scaled
        const saturnHours24 = saturnDayFraction * 24;

        const hours = Math.floor(saturnHours24);
        const minutes = Math.floor((saturnHours24 - hours) * 60);
        const seconds = Math.floor(((saturnHours24 - hours) * 60 - minutes) * 60);

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // Calculate time dilation near Sagittarius A* (nearest supermassive black hole)
    calculateBlackholeTime(earthDate) {
        // Sagittarius A* is ~26,000 light years away
        // At the event horizon, time effectively stops (infinite dilation)
        // Time runs much slower near the black hole - visible but sluggish

        // Time dilation factor - runs at 1/5 speed (visibly slower but still updates)
        const dilationFactor = 0.2;

        // Calculate dilated time since page load for visible effect
        const epoch = new Date('2000-01-01T00:00:00Z').getTime();
        const earthElapsed = earthDate.getTime() - epoch;
        const bhElapsed = earthElapsed * dilationFactor;

        // Convert to time format
        const totalSeconds = Math.floor(bhElapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    // System Status Widget
    initSystemStatus() {
        this.updateSystemStatus();
        setInterval(() => this.updateSystemStatus(), 5000);
    }

    updateSystemStatus() {
        // Simulate system health (90-100%)
        const health = 90 + Math.floor(Math.random() * 10);
        const healthPercent = document.getElementById('healthPercent');
        const systemHealth = document.getElementById('systemHealth');

        if (healthPercent) {
            healthPercent.textContent = `${health}%`;
        }
        if (systemHealth) {
            systemHealth.style.width = `${health}%`;
        }

        // Memory usage (if available)
        const memoryUsage = document.getElementById('memoryUsage');
        if (memoryUsage) {
            if (performance.memory) {
                const usedMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
                memoryUsage.textContent = `${usedMB} MB`;
                memoryUsage.className = usedMB > 100 ? 'status-value warning' : 'status-value online';
            } else {
                // Simulate memory for browsers without performance.memory
                const simMem = 30 + Math.floor(Math.random() * 40);
                memoryUsage.textContent = `${simMem} MB`;
                memoryUsage.className = 'status-value online';
            }
        }

        // Network status based on actual connection
        const networkStatus = document.getElementById('networkStatus');
        if (networkStatus) {
            if (navigator.onLine) {
                networkStatus.textContent = 'CONNECTED';
                networkStatus.className = 'status-value online';
            } else {
                networkStatus.textContent = 'OFFLINE';
                networkStatus.className = 'status-value offline';
            }
        }

        // Update header stats
        const headerCoreStatus = document.getElementById('headerCoreStatus');
        if (headerCoreStatus) {
            headerCoreStatus.textContent = navigator.onLine ? 'ONLINE' : 'OFFLINE';
        }

        // Listen for online/offline events
        window.addEventListener('online', () => {
            if (networkStatus) {
                networkStatus.textContent = 'CONNECTED';
                networkStatus.className = 'status-value online';
            }
            if (headerCoreStatus) {
                headerCoreStatus.textContent = 'ONLINE';
            }
        });

        window.addEventListener('offline', () => {
            if (networkStatus) {
                networkStatus.textContent = 'OFFLINE';
                networkStatus.className = 'status-value offline';
            }
            if (headerCoreStatus) {
                headerCoreStatus.textContent = 'OFFLINE';
            }
        });
    }

    // Weather Widget
    initWeather() {
        this.getWeather();
    }

    async getWeather() {
        try {
            // Try to get user's location
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        await this.fetchWeatherData(latitude, longitude);
                    },
                    () => {
                        // If location denied, use default weather display
                        this.setDefaultWeather();
                    }
                );
            } else {
                this.setDefaultWeather();
            }
        } catch (error) {
            this.setDefaultWeather();
        }
    }

    async fetchWeatherData(lat, lon) {
        try {
            // Using Open-Meteo API (free, no API key needed)
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,surface_pressure,uv_index`
            );

            if (response.ok) {
                const data = await response.json();
                this.updateWeatherDisplay(data);
            } else {
                this.setDefaultWeather();
            }
        } catch (error) {
            this.setDefaultWeather();
        }
    }

    updateWeatherDisplay(data) {
        const current = data.current;

        // Temperature
        const weatherTemp = document.getElementById('weatherTemp');
        if (weatherTemp) {
            weatherTemp.textContent = `${Math.round(current.temperature_2m)}°C`;
        }

        // Humidity
        const weatherHumidity = document.getElementById('weatherHumidity');
        if (weatherHumidity) {
            weatherHumidity.textContent = `${current.relative_humidity_2m}%`;
        }

        // Wind
        const weatherWind = document.getElementById('weatherWind');
        if (weatherWind) {
            weatherWind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
        }

        // Pressure
        const weatherPressure = document.getElementById('weatherPressure');
        if (weatherPressure && current.surface_pressure) {
            weatherPressure.textContent = `${Math.round(current.surface_pressure)} hPa`;
        }

        // UV Index
        const weatherUV = document.getElementById('weatherUV');
        if (weatherUV && current.uv_index !== undefined) {
            const uv = Math.round(current.uv_index);
            weatherUV.textContent = uv;
            // Color code UV index
            if (uv >= 8) weatherUV.className = 'weather-value uv-extreme';
            else if (uv >= 6) weatherUV.className = 'weather-value uv-high';
            else if (uv >= 3) weatherUV.className = 'weather-value uv-moderate';
            else weatherUV.className = 'weather-value uv-low';
        }

        // Weather icon based on WMO code
        const weatherIcon = document.getElementById('weatherIcon');
        if (weatherIcon) {
            weatherIcon.textContent = this.getWeatherIcon(current.weather_code);
        }

        // Location
        const weatherLocation = document.getElementById('weatherLocation');
        if (weatherLocation) {
            weatherLocation.textContent = 'LOCAL';
        }
    }

    getWeatherIcon(code) {
        // WMO Weather interpretation codes
        if (code === 0) return '☀'; // Clear sky
        if (code === 1 || code === 2 || code === 3) return '⛅'; // Partly cloudy
        if (code >= 45 && code <= 48) return '🌫'; // Fog
        if (code >= 51 && code <= 57) return '🌧'; // Drizzle
        if (code >= 61 && code <= 67) return '🌧'; // Rain
        if (code >= 71 && code <= 77) return '❄'; // Snow
        if (code >= 80 && code <= 82) return '🌧'; // Rain showers
        if (code >= 85 && code <= 86) return '❄'; // Snow showers
        if (code >= 95 && code <= 99) return '⛈'; // Thunderstorm
        return '☀';
    }

    setDefaultWeather() {
        const weatherTemp = document.getElementById('weatherTemp');
        const weatherHumidity = document.getElementById('weatherHumidity');
        const weatherWind = document.getElementById('weatherWind');
        const weatherPressure = document.getElementById('weatherPressure');
        const weatherUV = document.getElementById('weatherUV');
        const weatherLocation = document.getElementById('weatherLocation');
        const weatherIcon = document.getElementById('weatherIcon');

        if (weatherTemp) weatherTemp.textContent = '22°C';
        if (weatherHumidity) weatherHumidity.textContent = '65%';
        if (weatherWind) weatherWind.textContent = '12 km/h';
        if (weatherPressure) weatherPressure.textContent = '1013 hPa';
        if (weatherUV) weatherUV.textContent = '3';
        if (weatherLocation) weatherLocation.textContent = 'N/A';
        if (weatherIcon) weatherIcon.textContent = '☀';
    }

    // Network Monitor Widget
    initNetworkMonitor() {
        this.packetCount = 0;
        this.setupNetworkGraph();
        this.measureNetworkStats();
        setInterval(() => this.measureNetworkStats(), 2000);
    }

    setupNetworkGraph() {
        const canvas = document.getElementById('networkGraph');
        if (!canvas) return;

        this.networkCanvas = canvas;
        this.networkCtx = canvas.getContext('2d');

        // Initialize with zeros
        for (let i = 0; i < this.maxDataPoints; i++) {
            this.networkData.push(0);
        }
    }

    measureNetworkStats() {
        // Simulate latency (10-100ms)
        const latency = 10 + Math.floor(Math.random() * 50);
        const networkLatency = document.getElementById('networkLatency');
        if (networkLatency) {
            networkLatency.textContent = `${latency} ms`;
        }

        // Update header latency
        const headerLatency = document.getElementById('headerLatency');
        if (headerLatency) {
            headerLatency.textContent = `${latency} ms`;
        }

        // Detect bandwidth and connection type
        let bandwidth = 100;
        let connType = 'WiFi';
        if ('connection' in navigator) {
            const conn = navigator.connection;
            const effectiveType = conn.effectiveType;
            const type = conn.type;

            // Determine display name for connection type
            // Note: type is often undefined on desktop browsers, so we default to WiFi
            if (type === 'wifi') {
                connType = 'WiFi';
            } else if (type === 'ethernet') {
                connType = 'ETH';
            } else if (type === 'cellular') {
                connType = effectiveType ? effectiveType.toUpperCase() : 'LTE';
            } else if (type === 'bluetooth') {
                connType = 'BT';
            } else if (type === 'none') {
                connType = 'NONE';
            } else {
                // Desktop browsers typically don't support connection.type
                // Default to Q-Wave for futuristic theme
                connType = 'Q-Wave';
            }

            // Set bandwidth based on effective type
            if (effectiveType === '4g') {
                bandwidth = 50 + Math.floor(Math.random() * 100);
            } else if (effectiveType === '3g') {
                bandwidth = 10 + Math.floor(Math.random() * 20);
            } else if (effectiveType === '2g') {
                bandwidth = 1 + Math.floor(Math.random() * 5);
            } else {
                bandwidth = 50 + Math.floor(Math.random() * 100);
            }
        } else {
            bandwidth = 50 + Math.floor(Math.random() * 100);
        }

        const networkBandwidth = document.getElementById('networkBandwidth');
        if (networkBandwidth) {
            networkBandwidth.textContent = `${bandwidth} Mbps`;
        }

        // Packet count (simulated - increases over time)
        this.packetCount += Math.floor(Math.random() * 50) + 10;
        const networkPackets = document.getElementById('networkPackets');
        if (networkPackets) {
            if (this.packetCount > 1000000) {
                networkPackets.textContent = `${(this.packetCount / 1000000).toFixed(1)}M`;
            } else if (this.packetCount > 1000) {
                networkPackets.textContent = `${(this.packetCount / 1000).toFixed(1)}K`;
            } else {
                networkPackets.textContent = this.packetCount;
            }
        }

        // Connection type
        const connectionType = document.getElementById('connectionType');
        if (connectionType) {
            connectionType.textContent = connType.toUpperCase();
        }

        // Update graph data
        this.networkData.push(latency);
        if (this.networkData.length > this.maxDataPoints) {
            this.networkData.shift();
        }

        this.drawNetworkGraph();
    }

    drawNetworkGraph() {
        if (!this.networkCtx || !this.networkCanvas) return;

        const ctx = this.networkCtx;
        const canvas = this.networkCanvas;
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(0, (height / 4) * i);
            ctx.lineTo(width, (height / 4) * i);
            ctx.stroke();
        }

        // Draw data line
        if (this.networkData.length < 2) return;

        const maxVal = Math.max(...this.networkData, 100);
        const stepX = width / (this.maxDataPoints - 1);

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(74, 222, 128, 0.8)');
        gradient.addColorStop(1, 'rgba(74, 222, 128, 0.1)');

        // Calculate points for smooth curves
        const points = this.networkData.map((val, i) => ({
            x: i * stepX,
            y: height - (val / maxVal) * height * 0.9
        }));

        // Draw filled area with sharp/pointy lines
        ctx.beginPath();
        ctx.moveTo(0, height);

        if (points.length > 0) {
            // Use straight lines for pointy/jagged appearance
            for (let i = 0; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw sharp line on top
        ctx.beginPath();
        if (points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);

            // Use straight lines for pointy appearance
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
        }
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw glow effect on the last point
        const lastX = (this.networkData.length - 1) * stepX;
        const lastY = height - (this.networkData[this.networkData.length - 1] / maxVal) * height * 0.9;

        ctx.beginPath();
        ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#4ade80';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.3)';
        ctx.fill();
    }

    // Uptime Counter for Header
    initUptime() {
        this.updateUptime();
        setInterval(() => this.updateUptime(), 1000);
    }

    updateUptime() {
        const headerUptime = document.getElementById('headerUptime');
        if (!headerUptime) return;

        const elapsed = Date.now() - this.sessionStartTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            headerUptime.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            headerUptime.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DashboardWidgets();
    new StatsWidgets();
});

// Stats Widgets - Track file transfer statistics
class StatsWidgets {
    constructor() {
        this.stats = this.loadStats();
        this.sessionStats = {
            totalFiles: 0,
            successful: 0,
            pending: 0,
            transferSpeed: 0,
            startTime: null,
            transferComplete: false
        };
        this.init();
    }

    init() {
        this.updateDisplay();
        this.bindFileShareEvents();
        // Update display every second for time tracking
        setInterval(() => this.updateTimeTaken(), 1000);
    }

    loadStats() {
        const stored = localStorage.getItem('sendDirectStats');
        if (stored) {
            return JSON.parse(stored);
        }
        return {
            yourTotalFiles: 0,
            totalSuccessful: 0,
            totalTime: 0
        };
    }

    saveStats() {
        localStorage.setItem('sendDirectStats', JSON.stringify(this.stats));
    }

    bindFileShareEvents() {
        // Listen for share button click to start timer
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                this.sessionStats.startTime = Date.now();
            });
        }

        // Expose methods globally for FileShare class to call
        window.statsWidgets = {
            onTransferComplete: (fileCount, speed) => this.onTransferComplete(fileCount, speed),
            onFileAdded: (count) => this.onFileAdded(count),
            onTransferStart: () => this.onTransferStart(),
            onTransferProgress: (pending) => this.onTransferProgress(pending),
            show: () => this.showStatsWidgets(),
            hide: () => this.hideStatsWidgets()
        };
    }

    showStatsWidgets() {
        const statsSection = document.getElementById('statsWidgets');
        if (statsSection) {
            statsSection.style.display = 'flex';
        }
    }

    hideStatsWidgets() {
        const statsSection = document.getElementById('statsWidgets');
        if (statsSection) {
            statsSection.style.display = 'none';
        }
    }

    onFileAdded(count) {
        // Don't show stats widgets on file add - only track the count
        this.sessionStats.totalFiles = count;
        this.sessionStats.pending = count;
        this.sessionStats.successful = 0;
    }

    onTransferStart() {
        this.sessionStats.startTime = Date.now();
    }

    onTransferProgress(pending) {
        this.sessionStats.pending = pending;
        this.sessionStats.successful = this.sessionStats.totalFiles - pending;
    }

    onTransferComplete(fileCount, speed, timeTaken) {
        this.sessionStats.totalFiles = fileCount;
        this.sessionStats.successful = fileCount;
        this.sessionStats.pending = 0;
        this.sessionStats.transferSpeed = speed || 0;
        this.sessionStats.timeTaken = timeTaken || 0;
        this.sessionStats.transferComplete = true; // Stop the timer

        // Update lifetime stats
        this.stats.yourTotalFiles += fileCount;
        this.stats.totalSuccessful += fileCount;
        if (this.sessionStats.startTime) {
            this.stats.totalTime += (Date.now() - this.sessionStats.startTime);
        }
        this.saveStats();

        // Show stats widgets only after successful transfer
        this.showStatsWidgets();
        this.updateDisplay();
    }

    updateTimeTaken() {
        const timeTakenEl = document.getElementById('statTimeTaken');
        // Don't update if transfer is complete - keep final time
        if (timeTakenEl && this.sessionStats.startTime && !this.sessionStats.transferComplete) {
            const elapsed = Date.now() - this.sessionStats.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            if (minutes > 0) {
                timeTakenEl.textContent = `${minutes}m ${seconds}s`;
            } else {
                timeTakenEl.textContent = `${seconds}s`;
            }
        }
    }

    updateDisplay() {
        // Session stats - show real transfer data
        const totalFilesEl = document.getElementById('statTotalFiles');
        const successfulEl = document.getElementById('statSuccessful');
        const pendingEl = document.getElementById('statPending');
        const speedEl = document.getElementById('statTransferSpeed');
        const timeTakenEl = document.getElementById('statTimeTaken');

        if (totalFilesEl) totalFilesEl.textContent = this.sessionStats.totalFiles;
        if (successfulEl) successfulEl.textContent = this.sessionStats.successful;
        if (pendingEl) pendingEl.textContent = this.sessionStats.pending;
        if (speedEl) speedEl.textContent = this.sessionStats.transferSpeed.toFixed(1);

        // Update time taken
        if (timeTakenEl && this.sessionStats.timeTaken) {
            const seconds = Math.floor(this.sessionStats.timeTaken / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            if (minutes > 0) {
                timeTakenEl.textContent = `${minutes}m ${remainingSeconds}s`;
            } else {
                timeTakenEl.textContent = `${remainingSeconds}s`;
            }
        }
    }
}
