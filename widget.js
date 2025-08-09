// ===== MINIMAL WIDGET - LOAD ALL DATA ONCE + INSTANT SEARCH =====
// 🚀 REDIS-ENHANCED BACKEND INTEGRATION

// Backend API Configuration with Enhanced Auto-Detection
function getBackendConfig() {
    // Force production URL for safety (CSP compatibility)
    // Set FORCE_PRODUCTION = false only for local development
    const FORCE_PRODUCTION = true;
    
    if (FORCE_PRODUCTION) {
        console.log('🔒 FORCE_PRODUCTION enabled - using production URL');
        return {
            BASE_URL: 'https://nexpo-event-registration-backend-production.up.railway.app',
            ENDPOINTS: {
                EVENT_FILTERING: '/api/event-filtering/registrations',
                EVENTS_LIST: '/api/event-filtering/events/list',
                REALTIME_STATUS: '/api/status/realtime',
                HEALTH: '/api/health'
            }
        };
    }
    
    // Enhanced detection for Zoho Creator environment (backup logic)
    const currentHostname = window.location.hostname;
    const currentOrigin = window.location.origin;
    const currentURL = window.location.href;
    
    // Check multiple ways to detect Zoho environment
    const isZohoCreator = currentHostname.includes('zoho.com') || 
                         currentHostname.includes('creator.zoho') ||
                         currentHostname.includes('creatorapp.zoho') ||
                         currentHostname.includes('zohostatic.com') ||
                         currentHostname.includes('zappsusercontent.com') ||
                         currentURL.includes('zoho.com') ||
                         (window.parent && window.parent !== window && 
                          (document.referrer.includes('zoho.com') || 
                           document.referrer.includes('creator.zoho')));
    
    const PRODUCTION_URL = 'https://nexpo-event-registration-backend-production.up.railway.app';
    const LOCAL_URL = 'http://localhost:3000';
    
    // Log detection for debugging
    console.log('🔍 Environment Detection:', {
        hostname: currentHostname,
        origin: currentOrigin,
        isZohoCreator: isZohoCreator,
        selectedURL: isZohoCreator ? PRODUCTION_URL : LOCAL_URL,
        referrer: document.referrer,
        inIframe: window.parent !== window
    });
    
    return {
        BASE_URL: isZohoCreator ? PRODUCTION_URL : LOCAL_URL,
        ENDPOINTS: {
            EVENT_FILTERING: '/api/event-filtering/registrations',
            EVENTS_LIST: '/api/event-filtering/events/list',
            REALTIME_STATUS: '/api/status/realtime',
            HEALTH: '/api/health'
        }
    };
}

// Force production URL if CSP detected or for safety in Zoho
const BACKEND_CONFIG = (() => {
    const config = getBackendConfig();
    
    // Force production URL if we detect CSP restrictions
    // This happens when running in Zoho Creator
    if (typeof window !== 'undefined' && 
        (document.location.protocol === 'https:' && 
         !config.BASE_URL.startsWith('https:'))) {
        console.log('🔒 CSP/HTTPS detected, forcing production URL');
        return {
            ...config,
            BASE_URL: 'https://nexpo-event-registration-backend-production.up.railway.app'
        };
    }
    
    return config;
})();

// Enhanced API request function with CORS support and error handling
async function makeApiRequest(endpoint, options = {}) {
    const url = `${BACKEND_CONFIG.BASE_URL}${endpoint}`;
    
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
        // Temporary fix for CORS credentials issue while production deploys
        credentials: BACKEND_CONFIG.BASE_URL.includes('localhost') ? 'include' : 'omit'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // Merge headers properly
    if (options.headers) {
        finalOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }
    
    console.log('🌐 Making API request to:', url);
    console.log('📋 Request options:', finalOptions);
    
    try {
        const response = await fetch(url, finalOptions);
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ API request successful');
        return data;
    } catch (error) {
        console.error('❌ API Request failed:', error);
        throw error;
    }
}

// Enhanced API request with retry logic
async function makeApiRequestWithRetry(endpoint, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 API request attempt ${attempt}/${maxRetries} to: ${endpoint}`);
            const result = await makeApiRequest(endpoint, options);
            console.log('✅ API request succeeded');
            return result;
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
    
    throw new Error(`Failed to make API request after ${maxRetries} attempts: ${lastError.message}`);
}

// Global variables (keep it simple!)
let ALL_VISITORS = []; // Load once, use everywhere
let CURRENT_EVENT = null;
let SEARCH_TERM = '';
let STATUS_FILTER = '';
let TYPE_FILTER = '';
let DATE_FILTER = '';
let CURRENT_PAGE = 1;
let PAGE_SIZE = 50;

// 🚀 REDIS-ENHANCED: Real-time features
let SOCKET_IO = null;
let REAL_TIME_ENABLED = false;

// Selection state
let SELECTED_VISITOR_IDS = new Set();

// Additional state for exhibitors
let ALL_EXHIBITORS = []; // Quick view data from exhibitor_company
let ALL_EXHIBITOR_PROFILES = []; // Detailed data from Exhibitor_Profile
let FILTERED_EXHIBITORS = [];
let EXHIBITOR_SEARCH_TERM = '';
let EXHIBITOR_STATUS_FILTER = '';
let CURRENT_EXHIBITOR_PAGE = 1;
let EXHIBITOR_PAGE_SIZE = 20;
let SELECTED_EXHIBITOR_IDS = new Set();

// 🚀 ENHANCED: Setup real-time features with better error handling
async function setupRealTimeFeatures(eventId) {
    try {
        console.log('🔌 Setting up real-time features for event:', eventId);
        console.log('🌐 Backend URL:', BACKEND_CONFIG.BASE_URL);
        
        // Real-time features disabled due to Zoho Creator CSP restrictions
        console.log('⚠️ Real-time features disabled due to Zoho Creator CSP restrictions');
        console.log('📝 Socket.IO connections blocked by Content Security Policy');
        console.log('🔄 Widget will work in standard mode without real-time updates');
        
        // CSP in Zoho Creator blocks external WebSocket connections:
        // connect-src https://*.zappsusercontent.com https://*.zohostatic.com ...
        // This prevents Socket.IO from connecting to external backend
        
        return;
    } catch (error) {
        console.warn('⚠️ Could not setup real-time features:', error.message);
        console.log('📱 Widget will continue without real-time updates');
    }
}

// Enhanced Socket.IO library loading
function loadSocketIOLibrary() {
    return new Promise((resolve, reject) => {
        console.log('📦 Loading Socket.IO library...');
        
        const script = document.createElement('script');
        script.src = `${BACKEND_CONFIG.BASE_URL}/socket.io/socket.io.js`;
        
        script.onload = () => {
            console.log('✅ Socket.IO library loaded successfully');
            resolve();
        };
        
        script.onerror = () => {
            console.error('❌ Failed to load Socket.IO library');
            reject(new Error('Failed to load Socket.IO library'));
        };
        
        document.head.appendChild(script);
    });
}

function connectRealTime(eventId) {
    try {
        console.log('🔄 Connecting to WebSocket:', BACKEND_CONFIG.BASE_URL);
        
        // Disconnect existing connection if any
        if (SOCKET_IO) {
            SOCKET_IO.disconnect();
        }
        
        // Create new Socket.IO connection with enhanced configuration
        SOCKET_IO = io(BACKEND_CONFIG.BASE_URL, {
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
        
        // Enhanced connection event handlers
        SOCKET_IO.on('connect', () => {
            console.log('✅ WebSocket connected successfully');
            console.log('🆔 Socket ID:', SOCKET_IO.id);
            console.log('🚌 Transport:', SOCKET_IO.io.engine.transport.name);
            REAL_TIME_ENABLED = true;
            
            // Join event room using correct event name
            if (eventId) {
                SOCKET_IO.emit('join_event', eventId);
                console.log('📍 Joining event room:', eventId);
            }
            
            // Subscribe to registrations report
            SOCKET_IO.emit('subscribe_report', 'Registrations');
            console.log('📊 Subscribing to Registrations report');
        });
        
        SOCKET_IO.on('disconnect', (reason) => {
            console.log('🔌 WebSocket disconnected:', reason);
            REAL_TIME_ENABLED = false;
        });
        
        SOCKET_IO.on('connect_error', (error) => {
            console.error('❌ WebSocket connection error:', error);
            REAL_TIME_ENABLED = false;
            
            // Fallback to polling if websocket fails
            if (SOCKET_IO.io.engine.transport.name === 'websocket') {
                console.log('🔄 Falling back to polling transport');
                SOCKET_IO.io.opts.transports = ['polling'];
            }
        });
        
        SOCKET_IO.on('reconnect', (attemptNumber) => {
            console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
            REAL_TIME_ENABLED = true;
        });
        
        SOCKET_IO.on('reconnect_error', (error) => {
            console.error('❌ WebSocket reconnection failed:', error);
        });
        
        SOCKET_IO.on('reconnect_failed', () => {
            console.error('❌ WebSocket reconnection failed permanently');
            REAL_TIME_ENABLED = false;
        });
        
        // Server message handlers
        SOCKET_IO.on('connected', (data) => {
            console.log('📨 Server welcome message:', data);
        });
        
        SOCKET_IO.on('joined_event', (data) => {
            console.log('📍 Joined event room:', data);
        });
        
        SOCKET_IO.on('subscribed_report', (data) => {
            console.log('📊 Subscribed to report:', data);
        });
        
        // Enhanced data event handlers
        SOCKET_IO.on('registration_data', (data) => {
            console.log('📥 Registration data received:', data);
            handleRealTimeUpdate(data);
        });
        
        SOCKET_IO.on('registration_update', (data) => {
            console.log('🔄 Registration update received:', data);
            handleRealTimeUpdate(data);
        });
        
        SOCKET_IO.on('checkin_update', (data) => {
            console.log('🎫 Check-in update received:', data);
            handleCheckInUpdate(data);
        });
        
        SOCKET_IO.on('event_update', (data) => {
            console.log('📅 Event update received:', data);
            handleRealTimeUpdate(data);
        });
        
    } catch (error) {
        console.error('❌ Error setting up WebSocket connection:', error);
        REAL_TIME_ENABLED = false;
    }
}

function handleRealTimeUpdate(data) {
    if (data.event_id === CURRENT_EVENT?.id) {
        console.log('🔄 Updating visitor data in real-time...');
        
        // Refresh data automatically
        if (data.type === 'new_registration') {
            refreshVisitorData();
        } else if (data.type === 'check_in') {
            updateVisitorCheckInStatus(data.visitor_id, true);
        }
    }
}

function handleCheckInUpdate(data) {
    if (data.event_id === CURRENT_EVENT?.id) {
        updateVisitorCheckInStatus(data.visitor_id, data.checked_in);
        updateStatsFromLocalData();
    }
}

function updateVisitorCheckInStatus(visitorId, checkedIn) {
    const visitor = ALL_VISITORS.find(v => v.id === visitorId);
    if (visitor) {
        visitor.checked_in = checkedIn;
        
        // Update table if visible
        const checkbox = document.querySelector(`[data-visitor-id="${visitorId}"]`);
        if (checkbox) {
            const row = checkbox.closest('tr');
            const statusCell = row.querySelector('.status-badge');
            if (statusCell) {
                statusCell.textContent = checkedIn ? 'Checked In' : 'Not Checked In';
                statusCell.className = `status-badge ${checkedIn ? 'status-checked-in' : 'status-not-checked-in'}`;
            }
        }
        
        console.log(`✅ Updated visitor ${visitorId} check-in status: ${checkedIn}`);
    }
}

async function refreshVisitorData() {
    if (CURRENT_EVENT?.id) {
        console.log('🔄 Refreshing visitor data due to real-time update...');
        const batch = await loadVisitorBatch(CURRENT_EVENT.id, null, 1000);
        if (batch && batch.visitors) {
            ALL_VISITORS = batch.visitors;
            performInstantSearch(); // Re-render table
        }
    }
}

// ===== 1. STARTUP: LOAD ALL DATA ONCE =====
async function initializeWidget() {
    console.log('🚀 Starting minimal widget...');
    
    try {
        showLoading(true);
        
        // Wait for ZOHO SDK to fully initialize
        console.log('⏳ Waiting for ZOHO SDK to initialize...');
        await waitForZohoSDK();
        console.log('✅ ZOHO SDK ready!');
        
        // Try to get user email from multiple sources
        let userEmail = getUrlParameter('user_email');
        
        // Try to get from ZOHO user info
        if (!userEmail) {
            console.log('🔍 Checking ZOHO SDK availability...');
            console.log('ZOHO object:', typeof ZOHO !== 'undefined' ? 'Available' : 'Not available');
            
            if (typeof ZOHO !== 'undefined' && ZOHO.CREATOR && ZOHO.CREATOR.UTIL) {
                console.log('✅ ZOHO.CREATOR.UTIL is available');
                try {
                    console.log('📞 Calling ZOHO.CREATOR.UTIL.getInitParams()...');
                    const initParams = await ZOHO.CREATOR.UTIL.getInitParams();
                    console.log('📦 getInitParams response:', initParams);
                    
                    userEmail = initParams.loginUser;
                    console.log('✅ Got email from ZOHO:', userEmail);
                } catch (e) {
                    console.error('❌ Error getting ZOHO user info:', e);
                }
        } else {
                console.log('❌ ZOHO SDK not fully available');
                if (typeof ZOHO === 'undefined') {
                    console.log('- ZOHO object is undefined');
                } else {
                    console.log('- ZOHO.CREATOR:', !!ZOHO.CREATOR);
                    console.log('- ZOHO.CREATOR.UTIL:', !!(ZOHO.CREATOR && ZOHO.CREATOR.UTIL));
                }
            }
        }
        
                // Check if we got user email
        if (!userEmail) {
            showError('⚠️ Unable to detect user email. Please make sure you are logged into Zoho Creator.');
            return;
        }
        
        console.log('Using email:', userEmail);
        
        const dashboardData = await loadDashboardData(userEmail);
        
        if (dashboardData && dashboardData.tenant && dashboardData.tenant.events.length > 0) {
            const event = dashboardData.tenant.events[0];
            CURRENT_EVENT = event;
            
            console.log('Selected event:', event.name);
            
            // Hide event selector overlay and show dashboard
            const eventOverlay = document.getElementById('eventSelectOverlay');
            if (eventOverlay) {
                eventOverlay.style.display = 'none';
                console.log('✅ Event overlay hidden');
            }
            
            const dashboardContainer = document.getElementById('dashboardContainer');
            if (dashboardContainer) {
                dashboardContainer.style.display = 'block';
                console.log('✅ Dashboard container shown');
            } else {
                console.error('❌ Dashboard container not found!');
            }
            
            // Load tenant stats from API (main stats) 
            const tenantStats = await loadTenantStats(userEmail);
            
            // Show basic event info
            showEventInfo(event);
            
            // Smart loading with cache
            await loadVisitorsWithCache(event.id, tenantStats);
            
            // Load exhibitor data
            await loadExhibitorData(event.id);
            
            // 🚀 Setup real-time features
            await setupRealTimeFeatures(event.id);
            
            setupAdvancedFilter();
            setupSearchInput();
            setupExhibitorSearchInput();
            setupExportImportListeners();
            
            console.log('✅ Widget initialized successfully!');
        } else {
            showNoEventsWarning(userEmail);
        }
        
    } catch (error) {
        console.error('❌ Widget initialization failed:', error);
        showError('Failed to load widget: ' + error.message);
        showLoading(false);
    }
}

// ===== 2. PROGRESSIVE LOADING FOR BETTER UX =====
// Smart visitor loading with cache support
async function loadVisitorsWithCache(eventId, tenantStats) {
    console.log('🚀 Starting smart visitor loading with cache...');
    console.log('🔍 Debug - Event ID:', eventId);
    console.log('🔍 Debug - Tenant Stats:', tenantStats);
    
    // Load form fields for this event first (needed for proper field mapping)
    await fetchEventFormFields(eventId);
    
    // Use cache for better performance
    console.log('📦 Checking cache for optimized loading...');
    
    // Check cache first
    const cacheResult = compareWithCachedData(eventId, tenantStats);
    console.log('🔍 Debug - Cache Result:', cacheResult);
    
    if (!cacheResult.needsRefresh && cacheResult.cached) {
        // Check if we need full data for custom field filtering
        const needsFullData = ACTIVE_FILTERS && ACTIVE_FILTERS.some(filter => {
            if (filter.type === 'condition') {
                return filter.field.startsWith('customFields.');
            } else if (filter.type === 'group') {
                return filter.conditions.some(condition => condition.field.startsWith('customFields.'));
            }
            return false;
        });
        
        if (needsFullData && (cacheResult.cached.compressed || cacheResult.cached.ultraCompressed)) {
            console.log('🔄 Custom field filtering detected - forcing refresh for full data');
            // Force refresh to get full custom fields data
        } else {
            // Use cached data
            console.log('⚡ Using cached visitor data');
            
            ALL_VISITORS = cacheResult.cached.visitors;
            
            // If compressed data, we may be missing some fields - that's ok for basic functionality
            if (cacheResult.cached.compressed || cacheResult.cached.ultraCompressed) {
                console.log('📦 Using compressed cache data - some features may require refresh');
            }
            
            showLoading(false);
            displayPage(1);
            
            // Show cache info
            showCacheInfo(cacheResult.cached);
            
            console.log(`✅ Instantly loaded ${ALL_VISITORS.length} visitors from cache!`);
            return;
        }
    }
    
    // Need to fetch data
    console.log(`🔄 Cache refresh needed: ${cacheResult.reason}`);
    
    if (cacheResult.reason === 'data_changed' && cacheResult.cached) {
        // Incremental update scenario
        console.log('📈 Attempting incremental update...');
        const currentCount = cacheResult.currentCount;
        const cachedCount = cacheResult.cachedCount;
        
        if (currentCount > cachedCount) {
            // New visitors added, fetch only new ones
            try {
                await loadIncrementalVisitors(eventId, cacheResult.cached, tenantStats);
                return;
            } catch (error) {
                console.log('❌ Incremental update failed, doing full refresh');
            }
        }
    }
    
    // Full refresh needed
    await loadVisitorsProgressively(eventId, tenantStats);
}

async function loadIncrementalVisitors(eventId, cachedData, tenantStats) {
    console.log('📈 Loading new visitors incrementally...');
    
    // Load cached data first for instant UI
    ALL_VISITORS = cachedData.visitors;
    showLoading(false);
    displayPage(1);
    
    console.log(`⚡ Showing ${ALL_VISITORS.length} cached visitors instantly`);
    
    // Calculate how many new visitors to fetch
    const cachedCount = cachedData.visitors.length;
    const expectedCount = tenantStats?.total_registrations || 0;
    const newVisitorsCount = expectedCount - cachedCount;
    
    console.log(`🔍 Incremental calc: expected=${expectedCount}, cached=${cachedCount}, diff=${newVisitorsCount}`);
    
    if (newVisitorsCount <= 0) {
        if (newVisitorsCount < -50) { // Cache has significantly more than expected
            console.log('⚠️ Cache appears corrupted - clearing and full refresh');
            clearVisitorCache();
            await loadVisitorsProgressively(eventId, tenantStats);
            return;
        }
        console.log('📊 No new visitors to fetch (cache up to date)');
        return;
    }
    
    console.log(`📥 Fetching ${newVisitorsCount} new visitors...`);
    showProgressBar(true, `Loading ${newVisitorsCount} new visitors...`);
    
    // Fetch only new visitors (starting from where cache left off)  
    try {
        const newBatch = await loadVisitorBatch(eventId, null, 1000, cachedCount);
        
        if (newBatch && newBatch.visitors.length > 0) {
            // Append new visitors to existing array
            ALL_VISITORS.push(...newBatch.visitors);
            
            // Update cache with combined data
            saveVisitorCache(eventId, ALL_VISITORS, tenantStats);
            
            // Refresh UI
            displayPage(CURRENT_PAGE);
            
            console.log(`✅ Added ${newBatch.visitors.length} new visitors. Total: ${ALL_VISITORS.length}`);
        }
    } catch (error) {
        console.error('❌ Failed to load incremental visitors:', error);
        throw error;
    } finally {
        showProgressBar(false);
    }
}

async function loadVisitorsProgressively(eventId, tenantStats) {
    console.log('🚀 Starting progressive loading for event:', eventId);
    
    try {
        ALL_VISITORS = [];
        
        // STEP 1: Load first 200 records FAST → Show UI immediately
        console.log('📦 Loading first batch (200 records)...');
        const firstBatch = await loadVisitorBatch(eventId, null, 200);
        
        if (firstBatch && firstBatch.visitors.length > 0) {
            ALL_VISITORS = firstBatch.visitors;
            
            // CRITICAL: Hide ALL loading states and show UI immediately!
            showLoading(false);
            
            // Force hide any Zoho loading overlays
            setTimeout(() => {
                const loadingOverlays = document.querySelectorAll('[class*="loading"], [id*="loading"], [class*="spinner"]');
                loadingOverlays.forEach(overlay => {
                    if (overlay.style) overlay.style.display = 'none';
                });
                console.log(`🚫 Force hidden ${loadingOverlays.length} loading overlays`);
            }, 100);
            displayPage(1); // Show UI immediately! (will show first 50 from 200)
            console.log(`✅ First batch loaded! Showing first 50 of ${firstBatch.visitors.length} visitors immediately`);
            
            // Note: Main stats are loaded from tenant API, not from visitor count
        }
        
        // STEP 2: Continue loading rest in background (1000 per batch)
        console.log('🔄 Loading remaining data in background...');
        await loadRemainingVisitorsInBackground(eventId, firstBatch.cursor, tenantStats);
        
    } catch (error) {
        console.error('❌ Error in progressive loading:', error);
        showError('Failed to load visitor data');
    }
}

// 🚀 REDIS-ENHANCED: Load visitors using backend API
async function loadVisitorBatch(eventId, cursor = null, maxRecords = 1000) {
    try {
        console.log(`🚀 Loading visitors from Redis-enhanced backend for event: ${eventId}`);
        
        // Build endpoint with parameters
        const endpoint = `${BACKEND_CONFIG.ENDPOINTS.EVENT_FILTERING}/${eventId}?limit=${maxRecords}`;
        
        // Use enhanced API request function
        const data = await makeApiRequestWithRetry(endpoint);
        
        if (data.success && data.data) {
            console.log(`✅ Redis backend returned ${data.data.length} visitors`);
            console.log(`📊 Stats: Total=${data.stats.total_for_event}, Checked In=${data.stats.checked_in}, Groups=${data.stats.group_registrations}`);
            
            // Log first visitor to see structure (only once)
            if (data.data.length > 0 && !window.VISITOR_STRUCTURE_LOGGED) {
                console.log('🔍 Sample visitor data from Redis backend:', data.data[0]);
                console.log('🔍 Available keys:', Object.keys(data.data[0]));
                window.VISITOR_STRUCTURE_LOGGED = true;
            }
            
            const visitors = data.data.map(record => {
                // Parse custom fields if available
                let customFields = {};
                if (record.Custom_Fields_Value) {
                    try {
                        customFields = JSON.parse(record.Custom_Fields_Value);
                    } catch (e) {
                        console.warn('Failed to parse Custom_Fields_Value for record:', record.ID, e);
                    }
                }
                
                // Debug: Check Group_Registration values
                if (record.Group_Registration && record.Group_Registration !== "false") {
                    console.log(`🔍 Found Group Registration: ${record.Full_Name} - Group_Registration: "${record.Group_Registration}" (type: ${typeof record.Group_Registration})`);
                }
                
                return {
                    id: record.ID,
                    name: record.Full_Name || 'N/A',
                    email: record.Email || 'N/A',
                    phone: record.Phone_Number || 'N/A',
                    checked_in: record.Check_In_Status === true || record.Check_In_Status === 'true',
                    group_registration: record.Group_Registration === true || record.Group_Registration === 'true',
                    redeem_id: record.Redeem_ID || 'N/A',
                    salutation: record.Salutation || '',
                    added_time: record.Added_Time || '',
                    raw: record,
                    customFields: customFields
                };
            });
            
            return {
                visitors: visitors,
                totalCount: data.stats.total_for_event,
                stats: data.stats,
                hasMore: false // Backend fetches all data with client-side filtering
            };
        } else {
            console.error('❌ Backend API error:', data);
            return null;
        }
    } catch (error) {
        console.error('❌ Error calling Redis backend:', error);
        return null;
    }
}

// Load remaining visitors in background
async function loadRemainingVisitorsInBackground(eventId, startCursor, tenantStats) {
    let cursor = startCursor;
    let page = 2; // Starting from page 2 since page 1 was already loaded
    const maxPages = 25; // Safety limit
    
    // Show progress bar
    showProgressBar(true, 'Loading additional visitors...');
    updateProgressBar(0, 'Starting background loading...');
    
    while (page <= maxPages && cursor) {
        try {
            const progressPercentage = ((page - 2) / (maxPages - 2)) * 100;
            updateProgressBar(progressPercentage, `Loading page ${page}...`);
            
            console.log(`📦 Background loading page ${page}...`);
            
            const batch = await loadVisitorBatch(eventId, cursor, 1000);
            console.log(`🔍 API returned ${batch?.visitors?.length || 0} records (requested 1000)`);
            
            if (batch && batch.visitors.length > 0) {
                // Add to global array
                ALL_VISITORS.push(...batch.visitors);
                
                const currentProgress = ((page - 1) / maxPages) * 100;
                updateProgressBar(currentProgress, `Loaded ${ALL_VISITORS.length} visitors...`);
                
                console.log(`✅ Background loaded ${batch.visitors.length} visitors. Total: ${ALL_VISITORS.length}`);
                
                // Note: Stats are from tenant API, not real-time counted from visitors
                
                // Update pagination if user is still on page 1
                if (CURRENT_PAGE === 1) {
                    const totalPages = Math.ceil(ALL_VISITORS.length / PAGE_SIZE);
                    const filtered = window.FILTERED_VISITORS || ALL_VISITORS;
                    renderPagination(1, Math.ceil(filtered.length / PAGE_SIZE), filtered.length);
                }
                
                cursor = batch.cursor;
                console.log(`🔍 Debug: hasMore=${batch.hasMore}, cursor=${cursor ? 'exists' : 'null'}`);
                
                if (!batch.hasMore) {
                    updateProgressBar(100, 'All data loaded!');
                    console.log('🎉 All data loaded in background!');
                    
                    // Save to cache when all data is loaded
                    console.log('🔍 Checking cache save conditions:', {
                        tenantStats: !!tenantStats,
                        visitorCount: ALL_VISITORS.length
                    });
                    if (tenantStats && ALL_VISITORS.length > 0) {
                        console.log('💾 Saving cache after background loading...');
                        saveVisitorCache(eventId, ALL_VISITORS, tenantStats);
                    } else {
                        console.log('❌ Cache save skipped - missing conditions');
                    }
                    break;
                }
            
                page++;
                
                // Small delay to not overwhelm the API
                await new Promise(resolve => setTimeout(resolve, 100));
    } else {
                    break;
                }
        } catch (error) {
            console.error(`❌ Error loading background page ${page}:`, error);
            updateProgressBar(100, 'Loading completed with errors');
                    break;
                }
    }
    
    // Complete progress and hide after delay
    updateProgressBar(100, `Completed! ${ALL_VISITORS.length} visitors loaded`);
    setTimeout(() => {
        showProgressBar(false);
    }, 2000);
    
    console.log(`🎊 Progressive loading complete! Total: ${ALL_VISITORS.length} visitors`);
    
    // Save to cache for future visits
    console.log('🔍 Progressive loading cache save check:', {
        tenantStats: !!tenantStats,
        visitorCount: ALL_VISITORS.length
    });
    if (tenantStats && ALL_VISITORS.length > 0) {
        console.log('💾 Saving cache after progressive loading...');
        saveVisitorCache(eventId, ALL_VISITORS, tenantStats);
            } else {
        console.log('❌ Progressive cache save skipped');
    }
}

// Note: Stats are now loaded from tenant API in loadTenantStats()
// No longer updating stats in real-time from visitor data

// ===== 3. INSTANT SEARCH (NO API CALLS) =====
function performInstantSearch() {
    console.log('🔍 Instant search:', { SEARCH_TERM, ACTIVE_FILTERS });
    
    let filtered = ALL_VISITORS.filter(visitor => {
        // Search filter (searches in name, email, phone)
        const matchesSearch = !SEARCH_TERM || 
            visitor.name.toLowerCase().includes(SEARCH_TERM.toLowerCase()) ||
            visitor.email.toLowerCase().includes(SEARCH_TERM.toLowerCase()) ||
            visitor.phone.toLowerCase().includes(SEARCH_TERM.toLowerCase());
        
        // Advanced filters
        const matchesAdvancedFilters = checkAdvancedFilters(visitor);
        
        return matchesSearch && matchesAdvancedFilters;
    });
    
    console.log(`Found ${filtered.length}/${ALL_VISITORS.length} visitors`);
    
    // Check if filters are active
    const hasActiveFilters = SEARCH_TERM || ACTIVE_FILTERS.length > 0;
    
    // Update filter badge (NOT main stats)
    updateFilterResultsBadge(filtered.length, hasActiveFilters);
    
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const firstPage = filtered.slice(0, PAGE_SIZE);
    
    renderVisitorTable(firstPage);
    renderPagination(1, totalPages, filtered.length);
    
    window.FILTERED_VISITORS = filtered;
    CURRENT_PAGE = 1;
    
    return filtered;
}

// Check advanced filters for a visitor
function checkAdvancedFilters(visitor) {
    if (!ACTIVE_FILTERS || ACTIVE_FILTERS.length === 0) return true;
    
    let result = true;
    let currentConnector = 'AND';
    
    for (let i = 0; i < ACTIVE_FILTERS.length; i++) {
        const filter = ACTIVE_FILTERS[i];
        let filterMatch = false;
        
        if (filter.type === 'condition') {
            const fieldValue = getVisitorFieldValue(visitor, filter.field);
            filterMatch = evaluateCondition(fieldValue, filter.operator, filter.value, filter.field);
        } else if (filter.type === 'group') {
            // Evaluate group conditions
            let groupResult = true;
            let groupConnector = 'AND';
            
            for (let j = 0; j < filter.conditions.length; j++) {
                const condition = filter.conditions[j];
                const fieldValue = getVisitorFieldValue(visitor, condition.field);
                const conditionMatch = evaluateCondition(fieldValue, condition.operator, condition.value, condition.field);
                
                if (j === 0) {
                    groupResult = conditionMatch;
                } else {
                    if (groupConnector === 'AND') {
                        groupResult = groupResult && conditionMatch;
                    } else { // OR
                        groupResult = groupResult || conditionMatch;
                    }
                }
                
                if (j < filter.conditions.length - 1) {
                    groupConnector = filter.conditions[j + 1].connector || 'AND';
                }
            }
            
            filterMatch = groupResult;
        }
        
        // Apply connector logic
        if (i === 0) {
            result = filterMatch;
        } else {
            if (currentConnector === 'AND') {
                result = result && filterMatch;
            } else { // OR
                result = result || filterMatch;
            }
        }
        
        // Update connector for next iteration
        if (i < ACTIVE_FILTERS.length - 1) {
            currentConnector = ACTIVE_FILTERS[i + 1].connector || 'AND';
        }
    }
    
    return result;
}

// Get field value from visitor with support for new field key format
function getVisitorFieldValue(visitor, fieldKey) {
    let value;
    if (fieldKey.startsWith('customFields.')) {
        const customFieldName = fieldKey.replace('customFields.', '');
        value = visitor.customFields?.[customFieldName];
        console.log(`🔍 DEBUG: Field "${customFieldName}" = "${value}" (from customFields)`);
        
        // Debug: Show all available custom fields
        if (!value) {
            console.log(`🔍 DEBUG: Available custom fields:`, Object.keys(visitor.customFields || {}));
            console.log(`🔍 DEBUG: Full visitor object:`, visitor);
        }
    } else if (fieldKey.startsWith('custom_')) {
        // Legacy support for old custom field format
        const customFieldName = fieldKey.replace('custom_', '');
        value = visitor.customFields?.[customFieldName];
        console.log(`🔍 DEBUG: Legacy field "${customFieldName}" = "${value}"`);
    } else if (fieldKey.startsWith('raw.')) {
        const rawFieldName = fieldKey.replace('raw.', '');
        value = visitor.raw?.[rawFieldName];
        console.log(`🔍 DEBUG: Raw field "${rawFieldName}" = "${value}"`);
    } else {
        value = visitor[fieldKey];
        console.log(`🔍 DEBUG: Standard field "${fieldKey}" = "${value}"`);
    }
    return value;
}

// Helper function for date filtering
function matchesDateFilter(visitor, dateFilter) {
    if (!visitor.raw?.Added_Time) return true;
    
    const visitorDate = new Date(visitor.raw.Added_Time);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    switch (dateFilter) {
        case 'today':
            return visitorDate.toDateString() === today.toDateString();
        case 'yesterday':
            return visitorDate.toDateString() === yesterday.toDateString();
        case 'this-week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return visitorDate >= weekStart;
        default:
            return true;
    }
}

// Load tenant stats from custom API (NOT from Redis backend)
async function loadTenantStats(userEmail) {
    try {
        console.log('📊 Loading tenant stats from custom API...');
        const response = await ZOHO.CREATOR.DATA.invokeCustomApi({
            api_name: `getTenantInfo?publickey=nsHzZV3d8gB6SnSYFDBvZA2OU&tenant_email=${encodeURIComponent(userEmail)}`,
            workspace_name: "tsxcorp",
            http_method: "GET"
        });
        
        if (response.code === 3000 && response.result?.tenant?.events?.length > 0) {
            const event = response.result.tenant.events[0]; // Current event
            
            const totalElement = document.getElementById('totalVisitors');
            const checkedInElement = document.getElementById('checkedIn');
            const individualElement = document.getElementById('individualCount');
            const groupElement = document.getElementById('groupCount');
            const groupQuantityElement = document.getElementById('groupQuantity');
            
            // Use custom API data for main stats
            if (totalElement) totalElement.textContent = event.total_registrations || 0;
            if (checkedInElement) checkedInElement.textContent = event.checked_in || 0;
            if (individualElement) individualElement.textContent = event.individual_registrations || 0;
            if (groupElement) groupElement.textContent = event.group_registrations || 0;
            if (groupQuantityElement) groupQuantityElement.textContent = event.group_quantity || 0;
            
            console.log('✅ Custom API stats loaded:', {
                total: event.total_registrations,
                checkedIn: event.checked_in,
                individual: event.individual_registrations,
                group: event.group_registrations,
                groupQuantity: event.group_quantity
            });
            
            return event;
        } else {
            throw new Error('No events found in custom API data');
        }
    } catch (error) {
        console.error('❌ Failed to load tenant stats:', error);
        
        // Fallback to counting from loaded visitors
        updateStatsFromLocalData();
        return null;
    }
}

// Fallback: Update stats from local data (when API fails)
function updateStatsFromLocalData() {
    const totalElement = document.getElementById('totalVisitors');
    const checkedInElement = document.getElementById('checkedIn');
    const individualElement = document.getElementById('individualCount');
    const groupElement = document.getElementById('groupCount');
    const groupQuantityElement = document.getElementById('groupQuantity');
    
    const checkedInCount = ALL_VISITORS.filter(v => v.checked_in).length;
    const individualCount = ALL_VISITORS.filter(v => !v.group_registration).length;
    const groupCount = ALL_VISITORS.filter(v => v.group_registration).length;
    
    // Calculate unique groups (fallback - estimate from group registrations)
    const groupQuantity = groupCount > 0 ? Math.ceil(groupCount / 3) : 0; // Estimate: avg 3 people per group
    
    if (totalElement) totalElement.textContent = ALL_VISITORS.length;
    if (checkedInElement) checkedInElement.textContent = checkedInCount;
    if (individualElement) individualElement.textContent = individualCount;
    if (groupElement) groupElement.textContent = groupCount;
    if (groupQuantityElement) groupQuantityElement.textContent = groupQuantity;
    
    console.log('⚠️ Using fallback stats from local data (group quantity estimated)');
}

// Show filter results badge (separate from main stats)
function updateFilterResultsBadge(filteredCount, hasActiveFilters) {
    const badge = document.getElementById('filterResultsBadge');
    const countElement = document.getElementById('filterResultsCount');
    
    if (hasActiveFilters && filteredCount !== ALL_VISITORS.length) {
        if (countElement) countElement.textContent = filteredCount;
        if (badge) {
            badge.style.display = 'flex';
        }
        console.log(`🔍 Filter badge: ${filteredCount} results`);
        } else {
        if (badge) {
            badge.style.display = 'none';
        }
    }
}

// ===== 4. SMOOTH PAGINATION (NO API CALLS) =====
function displayPage(pageNumber) {
    const filtered = window.FILTERED_VISITORS || ALL_VISITORS;
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    
    if (pageNumber < 1 || pageNumber > totalPages) {
        return;
    }
    
    const startIndex = (pageNumber - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pageData = filtered.slice(startIndex, endIndex);
    
    renderVisitorTable(pageData);
    renderPagination(pageNumber, totalPages, filtered.length);
    
    CURRENT_PAGE = pageNumber;
    console.log(`Page ${pageNumber}/${totalPages}: ${pageData.length} visitors`);
}

// ===== 5. SIMPLE UI FUNCTIONS =====
function showEventInfo(event) {
    const eventName = document.getElementById('eventName');
    
    // Only update event name - stats are handled by loadTenantStats()
    if (eventName) eventName.textContent = event.name;
    
    console.log('📋 Event info updated (name only, stats from tenant API)');
}

function renderVisitorTable(visitors) {
    console.log('🎨 Rendering visitor table with', visitors.length, 'visitors');
    const tbody = document.querySelector('#visitorTable tbody');
    if (!tbody) {
        console.error('❌ Visitor table tbody not found!');
        return;
    }
    
    tbody.innerHTML = visitors.map((visitor, index) => `
        <tr>
                            <td><input type="checkbox" name="visitorSelect" value="${visitor.id}" onchange="toggleVisitorSelect('${visitor.id}')"></td>
            <td>${visitor.name}</td>
            <td>${visitor.email}</td>
            <td>${visitor.phone}</td>
            <td>
                <span class="status-badge ${visitor.checked_in ? 'status-checked-in' : 'status-not-checked-in'}">
                    ${visitor.checked_in ? 'Checked In' : 'Not Yet'}
                </span>
            </td>
            <td>${visitor.group_registration ? 'Group' : 'Individual'}</td>
                                <td>${visitor.added_time ? formatDate(visitor.added_time) : 'N/A'}</td>
            <td>
                <button class="btn btn-secondary" onclick="viewVisitorDetails('${visitor.id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    // Update checkbox states and selection UI
    updateVisitorCheckboxes();
    updateSelectAllState();
    updateSelectionBadge();
    
    console.log('✅ Table rendered successfully');
}

function renderPagination(currentPage, totalPages, totalRecords) {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    let html = '';
    
    if (totalPages > 1) {
        // Previous button
        if (currentPage > 1) {
            html += `<button class="pagination-btn" onclick="displayPage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>`;
        }
        
        // Page numbers
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            const active = i === currentPage ? 'active' : '';
            html += `<button class="pagination-btn ${active}" onclick="displayPage(${i})">${i}</button>`;
        }
        
        // Next button
        if (currentPage < totalPages) {
            html += `<button class="pagination-btn" onclick="displayPage(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>`;
        }
    }
    
    // Add info
    html += `<div class="pagination-info">
        Showing ${((currentPage - 1) * PAGE_SIZE) + 1}-${Math.min(currentPage * PAGE_SIZE, totalRecords)} of ${totalRecords} visitors
    </div>`;
    
    container.innerHTML = html;
}

// Old function removed - replaced with modern filter system

// ===== EXHIBITOR FUNCTIONS =====
function setupExhibitorSearch() {
    const searchInput = document.getElementById('exhibitorSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            EXHIBITOR_SEARCH_TERM = e.target.value.trim();
            performExhibitorSearch();
        });
    }
    
    const statusFilter = document.getElementById('exhibitorStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            EXHIBITOR_STATUS_FILTER = e.target.value;
            performExhibitorSearch();
        });
    }
    
    const clearButton = document.getElementById('clearExhibitorSearch');
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            EXHIBITOR_SEARCH_TERM = '';
            EXHIBITOR_STATUS_FILTER = '';
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = '';
            performExhibitorSearch();
        });
    }
}

// ===== EXHIBITOR DATA LOADING WITH CACHE =====
async function loadExhibitorData(eventId) {
    console.log('🏢 Loading exhibitor data for event:', eventId);
    
    // Check cache first
    const cachedData = loadExhibitorCache(eventId);
    if (cachedData && cachedData.exhibitors && cachedData.exhibitors.length > 0) {
        console.log(`📦 Using cached exhibitor data: ${cachedData.exhibitors.length} exhibitors`);
        
        ALL_EXHIBITORS = cachedData.exhibitors;
        ALL_EXHIBITOR_PROFILES = cachedData.exhibitorProfiles || [];
        
        // Update UI
        updateExhibitorStats();
        performExhibitorSearch();
        
        console.log(`⚡ Exhibitor data loaded from cache instantly`);
        return;
    }
    
    try {
        // Load fresh data from API
        console.log('📦 Loading fresh exhibitor company data from API...');
        const exhibitorResponse = await ZOHO.CREATOR.DATA.getRecords({
            app_name: 'nxp',
            report_name: 'Exhibitors',
            criteria: `Event_Info == ${eventId}`,
            max_records: 1000,
            field_config: 'all'
        });
        
        if (exhibitorResponse.code === 3000 && exhibitorResponse.data) {
            console.log('🔍 Debug: Sample exhibitor record from Exhibitors report:', exhibitorResponse.data[0]);
            
            ALL_EXHIBITORS = exhibitorResponse.data.map(record => ({
                id: record.ID,
                company_name_en: record.Company_Name_En || 'N/A',
                company_name_vi: record.Company_Name_Vi || 'N/A', 
                booth_no: record.Booth_No1 || 'N/A',
                representative_name: record.Representative_Name || 'N/A',
                representative_email: record.representative_email || 'N/A',
                booth_area: record.Booth_Area || 0,
                employees_count: record.Employees?.length || 0,
                products_count: record.Products?.length || 0,
                raw: record
            }));
            
            console.log(`✅ Loaded ${ALL_EXHIBITORS.length} exhibitor companies from API`);
            
            // Update exhibitor stats
            updateExhibitorStats();
            
            // Initialize exhibitor display
            performExhibitorSearch();
            
            // Cache the fresh data
            saveExhibitorCache(eventId, ALL_EXHIBITORS, [], {
                total_exhibitors: ALL_EXHIBITORS.length,
                total_booths: ALL_EXHIBITORS.filter(e => e.booth_no !== 'N/A').length,
                total_staff: ALL_EXHIBITORS.reduce((sum, e) => sum + e.employees_count, 0),
                total_products: ALL_EXHIBITORS.reduce((sum, e) => sum + e.products_count, 0)
            });
        }
    } catch (error) {
        console.error('❌ Error loading exhibitor data:', error);
        
        // Check if it's a permission error
        if (error.status === 403 || (error.responseText && error.responseText.includes('Permission denied'))) {
            console.warn('⚠️ No exhibitor access permission - hiding exhibitor section');
            
            // Hide exhibitor section from UI
            const exhibitorSection = document.querySelector('.management-section:last-child');
            if (exhibitorSection) {
                exhibitorSection.style.display = 'none';
                console.log('✅ Exhibitor section hidden due to permissions');
            }
            
            // Initialize empty arrays to prevent errors
            ALL_EXHIBITORS = [];
            FILTERED_EXHIBITORS = [];
            
            return; // Exit gracefully
        }
        
        // For other errors, still hide the section but log for debugging
        console.warn('⚠️ Exhibitor data unavailable - hiding section');
        const exhibitorSection = document.querySelector('.management-section:last-child');
        if (exhibitorSection) {
            exhibitorSection.style.display = 'none';
        }
        ALL_EXHIBITORS = [];
        FILTERED_EXHIBITORS = [];
    }
}

// Load detailed exhibitor profile for modal
async function loadExhibitorProfile(exhibitorId) {
    console.log('📋 Loading detailed exhibitor profile:', exhibitorId);
    
    try {
        const response = await ZOHO.CREATOR.DATA.getRecords({
            app_name: 'nxp',
            report_name: 'Exhibitor_Profiles', 
            criteria: `exhibitor_company == ${exhibitorId}`,
            max_records: 1,
            field_config: 'all'
        });
        
        if (response.code === 3000 && response.data && response.data.length > 0) {
            const record = response.data[0];
            return {
                id: record.ID,
                display_name: record.Display_Name || 'N/A',
                country: record.Country || 'N/A',
                eng_address: record.eng_address || 'N/A',
                vie_address: record.vie_address || 'N/A',
                tel: record.Tel || 'N/A',
                mobile: record.Mobile || 'N/A',
                fax: record.Fax || 'N/A',
                email: record.Email || 'N/A',
                website: record.Website || 'N/A',
                zip_code: record.Zip_code || 'N/A',
                eng_display_products: record.eng_display_products || 'N/A',
                vie_display_products: record.vie_display_products || 'N/A',
                eng_company_description: record.eng_company_description || 'N/A',
                vie_company_description: record.Company_introduction_in_Vietnamese || 'N/A',
                company_logo: record.Company_logo || null,
                cover_image: record.Cover_Image || null,
                introduction_video: record.introduction_video || null,
                company_products: record.Company_products || [],
                company_representative: record.Company_representative || 'N/A',
                position: record.Position || 'N/A',
                badge_quantity: record.Badge_quantity || 0,
                raw: record
            };
        }
        return null;
    } catch (error) {
        console.error('❌ Error loading exhibitor profile:', error);
        return null;
    }
}

// Update exhibitor stats display
function updateExhibitorStats() {
    const totalElement = document.getElementById('totalExhibitors');
    const boothsElement = document.getElementById('boothsOccupied');
    const staffElement = document.getElementById('exhibitorStaff');
    const productsElement = document.getElementById('totalProducts');
    
    if (totalElement) totalElement.textContent = ALL_EXHIBITORS.length;
    if (boothsElement) boothsElement.textContent = ALL_EXHIBITORS.filter(e => e.booth_no !== 'N/A').length;
    if (staffElement) staffElement.textContent = ALL_EXHIBITORS.reduce((sum, e) => sum + e.employees_count, 0);
    if (productsElement) productsElement.textContent = ALL_EXHIBITORS.reduce((sum, e) => sum + e.products_count, 0);
}

function performExhibitorSearch() {
    console.log('🔍 Exhibitor search:', { 
        EXHIBITOR_SEARCH_TERM, 
        ACTIVE_EXHIBITOR_FILTERS: ACTIVE_EXHIBITOR_FILTERS.length 
    });
    
    FILTERED_EXHIBITORS = ALL_EXHIBITORS.filter(exhibitor => {
        // Basic search functionality
        const matchesSearch = !EXHIBITOR_SEARCH_TERM || 
            exhibitor.company_name_en.toLowerCase().includes(EXHIBITOR_SEARCH_TERM.toLowerCase()) ||
            exhibitor.company_name_vi.toLowerCase().includes(EXHIBITOR_SEARCH_TERM.toLowerCase()) ||
            exhibitor.booth_no.toLowerCase().includes(EXHIBITOR_SEARCH_TERM.toLowerCase()) ||
            exhibitor.representative_name.toLowerCase().includes(EXHIBITOR_SEARCH_TERM.toLowerCase()) ||
            exhibitor.representative_email.toLowerCase().includes(EXHIBITOR_SEARCH_TERM.toLowerCase());
        
        // Advanced filters
        const matchesAdvancedFilters = checkExhibitorAdvancedFilters(exhibitor);
        
        return matchesSearch && matchesAdvancedFilters;
    });
    
    console.log(`Found ${FILTERED_EXHIBITORS.length}/${ALL_EXHIBITORS.length} exhibitors`);
    
    // Check if filters are active
    const hasActiveFilters = EXHIBITOR_SEARCH_TERM || ACTIVE_EXHIBITOR_FILTERS.length > 0;
    
    // Update filter results badge
    updateExhibitorFilterResultsBadge(FILTERED_EXHIBITORS.length, hasActiveFilters);
    
    CURRENT_EXHIBITOR_PAGE = 1;
    displayExhibitorPage(1);
}

function displayExhibitorPage(page) {
    CURRENT_EXHIBITOR_PAGE = page;
    const startIndex = (page - 1) * EXHIBITOR_PAGE_SIZE;
    const endIndex = startIndex + EXHIBITOR_PAGE_SIZE;
    const pageData = FILTERED_EXHIBITORS.slice(startIndex, endIndex);
    
    renderExhibitorTable(pageData);
    renderExhibitorPagination(page, Math.ceil(FILTERED_EXHIBITORS.length / EXHIBITOR_PAGE_SIZE), FILTERED_EXHIBITORS.length);
    updateExhibitorCheckboxes();
    updateExhibitorSelectAllState();
    
    console.log(`Page ${page}/${Math.ceil(FILTERED_EXHIBITORS.length / EXHIBITOR_PAGE_SIZE)}: ${pageData.length} exhibitors`);
}

function renderExhibitorTable(exhibitors) {
    const tbody = document.querySelector('#exhibitorTable tbody');
    if (!tbody) return;
    
    console.log('🎨 Rendering exhibitor table with', exhibitors.length, 'exhibitors');
    
    tbody.innerHTML = exhibitors.map(exhibitor => `
        <tr>
            <td><input type="checkbox" value="${exhibitor.id}" name="exhibitorSelect" onchange="toggleExhibitorSelect('${exhibitor.id}')"></td>
            <td>
                <div class="company-info">
                    <div class="company-name">${exhibitor.company_name_en}</div>
                    ${exhibitor.company_name_vi !== 'N/A' ? `<div class="company-name-vi">${exhibitor.company_name_vi}</div>` : ''}
                </div>
            </td>
            <td><span class="booth-number">${exhibitor.booth_no}</span></td>
            <td>${exhibitor.representative_name}</td>
            <td>${exhibitor.representative_email}</td>
            <td>N/A</td>
            <td>
                <span class="product-count">${exhibitor.products_count} products</span>
            </td>
            <td>
                <button class="btn btn-secondary" onclick="viewExhibitorDetails('${exhibitor.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderExhibitorPagination(currentPage, totalPages, totalRecords) {
    const container = document.getElementById('exhibitorPagination');
    if (!container) return;
    
    let html = '';
    
    if (totalPages > 1) {
    // Previous button
        if (currentPage > 1) {
            html += `<button class="pagination-btn" onclick="displayExhibitorPage(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
            </button>`;
        }
    
    // Page numbers
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            const active = i === currentPage ? 'active' : '';
            html += `<button class="pagination-btn ${active}" onclick="displayExhibitorPage(${i})">${i}</button>`;
        }
        
        // Next button
        if (currentPage < totalPages) {
            html += `<button class="pagination-btn" onclick="displayExhibitorPage(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>`;
        }
    }
    
    html += `<div class="pagination-info">
        Showing exhibitors: ${totalRecords} total
    </div>`;
    
    container.innerHTML = html;
}

// ===== EXHIBITOR SELECTION MANAGEMENT =====
function toggleExhibitorSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllExhibitorsCheckbox');
    if (!selectAllCheckbox) return;
    
    const isChecked = selectAllCheckbox.checked;
    const currentPageExhibitors = getCurrentPageExhibitors();
    
    if (isChecked) {
        currentPageExhibitors.forEach(exhibitor => SELECTED_EXHIBITOR_IDS.add(exhibitor.id));
    } else {
        currentPageExhibitors.forEach(exhibitor => SELECTED_EXHIBITOR_IDS.delete(exhibitor.id));
    }
    
    updateExhibitorCheckboxes();
    updateExhibitorSelectionBadge();
    console.log('🗂️ Exhibitor select all toggled:', isChecked, 'Total selected:', SELECTED_EXHIBITOR_IDS.size);
}

function toggleExhibitorSelect(exhibitorId) {
    if (SELECTED_EXHIBITOR_IDS.has(exhibitorId)) {
        SELECTED_EXHIBITOR_IDS.delete(exhibitorId);
    } else {
        SELECTED_EXHIBITOR_IDS.add(exhibitorId);
    }
    
    updateExhibitorSelectAllState();
    updateExhibitorSelectionBadge();
    console.log('🔘 Exhibitor selection toggled:', exhibitorId, 'Total selected:', SELECTED_EXHIBITOR_IDS.size);
}

function updateExhibitorCheckboxes() {
    const checkboxes = document.querySelectorAll('input[name="exhibitorSelect"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = SELECTED_EXHIBITOR_IDS.has(checkbox.value);
    });
}

function updateExhibitorSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAllExhibitorsCheckbox');
    if (!selectAllCheckbox) return;
    
    const currentPageExhibitors = getCurrentPageExhibitors();
    const selectedOnPage = currentPageExhibitors.filter(exhibitor => SELECTED_EXHIBITOR_IDS.has(exhibitor.id));
    
    if (selectedOnPage.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedOnPage.length === currentPageExhibitors.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
            } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

function updateExhibitorSelectionBadge() {
    const badge = document.getElementById('exhibitorSelectionBadge');
    const countSpan = document.getElementById('exhibitorSelectionCount');
    if (!badge || !countSpan) return;
    
    const count = SELECTED_EXHIBITOR_IDS.size;
    
    if (count > 0) {
        badge.style.display = 'inline-flex';
        countSpan.textContent = count;
    } else {
        badge.style.display = 'none';
    }
}

function clearExhibitorSelection() {
    SELECTED_EXHIBITOR_IDS.clear();
    updateExhibitorCheckboxes();
    updateExhibitorSelectionBadge();
    updateExhibitorSelectAllState();
    console.log('🗑️ All exhibitor selections cleared');
}

function getCurrentPageExhibitors() {
    const startIndex = (CURRENT_EXHIBITOR_PAGE - 1) * EXHIBITOR_PAGE_SIZE;
    const endIndex = startIndex + EXHIBITOR_PAGE_SIZE;
    return FILTERED_EXHIBITORS.slice(startIndex, endIndex);
}

// ===== EXHIBITOR DETAIL MODAL =====
async function viewExhibitorDetails(exhibitorId) {
    console.log('🏢 View exhibitor details:', exhibitorId);
    
    // Find exhibitor quick data
    const exhibitor = ALL_EXHIBITORS.find(e => e.id === exhibitorId);
    if (!exhibitor) {
        console.error('❌ Exhibitor not found:', exhibitorId);
        return;
    }
    
    console.log('✅ Found exhibitor:', exhibitor);
    
    // Load detailed profile data
    showLoading(true);
    const profileData = await loadExhibitorProfile(exhibitorId);
    showLoading(false);
    
    if (profileData) {
        populateExhibitorModal(exhibitor, profileData);
    } else {
        // Show basic info only if profile not found
        populateExhibitorModal(exhibitor, null);
    }
    
    showExhibitorModal();
}

function populateExhibitorModal(exhibitor, profile) {
    console.log('🏢 Populating exhibitor modal with data:', exhibitor, profile);
    
    // Basic header info
    const companyNameEl = document.getElementById('exhibitorCompanyName');
    const boothNumberEl = document.getElementById('exhibitorBoothNumber');
    
    if (companyNameEl) companyNameEl.textContent = exhibitor.company_name_en || 'N/A';
    if (boothNumberEl) boothNumberEl.textContent = `Booth: ${exhibitor.booth_no}`;
    
    // Handle company logo using Zoho's setImageData API
    const logoImg = document.getElementById('exhibitorLogo');
    const logoPlaceholder = document.getElementById('exhibitorLogoPlaceholder');
    
    if (profile && profile.company_logo) {
        // Use Zoho's setImageData API for logo
        const logoUrl = `api/v2/nxp/Exhibitor_Profiles/view/All_Exhibitor_Profiles/${profile.id}/Company_logo/download`;
        
        try {
            ZOHO.CREATOR.UTIL.setImageData(logoImg, logoUrl, () => {
                logoImg.style.display = 'block';
                logoPlaceholder.style.display = 'none';
            });
        } catch (error) {
            console.warn('Failed to load company logo:', error);
            logoImg.style.display = 'none';
            logoPlaceholder.style.display = 'flex';
        }
    } else {
        logoImg.style.display = 'none';
        logoPlaceholder.style.display = 'flex';
    }
    
    // Company Information section
    const companyInfo = document.getElementById('exhibitorCompanyInfo');
    if (companyInfo) {
        const companyFields = [
            { label: 'Company Name (English)', value: exhibitor.company_name_en },
            { label: 'Company Name (Vietnamese)', value: exhibitor.company_name_vi },
            { label: 'Display Name', value: profile?.display_name || 'N/A' },
            { label: 'Country', value: profile?.country || 'N/A' },
            { label: 'English Address', value: profile?.eng_address || 'N/A' },
            { label: 'Vietnamese Address', value: profile?.vie_address || 'N/A' },
            { label: 'Zip Code', value: profile?.zip_code || 'N/A' },
            { label: 'Website', value: profile?.website || 'N/A' }
        ];
        
        companyInfo.innerHTML = companyFields.map(field => 
            field.value !== 'N/A' ? `<div class="info-item">
                <div class="info-label">${field.label}:</div>
                <div class="info-value">${field.value}</div>
            </div>` : ''
        ).join('');
    }
    
    // Contact Information section
    const contactInfo = document.getElementById('exhibitorContactInfo');
    if (contactInfo) {
        const contactFields = [
            { label: 'Representative', value: exhibitor.representative_name },
            { label: 'Email', value: exhibitor.representative_email },
            { label: 'Telephone', value: profile?.tel || 'N/A' },
            { label: 'Mobile', value: profile?.mobile || 'N/A' },
            { label: 'Fax', value: profile?.fax || 'N/A' },
            { label: 'Position', value: profile?.position || 'N/A' }
        ];
        
        contactInfo.innerHTML = contactFields.map(field => 
            field.value !== 'N/A' ? `<div class="info-item">
                <div class="info-label">${field.label}:</div>
                <div class="info-value">${field.value}</div>
            </div>` : ''
        ).join('');
    }
    
    // Products & Services section
    const productsInfo = document.getElementById('exhibitorProductsInfo');
    if (productsInfo) {
        const productFields = [
            { label: 'Products (English)', value: profile?.eng_display_products || 'N/A' },
            { label: 'Products (Vietnamese)', value: profile?.vie_display_products || 'N/A' },
            { label: 'Company Description (English)', value: profile?.eng_company_description || 'N/A' },
            { label: 'Company Description (Vietnamese)', value: profile?.vie_company_description || 'N/A' },
            { label: 'Total Products', value: exhibitor.products_count + ' items' },
            { label: 'Booth Area', value: exhibitor.booth_area + ' m²' }
        ];
        
        productsInfo.innerHTML = productFields.map(field => 
            field.value !== 'N/A' ? `<div class="info-item">
                <div class="info-label">${field.label}:</div>
                <div class="info-value">${field.value}</div>
            </div>` : ''
        ).join('');
    }
    
    // Staff Members section
    const staffList = document.getElementById('exhibitorStaffList');
    if (staffList) {
        if (exhibitor.raw.Employees && exhibitor.raw.Employees.length > 0) {
            staffList.innerHTML = exhibitor.raw.Employees.map(employee => `
                <div class="staff-item">
                    <div class="staff-info">
                        <h5>${employee.Full_Name || 'N/A'}</h5>
                        <p>${employee.Email || 'N/A'} | ${employee.Phone_Number || 'N/A'}</p>
                    </div>
                    <div class="staff-badge">Staff</div>
                </div>
            `).join('');
    } else {
            staffList.innerHTML = '<div class="info-item"><div class="info-value">No staff information available</div></div>';
        }
    }
}

function showExhibitorModal() {
    const modal = document.getElementById('exhibitorModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        console.log('👁️ Exhibitor modal opened');
    }
}

function closeExhibitorModal() {
    const modal = document.getElementById('exhibitorModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        console.log('❌ Exhibitor modal closed');
    }
}

// ===== VISITOR DETAIL MODAL =====
function viewVisitorDetails(visitorId) {
    console.log('👁️ View visitor details:', visitorId);
    
    // Find visitor data
    const visitor = ALL_VISITORS.find(v => v.id === visitorId);
    if (!visitor) {
        console.error('❌ Visitor not found:', visitorId);
        return;
    }
    
    console.log('✅ Found visitor:', visitor);
    
    // Populate modal with visitor data
    populateVisitorModal(visitor);
    
    // Show modal
    showVisitorModal();
}

function populateVisitorModal(visitor) {
    const detailsContainer = document.getElementById('visitorDetails');
    if (!detailsContainer) return;
    
    const raw = visitor.raw || {};
    const customFields = visitor.customFields || {};
    
    console.log('🔍 Populating modal for visitor:', visitor.name);
    console.log('🔍 Raw data keys:', Object.keys(raw));
    console.log('🔍 Custom fields:', customFields);
    console.log('🔍 Custom fields type:', typeof customFields);
    console.log('🔍 Custom fields keys:', Object.keys(customFields));
    console.log('🔍 Custom fields entries:', Object.entries(customFields));
    
    // Format registration date (use same logic as table)
    const regDate = visitor.added_time ? formatDate(visitor.added_time) : 'N/A';
    
    // === SECTION 1: BASIC INFORMATION ===
    const basicInfo = [
        { label: 'Full Name', value: (visitor.salutation ? visitor.salutation + ' ' : '') + visitor.name, highlighted: true },
        { label: 'Email Address', value: visitor.email || 'N/A' },
        { label: 'Phone Number', value: visitor.phone || 'N/A' },
        { label: 'Redeem ID', value: visitor.redeem_id || 'N/A' }
    ];
    
    // === SECTION 2: STATUS & REGISTRATION ===
    const statusInfo = [
        { 
            label: 'Check-in Status', 
            value: `<div class="status">
                <span class="status-indicator ${visitor.checked_in ? 'checked-in' : 'not-checked-in'}"></span>
                ${visitor.checked_in ? 'Checked In' : 'Not Yet'}
            </div>`,
            isStatus: true,
            highlighted: visitor.checked_in
        },
        { label: 'Registration Type', value: visitor.group_registration ? 'Group Registration' : 'Individual' },
        { label: 'Registration Date', value: regDate }
    ];
    
    // === SECTION 3: PROFESSIONAL INFORMATION ===
    const professionalInfo = [];
    const customFieldsInfo = [];
    
    if (Object.keys(customFields).length > 0) {
        console.log('📋 Processing custom fields');
        
        // Get current event ID for field metadata lookup
        const currentEventId = CURRENT_EVENT?.id;
        
        // Categorize custom fields
        const professionalFields = ['Job Title', 'Company', 'Industry'];
        const otherFields = [];
        
        Object.entries(customFields).forEach(([fieldId, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                // Handle different value types
                let displayValue = value;
                
                if (typeof value === 'boolean') {
                    displayValue = value ? 'Yes' : 'No';
                } else if (typeof value === 'string' && value.trim() === '') {
                    return; // Skip empty strings
                } else {
                    displayValue = String(value);
                }
                
                // Get field label from form fields mapping (fallback to fieldId)
                const fieldLabel = currentEventId ? getFieldLabel(currentEventId, fieldId) : fieldId;
                
                // Clean up label formatting if needed
                let label = fieldLabel;
                if (label.includes(':')) {
                    label = label.split(':')[0]; // Remove description part
                }
                
                const fieldData = {
                    label: label,
                    value: displayValue,
                    fieldId: fieldId, // Keep original field ID for reference
                    highlighted: professionalFields.includes(label)
                };
                
                if (professionalFields.includes(label)) {
                    professionalInfo.push(fieldData);
                } else {
                    otherFields.push(fieldData);
                }
            }
        });
        
        // Add remaining fields to customFieldsInfo
        customFieldsInfo.push(...otherFields);
    }
    
    // === GENERATE HTML ===
    let html = '';
    
    // Basic Information Section
    html += `
        <div class="info-section">
            <div class="section-title">Basic Information</div>
            <div class="info-grid-2col">
                ${basicInfo.map(item => `
                    <div class="info-item ${item.highlighted ? 'highlighted' : ''}">
                        <div class="info-label">${item.label}</div>
                        <div class="info-value ${item.isStatus ? 'status' : ''}">${item.value}</div>
            </div>
                `).join('')}
            </div>
            </div>
    `;
    
    // Status & Registration Section
    html += `
        <div class="info-section">
            <div class="section-title">Status & Registration</div>
            <div class="info-grid-2col">
                ${statusInfo.map(item => `
                    <div class="info-item ${item.highlighted ? 'highlighted' : ''}">
                        <div class="info-label">${item.label}</div>
                        <div class="info-value ${item.isStatus ? 'status' : ''}">${item.value}</div>
            </div>
                `).join('')}
            </div>
            </div>
    `;
    
    // Professional Information Section (if any)
    if (professionalInfo.length > 0) {
        html += `
            <div class="info-section">
                <div class="section-title">Professional Information</div>
                <div class="info-grid-2col">
                    ${professionalInfo.map(item => `
                        <div class="info-item ${item.highlighted ? 'highlighted' : ''}">
                            <div class="info-label">${item.label}</div>
                            <div class="info-value">${item.value}</div>
                        </div>
                    `).join('')}
                    </div>
            </div>
    `;
    }
    
    // Additional Information Section (if any)
    if (customFieldsInfo.length > 0) {
        html += `
            <div class="info-section">
                <div class="section-title">Additional Information</div>
                <div class="info-grid-1col">
                    ${customFieldsInfo.map(item => `
                        <div class="info-item">
                            <div class="info-label">${item.label}</div>
                            <div class="info-value">${item.value}</div>
                        </div>
                    `).join('')}
            </div>
        </div>
    `;
    }
    
    detailsContainer.innerHTML = html;
    
    const totalFields = basicInfo.length + statusInfo.length + professionalInfo.length + customFieldsInfo.length;
    console.log(`✅ Modal populated with ${totalFields} fields in organized sections`);
}

function showVisitorModal() {
    const modal = document.getElementById('visitorModal');
    if (modal) {
        modal.classList.add('show');
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        console.log('✅ Visitor modal shown');
    }
}

function closeVisitorModal() {
    const modal = document.getElementById('visitorModal');
    if (modal) {
        modal.classList.remove('show');
        // Restore body scroll
        document.body.style.overflow = '';
        console.log('✅ Visitor modal closed');
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('visitorModal');
    if (modal && event.target === modal) {
        closeVisitorModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeVisitorModal();
    }
});

function viewExhibitorDetails(exhibitorId) {
    console.log('View exhibitor details:', exhibitorId);
    // TODO: Implement exhibitor details modal
}

// ===== 6. HELPER FUNCTIONS =====
// Wait for ZOHO SDK to be fully loaded
function waitForZohoSDK(timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        function checkSDK() {
            if (typeof ZOHO !== 'undefined' && 
                ZOHO.CREATOR && 
                ZOHO.CREATOR.UTIL && 
                ZOHO.CREATOR.UTIL.getInitParams) {
                resolve();
                return;
            }
            
            if (Date.now() - startTime > timeout) {
                reject(new Error('ZOHO SDK failed to load within timeout'));
                return;
            }
            
            setTimeout(checkSDK, 100);
        }
        
        checkSDK();
    });
}

async function loadDashboardData(userEmail) {
    try {
        const response = await ZOHO.CREATOR.DATA.invokeCustomApi({
            api_name: `getTenantInfo?publickey=nsHzZV3d8gB6SnSYFDBvZA2OU&tenant_email=${encodeURIComponent(userEmail)}`,
            workspace_name: "tsxcorp",
            http_method: "GET"
        });
        
        if (response.code === 3000 && response.result) {
            return response.result;
        } else {
            throw new Error('API failed: ' + response.message);
        }
    } catch (error) {
        console.error('Dashboard API error:', error);
        return {
            tenant: {
                events: [{
                    id: "4433256000012557772",
                    name: "VIET NAM INTERNATIONAL LOGISTICS EXHIBITION 2025",
                    total_registrations: 3890,
                    checked_in: 462
                }]
            }
        };
    }
}

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function showLoading(show) {
    console.log(`🔄 Setting loading state: ${show}`);
    const loading = document.getElementById('loading');
    const dashboardContainer = document.getElementById('dashboardContainer');
    
    if (loading) {
        if (show) {
    loading.style.display = 'flex';
            loading.classList.remove('hidden');
            console.log('✅ Loading overlay shown with animation');
    } else {
            loading.classList.add('hidden');
            // Hide completely after transition (matches order.html behavior)
    setTimeout(() => {
                if (loading.classList.contains('hidden')) {
        loading.style.display = 'none';
                }
            }, 500);
            console.log('✅ Loading overlay hiding with transition');
        }
    } else {
        console.error('❌ Loading element not found!');
    }
    
    if (dashboardContainer) {
        dashboardContainer.style.display = show ? 'none' : 'block';
    }
}

// ===== PROGRESS BAR FUNCTIONS =====
function showProgressBar(show, text = 'Loading data...') {
    const progressContainer = document.getElementById('progressBarContainer');
    const progressTextEl = document.getElementById('progressText');
    const progressLabel = document.getElementById('progressLabel');
    
    if (progressContainer && progressTextEl) {
        if (show) {
            progressContainer.classList.add('show');
            progressTextEl.classList.add('show');
            if (progressLabel) progressLabel.textContent = text;
            console.log('📊 Progress bar shown:', text);
    } else {
            progressContainer.classList.remove('show');
            progressTextEl.classList.remove('show');
            console.log('📊 Progress bar hidden');
        }
    }
}

function updateProgressBar(percentage, text = '') {
    const progressBar = document.getElementById('progressBar');
    const progressLabel = document.getElementById('progressLabel');
    
    if (progressBar) {
        // Ensure percentage is between 0 and 100
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        progressBar.style.width = `${clampedPercentage}%`;
        
        if (text && progressLabel) {
            progressLabel.textContent = text;
        }
        
        console.log(`📊 Progress updated: ${clampedPercentage}%`, text);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
    console.error('Widget error:', message);
}

function showNoEventsWarning(userEmail) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🎪</div>
                <h3 style="color: #6366f1; margin-bottom: 16px;">No Events Available</h3>
                <p style="color: #64748b; margin-bottom: 20px;">
                    User <strong>${userEmail}</strong> doesn't have any events assigned yet.
                </p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0; color: #475569; font-size: 14px;">
                        <strong>Next steps:</strong><br>
                        • Contact your admin to get event access<br>
                        • Make sure you're logged in with the correct account<br>
                        • Check if events are published and active
                    </p>
                </div>
        </div>
        `;
        errorDiv.style.display = 'block';
        errorDiv.style.background = '#ffffff';
        errorDiv.style.color = '#1e293b';
        errorDiv.style.border = '1px solid #e2e8f0';
    }
    console.log('No events found for user:', userEmail);
}

// ===== 7. VISITOR CACHE SYSTEM =====
const VISITOR_CACHE_KEY = 'nxp_visitor_cache';
const EXHIBITOR_CACHE_KEY = 'nxp_exhibitor_cache';
const CACHE_VERSION = '1.0';
const CACHE_EXPIRY_HOURS = 0.5; // Cache expires after 30 minutes

// ===== 8. FORM FIELDS SYSTEM =====
let EVENT_FORM_FIELDS = {}; // Global storage for form fields mapping

// Fetch form fields for an event
async function fetchEventFormFields(eventId) {
    try {
        console.log('🔍 Fetching form fields for event:', eventId);
        
        const response = await ZOHO.CREATOR.DATA.getRecords({
            app_name: 'nxp',
            report_name: 'Custom_Fields',
            criteria: `Event_Info == ${eventId}`,
            max_records: 1000,
            field_config: 'all'
        });
        
        console.log('Form fields response:', response);
        
        if (response.code === 3000 && response.data) {
            // Create mapping: Field_ID -> {label, type, choices, etc}
            const fieldsMapping = {};
            
            response.data.forEach(field => {
                const fieldId = field.Field_ID;
                if (fieldId) {
                    fieldsMapping[fieldId] = {
                        id: fieldId,
                        label: field.Label || fieldId,
                        type: mapFormFieldTypeToFilterType(field.Type_field || 'Text'), // UI mapped type
                        formFieldType: field.Type_field || 'Text', // Original API type
                        placeholder: field.Placeholder || '',
                        helpText: field.Help_Text || '',
                        required: field.Required === true,
                        sectionId: field.Section_ID || '',
                        sectionName: field.Section_Name || '',
                        sort: field.Sort || 0,
                        choices: field.Type_field === 'Select' || field.Type_field === 'Multi Select' ? 
                                getFieldChoices(field) : null
                    };
                }
            });
            
            EVENT_FORM_FIELDS[eventId] = fieldsMapping;
            console.log(`✅ Loaded ${Object.keys(fieldsMapping).length} form fields for event ${eventId}`);
            return fieldsMapping;
        } else {
            console.warn('Failed to fetch form fields:', response);
            return {};
        }
    } catch (error) {
        console.error('Error fetching form fields:', error);
        return {};
    }
}

// Helper to extract choices from field data (if available)
function getFieldChoices(field) {
    console.log(`🔍 Extracting choices from field:`, field);
    
    // Extract choices from Custom_Fields report
    // Choices might be stored in field.Value as comma-separated string
    if (field.Value && typeof field.Value === 'string') {
        const choices = field.Value.split(',').map(choice => choice.trim()).filter(choice => choice);
        console.log(`✅ Parsed choices from Value field:`, choices);
        return choices;
    }
    
    // Or choices might be in field.Choices if it exists
    if (field.Choices && Array.isArray(field.Choices)) {
        console.log(`✅ Found choices array:`, field.Choices);
        return field.Choices;
    }
    
    console.log(`⚠️ No choices found in field data`);
    return null;
}

// Get field metadata by Field_ID
function getFieldMetadata(eventId, fieldId) {
    const fields = EVENT_FORM_FIELDS[eventId] || {};
    const metadata = fields[fieldId] || {
        id: fieldId,
        label: fieldId, // Fallback to field ID
        type: 'text', // UI mapped type
        formFieldType: 'Text', // Original API type
        choices: []
    };
    console.log(`🔍 getFieldMetadata for ${fieldId}:`, metadata);
    return metadata;
}

// Get field label by Field_ID
function getFieldLabel(eventId, fieldId) {
    const metadata = getFieldMetadata(eventId, fieldId);
    return metadata.label;
}

// Get field type by Field_ID
function getFieldType(eventId, fieldId) {
    const metadata = getFieldMetadata(eventId, fieldId);
    return metadata.type;
}

function saveVisitorCache(eventId, visitors, apiStats) {
    try {
        console.log('💾 Attempting to cache data...', {
            eventId: eventId,
            visitorCount: visitors.length,
            apiStats: apiStats
        });
        
        // Compress visitor data - only keep essential fields
        console.log('🔍 Debug: Sample visitor before compression:', visitors[0]);
        const compressedVisitors = visitors.map(visitor => ({
            id: visitor.id,
            name: visitor.name,
            email: visitor.email,
            phone: visitor.phone,
            checked_in: visitor.checked_in,
            group_registration: visitor.group_registration,
            redeem_id: visitor.redeem_id,
            salutation: visitor.salutation,
            added_time: visitor.added_time,
            // Store all custom fields (disable compression for advanced filtering)
            customFields: visitor.customFields || {}
        }));
        
        console.log('🔍 Debug: Sample visitor after compression:', compressedVisitors[0]);
        
        const cacheData = {
            version: CACHE_VERSION,
            eventId: eventId,
            timestamp: Date.now(),
            apiStats: apiStats,
            visitors: compressedVisitors,
            totalCount: visitors.length,
            compressed: true // Flag to indicate compressed data
        };
        
        const dataSize = new Blob([JSON.stringify(cacheData)]).size;
        console.log(`📦 Cache size: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Check if still too large (5MB limit)
        if (dataSize > 5 * 1024 * 1024) {
            console.log('⚠️ Cache too large, implementing further compression...');
            
            // Further compression: Remove custom fields entirely
            const ultraCompressedVisitors = compressedVisitors.map(visitor => ({
                id: visitor.id,
                name: visitor.name,
                email: visitor.email,
                phone: visitor.phone,
                checked_in: visitor.checked_in,
                group_registration: visitor.group_registration,
                added_time: visitor.added_time
            }));
            
            cacheData.visitors = ultraCompressedVisitors;
            cacheData.ultraCompressed = true;
            
            const newSize = new Blob([JSON.stringify(cacheData)]).size;
            console.log(`📦 Ultra-compressed size: ${(newSize / 1024 / 1024).toFixed(2)} MB`);
        }
        
        localStorage.setItem(VISITOR_CACHE_KEY, JSON.stringify(cacheData));
        console.log(`✅ Successfully cached ${visitors.length} visitors for event ${eventId}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to save visitor cache:', error);
        
        // If still fails, try to clear other localStorage items
        if (error.name === 'QuotaExceededError') {
            console.log('🧹 Attempting to clear localStorage space...');
            
            // Clear other potential large items
            const keys = Object.keys(localStorage);
            for (const key of keys) {
                if (key !== VISITOR_CACHE_KEY && key.includes('cache')) {
                    localStorage.removeItem(key);
                    console.log(`🗑️ Cleared ${key}`);
                }
            }
            
            // Try one more time with minimal data
            try {
                const minimalData = {
                    version: CACHE_VERSION,
                    eventId: eventId,
                    timestamp: Date.now(),
                    apiStats: apiStats,
                    totalCount: visitors.length,
                    visitorIds: visitors.map(v => v.id), // Only store IDs for selection state
                    minimal: true
                };
                
                localStorage.setItem(VISITOR_CACHE_KEY, JSON.stringify(minimalData));
                console.log(`✅ Saved minimal cache (${visitors.length} visitor IDs only)`);
                return true;
            } catch (retryError) {
                console.error('❌ Even minimal cache failed:', retryError);
                return false;
            }
        }
        return false;
    }
}

function loadVisitorCache(eventId) {
    try {
        console.log('🔍 Checking cache for event:', eventId);
        const cached = localStorage.getItem(VISITOR_CACHE_KEY);
        if (!cached) {
            console.log('📦 No visitor cache found');
            return null;
        }
        console.log('📦 Cache data found, parsing...');
        
        const cacheData = JSON.parse(cached);
        
        // Check version compatibility
        if (cacheData.version !== CACHE_VERSION) {
            console.log('🔄 Cache version mismatch, clearing old cache');
            clearVisitorCache();
            return null;
        }
        
        // Check if cache is for the same event
        if (cacheData.eventId !== eventId) {
            console.log('🔄 Different event, cache not applicable');
            return null;
        }
        
        // Check if cache is expired
        const ageHours = (Date.now() - cacheData.timestamp) / (1000 * 60 * 60);
        if (ageHours > CACHE_EXPIRY_HOURS) {
            console.log('⏰ Cache expired, clearing');
            clearVisitorCache();
            return null;
        }
        
        console.log(`✅ Loaded cached data: ${cacheData.totalCount} visitors (age: ${ageHours.toFixed(1)}h)`);
        return cacheData;
    } catch (error) {
        console.error('❌ Failed to load visitor cache:', error);
        clearVisitorCache();
        return null;
    }
}

function clearVisitorCache() {
    try {
        localStorage.removeItem(VISITOR_CACHE_KEY);
        console.log('🧹 Visitor cache cleared');
    } catch (error) {
        console.error('❌ Failed to clear cache:', error);
    }
}

function showCacheInfo(cacheData) {
    const ageHours = (Date.now() - cacheData.timestamp) / (1000 * 60 * 60);
    const ageText = ageHours < 1 ? 
        `${Math.round(ageHours * 60)} minutes ago` : 
        `${ageHours.toFixed(1)} hours ago`;
    
    let cacheType = '';
    if (cacheData.minimal) cacheType = ' (minimal)';
    else if (cacheData.ultraCompressed) cacheType = ' (ultra-compressed)';
    else if (cacheData.compressed) cacheType = ' (compressed)';
    
    // Show a subtle notification
    showProgressBar(true, `⚡ Instant load: ${cacheData.totalCount} visitors${cacheType} (cached ${ageText})`);
    
    setTimeout(() => {
        showProgressBar(false);
    }, 3000);
}

function compareWithCachedData(eventId, currentApiStats) {
    console.log('🔍 Comparing with cached data...');
    console.log('🔍 Event ID:', eventId);
    console.log('🔍 Current API Stats:', currentApiStats);
    
    const cached = loadVisitorCache(eventId);
    if (!cached) {
        console.log('❌ No cache found, forcing refresh');
        return { needsRefresh: true, reason: 'no_cache' };
    }
    
    console.log('✅ Cache found:', {
        eventId: cached.eventId,
        timestamp: new Date(cached.timestamp).toLocaleString(),
        apiStats: cached.apiStats,
        visitorCount: cached.totalCount,
        type: cached.minimal ? 'minimal' : cached.compressed ? 'compressed' : 'full'
    });
    
    // If minimal cache (only IDs), always refresh but use it for selection state
    if (cached.minimal) {
        console.log('⚡ Minimal cache found - will use for selection state but refresh data');
        return { 
            needsRefresh: true, 
            reason: 'minimal_cache',
            cached: cached
        };
    }
    
    // Compare total registrations - use both API stats and actual visitor count
    const cachedApiTotal = cached.apiStats?.total_registrations || 0;
    const cachedVisitorCount = cached.totalCount || cached.visitors?.length || 0;
    const currentTotal = currentApiStats?.total_registrations || 0;
    
    console.log(`🔍 Comparing totals: cachedAPI=${cachedApiTotal}, cachedVisitors=${cachedVisitorCount}, current=${currentTotal}`);
    
    // If cache has more visitors than current API says, something is wrong - full refresh
    if (cachedVisitorCount > currentTotal + 100) { // Allow some buffer for concurrent updates
        console.log(`⚠️ Cache corruption detected: cached=${cachedVisitorCount} > current=${currentTotal} + buffer`);
        return { 
            needsRefresh: true, 
            reason: 'cache_corruption',
            cachedCount: cachedVisitorCount,
            currentCount: currentTotal,
            cached: cached
        };
    }
    
    if (currentTotal !== cachedApiTotal) {
        console.log(`📊 Data changed: cachedAPI=${cachedApiTotal}, current=${currentTotal}`);
        return { 
            needsRefresh: true, 
            reason: 'data_changed',
            cachedCount: cachedApiTotal,
            currentCount: currentTotal,
            cached: cached
        };
    }
    
    // Compare checked-in count (visitors might check in)
    const cachedCheckedIn = cached.apiStats?.checked_in || 0;
    const currentCheckedIn = currentApiStats?.checked_in || 0;
    
    console.log(`🔍 Comparing check-ins: cached=${cachedCheckedIn}, current=${currentCheckedIn}`);
    
    if (currentCheckedIn !== cachedCheckedIn) {
        console.log(`📊 Check-in status changed: cached=${cachedCheckedIn}, current=${currentCheckedIn}`);
        return { 
            needsRefresh: true, 
            reason: 'checkin_changed',
            cached: cached
        };
    }
    
    console.log('✅ Cache is up-to-date, using cached data');
    return { 
        needsRefresh: false, 
        cached: cached 
    };
}

// ===== 7B. EXHIBITOR CACHE SYSTEM =====
function saveExhibitorCache(eventId, exhibitors, exhibitorProfiles, apiStats) {
    try {
        console.log('💾 Attempting to cache exhibitor data...', {
            eventId: eventId,
            exhibitorCount: exhibitors.length,
            profileCount: exhibitorProfiles.length,
            apiStats: apiStats
        });
        
        // Compress exhibitor data - only keep essential fields
        const compressedExhibitors = exhibitors.map(exhibitor => ({
            id: exhibitor.id,
            company_name_en: exhibitor.company_name_en,
            company_name_vi: exhibitor.company_name_vi,
            booth_no: exhibitor.booth_no,
            representative_name: exhibitor.representative_name,
            representative_email: exhibitor.representative_email,
            booth_area: exhibitor.booth_area,
            employees_count: exhibitor.employees_count,
            products_count: exhibitor.products_count
        }));
        
        const cacheData = {
            version: CACHE_VERSION,
            eventId: eventId,
            timestamp: Date.now(),
            apiStats: apiStats,
            exhibitors: compressedExhibitors,
            exhibitorProfiles: exhibitorProfiles, // Keep profiles for details
            totalCount: exhibitors.length,
            compressed: true
        };
        
        const dataSize = new Blob([JSON.stringify(cacheData)]).size;
        console.log(`📦 Exhibitor cache size: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Check if too large (2MB limit for exhibitors)
        if (dataSize > 2 * 1024 * 1024) {
            console.log('⚠️ Exhibitor cache too large, using minimal cache...');
            
            const minimalData = {
                version: CACHE_VERSION,
                eventId: eventId,
                timestamp: Date.now(),
                apiStats: apiStats,
                totalCount: exhibitors.length,
                exhibitorIds: exhibitors.map(e => e.id),
                minimal: true
            };
            
            localStorage.setItem(EXHIBITOR_CACHE_KEY, JSON.stringify(minimalData));
            console.log(`✅ Saved minimal exhibitor cache (${exhibitors.length} IDs only)`);
            return true;
        }
        
        localStorage.setItem(EXHIBITOR_CACHE_KEY, JSON.stringify(cacheData));
        console.log(`✅ Successfully cached ${exhibitors.length} exhibitors for event ${eventId}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to save exhibitor cache:', error);
        return false;
    }
}

function loadExhibitorCache(eventId) {
    try {
        console.log('🔍 Checking exhibitor cache for event:', eventId);
        const cached = localStorage.getItem(EXHIBITOR_CACHE_KEY);
        if (!cached) {
            console.log('📦 No exhibitor cache found');
            return null;
        }
        console.log('📦 Exhibitor cache data found, parsing...');
        
        const cacheData = JSON.parse(cached);
        
        // Check version compatibility
        if (cacheData.version !== CACHE_VERSION) {
            console.log('🔄 Cache version mismatch, clearing old exhibitor cache');
            clearExhibitorCache();
            return null;
        }
        
        // Check if cache is for the same event
        if (cacheData.eventId !== eventId) {
            console.log('🔄 Different event, exhibitor cache not applicable');
            return null;
        }
        
        // Check if cache is expired
        const ageHours = (Date.now() - cacheData.timestamp) / (1000 * 60 * 60);
        if (ageHours > CACHE_EXPIRY_HOURS) {
            console.log('⏰ Exhibitor cache expired, clearing');
            clearExhibitorCache();
            return null;
        }
        
        console.log(`✅ Loaded cached exhibitor data: ${cacheData.totalCount} exhibitors (age: ${ageHours.toFixed(1)}h)`);
        return cacheData;
    } catch (error) {
        console.error('❌ Failed to load exhibitor cache:', error);
        clearExhibitorCache();
        return null;
    }
}

function clearExhibitorCache() {
    try {
        localStorage.removeItem(EXHIBITOR_CACHE_KEY);
        console.log('🧹 Exhibitor cache cleared');
    } catch (error) {
        console.error('❌ Failed to clear exhibitor cache:', error);
    }
}

// ===== 8. UTILITY FUNCTIONS =====
function isSameDate(dateString1, dateString2) {
    if (!dateString1 || !dateString2) return false;
    
    try {
        // Parse Zoho date format: "01/07/2025 13:56:38" or similar
        // Extract just the date part for comparison
        const date1 = parseZohoDate(dateString1);
        const date2 = parseZohoDate(dateString2);
        
        if (!date1 || !date2) return false;
        
        // Compare only the date part (ignore time)
        return date1.toDateString() === date2.toDateString();
    } catch (error) {
        console.warn('Date comparison error:', error, { dateString1, dateString2 });
        return false;
    }
}

function parseZohoDate(dateString) {
    if (!dateString) return null;
    
    try {
        // Handle Zoho format: "01/07/2025 13:56:38" 
        if (typeof dateString === 'string' && dateString.includes('/')) {
            // Split date and time parts
            const [datePart] = dateString.split(' ');
            const [day, month, year] = datePart.split('/');
            
            // Create date in format: YYYY-MM-DD
            const isoFormat = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            return new Date(isoFormat);
        }
        
        // Fallback to standard Date parsing
        return new Date(dateString);
    } catch (error) {
        console.warn('Failed to parse Zoho date:', dateString, error);
        return null;
    }
}

function limitCustomFields(customFields, maxFields) {
    if (!customFields || typeof customFields !== 'object') return {};
    
    const entries = Object.entries(customFields);
    if (entries.length <= maxFields) return customFields;
    
    // Prioritize important fields (keep them first)
    const importantFields = ['Job Title', 'Company', 'Industry', 'Position', 'Department'];
    const important = entries.filter(([key]) => 
        importantFields.some(field => key.toLowerCase().includes(field.toLowerCase()))
    );
    const others = entries.filter(([key]) => 
        !importantFields.some(field => key.toLowerCase().includes(field.toLowerCase()))
    );
    
    const limited = [...important, ...others].slice(0, maxFields);
    return Object.fromEntries(limited);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    // Return the date string as-is since Zoho provides it in readable format
    if (typeof dateString === 'string' && dateString.length > 0) {
        return dateString;
    }
    
    return 'N/A';
}

// ===== 8. SELECT ALL FUNCTIONALITY =====
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (!selectAllCheckbox) return;
    
    const isChecked = selectAllCheckbox.checked;
    
    if (isChecked) {
        // Add all visible visitors to selection
        const visibleVisitorIds = getCurrentPageVisitors().map(v => v.id);
        visibleVisitorIds.forEach(id => SELECTED_VISITOR_IDS.add(id));
    } else {
        // Remove all visible visitors from selection
        const visibleVisitorIds = getCurrentPageVisitors().map(v => v.id);
        visibleVisitorIds.forEach(id => SELECTED_VISITOR_IDS.delete(id));
    }
    
    // Update UI
    updateVisitorCheckboxes();
    updateSelectionBadge();
    updateSelectAllState();
    
    console.log(`${isChecked ? '✅' : '❌'} Select all page: ${isChecked ? 'selected' : 'deselected'}. Total selected: ${SELECTED_VISITOR_IDS.size}`);
}

function toggleVisitorSelect(visitorId) {
    if (SELECTED_VISITOR_IDS.has(visitorId)) {
        SELECTED_VISITOR_IDS.delete(visitorId);
    } else {
        SELECTED_VISITOR_IDS.add(visitorId);
    }
    
    updateSelectionBadge();
    updateSelectAllState();
    
    console.log(`🔄 Visitor ${visitorId} ${SELECTED_VISITOR_IDS.has(visitorId) ? 'selected' : 'deselected'}. Total selected: ${SELECTED_VISITOR_IDS.size}`);
}

function updateVisitorCheckboxes() {
    const checkboxes = document.querySelectorAll('input[name="visitorSelect"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = SELECTED_VISITOR_IDS.has(checkbox.value);
    });
}

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (!selectAllCheckbox) return;
    
    const visibleVisitorIds = getCurrentPageVisitors().map(v => v.id);
    const selectedVisibleIds = visibleVisitorIds.filter(id => SELECTED_VISITOR_IDS.has(id));
    
    if (selectedVisibleIds.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (selectedVisibleIds.length === visibleVisitorIds.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

function updateSelectionBadge() {
    const badge = document.getElementById('selectionBadge');
    const countSpan = document.getElementById('selectionCount');
    
    if (!badge || !countSpan) return;
    
    const count = SELECTED_VISITOR_IDS.size;
    
    if (count > 0) {
        badge.style.display = 'inline-flex';
        countSpan.textContent = count;
    } else {
        badge.style.display = 'none';
    }
}

function clearAllSelection() {
    SELECTED_VISITOR_IDS.clear();
    updateVisitorCheckboxes();
    updateSelectionBadge();
    updateSelectAllState();
    console.log('🗑️ All selections cleared');
}

function getCurrentPageVisitors() {
    const startIndex = (CURRENT_PAGE - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const filtered = getFilteredVisitors();
    return filtered.slice(startIndex, endIndex);
}

function getFilteredVisitors() {
    // Return the globally filtered visitors or use performInstantSearch logic
    if (window.FILTERED_VISITORS && window.FILTERED_VISITORS.length > 0) {
        return window.FILTERED_VISITORS;
    }
    
    // Fallback to basic filtering
    let filtered = ALL_VISITORS.filter(visitor => {
        const matchesSearch = !SEARCH_TERM || 
            visitor.name?.toLowerCase().includes(SEARCH_TERM.toLowerCase()) ||
            visitor.email?.toLowerCase().includes(SEARCH_TERM.toLowerCase()) ||
            visitor.phone?.toLowerCase().includes(SEARCH_TERM.toLowerCase());
        
        const matchesStatus = !STATUS_FILTER || 
            (STATUS_FILTER === 'checked-in' && visitor.checked_in) ||
            (STATUS_FILTER === 'not-checked-in' && !visitor.checked_in);
        
        const matchesType = !TYPE_FILTER ||
            (TYPE_FILTER === 'group' && visitor.group_registration) ||
            (TYPE_FILTER === 'individual' && !visitor.group_registration);
        
        return matchesSearch && matchesStatus && matchesType;
    });
    
    return filtered;
}

function getSelectedVisitors() {
    const selectedIds = Array.from(SELECTED_VISITOR_IDS);
    console.log('📋 Selected visitor IDs:', selectedIds);
    return selectedIds;
}

// ===== 9. EXPORT FUNCTIONALITY =====
function exportVisitors() {
    const selectedIds = getSelectedVisitors();
    const visitorsToExport = selectedIds.length > 0 
        ? ALL_VISITORS.filter(visitor => selectedIds.includes(visitor.id))
        : FILTERED_VISITORS.length > 0 ? FILTERED_VISITORS : ALL_VISITORS;
    
    if (visitorsToExport.length === 0) {
        alert('No visitors to export!');
        return;
    }
    
    console.log(`📤 Exporting ${visitorsToExport.length} visitors (${selectedIds.length > 0 ? 'selected' : 'all/filtered'})`);
    
    // Get all possible columns from all visitors
    const allColumns = new Set();
    visitorsToExport.forEach(visitor => {
        // Standard columns
        ['id', 'name', 'email', 'phone', 'checked_in', 'group_registration', 'added_time', 'redeem_id', 'salutation'].forEach(col => allColumns.add(col));
        
        // Custom fields
        if (visitor.customFields) {
            Object.keys(visitor.customFields).forEach(field => allColumns.add(`custom_${field}`));
        }
    });
    
    const columns = Array.from(allColumns);
    
    // Create CSV content
    const headers = columns.map(col => {
        if (col.startsWith('custom_')) {
            return col.replace('custom_', ''); // Remove custom_ prefix for display
        }
        return col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' ');
    });
    
    const csvContent = [
        headers.join(','),
        ...visitorsToExport.map(visitor => {
            return columns.map(col => {
                let value = '';
                
                if (col.startsWith('custom_')) {
                    const fieldName = col.replace('custom_', '');
                    value = visitor.customFields?.[fieldName] || '';
                } else {
                    value = visitor[col] || '';
                }
                
                // Handle different types
                if (typeof value === 'boolean') {
                    value = value ? 'Yes' : 'No';
                } else if (col === 'checked_in') {
                    value = visitor.checked_in ? 'Checked In' : 'Not Yet';
                } else if (col === 'group_registration') {
                    value = visitor.group_registration ? 'Group' : 'Individual';
                } else if (col === 'added_time' && value) {
                    value = formatDate(value);
                }
                
                // Escape CSV value
                value = String(value).replace(/"/g, '""');
                return value.includes(',') || value.includes('"') || value.includes('\n') ? `"${value}"` : value;
            }).join(',');
        })
    ].join('\n');
    
    // Create and download file
    const fileName = `visitors_export_${new Date().toISOString().split('T')[0]}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    
    console.log(`✅ Export completed: ${fileName} (${visitorsToExport.length} visitors, ${columns.length} columns)`);
}

// ===== 10. IMPORT FUNCTIONALITY =====
function showImportModal() {
    const modal = document.getElementById('importModal');
    const modalBody = modal?.querySelector('.modal-body');
    
    if (!modal || !modalBody) return;
    
    if (CURRENT_EVENT?.id) {
        const registrationUrl = `https://registration.nexpo.vn/register/${CURRENT_EVENT.id}`;
        
        // Update modal title
        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-external-link-alt"></i> Registration Portal';
        }
        
        // Create iframe to embed registration portal directly
        modalBody.innerHTML = `
            <div style="width: 100%; height: 600px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <iframe 
                    src="${registrationUrl}" 
                    style="width: 100%; height: 100%; border: none;"
                    title="Registration Portal"
                    loading="lazy"
                ></iframe>
            </div>
            <div style="margin-top: 16px; text-align: center; color: #64748b; font-size: 14px;">
                <i class="fas fa-info-circle"></i> 
                Registration portal is embedded above. Use this to add new visitors directly.
            </div>
        `;
        
        console.log('🔗 Embedded registration portal:', registrationUrl);
    } else {
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;"></i>
                <h3 style="color: #374151; margin-bottom: 8px;">Event ID Not Available</h3>
                <p style="color: #64748b;">Unable to load registration portal without event information.</p>
            </div>
        `;
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    console.log('📥 Import modal opened with embedded portal');
}

function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

// ===== 11. ADVANCED FILTER SYSTEM =====
let ACTIVE_FILTERS = [];
// Note: Each filter now has its own connector (AND/OR) to the next filter

function getAvailableFields() {
    const fields = [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'checked_in', label: 'Check-in Status', type: 'boolean' },
        { key: 'group_registration', label: 'Registration Type', type: 'boolean' },
        { key: 'added_time', label: 'Registration Date', type: 'date' }
    ];
    
    // Get current event ID for form fields lookup
    const currentEventId = CURRENT_EVENT?.id;
    
    // Add dynamic custom fields from form fields metadata (preferred) or visitor data (fallback)
    const customFieldsSet = new Set();
    
    // First, try to get fields from form fields metadata
    if (currentEventId && EVENT_FORM_FIELDS[currentEventId]) {
        const formFields = EVENT_FORM_FIELDS[currentEventId];
        Object.entries(formFields).forEach(([fieldId, metadata]) => {
            customFieldsSet.add(fieldId);
            fields.push({
                key: `customFields.${fieldId}`,
                label: metadata.label || fieldId,
                type: mapFormFieldTypeToFilterType(metadata.type),
                formFieldType: metadata.type, // Keep original type for reference
                choices: metadata.choices
            });
        });
        console.log(`✅ Added ${Object.keys(formFields).length} fields from form metadata`);
    } else {
        // Fallback: Get custom fields from current visitor data
        if (ALL_VISITORS && ALL_VISITORS.length > 0) {
            ALL_VISITORS.forEach(visitor => {
                if (visitor.customFields) {
                    Object.keys(visitor.customFields).forEach(key => {
                        if (!customFieldsSet.has(key)) {
                            customFieldsSet.add(key);
                            fields.push({
                                key: `customFields.${key}`,
                                label: currentEventId ? getFieldLabel(currentEventId, key) : key,
                                type: 'text' // Default type when no form metadata
                            });
                        }
                    });
                }
            });
            console.log(`⚠️ Added ${customFieldsSet.size} fields from visitor data (fallback)`);
        }
    }
    
    return fields;
}

// Helper function to map form field types to filter types
function mapFormFieldTypeToFilterType(formFieldType) {
    switch (formFieldType) {
        case 'Text':
        case 'Email':
        case 'Textarea':
            return 'text';
        case 'Number':
            return 'number';
        case 'Select':
        case 'Multi Select':
            return 'select';
        case 'Agreement':
            return 'boolean';
        case 'File':
        case 'Image':
            return 'text'; // Treat as text for filtering
        default:
            return 'text';
    }
}

function setupAdvancedFilter() {
    const openBtn = document.getElementById('openAdvancedFilter');
    const addConditionBtn = document.getElementById('addFilterCondition');
    const addGroupBtn = document.getElementById('addFilterGroup');
    const applyBtn = document.getElementById('applyFilters');
    const clearBtn = document.getElementById('clearAllFilters');
    const clearFilterResultsBtn = document.getElementById('clearFilterResults');
    
    if (openBtn) {
        openBtn.addEventListener('click', showAdvancedFilterModal);
    }
    
    if (addConditionBtn) {
        addConditionBtn.addEventListener('click', addFilterCondition);
    }
    
    if (addGroupBtn) {
        addGroupBtn.addEventListener('click', addFilterGroup);
    }
    
    if (applyBtn) {
        applyBtn.addEventListener('click', applyAdvancedFilters);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllAdvancedFilters);
    }
    
    if (clearFilterResultsBtn) {
        clearFilterResultsBtn.addEventListener('click', clearAllAdvancedFilters);
    }
    
    console.log('🎛️ Advanced filter system setup complete');
}

function showAdvancedFilterModal() {
    const modal = document.getElementById('advancedFilterModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Initialize with one condition if none exist
        if (ACTIVE_FILTERS.length === 0) {
            addFilterCondition();
        } else {
            // Populate existing conditions
            populateExistingFilters();
        }
    }
}

function closeAdvancedFilterModal() {
    const modal = document.getElementById('advancedFilterModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

function addFilterCondition() {
    const conditionsContainer = document.getElementById('filterConditions');
    const fields = getAvailableFields();
    const conditionId = `condition_${Date.now()}`;
    const isFirstCondition = conditionsContainer.children.length === 0;
    
    // Add connector if not first condition
    if (!isFirstCondition) {
        const connectorHtml = `
            <div class="condition-connector" data-connector-for="${conditionId}">
                <select class="connector-select" onchange="updateConnectorLogic()">
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                </select>
            </div>
        `;
        conditionsContainer.insertAdjacentHTML('beforeend', connectorHtml);
    }
    
    const conditionHtml = `
        <div class="filter-condition" data-condition-id="${conditionId}">
            <div class="condition-row">
                <div class="condition-field-group">
                    <select class="field-select" onchange="updateOperatorOptions('${conditionId}')">
                        <option value="">Select Field</option>
                        ${fields.map(field => `<option value="${field.key}" data-type="${field.type}">${field.label}</option>`).join('')}
                    </select>
                    <select class="operator-select">
                        <option value="contains">contains</option>
                    </select>
                    <div class="condition-value">
                        <input type="text" class="value-input" placeholder="Enter value">
                    </div>
                </div>
            </div>
            <button class="remove-condition" onclick="removeFilterCondition('${conditionId}')" title="Remove condition">
                ×
            </button>
        </div>
    `;
    
    conditionsContainer.insertAdjacentHTML('beforeend', conditionHtml);
    console.log('➕ Added filter condition:', conditionId);
}

function addFilterGroup() {
    const conditionsContainer = document.getElementById('filterConditions');
    const groupId = `group_${Date.now()}`;
    const isFirstGroup = conditionsContainer.children.length === 0;
    
    // Add connector if not first group
    if (!isFirstGroup) {
        const connectorHtml = `
            <div class="condition-connector" data-connector-for="${groupId}">
                <select class="connector-select" onchange="updateConnectorLogic()">
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                </select>
            </div>
        `;
        conditionsContainer.insertAdjacentHTML('beforeend', connectorHtml);
    }
    
    const groupHtml = `
        <div class="condition-group" data-group-id="${groupId}" style="border: 2px dashed #d1d5db; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: rgba(102, 126, 234, 0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <label style="font-weight: 600; color: #374151; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-layer-group" style="color: #667eea;"></i>
                    Group
                </label>
                <button onclick="removeFilterGroup('${groupId}')" style="background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='#fee2e2'; this.style.color='#dc2626'; this.style.borderColor='#fecaca';" onmouseout="this.style.background='#f1f5f9'; this.style.color='#64748b'; this.style.borderColor='#e2e8f0';" title="Remove group">
                    <i class="fas fa-recycle"></i>
                </button>
            </div>
            <div class="group-conditions" data-group-conditions="${groupId}">
                <!-- Group conditions will be added here -->
            </div>
            <button onclick="addConditionToGroup('${groupId}')" style="background: #667eea; color: white; border: none; border-radius: 8px; padding: 8px 12px; font-size: 12px; margin-top: 12px; cursor: pointer;">
                <i class="fas fa-plus"></i> Add Condition to Group
            </button>
        </div>
    `;
    
    conditionsContainer.insertAdjacentHTML('beforeend', groupHtml);
    
    // Add first condition to the group
    addConditionToGroup(groupId);
    
    console.log('➕ Added filter group:', groupId);
}

function addConditionToGroup(groupId) {
    const groupConditionsContainer = document.querySelector(`[data-group-conditions="${groupId}"]`);
    const fields = getAvailableFields();
    const conditionId = `condition_${Date.now()}`;
    const isFirstInGroup = groupConditionsContainer.children.length === 0;
    
    // Add connector if not first condition in group
    if (!isFirstInGroup) {
        const connectorHtml = `
            <div class="condition-connector" data-connector-for="${conditionId}">
                <select class="connector-select" onchange="updateConnectorLogic()">
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                </select>
            </div>
        `;
        groupConditionsContainer.insertAdjacentHTML('beforeend', connectorHtml);
    }
    
    const conditionHtml = `
        <div class="filter-condition" data-condition-id="${conditionId}" style="margin-bottom: 12px; background: white;">
            <select class="field-select" onchange="updateOperatorOptions('${conditionId}')">
                <option value="">Select Field</option>
                ${fields.map(field => `<option value="${field.key}" data-type="${field.type}">${field.label}</option>`).join('')}
            </select>
            <select class="operator-select">
                <option value="contains">contains</option>
            </select>
            <input type="text" class="value-input" placeholder="Enter value">
            <button class="remove-condition" onclick="removeConditionFromGroup('${conditionId}', '${groupId}')" title="Remove condition">
                <i class="fas fa-recycle"></i>
            </button>
        </div>
    `;
    
    groupConditionsContainer.insertAdjacentHTML('beforeend', conditionHtml);
    console.log('➕ Added condition to group:', groupId, conditionId);
}

function removeFilterCondition(conditionId) {
    const condition = document.querySelector(`[data-condition-id="${conditionId}"]`);
    const connector = document.querySelector(`[data-connector-for="${conditionId}"]`);
    
    if (condition) {
        condition.remove();
        if (connector) connector.remove();
        console.log('🗑️ Removed filter condition:', conditionId);
    }
}

function removeConditionFromGroup(conditionId, groupId) {
    const condition = document.querySelector(`[data-condition-id="${conditionId}"]`);
    const connector = document.querySelector(`[data-connector-for="${conditionId}"]`);
    
    if (condition) {
        condition.remove();
        if (connector) connector.remove();
        console.log('🗑️ Removed condition from group:', groupId, conditionId);
    }
}

function removeFilterGroup(groupId) {
    const group = document.querySelector(`[data-group-id="${groupId}"]`);
    const connector = document.querySelector(`[data-connector-for="${groupId}"]`);
    
    if (group) {
        group.remove();
        if (connector) connector.remove();
        console.log('🗑️ Removed filter group:', groupId);
    }
}

function updateConnectorLogic() {
    console.log('🔄 Connector logic updated');
    // This function can be used to update the visual representation
    // The actual logic evaluation happens in applyAdvancedFilters
}

function updateOperatorOptions(conditionId) {
    const condition = document.querySelector(`[data-condition-id="${conditionId}"]`);
    const fieldSelect = condition.querySelector('.field-select');
    const operatorSelect = condition.querySelector('.operator-select');
    const valueInput = condition.querySelector('.value-input');
    
    const selectedOption = fieldSelect.options[fieldSelect.selectedIndex];
    const fieldType = selectedOption.dataset.type;
    const fieldKey = fieldSelect.value;
    
    // Update operators based on field type
    let operators = [];
    let inputType = 'text';
    let placeholder = 'Enter value';
    
    switch (fieldType) {
        case 'text':
            operators = [
                { value: 'contains', label: 'contains' },
                { value: 'not_contains', label: 'does not contain' },
                { value: 'equals', label: 'equals' },
                { value: 'not_equals', label: 'does not equal' },
                { value: 'starts_with', label: 'starts with' },
                { value: 'ends_with', label: 'ends with' },
                { value: 'is_empty', label: 'is empty' },
                { value: 'is_not_empty', label: 'is not empty' },
                { value: 'regex', label: 'matches pattern (regex)' }
            ];
            inputType = 'text';
            placeholder = 'Enter text';
            break;
            
        case 'number':
            operators = [
                { value: 'equals', label: 'equals' },
                { value: 'not_equals', label: 'does not equal' },
                { value: 'greater_than', label: 'greater than' },
                { value: 'greater_than_equal', label: 'greater than or equal' },
                { value: 'less_than', label: 'less than' },
                { value: 'less_than_equal', label: 'less than or equal' },
                { value: 'between', label: 'between' },
                { value: 'is_empty', label: 'is empty' },
                { value: 'is_not_empty', label: 'is not empty' }
            ];
            inputType = 'number';
            placeholder = 'Enter number';
            break;
            
        case 'boolean':
            operators = [
                { value: 'equals', label: 'is' },
                { value: 'not_equals', label: 'is not' }
            ];
            inputType = 'select';
            if (fieldKey === 'checked_in') {
                placeholder = 'true or false';
            } else if (fieldKey === 'group_registration') {
                placeholder = 'group or individual';
            }
            break;
            
        case 'date':
            operators = [
                { value: 'equals', label: 'on' },
                { value: 'not_equals', label: 'not on' },
                { value: 'before', label: 'before' },
                { value: 'after', label: 'after' },
                { value: 'between', label: 'between' },
                { value: 'is_empty', label: 'is empty' },
                { value: 'is_not_empty', label: 'is not empty' },
                { value: 'today', label: 'is today' },
                { value: 'yesterday', label: 'is yesterday' },
                { value: 'this_week', label: 'is this week' },
                { value: 'this_month', label: 'is this month' },
                { value: 'this_year', label: 'is this year' }
            ];
            inputType = 'date';
            placeholder = '';
            break;
            
        case 'select':
        case 'dropdown':
        case 'multi_select':
            operators = [
                { value: 'equals', label: 'equals' },
                { value: 'not_equals', label: 'does not equal' },
                { value: 'contains', label: 'contains' },
                { value: 'not_contains', label: 'does not contain' },
                { value: 'is_empty', label: 'is empty' },
                { value: 'is_not_empty', label: 'is not empty' }
            ];
            inputType = 'select';
            placeholder = 'Select value';
            break;
            
        default:
            operators = [
                { value: 'contains', label: 'contains' },
                { value: 'not_contains', label: 'does not contain' },
                { value: 'equals', label: 'equals' },
                { value: 'not_equals', label: 'does not equal' },
                { value: 'is_empty', label: 'is empty' },
                { value: 'is_not_empty', label: 'is not empty' }
            ];
    }
    
    // Update operator select
    operatorSelect.innerHTML = operators.map(op => 
        `<option value="${op.value}">${op.label}</option>`
    ).join('');
    
    // Update value input based on field and operator
    updateValueInput(condition, fieldKey, fieldType, inputType, placeholder);
    
    // Add operator change listener to update value input accordingly
    operatorSelect.onchange = () => {
        updateValueInput(condition, fieldKey, fieldType, inputType, placeholder);
    };
}

function updateValueInput(condition, fieldKey, fieldType, inputType, placeholder) {
    const operatorSelect = condition.querySelector('.operator-select');
    const valueContainer = condition.querySelector('.condition-value');
    const valueInput = condition.querySelector('.value-input');
    const selectedOperator = operatorSelect.value;
    
    if (!valueContainer) {
        console.error('⚠️ No .condition-value container found');
        return;
    }
    
    // Clean up any existing custom inputs
    const existingSelects = valueContainer.querySelectorAll('.value-select, .between-inputs, .multi-select-container');
    existingSelects.forEach(el => el.remove());
    
    // Handle operators that don't need value input
    if (['is_empty', 'is_not_empty', 'today', 'yesterday', 'this_week', 'this_month', 'this_year'].includes(selectedOperator)) {
        valueContainer.style.display = 'none';
        if (valueInput) valueInput.value = '';
        return;
    } else {
        valueContainer.style.display = 'block';
    }
    
    // Get field metadata to check actual field type from API
    const currentEventId = CURRENT_EVENT?.id;
    let actualFieldType = fieldType;
    if (currentEventId && fieldKey.startsWith('customFields.')) {
        const fieldId = fieldKey.replace('customFields.', '');
        const fieldMetadata = getFieldMetadata(currentEventId, fieldId);
        actualFieldType = fieldMetadata.formFieldType || fieldType; // Use actual API field type
        console.log(`🔍 Field ${fieldId} - UI type: ${fieldType}, API type: ${actualFieldType}`);
    }

    // Handle special cases
    if (fieldType === 'boolean' || (fieldType === 'select' && ['checked_in', 'group_registration'].includes(fieldKey))) {
        createBooleanSelect(valueContainer, fieldKey);
    } else if (actualFieldType === 'Select' || fieldType === 'select' || fieldType === 'dropdown') {
        createFieldValueSelect(valueContainer, fieldKey, false); // Single select
    } else if (actualFieldType === 'Multi Select' || fieldType === 'multi_select') {
        createFieldValueSelect(valueContainer, fieldKey, true); // Multi select
    } else if (selectedOperator === 'between') {
        createBetweenInput(valueContainer, fieldType);
    } else {
        // Regular input
        valueInput.type = inputType === 'select' ? 'text' : inputType;
        valueInput.placeholder = placeholder;
        valueInput.style.display = 'block';
    }
}

function createBooleanSelect(valueContainer, fieldKey) {
    let options = [];
    
    if (fieldKey === 'checked_in') {
        options = [
            { value: 'true', label: 'Checked In' },
            { value: 'false', label: 'Not Checked In' }
        ];
    } else if (fieldKey === 'group_registration') {
        options = [
            { value: 'true', label: 'Group Registration' },
            { value: 'false', label: 'Individual Registration' }
        ];
    } else {
        options = [
            { value: 'true', label: 'True' },
            { value: 'false', label: 'False' }
        ];
    }
    
    const selectHtml = `
        <select class="value-select" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
            <option value="">Choose...</option>
            ${options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
        </select>
    `;
    
    // Hide original input and add select to container
    const originalInput = valueContainer.querySelector('.value-input');
    if (originalInput) originalInput.style.display = 'none';
    valueContainer.insertAdjacentHTML('beforeend', selectHtml);
}

function createFieldValueSelect(valueContainer, fieldKey, isMultiSelect = false) {
    const currentEventId = CURRENT_EVENT?.id;
    let choices = [];
    
    // First, try to get choices from form metadata
    if (currentEventId && fieldKey.startsWith('customFields.')) {
        const fieldId = fieldKey.replace('customFields.', '');
        const fieldMetadata = getFieldMetadata(currentEventId, fieldId);
        console.log(`🔍 Field metadata for ${fieldId}:`, fieldMetadata);
        if (fieldMetadata.choices && fieldMetadata.choices.length > 0) {
            choices = fieldMetadata.choices;
            console.log(`✅ Using choices from form metadata for ${fieldId}:`, choices);
        } else {
            console.log(`⚠️ No choices found in form metadata for ${fieldId}, trying visitor data...`);
        }
    }
    
    // Fallback: Get unique values from current visitor data
    if (choices.length === 0) {
        choices = getUniqueFieldValues(fieldKey);
        console.log(`⚠️ Using choices from visitor data for ${fieldKey}:`, choices);
    }
    
    if (choices.length === 0) {
        valueInput.type = 'text';
        valueInput.placeholder = 'Enter value (no options available)';
        return;
    }
    
    if (isMultiSelect) {
        // Multi-select with checkboxes
        const multiSelectHtml = `
            <div class="multi-select-container" style="border: 1px solid #d1d5db; border-radius: 6px; max-height: 200px; overflow-y: auto; background: white;">
                <div style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                    Select multiple values (use Ctrl/Cmd + click)
                </div>
                ${choices.map(value => `
                    <label class="multi-select-option" style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;">
                        <input type="checkbox" value="${value}" style="margin-right: 8px;">
                        <span>${value}</span>
                    </label>
                `).join('')}
            </div>
        `;
        
        // Hide original input and add multi-select to container
        const originalInput = valueContainer.querySelector('.value-input');
        if (originalInput) originalInput.style.display = 'none';
        valueContainer.insertAdjacentHTML('beforeend', multiSelectHtml);
        
        // Add hover effects
        const container = valueContainer.querySelector('.multi-select-container');
        container.addEventListener('change', () => {
            const checkedValues = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => cb.value);
            // Store values in a hidden input for easy retrieval
            let hiddenInput = valueContainer.querySelector('.multi-select-values');
            if (!hiddenInput) {
                hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.className = 'multi-select-values';
                valueContainer.appendChild(hiddenInput);
            }
            hiddenInput.value = checkedValues.join(',');
        });
        
    } else {
        // Single select dropdown
        const selectHtml = `
            <select class="value-select" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                <option value="">Choose from available values...</option>
                ${choices.map(value => `<option value="${value}">${value}</option>`).join('')}
            </select>
        `;
        
        // Hide original input and add select to container
        const originalInput = valueContainer.querySelector('.value-input');
        if (originalInput) originalInput.style.display = 'none';
        valueContainer.insertAdjacentHTML('beforeend', selectHtml);
    }
}

function createBetweenInput(valueContainer, fieldType) {
    const inputType = fieldType === 'date' ? 'date' : 'number';
    const placeholder = fieldType === 'date' ? '' : 'Min value';
    const placeholder2 = fieldType === 'date' ? '' : 'Max value';
    
    const betweenHtml = `
        <div class="between-inputs" style="display: flex; gap: 8px; align-items: center;">
            <input type="${inputType}" class="between-min" placeholder="${placeholder}" style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
            <span style="color: #6b7280; font-size: 14px;">and</span>
            <input type="${inputType}" class="between-max" placeholder="${placeholder2}" style="flex: 1; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
        </div>
    `;
    
    // Hide original input and add between inputs to container
    const originalInput = valueContainer.querySelector('.value-input');
    if (originalInput) originalInput.style.display = 'none';
    valueContainer.insertAdjacentHTML('beforeend', betweenHtml);
}

function getUniqueFieldValues(fieldKey) {
    let allData = [];
    
    // Get values from visitors
    if (ALL_VISITORS && ALL_VISITORS.length > 0) {
        allData = [...ALL_VISITORS];
    }
    
    // Get values from exhibitors if it's an exhibitor field
    if (fieldKey.includes('exhibitor') && ALL_EXHIBITORS && ALL_EXHIBITORS.length > 0) {
        allData = [...ALL_EXHIBITORS];
    }
    
    const uniqueValues = new Set();
    
    allData.forEach(item => {
        let value;
        
        if (fieldKey.startsWith('customFields.')) {
            const customFieldName = fieldKey.replace('customFields.', '');
            value = item.customFields?.[customFieldName];
        } else if (fieldKey.startsWith('custom_')) {
            // Legacy support for old custom field format
            const customFieldName = fieldKey.replace('custom_', '');
            value = item.customFields?.[customFieldName];
        } else if (fieldKey.startsWith('raw.')) {
            const rawFieldName = fieldKey.replace('raw.', '');
            value = item.raw?.[rawFieldName];
        } else {
            value = item[fieldKey];
        }
        
        if (value !== null && value !== undefined && value !== '') {
            // Handle array values (multi-select fields)
            if (Array.isArray(value)) {
                value.forEach(v => uniqueValues.add(String(v)));
            } else {
                uniqueValues.add(String(value));
            }
        }
    });
    
    // Sort and return up to 50 unique values
    return Array.from(uniqueValues).sort().slice(0, 50);
}

function getConditionValue(element, operator) {
    // Handle operators that don't need values
    if (['is_empty', 'is_not_empty', 'today', 'yesterday', 'this_week', 'this_month', 'this_year'].includes(operator)) {
        return '';
    }
    
    // Check for different input types
    const valueInput = element.querySelector('.value-input');
    const valueSelect = element.querySelector('.value-select');
    const betweenInputs = element.querySelector('.between-inputs');
    const multiSelectValues = element.querySelector('.multi-select-values');
    const multiSelectContainer = element.querySelector('.multi-select-container');
    
    if (betweenInputs) {
        // Between operator with min and max values
        const minInput = betweenInputs.querySelector('.between-min');
        const maxInput = betweenInputs.querySelector('.between-max');
        const minValue = minInput ? minInput.value : '';
        const maxValue = maxInput ? maxInput.value : '';
        return `${minValue},${maxValue}`;
    } else if (multiSelectContainer) {
        // Multi-select values
        const checkedValues = Array.from(multiSelectContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        return checkedValues.join(',');
    } else if (multiSelectValues) {
        // Hidden input with multi-select values
        return multiSelectValues.value;
    } else if (valueSelect) {
        // Dropdown select value
        return valueSelect.value;
    } else if (valueInput) {
        // Regular input value
        return valueInput.value;
    }
    
    return '';
}

// Helper function to set condition value (handles all input types)
function setConditionValue(conditionElement, value) {
    if (!value) return;
    
    console.log(`🔧 Setting condition value: "${value}"`);
    
    const valueInput = conditionElement.querySelector('.value-input');
    const valueSelect = conditionElement.querySelector('.value-select');
    const betweenInputs = conditionElement.querySelector('.between-inputs');
    const multiSelectContainer = conditionElement.querySelector('.multi-select-container');
    
    if (betweenInputs) {
        // Between operator: split value by comma
        const [minValue, maxValue] = value.split(',');
        const minInput = betweenInputs.querySelector('.between-min');
        const maxInput = betweenInputs.querySelector('.between-max');
        if (minInput) minInput.value = minValue || '';
        if (maxInput) maxInput.value = maxValue || '';
        console.log(`✅ Set between values: ${minValue} - ${maxValue}`);
        
    } else if (multiSelectContainer) {
        // Multi-select: check boxes based on comma-separated values
        const selectedValues = value.split(',').map(v => v.trim()).filter(v => v);
        const checkboxes = multiSelectContainer.querySelectorAll('input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectedValues.includes(checkbox.value);
        });
        console.log(`✅ Set multi-select values:`, selectedValues);
        
    } else if (valueSelect) {
        // Dropdown select
        valueSelect.value = value;
        console.log(`✅ Set select value: ${value}`);
        
    } else if (valueInput) {
        // Regular input
        valueInput.value = value;
        console.log(`✅ Set input value: ${value}`);
    } else {
        console.log(`⚠️ No value input found to set value: ${value}`);
    }
}

function populateExistingFilters() {
    const conditionsContainer = document.getElementById('filterConditions');
    conditionsContainer.innerHTML = '';
    
    if (ACTIVE_FILTERS.length === 0) {
        // Only add empty condition if no filters exist
        console.log('📝 No filters found, adding empty condition');
        addFilterCondition();
        return;
    }
    
    console.log('🔄 Reconstructing filters:', ACTIVE_FILTERS);
    
    // Reconstruct filters from saved state
    for (let i = 0; i < ACTIVE_FILTERS.length; i++) {
        const filter = ACTIVE_FILTERS[i];
        
        if (filter.type === 'condition') {
            // Add regular condition
            addFilterCondition();
            const lastCondition = conditionsContainer.lastElementChild;
            
            // Populate condition values
            const fieldSelect = lastCondition.querySelector('.field-select');
            const operatorSelect = lastCondition.querySelector('.operator-select');
            
            if (fieldSelect) {
                fieldSelect.value = filter.field;
                
                // Update operators based on field
                updateOperatorOptions(lastCondition.dataset.conditionId);
                
                // Set operator after field-dependent operators are loaded
                setTimeout(() => {
                    if (operatorSelect) {
                        operatorSelect.value = filter.operator;
                        
                        // Update value input based on operator
                        updateValueInput(lastCondition.dataset.conditionId);
                        
                        // Set value after input type is determined
                        setTimeout(() => {
                            setConditionValue(lastCondition, filter.value);
                        }, 50);
                    }
                }, 50);
            }
            
        } else if (filter.type === 'group') {
            // Add group with conditions
            addFilterGroup();
            const lastGroup = conditionsContainer.lastElementChild;
            
            // Note: Group logic now determined by AND/OR connectors between conditions
            
            // Clear default condition in group and add saved ones
            const groupConditionsContainer = lastGroup.querySelector('.group-conditions');
            groupConditionsContainer.innerHTML = '';
            
            filter.conditions.forEach((condition, condIndex) => {
                addConditionToGroup(lastGroup.dataset.groupId);
                const lastGroupCondition = groupConditionsContainer.lastElementChild;
                
                const fieldSelect = lastGroupCondition.querySelector('.field-select');
                const operatorSelect = lastGroupCondition.querySelector('.operator-select');
                const valueInput = lastGroupCondition.querySelector('.value-input');
                
                if (fieldSelect) fieldSelect.value = condition.field;
                if (fieldSelect && operatorSelect) {
                    updateOperatorOptions(lastGroupCondition.dataset.conditionId);
                    setTimeout(() => {
                        operatorSelect.value = condition.operator;
                    }, 10);
                }
                if (valueInput) valueInput.value = condition.value;
            });
        }
        
        // Set connector values after a small delay (to ensure DOM is ready)
        if (i < ACTIVE_FILTERS.length - 1) {
            const nextFilter = ACTIVE_FILTERS[i + 1];
            if (nextFilter.connector) {
                setTimeout(() => {
                    const connectors = conditionsContainer.querySelectorAll('.connector-select');
                    if (connectors[i]) { // i-th connector corresponds to (i+1)-th filter
                        connectors[i].value = nextFilter.connector;
                    }
                }, 50); // Small delay for DOM updates
            }
        }
    }
    
    console.log('✅ Filters reconstructed successfully');
}

function applyAdvancedFilters() {
    const conditionsContainer = document.getElementById('filterConditions');
    ACTIVE_FILTERS = [];
    
    // Parse conditions and groups with their connectors
    const allChildren = Array.from(conditionsContainer.children);
    let currentConnector = 'AND'; // Default for first condition
    
    for (let i = 0; i < allChildren.length; i++) {
        const element = allChildren[i];
        
        if (element.classList.contains('filter-condition')) {
            // Regular condition
            const field = element.querySelector('.field-select').value;
            const operator = element.querySelector('.operator-select').value;
            const value = getConditionValue(element, operator);
            
            if (field && (value || ['is_empty', 'is_not_empty', 'today', 'yesterday', 'this_week', 'this_month', 'this_year'].includes(operator))) {
                ACTIVE_FILTERS.push({
                    type: 'condition',
                    field,
                    operator,
                    value,
                    connector: currentConnector
                });
            }
        } else if (element.classList.contains('condition-group')) {
            // Group condition
            const groupConditions = [];
            const groupConditionsContainer = element.querySelector('.group-conditions');
            const groupChildren = Array.from(groupConditionsContainer.children);
            
            let groupConnector = 'AND';
            for (let j = 0; j < groupChildren.length; j++) {
                const groupChild = groupChildren[j];
                
                if (groupChild.classList.contains('filter-condition')) {
                    const field = groupChild.querySelector('.field-select').value;
                    const operator = groupChild.querySelector('.operator-select').value;
                    const value = groupChild.querySelector('.value-input').value;
                    
                    if (field && value) {
                        groupConditions.push({
                            field,
                            operator,
                            value,
                            connector: groupConnector
                        });
                    }
                } else if (groupChild.classList.contains('condition-connector')) {
                    groupConnector = groupChild.querySelector('.connector-select').value;
                }
            }
            
            if (groupConditions.length > 0) {
                ACTIVE_FILTERS.push({
                    type: 'group',
                    conditions: groupConditions,
                    connector: currentConnector
                });
            }
        } else if (element.classList.contains('condition-connector')) {
            // Update connector for next condition/group
            currentConnector = element.querySelector('.connector-select').value;
        }
    }
    
    // Update filter count badge
    const countBadge = document.getElementById('activeFiltersCount');
    if (ACTIVE_FILTERS.length > 0) {
        countBadge.textContent = ACTIVE_FILTERS.length;
        countBadge.style.display = 'flex';
        document.getElementById('openAdvancedFilter').classList.add('active');
    } else {
        countBadge.style.display = 'none';
        document.getElementById('openAdvancedFilter').classList.remove('active');
    }
    
    // Apply filters
    performInstantSearch();
    closeAdvancedFilterModal();
    
    console.log('🎯 Applied advanced filters:', ACTIVE_FILTERS);
}

function clearAllAdvancedFilters() {
    ACTIVE_FILTERS = [];
    SEARCH_TERM = '';
    
    // Reset UI
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    const countBadge = document.getElementById('activeFiltersCount');
    countBadge.style.display = 'none';
    document.getElementById('openAdvancedFilter').classList.remove('active');
    
    // Hide filter results badge
    const filterResultsBadge = document.getElementById('filterResultsBadge');
    if (filterResultsBadge) {
        filterResultsBadge.style.display = 'none';
    }
    
    // Clear conditions in modal
    const conditionsContainer = document.getElementById('filterConditions');
    conditionsContainer.innerHTML = '';
    addFilterCondition(); // Add one empty condition
    
    performInstantSearch();
    console.log('🧹 All advanced filters cleared');
}



function evaluateCondition(fieldValue, operator, targetValue, fieldName) {
    // Handle empty/null checks first
    const isEmpty = fieldValue === null || fieldValue === undefined || fieldValue === '' || 
                   (Array.isArray(fieldValue) && fieldValue.length === 0);
    
    switch (operator) {
        case 'is_empty':
            return isEmpty;
        case 'is_not_empty':
            return !isEmpty;
    }
    
    // If field is empty and operator is not empty check, return false
    if (isEmpty) {
        return false;
    }
    
    // Convert values for comparison
    const stringValue = String(fieldValue);
    const lowerFieldValue = stringValue.toLowerCase();
    const lowerTargetValue = String(targetValue).toLowerCase();
    const numericValue = parseFloat(fieldValue);
    const numericTarget = parseFloat(targetValue);
    
    switch (operator) {
        // Text operators
        case 'contains':
            if (Array.isArray(fieldValue)) {
                return fieldValue.some(item => String(item).toLowerCase().includes(lowerTargetValue));
            }
            // Handle multi-select target values (comma-separated)
            if (targetValue.includes(',')) {
                const targetValues = targetValue.split(',').map(v => v.trim().toLowerCase());
                return targetValues.some(tv => lowerFieldValue.includes(tv));
            }
            return lowerFieldValue.includes(lowerTargetValue);
            
        case 'not_contains':
            if (Array.isArray(fieldValue)) {
                return !fieldValue.some(item => String(item).toLowerCase().includes(lowerTargetValue));
            }
            return !lowerFieldValue.includes(lowerTargetValue);
            
        case 'equals':
            if (fieldName === 'checked_in') {
                return (lowerTargetValue === 'true' && fieldValue === true) ||
                       (lowerTargetValue === 'false' && fieldValue === false);
            } else if (fieldName === 'group_registration') {
                return (lowerTargetValue === 'true' && fieldValue === true) ||
                       (lowerTargetValue === 'false' && fieldValue === false);
            } else if (fieldName === 'added_time') {
                return isSameDate(fieldValue, targetValue);
            }
            if (Array.isArray(fieldValue)) {
                return fieldValue.some(item => String(item).toLowerCase() === lowerTargetValue);
            }
            // Handle multi-select target values (comma-separated)
            if (targetValue.includes(',')) {
                const targetValues = targetValue.split(',').map(v => v.trim().toLowerCase());
                return targetValues.includes(lowerFieldValue);
            }
            return lowerFieldValue === lowerTargetValue;
            
        case 'not_equals':
            if (fieldName === 'checked_in') {
                return !((lowerTargetValue === 'true' && fieldValue === true) ||
                        (lowerTargetValue === 'false' && fieldValue === false));
            } else if (fieldName === 'group_registration') {
                return !((lowerTargetValue === 'true' && fieldValue === true) ||
                        (lowerTargetValue === 'false' && fieldValue === false));
            } else if (fieldName === 'added_time') {
                return !isSameDate(fieldValue, targetValue);
            }
            if (Array.isArray(fieldValue)) {
                return !fieldValue.some(item => String(item).toLowerCase() === lowerTargetValue);
            }
            return lowerFieldValue !== lowerTargetValue;
            
        case 'starts_with':
            return lowerFieldValue.startsWith(lowerTargetValue);
            
        case 'ends_with':
            return lowerFieldValue.endsWith(lowerTargetValue);
            
        case 'regex':
            try {
                const regex = new RegExp(targetValue, 'i');
                return regex.test(stringValue);
            } catch (e) {
                console.warn('Invalid regex pattern:', targetValue);
                return false;
            }
            
        // Numeric operators
        case 'greater_than':
            return !isNaN(numericValue) && !isNaN(numericTarget) && numericValue > numericTarget;
            
        case 'greater_than_equal':
            return !isNaN(numericValue) && !isNaN(numericTarget) && numericValue >= numericTarget;
            
        case 'less_than':
            return !isNaN(numericValue) && !isNaN(numericTarget) && numericValue < numericTarget;
            
        case 'less_than_equal':
            return !isNaN(numericValue) && !isNaN(numericTarget) && numericValue <= numericTarget;
            
        case 'between':
            // targetValue should be in format "min,max"
            const [min, max] = targetValue.split(',').map(v => parseFloat(v.trim()));
            if (isNaN(min) || isNaN(max) || isNaN(numericValue)) return false;
            return numericValue >= min && numericValue <= max;
            
        // Date operators
        case 'before':
            const beforeDate1 = parseZohoDate(fieldValue);
            const beforeDate2 = parseZohoDate(targetValue);
            return beforeDate1 && beforeDate2 && beforeDate1 < beforeDate2;
            
        case 'after':
            const afterDate1 = parseZohoDate(fieldValue);
            const afterDate2 = parseZohoDate(targetValue);
            return afterDate1 && afterDate2 && afterDate1 > afterDate2;
            
        case 'today':
            const today = new Date();
            const fieldDate = parseZohoDate(fieldValue);
            return fieldDate && isSameDate(fieldDate.toDateString(), today.toDateString());
            
        case 'yesterday':
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const fieldDateYesterday = parseZohoDate(fieldValue);
            return fieldDateYesterday && isSameDate(fieldDateYesterday.toDateString(), yesterday.toDateString());
            
        case 'this_week':
            const fieldDateWeek = parseZohoDate(fieldValue);
            if (!fieldDateWeek) return false;
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            return fieldDateWeek >= startOfWeek && fieldDateWeek <= endOfWeek;
            
        case 'this_month':
            const fieldDateMonth = parseZohoDate(fieldValue);
            if (!fieldDateMonth) return false;
            const currentDate = new Date();
            return fieldDateMonth.getMonth() === currentDate.getMonth() && 
                   fieldDateMonth.getFullYear() === currentDate.getFullYear();
                   
        case 'this_year':
            const fieldDateYear = parseZohoDate(fieldValue);
            if (!fieldDateYear) return false;
            const currentYear = new Date().getFullYear();
            return fieldDateYear.getFullYear() === currentYear;
            
        default:
            console.warn('Unknown operator:', operator);
            return false;
    }
}

function setupSearchInput() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            SEARCH_TERM = e.target.value.trim();
            performInstantSearch();
        });
        console.log('🔍 Search input setup complete');
    }
}

function setupExhibitorSearchInput() {
    const exhibitorSearchInput = document.getElementById('exhibitorSearchInput');
    if (exhibitorSearchInput) {
        exhibitorSearchInput.addEventListener('input', (e) => {
            EXHIBITOR_SEARCH_TERM = e.target.value.trim();
            performExhibitorSearch();
        });
        console.log('🏢 Exhibitor search input setup complete');
    }
    
    // Setup exhibitor selection clear button
    const clearExhibitorSelectionBtn = document.getElementById('clearExhibitorSelection');
    if (clearExhibitorSelectionBtn) {
        clearExhibitorSelectionBtn.addEventListener('click', clearExhibitorSelection);
        console.log('🗑️ Exhibitor clear selection button setup complete');
    }

    // Setup exhibitor clear filter results button
    const clearExhibitorFilterResults = document.getElementById('clearExhibitorFilterResults');
    if (clearExhibitorFilterResults) {
        clearExhibitorFilterResults.addEventListener('click', clearExhibitorFilters);
        console.log('🗑️ Exhibitor clear filter results button setup complete');
    }

    // Setup exhibitor export button
    const exportExhibitorsBtn = document.getElementById('exportExhibitorsBtn');
    if (exportExhibitorsBtn) {
        exportExhibitorsBtn.addEventListener('click', exportExhibitorData);
        console.log('📤 Exhibitor export button listener added');
    }

    // Setup exhibitor import button  
    const importExhibitorsBtn = document.getElementById('importExhibitorsBtn');
    if (importExhibitorsBtn) {
        importExhibitorsBtn.addEventListener('click', () => {
            alert('Import functionality coming soon!');
        });
        console.log('📥 Exhibitor import button listener added');
    }

    // Setup exhibitor advanced filter button
    const exhibitorAdvancedFilterBtn = document.getElementById('exhibitorAdvancedFilterBtn');
    if (exhibitorAdvancedFilterBtn) {
        console.log('🔍 Found exhibitor advanced filter button:', exhibitorAdvancedFilterBtn);
        exhibitorAdvancedFilterBtn.addEventListener('click', (event) => {
            console.log('🔍 Exhibitor advanced filter button clicked!', event);
            event.preventDefault();
            openExhibitorAdvancedFilter();
        });
        console.log('🔍 Exhibitor advanced filter button setup complete');
    } else {
        console.error('❌ Exhibitor advanced filter button not found!');
    }
}

// Export exhibitor data to CSV
function exportExhibitorData() {
    if (!ALL_EXHIBITORS || ALL_EXHIBITORS.length === 0) {
        alert('No exhibitor data to export');
        return;
    }

    const selectedExhibitors = getSelectedExhibitors();
    const dataToExport = selectedExhibitors.length > 0 ? selectedExhibitors : FILTERED_EXHIBITORS;
    
    if (dataToExport.length === 0) {
        alert('No exhibitors to export');
        return;
    }
    
    // Create CSV content
    const headers = [
        'ID', 'Company Name (EN)', 'Company Name (VI)', 'Booth No.', 
        'Representative Name', 'Email', 'Phone', 'Booth Area', 
        'Employees Count', 'Products Count'
    ];
    
    const csvContent = [
        headers.join(','),
        ...dataToExport.map(exhibitor => [
            exhibitor.id,
            `"${exhibitor.company_name_en || 'N/A'}"`,
            `"${exhibitor.company_name_vi || 'N/A'}"`,
            exhibitor.booth_no || 'N/A',
            `"${exhibitor.representative_name || 'N/A'}"`,
            exhibitor.representative_email || 'N/A',
            exhibitor.raw?.Phone || 'N/A',
            exhibitor.booth_area || 0,
            exhibitor.employees_count || 0,
            exhibitor.products_count || 0
        ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const selectedCount = selectedExhibitors.length;
    const filename = selectedCount > 0 
        ? `exhibitors_selected_${selectedCount}_${new Date().toISOString().split('T')[0]}.csv`
        : `exhibitors_filtered_${dataToExport.length}_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.download = filename;
    link.click();
    
    console.log(`📤 Exported ${dataToExport.length} exhibitors to ${filename}`);
}

function getSelectedExhibitors() {
    return ALL_EXHIBITORS.filter(exhibitor => SELECTED_EXHIBITOR_IDS.has(exhibitor.id));
}

// ===== EXHIBITOR ADVANCED FILTER SYSTEM =====
let ACTIVE_EXHIBITOR_FILTERS = [];

function getAvailableExhibitorFields() {
    const baseFields = [
        { key: 'company_name_en', label: 'Company Name (EN)', type: 'text' },
        { key: 'company_name_vi', label: 'Company Name (VI)', type: 'text' },
        { key: 'booth_no', label: 'Booth Number', type: 'text' },
        { key: 'representative_name', label: 'Representative Name', type: 'text' },
        { key: 'representative_email', label: 'Representative Email', type: 'text' },
        { key: 'booth_area', label: 'Booth Area', type: 'text' },
        { key: 'employees_count', label: 'Employees Count', type: 'text' },
        { key: 'products_count', label: 'Products Count', type: 'text' }
    ];

    // Add dynamic fields from exhibitor raw data if available
    if (ALL_EXHIBITORS.length > 0) {
        const sampleExhibitor = ALL_EXHIBITORS[0];
        if (sampleExhibitor.raw) {
            const additionalFields = [
                { key: 'raw.Phone', label: 'Phone', type: 'text' },
                { key: 'raw.Fax', label: 'Fax', type: 'text' },
                { key: 'raw.Website', label: 'Website', type: 'text' },
                { key: 'raw.Country', label: 'Country', type: 'text' },
                { key: 'raw.City', label: 'City', type: 'text' },
                { key: 'raw.Company_Size', label: 'Company Size', type: 'text' },
                { key: 'raw.Business_Type', label: 'Business Type', type: 'text' },
                { key: 'raw.Industry', label: 'Industry', type: 'text' }
            ];
            
            // Only add fields that exist in the data
            additionalFields.forEach(field => {
                const fieldKey = field.key.replace('raw.', '');
                if (sampleExhibitor.raw[fieldKey] !== undefined) {
                    baseFields.push(field);
                }
            });
        }
    }

    return baseFields;
}

function openExhibitorAdvancedFilter() {
    console.log('🔍 openExhibitorAdvancedFilter called!');
    
    try {
        const modal = document.getElementById('exhibitorAdvancedFilterModal');
        console.log('🔍 Found modal:', modal);
        
        if (!modal) {
            console.error('❌ Exhibitor advanced filter modal not found!');
            return;
        }
        
        // Clear existing conditions
        const conditionsContainer = document.getElementById('exhibitorFilterConditions');
        console.log('🔍 Found conditions container:', conditionsContainer);
        conditionsContainer.innerHTML = '';
        
        // Add first condition if none exist
        if (ACTIVE_EXHIBITOR_FILTERS.length === 0) {
            console.log('🔍 Adding new exhibitor filter condition...');
            addExhibitorFilterCondition();
        } else {
            console.log('🔍 Populating existing exhibitor filters...');
            populateExistingExhibitorFilters();
        }
        
        // Setup event handlers for exhibitor mode
        console.log('🔍 Setting up exhibitor modal event handlers...');
        setupExhibitorModalEventHandlers();
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        console.log('✅ Exhibitor advanced filter modal opened successfully');
    } catch (error) {
        console.error('❌ Error opening exhibitor advanced filter:', error);
    }
}

function closeExhibitorAdvancedFilterModal() {
    const modal = document.getElementById('exhibitorAdvancedFilterModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

function addExhibitorFilterCondition() {
    const conditionsContainer = document.getElementById('exhibitorFilterConditions');
    const conditionId = 'exhibitor_condition_' + Date.now();
    const isFirstCondition = conditionsContainer.children.length === 0;
    
    const fields = getAvailableExhibitorFields();
    
    const conditionHTML = `
        <div class="filter-condition" data-condition-id="${conditionId}">
            <select class="field-select" onchange="updateOperatorOptions('${conditionId}')">
                <option value="">Select field...</option>
                ${fields.map(field => 
                    `<option value="${field.key}" data-type="${field.type}">${field.label}</option>`
                ).join('')}
            </select>
            <select class="operator-select">
                <option value="">Select operator...</option>
            </select>
            <input type="text" class="value-input" placeholder="Enter value">
            <button class="remove-condition" onclick="removeFilterCondition('${conditionId}')" title="Remove condition">
                <i class="fas fa-recycle"></i>
            </button>
        </div>
    `;
    
    conditionsContainer.insertAdjacentHTML('beforeend', conditionHTML);
    
    // Add connector before this condition (except for first)
    if (!isFirstCondition) {
        const connectorHTML = `
            <div class="condition-connector">
                <select class="connector-select">
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                </select>
            </div>
        `;
        const newCondition = conditionsContainer.lastElementChild;
        newCondition.insertAdjacentHTML('beforebegin', connectorHTML);
    }
    
    console.log('➕ Added exhibitor filter condition');
}

function populateExistingExhibitorFilters() {
    const conditionsContainer = document.getElementById('exhibitorFilterConditions');
    conditionsContainer.innerHTML = '';
    
    for (let i = 0; i < ACTIVE_EXHIBITOR_FILTERS.length; i++) {
        const filter = ACTIVE_EXHIBITOR_FILTERS[i];
        
        if (filter.type === 'condition') {
            addExhibitorFilterCondition();
            
            // Get the last added condition
            const conditions = conditionsContainer.querySelectorAll('.filter-condition');
            const lastCondition = conditions[conditions.length - 1];
            
            const fieldSelect = lastCondition.querySelector('.field-select');
            const operatorSelect = lastCondition.querySelector('.operator-select');
            const valueInput = lastCondition.querySelector('.value-input');
            
            if (fieldSelect && operatorSelect) {
                fieldSelect.value = filter.field;
                updateOperatorOptions(lastCondition.dataset.conditionId);
                
                setTimeout(() => {
                    operatorSelect.value = filter.operator;
                    valueInput.value = filter.value;
                }, 10);
            }
        }
    }
    
    console.log('✅ Exhibitor filters reconstructed successfully');
}

function setupExhibitorModalEventHandlers() {
    // Get exhibitor modal buttons
    const applyBtn = document.getElementById('applyExhibitorFilters');
    const clearBtn = document.getElementById('clearAllExhibitorFilters');
    const addConditionBtn = document.getElementById('addExhibitorFilterCondition');
    const addGroupBtn = document.getElementById('addExhibitorFilterGroup');
    
    // Clone buttons to remove existing event listeners
    const newApplyBtn = applyBtn.cloneNode(true);
    const newClearBtn = clearBtn.cloneNode(true);
    const newAddConditionBtn = addConditionBtn.cloneNode(true);
    const newAddGroupBtn = addGroupBtn.cloneNode(true);
    
    // Replace old buttons
    applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
    clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
    addConditionBtn.parentNode.replaceChild(newAddConditionBtn, addConditionBtn);
    addGroupBtn.parentNode.replaceChild(newAddGroupBtn, addGroupBtn);
    
    // Add new event listeners for exhibitor mode
    newApplyBtn.addEventListener('click', applyExhibitorAdvancedFilters);
    newClearBtn.addEventListener('click', clearAllExhibitorAdvancedFilters);
    newAddConditionBtn.addEventListener('click', addExhibitorFilterCondition);
    newAddGroupBtn.addEventListener('click', () => {
        alert('Exhibitor filter groups coming soon!');
    });
}

function applyExhibitorAdvancedFilters() {
    const conditionsContainer = document.getElementById('exhibitorFilterConditions');
    ACTIVE_EXHIBITOR_FILTERS = [];
    
    // Parse conditions with their connectors
    const allChildren = Array.from(conditionsContainer.children);
    let currentConnector = 'AND';
    
    for (let i = 0; i < allChildren.length; i++) {
        const element = allChildren[i];
        
        if (element.classList.contains('filter-condition')) {
            const field = element.querySelector('.field-select').value;
            const operator = element.querySelector('.operator-select').value;
            const value = element.querySelector('.value-input').value;
            
            if (field && operator && value) {
                ACTIVE_EXHIBITOR_FILTERS.push({
                    type: 'condition',
                    field,
                    operator,
                    value,
                    connector: currentConnector
                });
            }
        } else if (element.classList.contains('condition-connector')) {
            const connectorSelect = element.querySelector('.connector-select');
            currentConnector = connectorSelect.value;
        }
    }
    
    console.log('🔍 Applied exhibitor filters:', ACTIVE_EXHIBITOR_FILTERS);
    
    // Apply filters and refresh display
    performExhibitorSearch();
    updateExhibitorFilterBadge();
    
    // Close modal
    closeExhibitorAdvancedFilterModal();
}

function clearAllExhibitorAdvancedFilters() {
    ACTIVE_EXHIBITOR_FILTERS = [];
    
    const conditionsContainer = document.getElementById('exhibitorFilterConditions');
    conditionsContainer.innerHTML = '';
    
    addExhibitorFilterCondition();
    
    // Refresh display
    performExhibitorSearch();
    updateExhibitorFilterBadge();
    
    console.log('🧹 All exhibitor advanced filters cleared');
}

function updateExhibitorFilterBadge() {
    const filterCount = document.getElementById('exhibitorFilterCount');
    const filterBtn = document.getElementById('exhibitorAdvancedFilterBtn');
    
    if (ACTIVE_EXHIBITOR_FILTERS.length > 0) {
        filterCount.textContent = ACTIVE_EXHIBITOR_FILTERS.length;
        filterCount.style.display = 'inline';
        filterBtn.classList.add('active');
    } else {
        filterCount.style.display = 'none';
        filterBtn.classList.remove('active');
    }
}

function updateExhibitorFilterResultsBadge(filteredCount, hasActiveFilters) {
    const filterBadge = document.getElementById('exhibitorFilterResultsBadge');
    const filterResultsCount = document.getElementById('exhibitorFilterResultsCount');
    
    if (hasActiveFilters && filteredCount !== ALL_EXHIBITORS.length) {
        filterResultsCount.textContent = filteredCount;
        filterBadge.style.display = 'flex';
    } else {
        filterBadge.style.display = 'none';
    }
}

function checkExhibitorAdvancedFilters(exhibitor) {
    if (ACTIVE_EXHIBITOR_FILTERS.length === 0) return true;
    
    let finalResult = true;
    
    for (let i = 0; i < ACTIVE_EXHIBITOR_FILTERS.length; i++) {
        const filter = ACTIVE_EXHIBITOR_FILTERS[i];
        let currentResult;
        
        if (filter.type === 'condition') {
            const { field, operator, value } = filter;
            let fieldValue = getExhibitorFieldValue(exhibitor, field);
            
            currentResult = evaluateCondition(fieldValue, operator, value, field);
        }
        
        if (i === 0) {
            finalResult = currentResult;
        } else {
            const connector = filter.connector;
            if (connector === 'AND') {
                finalResult = finalResult && currentResult;
            } else {
                finalResult = finalResult || currentResult;
            }
        }
    }
    
    return finalResult;
}

function getExhibitorFieldValue(exhibitor, field) {
    if (field.startsWith('raw.')) {
        const nestedField = field.replace('raw.', '');
        return exhibitor.raw?.[nestedField];
    }
    return exhibitor[field];
}

function clearExhibitorFilters() {
    // Clear search term
    EXHIBITOR_SEARCH_TERM = '';
    const searchInput = document.getElementById('exhibitorSearchInput');
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Clear advanced filters
    ACTIVE_EXHIBITOR_FILTERS = [];
    
    // Update badges
    updateExhibitorFilterBadge();
    updateExhibitorFilterResultsBadge(ALL_EXHIBITORS.length, false);
    
    // Refresh display
    performExhibitorSearch();
    
    console.log('🧹 All exhibitor filters cleared');
}

// ===== 12. EVENT LISTENERS =====
function setupExportImportListeners() {
    const exportBtn = document.getElementById('exportVisitors');
    const importBtn = document.getElementById('importVisitors');
    const clearSelectionBtn = document.getElementById('clearSelection');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportVisitors);
        console.log('📤 Export button listener added');
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', showImportModal);
        console.log('📥 Import button listener added');
    }
    
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearAllSelection);
        console.log('🗑️ Clear selection button listener added');
    }
    
    // Close import modal on outside click
    const importModal = document.getElementById('importModal');
    if (importModal) {
        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) {
                closeImportModal();
            }
        });
    }
    
    // Close modals on Escape key and outside click
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const importModal = document.getElementById('importModal');
            const advancedFilterModal = document.getElementById('advancedFilterModal');
            
            if (importModal?.classList.contains('show')) {
                closeImportModal();
            }
            if (advancedFilterModal?.classList.contains('show')) {
                closeAdvancedFilterModal();
            }
        }
    });

    // Close advanced filter modal on outside click
    const advancedFilterModal = document.getElementById('advancedFilterModal');
    if (advancedFilterModal) {
        advancedFilterModal.addEventListener('click', (e) => {
            if (e.target === advancedFilterModal) {
                closeAdvancedFilterModal();
            }
        });
    }
}

// ===== 13. GLOBAL EXPORTS =====
window.initializeWidget = initializeWidget;
window.displayPage = displayPage;
window.performInstantSearch = performInstantSearch;
window.formatDate = formatDate;
window.toggleSelectAll = toggleSelectAll;
window.toggleVisitorSelect = toggleVisitorSelect;
window.getSelectedVisitors = getSelectedVisitors;
window.clearAllSelection = clearAllSelection;
window.exportVisitors = exportVisitors;
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.showAdvancedFilterModal = showAdvancedFilterModal;
window.closeAdvancedFilterModal = closeAdvancedFilterModal;
window.addFilterCondition = addFilterCondition;
window.addFilterGroup = addFilterGroup;
window.addConditionToGroup = addConditionToGroup;
window.removeFilterCondition = removeFilterCondition;
window.removeConditionFromGroup = removeConditionFromGroup;
window.removeFilterGroup = removeFilterGroup;
window.updateOperatorOptions = updateOperatorOptions;
window.updateConnectorLogic = updateConnectorLogic;
window.clearVisitorCache = clearVisitorCache;

// Exhibitor functions
window.displayExhibitorPage = displayExhibitorPage;
window.performExhibitorSearch = performExhibitorSearch;
window.toggleExhibitorSelectAll = toggleExhibitorSelectAll;
window.toggleExhibitorSelect = toggleExhibitorSelect;
window.clearExhibitorSelection = clearExhibitorSelection;
window.viewExhibitorDetails = viewExhibitorDetails;
window.exportExhibitorData = exportExhibitorData;
window.getSelectedExhibitors = getSelectedExhibitors;
window.openExhibitorAdvancedFilter = openExhibitorAdvancedFilter;
window.addExhibitorFilterCondition = addExhibitorFilterCondition;
window.applyExhibitorAdvancedFilters = applyExhibitorAdvancedFilters;
window.clearAllExhibitorAdvancedFilters = clearAllExhibitorAdvancedFilters;
window.clearExhibitorFilters = clearExhibitorFilters;
window.closeExhibitorModal = closeExhibitorModal;
window.clearExhibitorCache = clearExhibitorCache;
window.checkCacheInfo = function() {
    const cached = localStorage.getItem(VISITOR_CACHE_KEY);
    if (cached) {
        const size = new Blob([cached]).size;
        const data = JSON.parse(cached);
        console.log('📦 Cache Info:', {
            size: (size / 1024 / 1024).toFixed(2) + ' MB',
            eventId: data.eventId,
            visitorCount: data.totalCount,
            timestamp: new Date(data.timestamp).toLocaleString(),
            age: ((Date.now() - data.timestamp) / (1000 * 60 * 60)).toFixed(1) + ' hours'
        });
        return data;
    } else {
        console.log('📦 No cache found');
        return null;
    }
};

// ===== 8. AUTO-START =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, starting widget...');
    initializeWidget();
});

console.log('✅ Minimal widget script loaded');