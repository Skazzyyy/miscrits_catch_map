/**
 * Pure JavaScript Nakama Client for Browser
 * This implements the essential Nakama client functionality using fetch() API
 * No external dependencies required
 */

class NakamaClient {
    constructor(serverKey, serverHost, serverPort = 443, useSSL = true) {
        this.serverKey = serverKey;
        this.serverHost = serverHost;
        this.serverPort = serverPort;
        this.useSSL = useSSL;
        this.token = null;
        this.refreshToken = null;
        this.userId = null;
        
        // Base URL for all API calls
        this.baseUrl = `${useSSL ? 'https' : 'http'}://${serverHost}${serverPort !== (useSSL ? 443 : 80) ? ':' + serverPort : ''}`;
        this.apiUrl = `${this.baseUrl}/v2`;
        this.rpcUrl = `${this.baseUrl}/v2/rpc`;
        
        console.log(`[NakamaClient] Initialized with server: ${this.baseUrl}`);
    }

    /**
     * Create authentication headers
     */
    getAuthHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (includeAuth && this.token) {
            // Use session token for authenticated requests
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    /**
     * Authenticate with email and password
     */
    async authenticateEmail(email, password, create = false) {
        console.log(`[NakamaClient] Authenticating email: ${email} (create: ${create})`);
        
        // Use the correct authentication endpoint and Basic Auth
        const url = `${this.apiUrl}/account/authenticate/email`;
        const payload = {
            email: email,
            password: password
        };

        // Create Basic Auth header with server key as username and empty password
        const basicAuth = btoa(this.serverKey + ':');
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${basicAuth}`
        };

        console.log(`[NakamaClient] Making authentication request to: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });
            
            console.log(`[NakamaClient] Auth response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[NakamaClient] Auth error response:`, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(`[NakamaClient] Auth response data:`, data);

            if (data.token) {
                this.token = data.token;
                this.refreshToken = data.refresh_token;
                this.userId = data.user?.id;
                
                console.log(`[NakamaClient] Authentication successful`);
                return data;
            } else {
                throw new Error('Authentication failed: No token received');
            }
            
        } catch (error) {
            console.error(`[NakamaClient] Authentication failed:`, error);
            throw error;
        }
    }

    /**
     * Make RPC call to server
     */
    async rpc(session, id, payload = '{}', httpKey = null) {
        if (!session || !session.token) {
            throw new Error('Must provide valid session for RPC calls');
        }

        console.log(`[NakamaClient] Making RPC call: ${id}`);
        
        const url = `${this.rpcUrl}/${id}?unwrap`;  // Add unwrap query parameter
        
        try {
            // Make direct fetch call with session token
            // Add unwrap query parameter to handle raw JSON payload correctly
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',  // Back to JSON since we're sending JSON with unwrap
                    'Authorization': `Bearer ${session.token}`
                },
                body: payload  // Send as raw string with unwrap parameter
            });
            
            console.log(`[NakamaClient] Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[NakamaClient] Error response:`, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log(`[NakamaClient] RPC ${id} response:`, data);
            return data;
            
        } catch (error) {
            console.error(`[NakamaClient] RPC ${id} failed:`, error);
            throw error;
        }
    }

    /**
     * Get current session info
     */
    getSession() {
        return {
            token: this.token,
            refresh_token: this.refreshToken,
            user_id: this.userId,
            isValid: !!this.token
        };
    }

    /**
     * Restore session from stored session data
     */
    async restoreSession(sessionData) {
        console.log(`[NakamaClient] Restoring session for user: ${sessionData.username}`);
        
        this.token = sessionData.token;
        this.refreshToken = sessionData.refresh_token;
        this.userId = sessionData.user_id;
        
        // Verify the session is still valid by making a test request
        try {
            const response = await fetch(`${this.apiUrl}/account`, {
                method: 'GET',
                headers: this.getAuthHeaders(true)
            });
            
            if (!response.ok) {
                throw new Error(`Session validation failed: ${response.status}`);
            }
            
            console.log(`[NakamaClient] Session restored and validated successfully`);
            return {
                token: this.token,
                refresh_token: this.refreshToken,
                user_id: this.userId,
                username: sessionData.username
            };
        } catch (error) {
            console.error(`[NakamaClient] Session restoration failed:`, error);
            this.logout();
            throw error;
        }
    }

    /**
     * Get current session object
     */
    getSession() {
        if (!this.isAuthenticated()) {
            return null;
        }
        
        return {
            token: this.token,
            refresh_token: this.refreshToken,
            user_id: this.userId
        };
    }

    /**
     * Check if client is authenticated
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * Logout and clear session
     */
    logout() {
        console.log(`[NakamaClient] Logging out`);
        this.token = null;
        this.refreshToken = null;
        this.userId = null;
    }
}
