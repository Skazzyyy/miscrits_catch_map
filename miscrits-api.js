/**
 * Miscrits API Client for Browser
 * Handles authentication and player data retrieval
 */

class MiscritsAPI {
    constructor() {
        // Server configuration from the game's source code
        this.serverKey = "a1c737cc188f54ab3658ba5da0e12ee5";
        this.serverHost = "worldofmiscrits.com";
        this.serverPort = 443;
        
        this.client = new NakamaClient(this.serverKey, this.serverHost, this.serverPort, true);
        this.playerData = null;
        this.cookieName = 'miscrits_session'; // Only session data is cached in cookies
        
        console.log(`[MiscritsAPI] Initialized with server: ${this.serverHost}:${this.serverPort}`);
    }

    /**
     * Set a secure cookie with expiration
     */
    setCookie(name, value, days = 7) {
        try {
            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
            
            const cookieValue = `${name}=${encodeURIComponent(JSON.stringify(value))}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure=${location.protocol === 'https:'}`;
            document.cookie = cookieValue;
            
            console.log(`[MiscritsAPI] Cookie '${name}' set successfully`);
        } catch (error) {
            console.error(`[MiscritsAPI] Failed to set cookie '${name}':`, error);
        }
    }

    /**
     * Get cookie value
     */
    getCookie(name) {
        try {
            const nameEQ = name + "=";
            const cookies = document.cookie.split(';');
            
            for (let cookie of cookies) {
                let c = cookie.trim();
                if (c.indexOf(nameEQ) === 0) {
                    const value = c.substring(nameEQ.length);
                    return JSON.parse(decodeURIComponent(value));
                }
            }
            return null;
        } catch (error) {
            console.error(`[MiscritsAPI] Failed to get cookie '${name}':`, error);
            return null;
        }
    }

    /**
     * Delete a cookie
     */
    deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
        console.log(`[MiscritsAPI] Cookie '${name}' deleted`);
    }

    /**
     * Store session in cookies (persistent across server restarts)
     */
    storeSession(session) {
        try {
            const sessionData = {
                token: session.token,
                refresh_token: session.refresh_token,
                username: session.username,
                user_id: session.user_id,
                created_at: session.created_at,
                expires_at: session.expires_at,
                stored_at: Date.now()
            };
            
            // Store session for 7 days by default
            this.setCookie(this.cookieName, sessionData, 7);
            console.log(`[MiscritsAPI] Session stored in cookies successfully`);
        } catch (error) {
            console.error(`[MiscritsAPI] Failed to store session in cookies:`, error);
        }
    }

    /**
     * Retrieve session from cookies
     */
    retrieveStoredSession() {
        try {
            const sessionData = this.getCookie(this.cookieName);
            if (!sessionData) {
                return null;
            }
            
            // Check if session is expired
            const now = Date.now() / 1000; // Convert to seconds
            if (sessionData.expires_at && now >= sessionData.expires_at) {
                console.log(`[MiscritsAPI] Stored session has expired`);
                this.clearStoredSession();
                return null;
            }
            
            console.log(`[MiscritsAPI] Retrieved valid stored session from cookies`);
            return sessionData;
        } catch (error) {
            console.error(`[MiscritsAPI] Failed to retrieve stored session from cookies:`, error);
            this.clearStoredSession();
            return null;
        }
    }

    /**
     * Clear stored session
     */
    clearStoredSession() {
        this.deleteCookie(this.cookieName);
        console.log(`[MiscritsAPI] Stored session cleared from cookies`);
    }

    async restoreSession() {
        const storedSession = this.retrieveStoredSession();
        if (!storedSession) {
            return false;
        }
        
        try {
            // Restore the session in the client
            await this.client.restoreSession(storedSession);
            console.log(`[MiscritsAPI] Session restored successfully for user: ${storedSession.username}`);
            return true;
        } catch (error) {
            console.error(`[MiscritsAPI] Failed to restore session:`, error);
            this.clearStoredSession();
            return false;
        }
    }

    /**
     * Authenticate user with email and password
     */
    async authenticate(email, password) {
        console.log(`[MiscritsAPI] Authenticating user: ${email}`);
        
        try {
            const session = await this.client.authenticateEmail(email, password, false);
            
            // Store the session for future use
            this.storeSession(session);
            
            console.log(`[MiscritsAPI] Authentication successful`);
            return session;
        } catch (error) {
            console.error(`[MiscritsAPI] Authentication failed:`, error);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Get complete player data including miscrits
     * Always fetches fresh data from the server
     */
    async getPlayerData() {
        if (!this.client.isAuthenticated()) {
            throw new Error('Must authenticate before fetching player data');
        }

        console.log(`[MiscritsAPI] Fetching player data from server...`);
        
        try {
            // Get the session object from authentication
            const session = this.client.getSession();
            if (!session || !session.token) {
                throw new Error('No valid session available');
            }
            
            const response = await this.client.rpc(session, 'get_player', '{}');
            
            console.log(`[MiscritsAPI] Raw RPC response:`, response);
            
            // Check if the response is successful
            if (!response.success) {
                throw new Error(`Server error: ${response.code || 'Unknown error'}`);
            }
            
            // The actual player data is in the 'data' field as a JSON string
            let playerData;
            if (typeof response.data === 'string') {
                try {
                    playerData = JSON.parse(response.data);
                    console.log(`[MiscritsAPI] Parsed player data successfully`);
                } catch (parseError) {
                    console.error(`[MiscritsAPI] Failed to parse player data JSON:`, parseError);
                    throw new Error(`Failed to parse player data: ${parseError.message}`);
                }
            } else {
                // If data is already an object
                playerData = response.data;
            }

            // Store player data in memory only
            this.playerData = playerData;
            
            console.log(`[MiscritsAPI] Player data retrieved successfully`);
            console.log(`[MiscritsAPI] Player: ${playerData.username} (Level ${playerData.level})`);
            console.log(`[MiscritsAPI] Miscrits count: ${playerData.miscrits ? playerData.miscrits.length : 0}`);
            
            return playerData;
            
        } catch (error) {
            console.error(`[MiscritsAPI] Failed to fetch player data:`, error);
            throw new Error(`Failed to fetch player data: ${error.message}`);
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.client.isAuthenticated();
    }

    /**
     * Logout user
     */
    logout() {
        this.client.logout();
        this.playerData = null;
        this.clearStoredSession();
        console.log(`[MiscritsAPI] User logged out`);
    }

    /**
     * Get stored player data
     */
    getStoredPlayerData() {
        return this.playerData;
    }
}
