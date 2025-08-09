// Widget.js Fix - Common Issues and Solutions for Backend Connection

// ==================== BACKEND CONNECTION CONFIG ====================

// 1. Fix Backend URL Configuration
function getBackendUrl() {
    // Check if running in Zoho Creator environment
    const isZohoCreator = window.location.hostname.includes('zoho.com') || 
                         window.location.hostname.includes('creator.zoho');
    
    // Production backend URL
    const PRODUCTION_URL = 'https://nexpo-event-registration-backend-production.up.railway.app';
    
    // Local development URL
    const LOCAL_URL = 'http://localhost:3000';
    
    // Use production URL in Zoho Creator, local for development
    return isZohoCreator ? PRODUCTION_URL : LOCAL_URL;
}

// 2. Enhanced CORS Headers for API Requests
function makeApiRequest(endpoint, options = {}) {
    const backendUrl = getBackendUrl();
    const url = `${backendUrl}${endpoint}`;
    
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            // Add origin header for CORS
            'Origin': window.location.origin
        },
        mode: 'cors',
        credentials: 'include'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // Merge headers properly
    if (options.headers) {
        finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }
    
    console.log('🌐 Making API request to:', url);
    console.log('📋 Request options:', finalOptions);
    
    return fetch(url, finalOptions)
        .then(response => {
            console.log('📥 Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .catch(error => {
            console.error('❌ API Request failed:', error);
            throw error;
        });
}

// 3. Fixed WebSocket/Socket.IO Connection
function setupRealTimeFeatures(eventId) {
    const backendUrl = getBackendUrl();
    
    console.log('🔌 Setting up real-time features for event:', eventId);
    console.log('🌐 Backend URL:', backendUrl);
    
    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
        console.error('❌ Socket.IO library not loaded');
        loadSocketIO().then(() => {
            connectRealTime(eventId);
        }).catch(error => {
            console.error('❌ Failed to load Socket.IO:', error);
        });
        return;
    }
    
    connectRealTime(eventId);
}

// 4. Load Socket.IO Library Dynamically
function loadSocketIO() {
    return new Promise((resolve, reject) => {
        if (typeof io !== 'undefined') {
            resolve();
            return;
        }
        
        const backendUrl = getBackendUrl();
        const script = document.createElement('script');
        script.src = `${backendUrl}/socket.io/socket.io.js`;
        script.onload = () => {
            console.log('✅ Socket.IO library loaded');
            resolve();
        };
        script.onerror = () => {
            console.error('❌ Failed to load Socket.IO library');
            reject(new Error('Failed to load Socket.IO'));
        };
        document.head.appendChild(script);
    });
}

// 5. Enhanced Real-Time Connection with Better Error Handling
function connectRealTime(eventId) {
    const backendUrl = getBackendUrl();
    
    try {
        console.log('🔄 Connecting to WebSocket:', backendUrl);
        
        // Disconnect existing connection if any
        if (window.realtimeSocket) {
            window.realtimeSocket.disconnect();
        }
        
        // Create new Socket.IO connection with enhanced configuration
        window.realtimeSocket = io(backendUrl, {
            path: '/socket.io',
            transports: ['websocket', 'polling'], // Allow both transports
            timeout: 10000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 5000,
            maxReconnectionAttempts: 5,
            forceNew: true,
            // CORS settings
            withCredentials: true,
            extraHeaders: {
                'Origin': window.location.origin
            }
        });
        
        // Connection event handlers
        window.realtimeSocket.on('connect', function() {
            console.log('✅ WebSocket connected successfully');
            console.log('🆔 Socket ID:', window.realtimeSocket.id);
            console.log('🚌 Transport:', window.realtimeSocket.io.engine.transport.name);
            
            // Join event room
            if (eventId) {
                window.realtimeSocket.emit('join_event', eventId);
                console.log('📍 Joining event room:', eventId);
            }
            
            // Subscribe to registrations report
            window.realtimeSocket.emit('subscribe_report', 'Registrations');
            console.log('📊 Subscribing to Registrations report');
            
            // Update UI to show connected status
            updateConnectionStatus('connected');
        });
        
        window.realtimeSocket.on('disconnect', function(reason) {
            console.log('🔌 WebSocket disconnected:', reason);
            updateConnectionStatus('disconnected');
        });
        
        window.realtimeSocket.on('connect_error', function(error) {
            console.error('❌ WebSocket connection error:', error);
            updateConnectionStatus('error');
            
            // Fallback to polling if websocket fails
            if (window.realtimeSocket.io.engine.transport.name === 'websocket') {
                console.log('🔄 Falling back to polling transport');
                window.realtimeSocket.io.opts.transports = ['polling'];
            }
        });
        
        window.realtimeSocket.on('reconnect', function(attemptNumber) {
            console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
            updateConnectionStatus('connected');
        });
        
        window.realtimeSocket.on('reconnect_error', function(error) {
            console.error('❌ WebSocket reconnection failed:', error);
        });
        
        window.realtimeSocket.on('reconnect_failed', function() {
            console.error('❌ WebSocket reconnection failed permanently');
            updateConnectionStatus('failed');
        });
        
        // Data event handlers
        window.realtimeSocket.on('connected', function(data) {
            console.log('📨 Server welcome message:', data);
        });
        
        window.realtimeSocket.on('joined_event', function(data) {
            console.log('📍 Joined event room:', data);
        });
        
        window.realtimeSocket.on('subscribed_report', function(data) {
            console.log('📊 Subscribed to report:', data);
        });
        
        window.realtimeSocket.on('registration_data', function(data) {
            console.log('📥 Registration data received:', data);
            handleRealTimeUpdate(data);
        });
        
        window.realtimeSocket.on('checkin_update', function(data) {
            console.log('🎫 Check-in update received:', data);
            handleCheckInUpdate(data);
        });
        
        window.realtimeSocket.on('event_update', function(data) {
            console.log('📅 Event update received:', data);
            handleRealTimeUpdate(data);
        });
        
    } catch (error) {
        console.error('❌ Error setting up WebSocket connection:', error);
        updateConnectionStatus('error');
    }
}

// 6. Connection Status UI Updates
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        const statusMap = {
            'connected': { text: '🟢 Connected', class: 'status-connected' },
            'disconnected': { text: '🟡 Disconnected', class: 'status-disconnected' },
            'error': { text: '🔴 Connection Error', class: 'status-error' },
            'failed': { text: '🔴 Connection Failed', class: 'status-failed' }
        };
        
        const statusInfo = statusMap[status] || { text: '⚪ Unknown', class: 'status-unknown' };
        statusElement.textContent = statusInfo.text;
        statusElement.className = `connection-status ${statusInfo.class}`;
    }
}

// 7. Enhanced API Health Check
async function checkBackendHealth() {
    try {
        console.log('🏥 Checking backend health...');
        const health = await makeApiRequest('/api/health');
        console.log('✅ Backend health check:', health);
        
        if (health.status === 'ok') {
            console.log('✅ Backend is healthy');
            console.log('📊 Services:', health.services);
            return true;
        } else {
            console.warn('⚠️ Backend health issues:', health);
            return false;
        }
    } catch (error) {
        console.error('❌ Backend health check failed:', error);
        return false;
    }
}

// 8. Enhanced Error Handling for API Calls
async function loadVisitorsWithRetry(eventId, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Loading visitors (attempt ${attempt}/${maxRetries})`);
            
            const response = await makeApiRequest(`/api/visitors/${eventId}`);
            console.log('✅ Visitors loaded successfully');
            return response;
            
        } catch (error) {
            lastError = error;
            console.error(`❌ Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`⏳ Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw new Error(`Failed to load visitors after ${maxRetries} attempts: ${lastError.message}`);
}

// 9. Initialize Widget with Better Error Handling
async function initializeWidget() {
    try {
        console.log('🚀 Initializing widget...');
        
        // 1. Check backend health first
        const isHealthy = await checkBackendHealth();
        if (!isHealthy) {
            console.warn('⚠️ Backend health check failed, but continuing...');
        }
        
        // 2. Get event ID from URL or context
        const eventId = getEventIdFromContext();
        if (!eventId) {
            console.error('❌ No event ID found');
            return;
        }
        
        console.log('📅 Event ID:', eventId);
        
        // 3. Setup real-time features
        await setupRealTimeFeatures(eventId);
        
        // 4. Load initial data
        try {
            const visitors = await loadVisitorsWithRetry(eventId);
            console.log(`✅ Loaded ${visitors.length || 0} visitors`);
            // Process visitors data...
        } catch (error) {
            console.error('❌ Failed to load visitors:', error);
            // Continue without visitor data
        }
        
        console.log('✅ Widget initialized successfully');
        
    } catch (error) {
        console.error('❌ Widget initialization failed:', error);
    }
}

// 10. Utility Functions
function getEventIdFromContext() {
    // Try to get event ID from various sources
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('eventId') || 
           window.eventId || 
           document.getElementById('eventId')?.value ||
           '4433256000013114003'; // Default for testing
}

// 11. Export functions for use in main widget
window.WidgetFix = {
    getBackendUrl,
    makeApiRequest,
    setupRealTimeFeatures,
    connectRealTime,
    checkBackendHealth,
    loadVisitorsWithRetry,
    initializeWidget,
    updateConnectionStatus
};

// 12. Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
} else {
    initializeWidget();
}

console.log('🔧 Widget fix loaded and ready!');
