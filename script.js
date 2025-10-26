// Miscrits Map - JavaScript Logic

class MiscritsApp {
    constructor() {
        this.miscrits = [];
        this.filteredMiscrits = [];
        this.isAdminMode = false;
        this.isLoggedIn = false;
        this.miscritsApi = null;
        this.playerData = null;
        this.locationOrder = [
            'Forest',
            'Hidden Forest',
            'Mansion',
            'Mount Gemma',
            'Cave',
            'Sunfall Shores',
            'Moon'
        ];
        this.rarityOrder = ['Common', 'Rare', 'Epic', 'Exotic', 'Legendary'];
        this.init();
    }

    async init() {
        try {
            await this.loadMiscrits();
            await this.loadJsonData(); // Load JSON data for potential use
            this.setupEventListeners();
            
            // Try to restore saved session
            await this.tryRestoreSession();
            
            this.processMiscrits();
            // Initialize data source and filters before first render
            this.initializeDataSource();
            // Apply initial filtering after data source is set up
            this.filterMiscrits();
            this.renderMiscrits();
            this.initializeTimeDisplay();
            this.hideLoading();
        } catch (error) {
            this.showError(error.message);
        }
    }

    generateUUID() {
        // Generate a UUID v4
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async loadMiscrits() {
        const response = await fetch('https://cdn.worldofmiscrits.com/miscrits.json');
        if (!response.ok) {
            throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        this.miscrits = await response.json();
    }

    async loadJsonData() {
        try {
            const response = await fetch('miscrits_data.json');
            if (response.ok) {
                this.cachedJsonData = await response.json();
            } else {
                this.cachedJsonData = null;
            }
        } catch (error) {
            this.cachedJsonData = null;
        }
    }

    setupEventListeners() {
        const locationFilter = document.getElementById('location-filter');
        const areaFilter = document.getElementById('area-filter');
        const rarityFilter = document.getElementById('rarity-filter');
        const elementFilter = document.getElementById('element-filter');
        const searchFilter = document.getElementById('search-filter');

        locationFilter.addEventListener('change', () => {
            this.updateAreaFilter();
            this.filterMiscrits();
        });
        areaFilter.addEventListener('change', () => this.filterMiscrits());
        rarityFilter.addEventListener('change', () => this.filterMiscrits());
        elementFilter.addEventListener('change', () => this.filterMiscrits());
        
        // Day filter
        const dayFilter = document.getElementById('day-filter');
        dayFilter.addEventListener('change', () => {
            this.filterMiscrits();
        });
        
        searchFilter.addEventListener('input', () => this.filterMiscrits());

        // Ownership filter (will be shown/hidden based on login status)
        const ownershipFilter = document.getElementById('ownership-filter');
        if (ownershipFilter) {
            ownershipFilter.addEventListener('change', () => {
                this.filterMiscrits();
            });
        }

        // Admin mode button
        const adminModeBtn = document.getElementById('admin-mode-btn');
        adminModeBtn.addEventListener('click', () => this.showAdminModeWarning());

        // Export data button (only visible in admin mode)
        const exportBtn = document.getElementById('export-data-btn');
        exportBtn.addEventListener('click', () => this.exportData());

        // Clear all markers button (only visible in admin mode)
        const clearBtn = document.getElementById('clear-markers-btn');
        clearBtn.addEventListener('click', () => this.showClearMarkersConfirmation());

        // Clear local storage button (error screen)
        const clearStorageBtn = document.getElementById('clear-storage-btn');
        if (clearStorageBtn) {
            clearStorageBtn.addEventListener('click', () => this.clearLocalStorage());
        }

        // Exit admin mode button
        const exitAdminBtn = document.getElementById('exit-admin-btn');
        exitAdminBtn.addEventListener('click', () => this.exitAdminMode());

        // Data source selector
        const dataSourceSelect = document.getElementById('data-source-select');
        dataSourceSelect.addEventListener('change', () => this.switchDataSource());

        // Import from JSON button
        const importJsonBtn = document.getElementById('import-json-btn');
        importJsonBtn.addEventListener('click', () => this.importFromJsonFile());

        // Load from file button
        const loadFileBtn = document.getElementById('load-file-btn');
        loadFileBtn.addEventListener('click', () => this.showFileInput());

        // File input
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
        
        // Admin help toggle
        this.setupAdminHelpToggle();
        
        // Login functionality
        this.setupLoginEventListeners();
    }

    processMiscrits() {
        // Create separate entries for each location a miscrit appears in
        const processedMiscrits = [];
        
        this.miscrits.forEach(miscrit => {
            if (!miscrit.locations || Object.keys(miscrit.locations).length === 0) {
                // If no location data, create one entry with unknown location
                const processedMiscrit = {
                    ...miscrit,
                    firstName: miscrit.names?.[0] || 'Unknown',
                    imageUrl: this.getImageUrl(miscrit.names?.[0]),
                    elementImageUrl: this.getElementImageUrl(miscrit.element),
                    primaryLocation: 'Unknown',
                    locationInfo: this.getLocationInfoForSpecificLocation('Unknown', {})
                };
                processedMiscrits.push(processedMiscrit);
            } else {
                // Create separate entries for each location
                Object.entries(miscrit.locations).forEach(([locationName, areas]) => {
                    const processedMiscrit = {
                        ...miscrit,
                        firstName: miscrit.names?.[0] || 'Unknown',
                        imageUrl: this.getImageUrl(miscrit.names?.[0]),
                        elementImageUrl: this.getElementImageUrl(miscrit.element),
                        primaryLocation: locationName,
                        currentLocationAreas: areas,
                        locationInfo: this.getLocationInfoForSpecificLocation(locationName, areas)
                    };
                    processedMiscrits.push(processedMiscrit);
                });
            }
        });

        // Replace the original miscrits array with processed entries
        this.miscrits = processedMiscrits;

        // Populate location filter
        const locationFilter = document.getElementById('location-filter');
        const locations = [...new Set(this.miscrits.map(m => m.primaryLocation))].sort(
            (a, b) => this.locationOrder.indexOf(a) - this.locationOrder.indexOf(b)
        );
        
        locations.forEach(location => {
            if (location) {
                const option = document.createElement('option');
                option.value = location;
                option.textContent = location;
                locationFilter.appendChild(option);
            }
        });

        // Populate area filter initially (will be updated when location changes)
        this.updateAreaFilter();

        // Populate element filter
        const elementFilter = document.getElementById('element-filter');
        const elements = [...new Set(this.miscrits.map(m => m.element))].filter(Boolean).sort();
        
        elements.forEach(element => {
            const option = document.createElement('option');
            option.value = element;
            option.textContent = element;
            elementFilter.appendChild(option);
        });

        this.filteredMiscrits = [...this.miscrits];
        this.updateStats();
    }

    updateAreaFilter() {
        const locationFilter = document.getElementById('location-filter');
        const areaFilter = document.getElementById('area-filter');
        const selectedLocation = locationFilter.value;
        
        // Clear existing options
        areaFilter.innerHTML = '<option value="">All Areas</option>';
        
        // If no location selected or Unknown location, disable area filter
        if (!selectedLocation || selectedLocation === 'Unknown') {
            areaFilter.disabled = true;
            return;
        }
        
        // Enable area filter
        areaFilter.disabled = false;
        
        // Location name mappings
        const locationNameMap = {
            'Forest': {
                '1': 'Azore Lake',
                '2': 'Woodsman\'s Axe', 
                '3': 'Magic Flower',
                '4': 'Elder Tree'
            },
            'Hidden Forest': {},
            'Mansion': {
                '1': 'Outside',
                '2': 'Ground Floor',
                '3': '2nd Floor',
                '4': 'Attic (Middle)',
                '5': 'Attic (Right)',
                '6': 'Attic (Left)'
            },
            'Mount Gemma': {
                '1': 'Gemma Flats',
                '2': 'Eternal Falls',
                '3': 'The Shack',
                '4': 'Crystal Cliffs'
            },
            'Cave': {
                '1': 'Cave Entrance',
                '2': 'Hole',
                '3': 'Lost Treasure',
                '4': 'Ice Cavern'
            },
            'Sunfall Shores': {
                '1': 'Sand Castle',
                '2': 'Ship Graveyard',
                '3': 'Jagged Treasure',
                '4': 'Dead Island'
            },
            'Moon': {
                '1': 'The Moon Surface',
                '2': 'Cave of the Moon'
            }
        };
        
        // For Hidden Forest, no areas to show
        if (selectedLocation === 'Hidden Forest') {
            return;
        }
        
        // Get unique areas for the selected location from actual data
        const areasInLocation = [...new Set(this.miscrits
            .filter(m => m.primaryLocation === selectedLocation)
            .flatMap(m => {
                if (!m.currentLocationAreas) return [];
                return Object.keys(m.currentLocationAreas);
            })
        )].sort((a, b) => parseInt(a) - parseInt(b));
        
        // Add areas to filter with proper names
        areasInLocation.forEach(areaNum => {
            const areaName = locationNameMap[selectedLocation]?.[areaNum];
            const option = document.createElement('option');
            option.value = areaNum;
            if (areaName) {
                option.textContent = `Area ${areaNum} - ${areaName}`;
            } else {
                option.textContent = `Area ${areaNum}`;
            }
            areaFilter.appendChild(option);
        });
    }

    getPrimaryLocation(miscrit) {
        if (!miscrit.locations) return 'Unknown';
        
        const locations = Object.keys(miscrit.locations);
        if (locations.length === 0) return 'Unknown';
        
        // Return the first location found, prioritized by our order
        for (const location of this.locationOrder) {
            if (locations.includes(location)) {
                return location;
            }
        }
        
        return locations[0];
    }

    /**
     * Get day availability for a miscrit at a specific location/area from CDN data
     * @param {number} miscritId - The miscrit ID
     * @param {string} location - The location name
     * @param {string} area - The area number (optional)
     * @returns {string[]} Array of day abbreviations ['mon', 'tue', etc.] or all days if not specified
     */
    getDaysOfWeekFromCDN(miscritId, location, area = null) {
        // Day number to abbreviation mapping
        const DAY_MAP = {
            0: 'sun',
            1: 'mon',
            2: 'tue',
            3: 'wed',
            4: 'thu',
            5: 'fri',
            6: 'sat'
        };
        
        const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        
        // Find the miscrit in CDN data
        const miscrit = this.miscrits.find(m => m.id === miscritId);
        if (!miscrit || !miscrit.locations) {
            return ALL_DAYS; // Default to all days if not found
        }
        
        // Check if the miscrit exists in the specified location
        const locationData = miscrit.locations[location];
        if (!locationData) {
            return ALL_DAYS; // Not in this location, return all days
        }
        
        // If area is specified, get days for that specific area
        if (area && locationData[area]) {
            const dayNumbers = locationData[area];
            if (dayNumbers && dayNumbers.length > 0) {
                return dayNumbers.map(num => DAY_MAP[num]).sort();
            }
        } else {
            // No specific area, get days from first available area
            const areas = Object.keys(locationData);
            if (areas.length > 0) {
                const dayNumbers = locationData[areas[0]];
                if (dayNumbers && dayNumbers.length > 0) {
                    return dayNumbers.map(num => DAY_MAP[num]).sort();
                }
            }
        }
        
        return ALL_DAYS; // No day restrictions, available all days
    }

    getImageUrl(name) {
        if (!name) return '';
        // Convert name to lowercase and replace spaces with underscores
        const normalizedName = name.toLowerCase().replace(/\s+/g, '_');
        return `https://cdn.worldofmiscrits.com/miscrits/${normalizedName}_back.png`;
    }

    getElementImageUrl(element) {
        if (!element) return '';
        // Convert element to lowercase
        const normalizedElement = element.toLowerCase();
        return `https://worldofmiscrits.com/${normalizedElement}.png`;
    }

    getLocationInfoForSpecificLocation(locationName, areas) {
        // Location name mappings
        const locationNameMap = {
            'Forest': {
                '1': 'Azore Lake',
                '2': 'Woodsman\'s Axe', 
                '3': 'Magic Flower',
                '4': 'Elder Tree'
            },
            'Hidden Forest': {},
            'Mansion': {
                '1': 'Outside',
                '2': 'Ground Floor',
                '3': '2nd Floor',
                '4': 'Attic (Middle)',
                '5': 'Attic (Right)',
                '6': 'Attic (Left)'
            },
            'Mount Gemma': {
                '1': 'Gemma Flats',
                '2': 'Eternal Falls',
                '3': 'The Shack',
                '4': 'Crystal Cliffs'
            },
            'Cave': {
                '1': 'Cave Entrance',
                '2': 'Hole',
                '3': 'Lost Treasure',
                '4': 'Ice Cavern'
            },
            'Sunfall Shores': {
                '1': 'Sand Castle',
                '2': 'Ship Graveyard',
                '3': 'Jagged Treasure',
                '4': 'Dead Island'
            },
            'Moon': {
                '1': 'The Moon Surface',
                '2': 'Cave of the Moon'
            }
        };

        if (locationName === 'Unknown') {
            return { text: 'Unknown location', isClickable: false };
        }

        if (locationName === 'Hidden Forest') {
            return { text: 'The Hidden Forest', isClickable: false };
        }

        if (!areas || Object.keys(areas).length === 0) {
            return { text: locationName, isClickable: false };
        }

        const areaNumbers = Object.keys(areas).sort((a, b) => parseInt(a) - parseInt(b));
        
        if (areaNumbers.length === 1) {
            // Single area
            const areaNum = areaNumbers[0];
            const areaName = locationNameMap[locationName]?.[areaNum];
            if (areaName) {
                return { text: `Area ${areaNum} - ${areaName}`, isClickable: false };
            } else {
                return { text: `Area ${areaNum}`, isClickable: false };
            }
        } else {
            // Multiple areas - create nested format
            const areaList = areaNumbers.map(areaNum => {
                const areaName = locationNameMap[locationName]?.[areaNum];
                return areaName ? `Area ${areaNum} - ${areaName}` : `Area ${areaNum}`;
            }).join('\n');
            return { text: areaList, isClickable: false };
        }
    }

    getLocationInfo(miscrit, areaFilter = null) {
        if (!miscrit.locations || Object.keys(miscrit.locations).length === 0) {
            return { text: 'Unknown location', isClickable: false };
        }

        // Location name mappings
        const locationNameMap = {
            'Forest': {
                '1': 'Azore Lake',
                '2': 'Woodsman\'s Axe', 
                '3': 'Magic Flower',
                '4': 'Elder Tree'
            },
            'Hidden Forest': {},
            'Mansion': {
                '1': 'Outside',
                '2': 'Ground Floor',
                '3': '2nd Floor',
                '4': 'Attic (Middle)',
                '5': 'Attic (Right)',
                '6': 'Attic (Left)'
            },
            'Mount Gemma': {
                '1': 'Gemma Flats',
                '2': 'Eternal Falls',
                '3': 'The Shack',
                '4': 'Crystal Cliffs'
            },
            'Cave': {
                '1': 'Cave Entrance',
                '2': 'Hole',
                '3': 'Lost Treasure',
                '4': 'Ice Cavern'
            },
            'Sunfall Shores': {
                '1': 'Sand Castle',
                '2': 'Ship Graveyard',
                '3': 'Jagged Treasure',
                '4': 'Dead Island'
            },
            'Moon': {
                '1': 'The Moon Surface',
                '2': 'Cave of the Moon'
            }
        };

        const locationStrings = [];
        
        for (const [locationName, areas] of Object.entries(miscrit.locations)) {
            // If area filter is applied, only show areas that match the filter
            let filteredAreas = areas;
            if (areaFilter) {
                filteredAreas = {};
                if (areas[areaFilter]) {
                    filteredAreas[areaFilter] = areas[areaFilter];
                }
            }
            
            const areaNumbers = Object.keys(filteredAreas).sort((a, b) => parseInt(a) - parseInt(b));
            
            if (areaNumbers.length === 0) {
                // No areas match the filter, skip this location
                continue;
            } else if (areaNumbers.length === 1 && !areaFilter) {
                // Single area and no filter applied
                const areaNum = areaNumbers[0];
                const areaName = locationNameMap[locationName]?.[areaNum];
                if (areaName) {
                    locationStrings.push(`${locationName} ${areaNum} - ${areaName}`);
                } else {
                    locationStrings.push(`${locationName} Area ${areaNum}`);
                }
            } else if (areaNumbers.length === 1 && areaFilter) {
                // Single area matching the filter
                const areaNum = areaNumbers[0];
                const areaName = locationNameMap[locationName]?.[areaNum];
                if (areaName) {
                    locationStrings.push(`${locationName} ${areaNum} - ${areaName}`);
                } else {
                    locationStrings.push(`${locationName} Area ${areaNum}`);
                }
            } else {
                // Multiple areas - create nested format
                const areaList = areaNumbers.map(areaNum => {
                    const areaName = locationNameMap[locationName]?.[areaNum];
                    return areaName ? `Area ${areaNum} - ${areaName}` : `Area ${areaNum}`;
                }).join('\n- ');
                locationStrings.push(`${locationName}:\n- ${areaList}`);
            }
        }
        
        const result = { text: locationStrings.join('\n\n'), isClickable: false };
        return result;
    }

    filterMiscrits() {
        const locationFilter = document.getElementById('location-filter').value;
        const areaFilter = document.getElementById('area-filter').value;
        const rarityFilter = document.getElementById('rarity-filter').value;
        const elementFilter = document.getElementById('element-filter').value;
        const dayFilter = document.getElementById('day-filter').value;
        const searchFilter = document.getElementById('search-filter').value.toLowerCase();
        const ownershipFilterElement = document.getElementById('ownership-filter');
        const ownershipFilter = ownershipFilterElement ? ownershipFilterElement.value : '';

        // Get current day in GMT+0 for "today" filter
        const currentDay = this.getCurrentGMTDay();

        this.filteredMiscrits = this.miscrits.filter(miscrit => {
            // Exclude "Unknown" location unless explicitly filtered for it
            if (!locationFilter && miscrit.primaryLocation === 'Unknown') {
                return false;
            }
            
            const matchesLocation = !locationFilter || miscrit.primaryLocation === locationFilter;
            
            const matchesArea = !areaFilter || (miscrit.currentLocationAreas && 
                Object.keys(miscrit.currentLocationAreas).includes(areaFilter));
            
            const matchesRarity = !rarityFilter || miscrit.rarity === rarityFilter;
            const matchesElement = !elementFilter || miscrit.element === elementFilter;
            const matchesSearch = !searchFilter || 
                miscrit.firstName.toLowerCase().includes(searchFilter) ||
                (miscrit.names && miscrit.names.some(name => name.toLowerCase().includes(searchFilter)));

            // Day filtering logic
            const matchesDay = this.checkDayAvailability(miscrit, dayFilter, currentDay);

            // Ownership filtering logic (only if user is logged in)
            let matchesOwnership = true;
            if (ownershipFilter && this.playerData && this.playerData.miscrits) {
                const stats = this.getMiscritCollectionStats(miscrit.id);
                if (ownershipFilter === 'owned') {
                    matchesOwnership = stats && stats.total > 0;
                } else if (ownershipFilter === 'not-owned') {
                    matchesOwnership = !stats || stats.total === 0;
                }
            }

            return matchesLocation && matchesArea && matchesRarity && matchesElement && matchesSearch && matchesDay && matchesOwnership;
        }).map(miscrit => {
            // Create a copy of the miscrit with updated location info based on area filter
            const updatedMiscrit = { ...miscrit };
            updatedMiscrit.locationInfo = this.getLocationInfo(miscrit, areaFilter);
            return updatedMiscrit;
        });

        this.renderMiscrits();
        this.updateStats();
        this.reloadAllMarkers();
    }

    getCurrentGMTDay() {
        const now = new Date();
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        return dayNames[now.getUTCDay()];
    }

    checkDayAvailability(miscrit, dayFilter, currentDay) {
        // If no day filter is selected, show all miscrits
        if (!dayFilter) return true;

        // Determine which day to check
        const targetDay = dayFilter === 'today' ? currentDay : dayFilter;
        
        // Get availability data for this miscrit
        const availabilityData = this.getMiscritAvailabilityData();
        const miscritData = availabilityData[miscrit.id];
        
        // If custom availability data exists, use it
        if (miscritData) {
            return Object.values(miscritData).some(days => {
                return days && days.includes(targetDay);
            });
        }
        
        // If no custom availability data, check marker data as fallback
        const markerDays = this.getMarkerDaysForMiscrit(miscrit);
        if (markerDays.length > 0) {
            return markerDays.includes(targetDay);
        }
        
        // Default: available all days if no data exists
        return true;
    }

    getMarkerDaysForMiscrit(miscrit) {
        // Get day availability from CDN data instead of markers
        // Use the miscrit's primary location
        const location = miscrit.primaryLocation;
        
        // Get days from CDN data for this miscrit's location
        const days = this.getDaysOfWeekFromCDN(miscrit.id, location);
        
        return days;
    }

    updateStats() {
        // Count unique miscrits (not location-specific entries)
        const uniqueMiscritIds = new Set(this.filteredMiscrits.map(m => m.id));
        document.getElementById('total-miscrits').textContent = uniqueMiscritIds.size;
        const uniqueLocations = new Set(this.filteredMiscrits.map(m => m.primaryLocation));
        document.getElementById('total-locations').textContent = uniqueLocations.size;
    }

    renderMiscrits() {
        const container = document.getElementById('miscrits-container');
        container.innerHTML = '';


        if (this.filteredMiscrits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Miscrits Found</h3>
                    <p>Try adjusting your filters or search terms.</p>
                </div>
            `;
            return;
        }

        // Group by location
        const groupedByLocation = this.groupByLocation(this.filteredMiscrits);
        
        Object.keys(groupedByLocation).forEach(loc => {
        });
        
        // Render locations in the preferred order first
        this.locationOrder.forEach(location => {
            if (groupedByLocation[location] && groupedByLocation[location].length > 0) {
                const section = this.createLocationSection(location, groupedByLocation[location]);
                container.appendChild(section);
            }
        });
        
        // Then render any other locations not in the order (like "Unknown", "Shack", etc.)
        Object.keys(groupedByLocation).forEach(location => {
            if (!this.locationOrder.includes(location) && groupedByLocation[location].length > 0) {
                const section = this.createLocationSection(location, groupedByLocation[location]);
                container.appendChild(section);
            }
        });
    }

    groupByLocation(miscrits) {
        return miscrits.reduce((groups, miscrit) => {
            const location = miscrit.primaryLocation;
            if (!groups[location]) {
                groups[location] = [];
            }
            groups[location].push(miscrit);
            return groups;
        }, {});
    }

    createLocationSection(location, miscrits) {
        
        const section = document.createElement('div');
        section.className = 'location-section';

        // Location image mappings
        const locationImageMap = {
            'Forest': 'assets/maps/forest.jpg',
            'Hidden Forest': 'assets/maps/hidden_forest.jpg',
            'Mansion': 'assets/maps/mansion_all.png',
            'Mount Gemma': 'assets/maps/mount_gemma.png',
            'Cave': 'assets/maps/cave.png',
            'Sunfall Shores': 'assets/maps/sunfall_shores.jpg',
            'Moon': 'assets/maps/moon.png',
            'Shack': 'assets/maps/shack_all.png'
        };

        // Add location image if available
        const imageSrc = locationImageMap[location];
        if (imageSrc) {
            // Create viewport wrapper
            const viewport = document.createElement('div');
            viewport.className = 'map-viewport';
            
            // Create map content container
            const mapContent = document.createElement('div');
            mapContent.className = 'map-content';
            
            const imageContainer = document.createElement('div');
            imageContainer.className = 'location-image-container';
            imageContainer.style.position = 'relative';
            
            const img = document.createElement('img');
            img.className = 'location-image';
            img.src = imageSrc;
            img.alt = `${location} map`;
            img.loading = 'lazy';
            img.draggable = false;
            
            // Add right-click event listener for adding miscrits
            img.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                // Only allow marker creation in admin mode
                if (this.isAdminMode) {
                    this.handleMapRightClick(e, location, imageContainer);
                }
            });
            
            // Prevent image dragging
            img.addEventListener('dragstart', (e) => {
                e.preventDefault();
                return false;
            });
            
            imageContainer.appendChild(img);
            mapContent.appendChild(imageContainer);
            
            // Add zoom controls
            const zoomControls = document.createElement('div');
            zoomControls.className = 'zoom-controls';
            zoomControls.innerHTML = `
                <button class="zoom-btn zoom-in" title="Zoom In">+</button>
                <button class="zoom-btn zoom-out" title="Zoom Out">−</button>
                <button class="zoom-btn zoom-reset" title="Reset View">⌂</button>
            `;
            
            // Add zoom info display
            const zoomInfo = document.createElement('div');
            zoomInfo.className = 'zoom-info';
            zoomInfo.textContent = '100%';
            
            viewport.appendChild(mapContent);
            viewport.appendChild(zoomControls);
            viewport.appendChild(zoomInfo);
            
            // Initialize pan and zoom functionality
            this.initializePanZoom(viewport, mapContent, zoomInfo);
            
            
            // Load and display existing miscrit markers for this location
            this.loadMiscritMarkers(location, imageContainer);
            
            section.appendChild(viewport);
        } else {
        }

        // Create location header
        const header = document.createElement('div');
        header.className = 'location-header';
        header.innerHTML = `
            <h2 class="location-title">${location}</h2>
            <span class="location-count">${miscrits.length} Miscrits</span>
        `;

        section.appendChild(header);

        // Group by area first
        const groupedByArea = this.groupByArea(location, miscrits);
        
        Object.keys(groupedByArea).forEach(area => {
        });

        // Render each area group
        const sortedAreas = Object.keys(groupedByArea).sort((a, b) => {
            // Sort areas numerically
            const aNum = a === 'no-area' ? 999 : parseInt(a);
            const bNum = b === 'no-area' ? 999 : parseInt(b);
            return aNum - bNum;
        });


        sortedAreas.forEach(area => {
            if (groupedByArea[area] && groupedByArea[area].length > 0) {
                const areaSection = this.createAreaSection(location, area, groupedByArea[area]);
                section.appendChild(areaSection);
            }
        });

        return section;
    }

    groupByRarity(miscrits) {
        return miscrits.reduce((groups, miscrit) => {
            const rarity = miscrit.rarity || 'Common';
            if (!groups[rarity]) {
                groups[rarity] = [];
            }
            groups[rarity].push(miscrit);
            return groups;
        }, {});
    }

    groupByArea(location, miscrits) {
        // Check if there's an active area filter
        const areaFilterElement = document.getElementById('area-filter');
        const areaFilter = areaFilterElement ? areaFilterElement.value : '';
        
        return miscrits.reduce((groups, miscrit) => {
            if (!miscrit.currentLocationAreas || Object.keys(miscrit.currentLocationAreas).length === 0) {
                // Handle miscrits without specific areas - add them to 'no-area' group
                // This applies to Hidden Forest, Unknown, and any other location without area data
                if (!groups['no-area']) groups['no-area'] = [];
                groups['no-area'].push(miscrit);
                return groups;
            }

            // If area filter is active, only group by the filtered area
            if (areaFilter) {
                // Only add to the filtered area if the miscrit exists in that area
                if (Object.keys(miscrit.currentLocationAreas).includes(areaFilter)) {
                    if (!groups[areaFilter]) {
                        groups[areaFilter] = [];
                    }
                    groups[areaFilter].push(miscrit);
                }
            } else {
                // Add miscrit to each area it appears in (original behavior)
                Object.keys(miscrit.currentLocationAreas).forEach(area => {
                    if (!groups[area]) {
                        groups[area] = [];
                    }
                    groups[area].push(miscrit);
                });
            }

            return groups;
        }, {});
    }

    createAreaSection(location, area, miscrits) {
        const section = document.createElement('div');
        section.className = 'area-section';

        // Create area header
        const header = document.createElement('div');
        header.className = 'area-header';
        
        // Location name mappings
        const locationNameMap = {
            'Forest': {
                '1': 'Azore Lake',
                '2': 'Woodsman\'s Axe', 
                '3': 'Magic Flower',
                '4': 'Elder Tree'
            },
            'Hidden Forest': {},
            'Mansion': {
                '1': 'Outside',
                '2': 'Ground Floor',
                '3': '2nd Floor',
                '4': 'Attic (Middle)',
                '5': 'Attic (Right)',
                '6': 'Attic (Left)'
            },
            'Mount Gemma': {
                '1': 'Gemma Flats',
                '2': 'Eternal Falls',
                '3': 'The Shack',
                '4': 'Crystal Cliffs'
            },
            'Cave': {
                '1': 'Cave Entrance',
                '2': 'Hole',
                '3': 'Lost Treasure',
                '4': 'Ice Cavern'
            },
            'Sunfall Shores': {
                '1': 'Sand Castle',
                '2': 'Ship Graveyard',
                '3': 'Jagged Treasure',
                '4': 'Dead Island'
            },
            'Moon': {
                '1': 'The Moon Surface',
                '2': 'Cave of the Moon'
            },
            'Shack': {
                '1': 'First Floor',
                '2': 'Second Floor',
                '3': 'Basement',
                '4': 'Lower Basement'
            }
        };

        let areaTitle;
        if (area === 'no-area') {
            areaTitle = 'The Hidden Forest';
        } else {
            const areaName = locationNameMap[location]?.[area];
            areaTitle = areaName ? `Area ${area} - ${areaName}` : `Area ${area}`;
        }

        header.innerHTML = `
            <h3 class="area-title">${areaTitle}</h3>
            <span class="area-count">${miscrits.length} Miscrits</span>
        `;

        section.appendChild(header);

        // Group by rarity within area
        const groupedByRarity = this.groupByRarity(miscrits);

        // Render each rarity group
        this.rarityOrder.forEach(rarity => {
            if (groupedByRarity[rarity] && groupedByRarity[rarity].length > 0) {
                const rarityGroup = this.createRarityGroup(rarity, groupedByRarity[rarity]);
                section.appendChild(rarityGroup);
            }
        });

        return section;
    }

    createRarityGroup(rarity, miscrits) {
        const group = document.createElement('div');
        group.className = 'rarity-group';

        // Create rarity header
        const header = document.createElement('div');
        header.className = 'rarity-header';
        header.innerHTML = `
            <h3 class="rarity-title ${rarity.toLowerCase()}">${rarity}</h3>
            <span class="rarity-count">${miscrits.length}</span>
        `;

        group.appendChild(header);

        // Create grid
        const grid = document.createElement('div');
        grid.className = 'miscrits-grid';

        // Sort miscrits by element first, then by name within rarity
        miscrits.sort((a, b) => {
            // Sort by element first
            if (a.element !== b.element) {
                return a.element.localeCompare(b.element);
            }
            
            // If elements are the same, sort by name
            return a.firstName.localeCompare(b.firstName);
        });

        miscrits.forEach(miscrit => {
            const card = this.createMiscritCard(miscrit);
            grid.appendChild(card);
        });

        group.appendChild(grid);
        return group;
    }

    createMiscritCard(miscrit) {
        const card = document.createElement('div');
        card.className = `miscrit-card ${(miscrit.rarity || 'common').toLowerCase()}`;

        const img = document.createElement('img');
        img.className = 'miscrit-image';
        img.src = miscrit.imageUrl;
        img.alt = miscrit.firstName;
        img.loading = 'lazy';

        // Handle image load errors
        img.onerror = () => {
            img.style.display = 'none';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'miscrit-image error';
            errorDiv.textContent = '❓';
            img.parentNode.insertBefore(errorDiv, img);
        };

        const name = document.createElement('div');
        name.className = 'miscrit-name';
        name.textContent = miscrit.firstName;

        // Create element display
        const elementDiv = document.createElement('div');
        elementDiv.className = 'miscrit-element';
        
        if (miscrit.element) {
            const elementIcon = document.createElement('img');
            elementIcon.className = 'element-icon';
            elementIcon.src = miscrit.elementImageUrl;
            elementIcon.alt = miscrit.element;
            elementIcon.title = `Element: ${miscrit.element}`;
            
            // Handle element icon errors
            elementIcon.onerror = () => {
                elementIcon.style.display = 'none';
                const elementText = document.createElement('span');
                elementText.textContent = miscrit.element;
                elementText.style.fontSize = '0.7rem';
                elementText.style.color = 'var(--text-secondary)';
                elementDiv.appendChild(elementText);
            };
            
            elementDiv.appendChild(elementIcon);
        }

        // Create location info
        const locationDiv = document.createElement('div');
        locationDiv.className = `miscrit-location ${miscrit.locationInfo.isClickable ? 'clickable' : ''}`;
        locationDiv.textContent = miscrit.locationInfo.text;
        locationDiv.title = miscrit.locationInfo.isClickable ? 'Click to see detailed location info' : miscrit.locationInfo.text;

        if (miscrit.locationInfo.isClickable) {
            locationDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                // Future: Show detailed location modal
            });
        }

        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(elementDiv);

        // Add collection statistics if user is logged in
        if (this.playerData && this.playerData.miscrits) {
            const stats = this.getMiscritCollectionStats(miscrit.id);
            if (stats) {
                const collectionDiv = document.createElement('div');
                collectionDiv.className = 'miscrit-collection-stats';
                
                // Create title
                const titleDiv = document.createElement('div');
                titleDiv.className = `stats-title ${stats.total === 0 ? 'not-owned' : ''}`;
                titleDiv.textContent = stats.total === 0 ? 'Not Owned' : 'Owned';
                
                // Create stats grid
                const gridDiv = document.createElement('div');
                gridDiv.className = `stats-grid ${stats.total === 0 ? 'not-owned' : ''}`;
                
                // Add each stat with appropriate coloring
                const statConfigs = [
                    { label: 'S+', count: stats.sPlus },
                    { label: 'A+ RS', count: stats.aPlusRS },
                    { label: 'A RS', count: stats.aRS },
                    { label: 'B+ RS', count: stats.bPlusRS },
                    { label: 'Other', count: stats.total - (stats.sPlus + stats.aPlusRS + stats.aRS + stats.bPlusRS) }
                ];
                
                // Determine overall ownership status
                const hasAnyInScenarios = stats.sPlus > 0 || stats.aPlusRS > 0 || stats.aRS > 0 || stats.bPlusRS > 0;
                const overallStatus = stats.total === 0 ? 'none' : (hasAnyInScenarios ? 'scenario' : 'other');
                
                statConfigs.forEach(config => {
                    const statItem = document.createElement('div');
                    statItem.className = 'stat-item';
                    
                    const label = document.createElement('span');
                    label.className = 'stat-label';
                    label.textContent = config.label;
                    
                    const countBox = document.createElement('span');
                    countBox.className = `stat-count ${this.getStatCountClass(config.count, overallStatus)}`;
                    countBox.textContent = config.count;
                    
                    statItem.appendChild(label);
                    statItem.appendChild(countBox);
                    gridDiv.appendChild(statItem);
                });
                
                collectionDiv.appendChild(titleDiv);
                collectionDiv.appendChild(gridDiv);
                card.appendChild(collectionDiv);
            }
        }

        card.appendChild(locationDiv);

        // Add availability information if custom data exists
        this.addAvailabilityInfoToCard(card, miscrit);

        // Add location footer
        this.addLocationFooterToCard(card, miscrit);

        // Add click event for modal or future expansion
        card.addEventListener('click', (e) => {
            const markerInfo = this.getMiscritMarkerInfo(miscrit);
            if (markerInfo) {
                this.showMarkerModal(markerInfo);
            } else {
                // Future: Show detailed modal with all evolutions, stats, etc.
            }
        });

        // Add right-click event for admin mode
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only show context menu in admin mode
            if (this.isAdminMode) {
                this.showMiscritCardContextMenu(e, miscrit);
            }
        });

        return card;
    }

    showMiscritCardContextMenu(event, miscrit) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.miscrit-card-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'miscrit-card-context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="edit-availability">
                <span class="context-icon">📅</span> Edit Availability
            </div>
        `;

        document.body.appendChild(contextMenu);

        // Add event listeners
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            
            if (action === 'edit-availability') {
                this.showMiscritAvailabilityModal(miscrit);
            }
            
            contextMenu.remove();
        });

        // Close menu when clicking elsewhere
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    showMiscritAvailabilityModal(miscrit) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Availability - ${miscrit.firstName}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="miscrit-availability-editor">
                        <!-- Will be populated based on miscrit locations -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Get elements
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const saveBtn = modal.querySelector('.btn-save');
        const container = modal.querySelector('#miscrit-availability-editor');

        // Generate the availability editor content
        this.generateMiscritAvailabilityEditor(miscrit, container);

        // Close handlers
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Save changes
        saveBtn.addEventListener('click', () => {
            this.saveMiscritAvailabilityChanges(miscrit, container);
            document.body.removeChild(modal);
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    generateMiscritAvailabilityEditor(miscrit, container) {
        const days = [
            { key: 'mon', label: 'Monday' },
            { key: 'tue', label: 'Tuesday' },
            { key: 'wed', label: 'Wednesday' },
            { key: 'thu', label: 'Thursday' },
            { key: 'fri', label: 'Friday' },
            { key: 'sat', label: 'Saturday' },
            { key: 'sun', label: 'Sunday' }
        ];

        // Get stored availability data for this miscrit
        const availabilityData = this.getMiscritAvailabilityData();
        const miscritData = availabilityData[miscrit.id] || {};

        let sectionsHtml = `<p>Set availability for <strong>${miscrit.firstName}</strong> in each location and area:</p>`;

        // Generate sections for each location and area where this miscrit appears
        if (miscrit.locations) {
            Object.keys(miscrit.locations).forEach(location => {
                const locationAreas = miscrit.locations[location];
                
                sectionsHtml += `<div class="location-availability-section">
                    <h4 class="location-availability-title">${location}</h4>`;

                if (Object.keys(locationAreas).length === 0) {
                    // Location with no specific areas
                    const dataKey = `${location}|no-area`;
                    const savedDays = miscritData[dataKey] || [];
                    
                    sectionsHtml += `
                        <div class="area-availability-section" data-location="${location}" data-area="no-area">
                            <div class="area-availability-title">General Area</div>
                            <div class="days-checkboxes">
                                ${days.map(day => `
                                    <label class="day-checkbox">
                                        <input type="checkbox" 
                                               value="${day.key}" 
                                               ${savedDays.includes(day.key) ? 'checked' : ''}>
                                        <span class="day-label">${day.label}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>`;
                } else {
                    // Location with specific areas
                    Object.keys(locationAreas).forEach(areaKey => {
                        const dataKey = `${location}|${areaKey}`;
                        const savedDays = miscritData[dataKey] || [];
                        
                        // Get area display name
                        const locationNameMap = {
                            'Forest': {
                                '1': 'Azore Lake',
                                '2': 'Woodsman\'s Axe', 
                                '3': 'Magic Flower',
                                '4': 'Elder Tree'
                            },
                            'Mansion': {
                                '1': 'Outside',
                                '2': 'Ground Floor',
                                '3': '2nd Floor',
                                '4': 'Attic (Middle)',
                                '5': 'Attic (Right)',
                                '6': 'Attic (Left)'
                            },
                            'Mount Gemma': {
                                '1': 'Gemma Flats',
                                '2': 'Eternal Falls',
                                '3': 'The Shack',
                                '4': 'Crystal Cliffs'
                            },
                            'Cave': {
                                '1': 'Cave Entrance',
                                '2': 'Hole',
                                '3': 'Lost Treasure',
                                '4': 'Ice Cavern'
                            },
                            'Sunfall Shores': {
                                '1': 'Sand Castle',
                                '2': 'Ship Graveyard',
                                '3': 'Jagged Treasure',
                                '4': 'Dead Island'
                            },
                            'Moon': {
                                '1': 'The Moon Surface',
                                '2': 'Cave of the Moon'
                            }
                        };

                        const areaDisplayName = locationNameMap[location]?.[areaKey] || `Area ${areaKey}`;
                        
                        sectionsHtml += `
                            <div class="area-availability-section" data-location="${location}" data-area="${areaKey}">
                                <div class="area-availability-title">${areaDisplayName}</div>
                                <div class="days-checkboxes">
                                    ${days.map(day => `
                                        <label class="day-checkbox">
                                            <input type="checkbox" 
                                                   value="${day.key}" 
                                                   ${savedDays.includes(day.key) ? 'checked' : ''}>
                                            <span class="day-label">${day.label}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>`;
                    });
                }

                sectionsHtml += `</div>`;
            });
        }

        container.innerHTML = sectionsHtml;
    }

    saveMiscritAvailabilityChanges(miscrit, container) {
        const availabilityData = this.getMiscritAvailabilityData();
        
        if (!availabilityData[miscrit.id]) {
            availabilityData[miscrit.id] = {};
        }

        // Save data for each location/area combination
        const areaSections = container.querySelectorAll('.area-availability-section');
        areaSections.forEach(section => {
            const location = section.dataset.location;
            const area = section.dataset.area;
            const dataKey = `${location}|${area}`;
            
            const checkboxes = section.querySelectorAll('input[type="checkbox"]');
            const selectedDays = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            
            availabilityData[miscrit.id][dataKey] = selectedDays;
        });

        // Save to localStorage
        this.saveMiscritAvailabilityData(availabilityData);
        
    }

    getMiscritAvailabilityData() {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'json';
        
        if (dataSource === 'json') {
            // Return from cached JSON data if available
            return this.cachedJsonData?.miscritAvailability || {};
        } else {
            // Return from local storage
            const stored = localStorage.getItem('miscritAvailability');
            return stored ? JSON.parse(stored) : {};
        }
    }

    addAvailabilityInfoToCard(card, miscrit) {
        const availabilityData = this.getMiscritAvailabilityData();
        const miscritData = availabilityData[miscrit.id];
        
        // Create days of week indicator
        const daysIndicator = document.createElement('div');
        daysIndicator.className = 'miscrit-days-indicator';
        
        const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon-Sun
        const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        
        // Default: all days available if no data
        let availableDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        
        if (miscritData) {
            // Use custom availability data if it exists
            const firstAreaKey = Object.keys(miscritData)[0];
            if (firstAreaKey && miscritData[firstAreaKey]) {
                availableDays = miscritData[firstAreaKey];
            }
        } else {
            // If no custom availability data, check marker data as fallback
            const markerDays = this.getMarkerDaysForMiscrit(miscrit);
            if (markerDays.length > 0) {
                availableDays = markerDays;
            }
            // Otherwise keep the default (all days)
        }
        
        dayNames.forEach((dayName, index) => {
            const dayElement = document.createElement('div');
            dayElement.className = 'day-indicator';
            dayElement.textContent = dayName;
            
            const dayKey = dayKeys[index];
            const isAvailable = availableDays.includes(dayKey);
            
            dayElement.classList.add(isAvailable ? 'available' : 'unavailable');
            
            // Add glowing outline for currently selected day
            const selectedDayFilter = document.getElementById('day-filter').value;
            let currentDay = dayKey;
            
            // For "All Days" and "today", use the current GMT day
            if (selectedDayFilter === '' || selectedDayFilter === 'today') {
                currentDay = this.getCurrentGMTDay();
            } else {
                currentDay = selectedDayFilter;
            }
            
            if (dayKey === currentDay) {
                dayElement.classList.add('current-day');
            }
            
            daysIndicator.appendChild(dayElement);
        });
        
        card.appendChild(daysIndicator);
    }

    addLocationFooterToCard(card, miscrit) {
        const footer = document.createElement('div');
        footer.className = 'miscrit-location-footer';
        
        // Check if this miscrit has specific marker information
        const markerInfo = this.getMiscritMarkerInfo(miscrit);
        
        if (markerInfo) {
            footer.classList.add('has-location-info');
            footer.textContent = 'Click to see exact location';
            footer.title = 'This Miscrit has specific location information and images';
        } else {
            footer.classList.add('generic');
            footer.textContent = 'Can be found anywhere in area';
            footer.title = 'This Miscrit can be found anywhere within its listed areas';
        }
        
        card.appendChild(footer);
    }

    handleMapRightClick(event, location, imageContainer) {
        // Check if editing is allowed
        if (!this.isEditingAllowed()) {
            alert('⚠️ Editing is disabled in JSON data mode. Switch to Local Storage mode to make changes.');
            return;
        }
        
        const img = event.target;
        const imgRect = img.getBoundingClientRect();
        
        // Calculate relative position within the scaled image
        const relativeX = event.clientX - imgRect.left;
        const relativeY = event.clientY - imgRect.top;
        
        // Convert to percentage based on the current scaled dimensions
        // This will work correctly regardless of zoom level
        const x = Math.max(0, Math.min(100, (relativeX / imgRect.width * 100))).toFixed(2);
        const y = Math.max(0, Math.min(100, (relativeY / imgRect.height * 100))).toFixed(2);
        
        // Only proceed if click was within the image bounds
        if (relativeX >= 0 && relativeX <= imgRect.width && 
            relativeY >= 0 && relativeY <= imgRect.height) {
            this.showMiscritSelectionModal(location, x, y, imageContainer);
        }
    }

    showMiscritSelectionModal(location, x, y, imageContainer) {
        // Get miscrits for this location - filter by those that can be caught in this location
        const locationMiscrits = this.miscrits
            .filter(miscrit => {
                // Check if miscrit appears in this location
                if (!miscrit.locations) return false;
                return Object.keys(miscrit.locations).includes(location);
            })
            .map(miscrit => ({
                id: miscrit.id,
                name: miscrit.names?.[0] || 'Unknown',
                element: miscrit.element,
                rarity: miscrit.rarity
            }))
            // Remove duplicates based on ID
            .filter((miscrit, index, self) => 
                index === self.findIndex(m => m.id === miscrit.id)
            )
            .sort((a, b) => a.name.localeCompare(b.name));


        // Create modal
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Miscrits to ${location}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Position: ${x}%, ${y}%</p>
                    <div class="selected-miscrits-section">
                        <h4>Selected Miscrits:</h4>
                        <div class="selected-miscrits-list" id="selected-miscrits">
                            <div class="no-selection">No Miscrits selected yet</div>
                        </div>
                    </div>
                    <div class="miscrit-search">
                        <input type="text" placeholder="Search miscrits (leave empty to see all)..." class="miscrit-search-input" autofocus>
                    </div>
                    <div class="url-input-section">
                        <label for="marker-url-input">Exact Location (optional):</label>
                        <input type="url" id="marker-url-input" class="marker-url-input" placeholder="Enter exact location URL">
                    </div>
                    <div class="miscrit-list" id="miscrit-search-results">
                        <!-- Will be populated by search functionality -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-create" disabled>Create Pin</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const createBtn = modal.querySelector('.btn-create');
        const searchInput = modal.querySelector('.miscrit-search-input');
        const resultsContainer = modal.querySelector('#miscrit-search-results');
        const selectedMiscritsContainer = modal.querySelector('#selected-miscrits');

        // Track selected miscrits
        let selectedMiscrits = [];

        const updateSelectedDisplay = () => {
            if (selectedMiscrits.length === 0) {
                selectedMiscritsContainer.innerHTML = '<div class="no-selection">No Miscrits selected yet</div>';
                createBtn.disabled = true;
            } else {
                selectedMiscritsContainer.innerHTML = selectedMiscrits.map(miscrit => `
                    <div class="selected-miscrit" data-miscrit-id="${miscrit.id}">
                        <img src="https://cdn.worldofmiscrits.com/avatars/${miscrit.firstName.toLowerCase().replace(/\s+/g, '_')}_avatar.png" 
                             alt="${miscrit.firstName}" class="selected-miscrit-avatar">
                        <span class="selected-miscrit-name">${miscrit.firstName}</span>
                        <button class="remove-selected" data-miscrit-id="${miscrit.id}">&times;</button>
                    </div>
                `).join('');
                createBtn.disabled = false;

                // Add remove listeners
                selectedMiscritsContainer.querySelectorAll('.remove-selected').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const miscritId = parseInt(btn.dataset.miscritId);
                        selectedMiscrits = selectedMiscrits.filter(m => m.id !== miscritId);
                        updateSelectedDisplay();
                    });
                });
            }
        };

        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        createBtn.addEventListener('click', () => {
            const customUrl = modal.querySelector('#marker-url-input').value.trim();
            this.addMultipleMiscritMarker(location, x, y, selectedMiscrits, imageContainer, customUrl);
            document.body.removeChild(modal);
        });

        // Search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            let filteredMiscrits;
            if (searchTerm.length === 0) {
                // Show all miscrits sorted by rarity then name
                filteredMiscrits = locationMiscrits.sort((a, b) => {
                    const rarityOrder = ['Common', 'Rare', 'Epic', 'Exotic', 'Legendary'];
                    const aRarityIndex = rarityOrder.indexOf(a.rarity);
                    const bRarityIndex = rarityOrder.indexOf(b.rarity);
                    
                    if (aRarityIndex !== bRarityIndex) {
                        return aRarityIndex - bRarityIndex;
                    }
                    return a.name.localeCompare(b.name);
                });
            } else {
                // Filter based on search term
                filteredMiscrits = locationMiscrits.filter(miscrit => 
                    miscrit.name.toLowerCase().includes(searchTerm) ||
                    miscrit.element.toLowerCase().includes(searchTerm) ||
                    miscrit.rarity.toLowerCase().includes(searchTerm)
                );
            }

            if (filteredMiscrits.length === 0) {
                resultsContainer.innerHTML = '<div class="search-placeholder">No miscrits found</div>';
                return;
            }

            resultsContainer.innerHTML = filteredMiscrits.map(miscrit => {
                const isSelected = selectedMiscrits.some(m => m.id === miscrit.id);
                const rarityClass = miscrit.rarity.toLowerCase();
                return `
                    <div class="manage-miscrit-option ${isSelected ? 'selected' : ''}" data-miscrit-id="${miscrit.id}" data-rarity="${rarityClass}">
                        <img src="https://cdn.worldofmiscrits.com/avatars/${miscrit.name.toLowerCase().replace(/\s+/g, '_')}_avatar.png" 
                             alt="${miscrit.name}" class="manage-miscrit-avatar">
                        <div class="manage-miscrit-info">
                            <span class="manage-miscrit-name">${miscrit.name}</span>
                        </div>
                        <button class="manage-miscrit-action ${isSelected ? 'remove' : 'add'}" data-miscrit-id="${miscrit.id}">
                            ${isSelected ? '✕' : '+'}
                        </button>
                    </div>
                `;
            }).join('');

            // Wrap results in grid container
            if (filteredMiscrits.length > 0) {
                resultsContainer.innerHTML = `<div class="manage-miscrits-grid">${resultsContainer.innerHTML}</div>`;
            }

            // Add click listeners to new results
            const gridContainer = resultsContainer.querySelector('.manage-miscrits-grid');
            if (gridContainer) {
                gridContainer.querySelectorAll('.manage-miscrit-option').forEach(option => {
                    const actionBtn = option.querySelector('.manage-miscrit-action');
                    actionBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const miscritId = parseInt(option.dataset.miscritId);
                        const miscrit = this.miscrits.find(m => m.id === miscritId);
                        
                        // Toggle selection
                        if (selectedMiscrits.some(m => m.id === miscritId)) {
                            selectedMiscrits = selectedMiscrits.filter(m => m.id !== miscritId);
                        } else {
                            selectedMiscrits.push(miscrit);
                        }
                        
                        updateSelectedDisplay();
                        
                        // Update the search results to show new selection state
                        searchInput.dispatchEvent(new Event('input'));
                    });

                    // Also allow clicking the whole option
                    option.addEventListener('click', (e) => {
                        if (e.target.classList.contains('manage-miscrit-action')) return;
                        actionBtn.click();
                    });
                });
            }
        });

        // Initialize display with all miscrits
        searchInput.dispatchEvent(new Event('input'));

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // Focus the search input
        setTimeout(() => searchInput.focus(), 100);
    }

    addMiscritMarker(location, x, y, miscrit, imageContainer, customUrl = '') {
        // Get existing markers from localStorage
        const markers = this.getMiscritMarkers();
        
        // Create marker object with image URL
        const defaultImageUrl = `https://cdn.worldofmiscrits.com/avatars/${miscrit.firstName.toLowerCase().replace(/\s+/g, '_')}_avatar.png`;
        const marker = {
            location,
            x: parseFloat(x),
            y: parseFloat(y),
            miscritId: miscrit.id,
            miscritName: miscrit.firstName,
            miscritRarity: miscrit.rarity,
            imageUrl: defaultImageUrl, // Always use default avatar
            exactLocationImages: customUrl ? [customUrl] : [], // Array of exact location images
            additionalInformation: '', // Additional information about this marker
            id: this.generateUUID()  // Use unique ID instead of timestamp
        };

        // Add to markers
        if (!markers[location]) {
            markers[location] = [];
        }
        markers[location].push(marker);

        // Save to localStorage
        this.saveMiscritMarkers(markers);

        // Create visual marker
        this.createMarkerElement(marker, imageContainer);

    }

    addMultipleMiscritMarker(location, x, y, miscrits, imageContainer, customUrl = '') {
        // Get existing markers from localStorage
        const markers = this.getMiscritMarkers();
        
        // Create marker object for multiple miscrits
        const marker = {
            location,
            x: parseFloat(x),
            y: parseFloat(y),
            miscrits: miscrits.map(miscrit => ({
                miscritId: miscrit.id,
                miscritName: miscrit.firstName,
                miscritRarity: miscrit.rarity,
                imageUrl: `https://cdn.worldofmiscrits.com/avatars/${miscrit.firstName.toLowerCase().replace(/\s+/g, '_')}_avatar.png`
            })),
            exactLocationImages: customUrl ? [customUrl] : [], // Array of exact location images
            additionalInformation: '', // Additional information about this marker
            id: this.generateUUID(),  // Use unique ID instead of timestamp
            isMultiple: true // Flag to identify multi-miscrit markers
        };

        // Add to markers
        if (!markers[location]) {
            markers[location] = [];
        }
        markers[location].push(marker);

        // Save to localStorage
        this.saveMiscritMarkers(markers);

        // Create visual marker
        this.createMultipleMarkerElement(marker, imageContainer);

    }

    createMarkerElement(marker, imageContainer) {
        const markerEl = document.createElement('div');
        markerEl.className = 'miscrit-marker';
        markerEl.style.position = 'absolute';
        markerEl.style.left = `${marker.x}%`;
        markerEl.style.top = `${marker.y}%`;
        markerEl.style.transform = 'translate(-50%, -100%)'; // Always anchor to bottom
        
        // Create tooltip with day information from CDN
        const days = this.getDaysOfWeekFromCDN(marker.miscritId, marker.location);
        const dayNames = {
            'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu',
            'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
        };
        const daysText = days.length === 7 ? 'All days' : days.map(d => dayNames[d]).join(', ');
        markerEl.title = `${marker.miscritName}\nAvailable: ${daysText}\n(Right-click for options)`;
        
        // Use stored image URL
        const avatarUrl = marker.imageUrl;
        
        // Get rarity class for border color
        const rarityClass = marker.miscritRarity.toLowerCase();
        
        markerEl.innerHTML = `
            <div class="marker-content">
                <div class="marker-image">
                    <img src="${avatarUrl}" alt="${marker.miscritName}" class="miscrit-marker-img" data-rarity="${rarityClass}">
                </div>
                <div class="marker-pin">📍</div>
            </div>
        `;

        // Add right-click to remove
        markerEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only allow marker editing in admin mode
            if (this.isAdminMode) {
                this.showMarkerContextMenu(e, marker, markerEl, imageContainer);
            }
        });

        // Add left-click to show modal or bring to top
        markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Check if marker has additional info or exact location images
            if (this.hasMarkerInfo(marker)) {
                this.showMarkerModal(marker);
            } else {
                this.bringMarkerToTop(markerEl, imageContainer);
            }
        });

        imageContainer.appendChild(markerEl);
    }

    bringMarkerToTop(markerElement, imageContainer) {
        // Remove 'on-top' class from all other markers in this container
        const allMarkers = imageContainer.querySelectorAll('.miscrit-marker');
        allMarkers.forEach(marker => {
            if (marker !== markerElement) {
                marker.classList.remove('on-top');
            }
        });

        // Add 'on-top' class to the clicked marker
        markerElement.classList.add('on-top');
    }

    hasMarkerInfo(marker) {
        // Check if marker has additional information or exact location images
        return (marker.additionalInformation && marker.additionalInformation.trim() !== '') ||
               (marker.exactLocationImages && marker.exactLocationImages.length > 0);
    }

    showMarkerModal(marker) {
        const modal = document.getElementById('marker-info-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMiscritsList = document.getElementById('modal-miscrits-list');
        const modalAdditionalInfo = document.getElementById('modal-additional-info');
        const modalExactImages = document.getElementById('modal-exact-images');

        // Set modal title
        if (marker.isMultiple) {
            modalTitle.textContent = `Multiple Miscrits Location`;
        } else {
            modalTitle.textContent = `${marker.miscritName} Location`;
        }

        // Clear previous content
        modalMiscritsList.innerHTML = '';
        modalAdditionalInfo.innerHTML = '';
        modalExactImages.innerHTML = '';

        // Add miscrits information
        if (marker.isMultiple) {
            modalMiscritsList.innerHTML = '<div class="modal-section"><h4>Miscrits at this Location</h4><div class="modal-miscrits-grid"></div></div>';
            const grid = modalMiscritsList.querySelector('.modal-miscrits-grid');
            
            marker.miscrits.forEach(miscrit => {
                const miscritCard = document.createElement('div');
                miscritCard.className = 'modal-miscrit-card';
                
                const days = this.getDaysOfWeekFromCDN(miscrit.miscritId, marker.location);
                const dayNames = {
                    'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu',
                    'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
                };
                const daysText = days.length === 7 ? 'All days' : days.map(d => dayNames[d]).join(', ');
                
                miscritCard.innerHTML = `
                    <img src="${miscrit.imageUrl}" alt="${miscrit.miscritName}" class="modal-miscrit-image">
                    <div class="modal-miscrit-name">${miscrit.miscritName}</div>
                    <div class="modal-miscrit-rarity rarity-${miscrit.miscritRarity.toLowerCase()}">${miscrit.miscritRarity}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${daysText}</div>
                `;
                grid.appendChild(miscritCard);
            });
        } else {
            // Single miscrit
            modalMiscritsList.innerHTML = '<div class="modal-section"><h4>Miscrit Information</h4><div class="modal-miscrits-grid"></div></div>';
            const grid = modalMiscritsList.querySelector('.modal-miscrits-grid');
            
            const days = this.getDaysOfWeekFromCDN(marker.miscritId, marker.location);
            const dayNames = {
                'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu',
                'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
            };
            const daysText = days.length === 7 ? 'All days' : days.map(d => dayNames[d]).join(', ');
            
            const miscritCard = document.createElement('div');
            miscritCard.className = 'modal-miscrit-card';
            miscritCard.innerHTML = `
                <img src="${marker.imageUrl}" alt="${marker.miscritName}" class="modal-miscrit-image">
                <div class="modal-miscrit-name">${marker.miscritName}</div>
                <div class="modal-miscrit-rarity rarity-${marker.miscritRarity.toLowerCase()}">${marker.miscritRarity}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${daysText}</div>
            `;
            grid.appendChild(miscritCard);
        }

        // Add additional information
        if (marker.additionalInformation && marker.additionalInformation.trim() !== '') {
            modalAdditionalInfo.innerHTML = `
                <div class="modal-section">
                    <h4>Additional Information</h4>
                    <div class="modal-additional-info">${marker.additionalInformation}</div>
                </div>
            `;
        }

        // Add exact location images
        if (marker.exactLocationImages && marker.exactLocationImages.length > 0) {
            modalExactImages.innerHTML = '<div class="modal-section"><h4>Exact Location Images</h4><div class="modal-images-grid"></div></div>';
            const imagesGrid = modalExactImages.querySelector('.modal-images-grid');
            
            marker.exactLocationImages.forEach((imagePath, index) => {
                const imageCard = document.createElement('div');
                imageCard.className = 'modal-image-card';
                imageCard.innerHTML = `
                    <img src="${imagePath}" alt="Exact location ${index + 1}" class="modal-image" onclick="window.open('${imagePath}', '_blank')">
                    <div class="modal-image-caption">Location Image ${index + 1}</div>
                `;
                imagesGrid.appendChild(imageCard);
            });
        }

        // Show modal
        modal.style.display = 'block';
        
        // Setup modal close handlers
        this.setupModalCloseHandlers(modal);
    }

    setupModalCloseHandlers(modal) {
        const closeBtn = modal.querySelector('.modal-close');
        
        // Close button click
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
        
        // Click outside modal
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
        
        // Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    getMiscritMarkerInfo(miscrit) {
        // Get all markers and search for this miscrit
        const allMarkers = this.getMiscritMarkers();
        
        for (const location in allMarkers) {
            for (const marker of allMarkers[location]) {
                // Check if this marker contains the miscrit and has additional info
                if (marker.isMultiple) {
                    // Check if any miscrit in the multiple marker matches
                    const matchingMiscrit = marker.miscrits.find(m => m.miscritName === miscrit.firstName);
                    if (matchingMiscrit && this.hasMarkerInfo(marker)) {
                        return marker;
                    }
                } else {
                    // Single marker
                    if (marker.miscritName === miscrit.firstName && this.hasMarkerInfo(marker)) {
                        return marker;
                    }
                }
            }
        }
        
        return null;
    }

    createMultipleMarkerElement(marker, imageContainer) {
        const markerEl = document.createElement('div');
        markerEl.className = 'miscrit-marker multiple-marker';
        markerEl.style.position = 'absolute';
        markerEl.style.left = `${marker.x}%`;
        markerEl.style.top = `${marker.y}%`;
        markerEl.style.transform = 'translate(-50%, -100%)'; // Always anchor to bottom
        
        // Create tooltip with day information for each miscrit from CDN
        const miscritInfo = marker.miscrits.map(m => {
            const days = this.getDaysOfWeekFromCDN(m.miscritId, marker.location);
            const dayNames = {
                'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu',
                'fri': 'Fri', 'sat': 'Sat', 'sun': 'Sun'
            };
            const daysText = days.length === 7 ? 'All days' : days.map(d => dayNames[d]).join(', ');
            return `${m.miscritName}: ${daysText}`;
        }).join('\n');
        
        const miscritNames = marker.miscrits.map(m => m.miscritName).join(', ');
        markerEl.title = `${miscritNames}\n\nAvailability:\n${miscritInfo}\n\n(Right-click for options)`;
        
        // Create multiple avatars side by side
        const avatarsHtml = marker.miscrits.map(miscrit => {
            const rarityClass = miscrit.miscritRarity.toLowerCase();
            return `<img src="${miscrit.imageUrl}" alt="${miscrit.miscritName}" class="miscrit-marker-img" data-rarity="${rarityClass}">`;
        }).join('');
        
        markerEl.innerHTML = `
            <div class="marker-content">
                <div class="marker-images multiple-images">
                    ${avatarsHtml}
                </div>
                <div class="marker-pin">📍</div>
            </div>
        `;

        // Add right-click context menu
        markerEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only allow marker editing in admin mode
            if (this.isAdminMode) {
                this.showMultipleMarkerContextMenu(e, marker, markerEl, imageContainer);
            }
        });

        // Add left-click to show modal or bring to top
        markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Check if marker has additional info or exact location images
            if (this.hasMarkerInfo(marker)) {
                this.showMarkerModal(marker);
            } else {
                this.bringMarkerToTop(markerEl, imageContainer);
            }
        });

        imageContainer.appendChild(markerEl);
    }

    showMarkerContextMenu(event, marker, markerElement, imageContainer) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.marker-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'marker-context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="edit-marker">
                <span class="context-icon">✏️</span> Edit Marker
            </div>
            <div class="context-menu-item" data-action="move">
                <span class="context-icon">🔄</span> Move
            </div>
            <div class="context-menu-item" data-action="remove">
                <span class="context-icon">🗑️</span> Remove
            </div>
        `;

        document.body.appendChild(contextMenu);

        // Add event listeners
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            
            if (action === 'edit-marker') {
                this.showEditMarkerModal(marker, markerElement);
            } else if (action === 'move') {
                this.startMoveMode(marker, markerElement, imageContainer);
            } else if (action === 'remove') {
                this.removeMiscritMarker(marker, markerElement);
            }
            
            contextMenu.remove();
        });

        // Close menu when clicking elsewhere
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    startMoveMode(marker, markerElement, imageContainer) {
        // Add move mode class to indicate we're in move mode
        document.body.classList.add('move-mode');
        markerElement.classList.add('moving');
        
        // Create instruction overlay
        const instruction = document.createElement('div');
        instruction.className = 'move-instruction';
        instruction.textContent = `Moving ${marker.miscritName} - Click new position or press Escape to cancel`;
        document.body.appendChild(instruction);

        // Add click listener to the image container for new position
        const handleMove = (e) => {
            if (e.target === imageContainer.querySelector('.location-image')) {
                const rect = e.target.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(2);
                const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(2);
                
                this.updateMarkerPosition(marker, markerElement, x, y);
                this.exitMoveMode(instruction, handleMove, handleEscape, imageContainer);
            }
        };

        // Add escape key listener to cancel move
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.exitMoveMode(instruction, handleMove, handleEscape, imageContainer);
            }
        };

        imageContainer.addEventListener('click', handleMove);
        document.addEventListener('keydown', handleEscape);
    }

    exitMoveMode(instruction, handleMove, handleEscape, imageContainer) {
        document.body.classList.remove('move-mode');
        document.querySelector('.moving')?.classList.remove('moving');
        instruction.remove();
        
        // Remove event listeners
        imageContainer.removeEventListener('click', handleMove);
        document.removeEventListener('keydown', handleEscape);
    }

    updateMarkerPosition(marker, markerElement, newX, newY) {
        // Update marker object
        const oldX = marker.x;
        const oldY = marker.y;
        marker.x = parseFloat(newX);
        marker.y = parseFloat(newY);

        // Update visual position
        markerElement.style.left = `${newX}%`;
        markerElement.style.top = `${newY}%`;

        // Update localStorage
        const markers = this.getMiscritMarkers();
        if (markers[marker.location]) {
            const markerIndex = markers[marker.location].findIndex(m => 
                m.id === marker.id  // Use unique ID instead of timestamp
            );
            if (markerIndex !== -1) {
                markers[marker.location][markerIndex] = marker;
                localStorage.setItem('miscritMarkers', JSON.stringify(markers));
            }
        }

    }

    showMultipleMarkerContextMenu(event, marker, markerElement, imageContainer) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.marker-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'marker-context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="manage-miscrits">
                <span class="context-icon">📝</span> Add/Remove Miscrits
            </div>
            <div class="context-menu-item" data-action="edit-marker">
                <span class="context-icon">✏️</span> Edit Marker
            </div>
            <div class="context-menu-item" data-action="move">
                <span class="context-icon">🔄</span> Move
            </div>
            <div class="context-menu-item" data-action="remove">
                <span class="context-icon">🗑️</span> Remove All
            </div>
        `;

        document.body.appendChild(contextMenu);

        // Add event listeners
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            
            if (action === 'manage-miscrits') {
                this.showManageMiscritsModal(marker, markerElement, imageContainer);
            } else if (action === 'edit-marker') {
                this.showEditMarkerModal(marker, markerElement);
            } else if (action === 'move') {
                this.startMultipleMoveMode(marker, markerElement, imageContainer);
            } else if (action === 'remove') {
                this.removeMiscritMarker(marker, markerElement);
            }
            
            contextMenu.remove();
        });

        // Close menu when clicking elsewhere
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    showEditMarkerModal(marker, markerElement) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        
        // Handle title for single or multiple markers
        const title = marker.isMultiple 
            ? `Edit Marker - Multiple Miscrits`
            : `Edit Marker - ${marker.miscritName}`;
            
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="marker-editor">
                        <!-- Marker Information Section -->
                        <div class="editor-section">
                            <h4>Marker Information</h4>
                            <div class="marker-info-editor">
                                <div class="info-section">
                                    <label for="additional-info">Additional Information:</label>
                                    <textarea id="additional-info" class="additional-info-input" 
                                              placeholder="Enter additional information about this marker..."
                                              rows="4">${marker.additionalInformation || ''}</textarea>
                                </div>
                                
                                <div class="info-section">
                                    <label>Exact Location Images:</label>
                                    <div id="exact-location-images">
                                        <!-- Will be populated with existing images -->
                                    </div>
                                    <div class="add-image-section">
                                        <input type="url" id="new-image-url" class="image-url-input" 
                                               placeholder="Enter image URL">
                                        <button type="button" class="btn-add-image">Add Image</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Get elements
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const saveBtn = modal.querySelector('.btn-save');
        const exactImagesContainer = modal.querySelector('#exact-location-images');
        const addImageBtn = modal.querySelector('.btn-add-image');
        const newImageUrlInput = modal.querySelector('#new-image-url');
        
        // Populate existing exact location images
        this.populateExistingImages(marker, exactImagesContainer);

        // Add image functionality
        addImageBtn.addEventListener('click', () => {
            const url = newImageUrlInput.value.trim();
            if (url) {
                this.addImageToContainer(url, exactImagesContainer);
                newImageUrlInput.value = '';
            }
        });

        // Close handlers
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Save handler
        saveBtn.addEventListener('click', () => {
            // Save marker info data
            this.saveMarkerInfoFromEditor(marker, exactImagesContainer);
            
            // Update marker element display
            this.updateMarkerElementFromData(marker, markerElement);
            
            closeModal();
        });

        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    populateExistingImages(marker, container) {
        if (!marker.exactLocationImages) {
            marker.exactLocationImages = [];
        }
        
        container.innerHTML = '';
        
        marker.exactLocationImages.forEach((imageUrl, index) => {
            this.addImageToContainer(imageUrl, container, true);
        });
    }
    
    addImageToContainer(url, container, isExisting = false) {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.innerHTML = `
            <img src="${url}" alt="Location image" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px;">
            <div class="image-url">${url}</div>
            <button type="button" class="btn-remove-image">Remove</button>
        `;
        
        // Add remove functionality
        const removeBtn = imageItem.querySelector('.btn-remove-image');
        removeBtn.addEventListener('click', () => {
            container.removeChild(imageItem);
        });
        
        container.appendChild(imageItem);
    }
    
    saveMarkerInfoFromEditor(marker, imagesContainer) {
        // Get additional information
        const additionalInfoTextarea = document.getElementById('additional-info');
        marker.additionalInformation = additionalInfoTextarea.value.trim();
        
        // Get exact location images
        const imageItems = imagesContainer.querySelectorAll('.image-item');
        marker.exactLocationImages = Array.from(imageItems).map(item => {
            return item.querySelector('.image-url').textContent;
        });
        
        // Save to storage
        const allMarkers = this.getMiscritMarkers();
        this.saveMiscritMarkers(allMarkers);
    }

    showEditMarkerInfoModal(marker, markerElement) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        
        // Handle title for single or multiple markers
        const title = marker.isMultiple 
            ? `Edit Marker Info - ${marker.miscrits.map(m => m.miscritName).join(', ')}`
            : `Edit Marker Info - ${marker.miscritName}`;
            
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="marker-info-editor">
                        <div class="info-section">
                            <label for="additional-info">Additional Information:</label>
                            <textarea id="additional-info" class="additional-info-input" 
                                      placeholder="Enter additional information about this marker..."
                                      rows="4">${marker.additionalInformation || ''}</textarea>
                        </div>
                        
                        <div class="info-section">
                            <label>Exact Location Images:</label>
                            <div id="exact-location-images">
                                <!-- Will be populated with existing images -->
                            </div>
                            <div class="add-image-section">
                                <input type="url" id="new-image-url" class="image-url-input" 
                                       placeholder="Enter image URL">
                                <button type="button" class="btn-add-image">Add Image</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Get elements
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const saveBtn = modal.querySelector('.btn-save');
        const additionalInfoInput = modal.querySelector('#additional-info');
        const imagesContainer = modal.querySelector('#exact-location-images');
        const newImageUrlInput = modal.querySelector('#new-image-url');
        const addImageBtn = modal.querySelector('.btn-add-image');

        // Populate existing images
        this.populateExactLocationImages(marker, imagesContainer);

        // Add image button handler
        addImageBtn.addEventListener('click', () => {
            const url = newImageUrlInput.value.trim();
            if (url) {
                if (!marker.exactLocationImages) {
                    marker.exactLocationImages = [];
                }
                marker.exactLocationImages.push(url);
                newImageUrlInput.value = '';
                this.populateExactLocationImages(marker, imagesContainer);
            }
        });

        // Allow adding image with Enter key
        newImageUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addImageBtn.click();
            }
        });

        // Close handlers
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Save changes
        saveBtn.addEventListener('click', () => {
            this.saveMarkerInfo(marker, markerElement, additionalInfoInput.value.trim());
            document.body.removeChild(modal);
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // Focus the additional info input
        setTimeout(() => additionalInfoInput.focus(), 100);
    }

    populateExactLocationImages(marker, container) {
        const images = marker.exactLocationImages || [];
        
        if (images.length === 0) {
            container.innerHTML = '<div class="no-images">No exact location images added yet</div>';
            return;
        }

        container.innerHTML = images.map((url, index) => `
            <div class="exact-location-image-item">
                <img src="${url}" alt="Exact location ${index + 1}" class="exact-location-preview">
                <div class="image-url">${url}</div>
                <button class="btn-remove-image" data-index="${index}">&times;</button>
            </div>
        `).join('');

        // Add remove handlers
        container.querySelectorAll('.btn-remove-image').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                marker.exactLocationImages.splice(index, 1);
                this.populateExactLocationImages(marker, container);
            });
        });
    }

    saveMarkerInfo(marker, markerElement, additionalInfo) {
        // Update marker object
        marker.additionalInformation = additionalInfo;

        // Update localStorage
        const markers = this.getMiscritMarkers();
        if (markers[marker.location]) {
            const markerIndex = markers[marker.location].findIndex(m => 
                m.id === marker.id  // Use unique ID instead of timestamp
            );
            if (markerIndex !== -1) {
                markers[marker.location][markerIndex] = marker;
                localStorage.setItem('miscritMarkers', JSON.stringify(markers));
            }
        }

        const markerName = marker.isMultiple 
            ? marker.miscrits.map(m => m.miscritName).join(', ')
            : marker.miscritName;
    }

    showEditDaysModal(marker, markerElement) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        
        // Handle title for single or multiple markers
        const title = marker.isMultiple 
            ? `Edit Days of Week - Multiple Miscrits`
            : `Edit Days of Week - ${marker.miscritName}`;
            
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="days-editor-container">
                        <!-- Will be populated based on marker type -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Get elements
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const saveBtn = modal.querySelector('.btn-save');
        const container = modal.querySelector('#days-editor-container');

        // Generate the days editor content
        this.generateDaysEditor(marker, container);

        // Close handlers
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Save changes
        saveBtn.addEventListener('click', () => {
            this.saveDaysChanges(marker, markerElement, container);
            document.body.removeChild(modal);
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    generateDaysEditor(marker, container) {
        const days = [
            { key: 'mon', label: 'Monday' },
            { key: 'tue', label: 'Tuesday' },
            { key: 'wed', label: 'Wednesday' },
            { key: 'thu', label: 'Thursday' },
            { key: 'fri', label: 'Friday' },
            { key: 'sat', label: 'Saturday' },
            { key: 'sun', label: 'Sunday' }
        ];

        if (marker.isMultiple) {
            // For multiple miscrits, show each miscrit with its own day selector
            container.innerHTML = `
                <p>Select which days each miscrit can be caught:</p>
                <div class="miscrits-days-list">
                    ${marker.miscrits.map((miscrit, index) => `
                        <div class="miscrit-days-section" data-miscrit-index="${index}">
                            <div class="miscrit-days-header">
                                <img src="${miscrit.imageUrl}" alt="${miscrit.miscritName}" class="miscrit-days-avatar">
                                <span class="miscrit-days-name">${miscrit.miscritName}</span>
                            </div>
                            <div class="days-checkboxes">
                                ${days.map(day => `
                                    <label class="day-checkbox">
                                        <input type="checkbox" 
                                               value="${day.key}" 
                                               ${miscrit.daysOfWeek.includes(day.key) ? 'checked' : ''}>
                                        <span class="day-label">${day.label}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            // For single miscrit
            const miscritDays = marker.daysOfWeek;
            container.innerHTML = `
                <p>Select which days <strong>${marker.miscritName}</strong> can be caught:</p>
                <div class="days-checkboxes single-miscrit-days">
                    ${days.map(day => `
                        <label class="day-checkbox">
                            <input type="checkbox" 
                                   value="${day.key}" 
                                   ${miscritDays.includes(day.key) ? 'checked' : ''}>
                            <span class="day-label">${day.label}</span>
                        </label>
                    `).join('')}
                </div>
            `;
        }
    }

    saveDaysChanges(marker, markerElement, container) {
        if (marker.isMultiple) {
            // For multiple miscrits, update each miscrit's days
            const miscritSections = container.querySelectorAll('.miscrit-days-section');
            miscritSections.forEach((section, index) => {
                const checkboxes = section.querySelectorAll('input[type="checkbox"]');
                const selectedDays = Array.from(checkboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.value);
                
                if (marker.miscrits[index]) {
                    marker.miscrits[index].daysOfWeek = selectedDays;
                }
            });
        } else {
            // For single miscrit
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            const selectedDays = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            
            marker.daysOfWeek = selectedDays;
        }

        // Update localStorage
        const markers = this.getMiscritMarkers();
        if (markers[marker.location]) {
            const markerIndex = markers[marker.location].findIndex(m => 
                m.id === marker.id  // Use unique ID instead of timestamp
            );
            if (markerIndex !== -1) {
                markers[marker.location][markerIndex] = marker;
                localStorage.setItem('miscritMarkers', JSON.stringify(markers));
            }
        }

        const markerName = marker.isMultiple 
            ? marker.miscrits.map(m => m.miscritName).join(', ')
            : marker.miscritName;
    }

    generateDaysEditor(marker, container) {
        const days = [
            { key: 'mon', label: 'Monday' },
            { key: 'tue', label: 'Tuesday' },
            { key: 'wed', label: 'Wednesday' },
            { key: 'thu', label: 'Thursday' },
            { key: 'fri', label: 'Friday' },
            { key: 'sat', label: 'Saturday' },
            { key: 'sun', label: 'Sunday' }
        ];

        if (marker.isMultiple) {
            // For multiple miscrits, show each miscrit with its own day selector
            container.innerHTML = `
                <p>Select which days each miscrit can be caught:</p>
                <div class="miscrits-days-list">
                    ${marker.miscrits.map((miscrit, index) => `
                        <div class="miscrit-days-section" data-miscrit-index="${index}">
                            <div class="miscrit-days-header">
                                <img src="${miscrit.imageUrl}" alt="${miscrit.miscritName}" class="miscrit-days-avatar">
                                <span class="miscrit-days-name">${miscrit.miscritName}</span>
                            </div>
                            <div class="days-checkboxes">
                                ${days.map(day => `
                                    <label class="day-checkbox">
                                        <input type="checkbox" 
                                               value="${day.key}" 
                                               ${miscrit.daysOfWeek.includes(day.key) ? 'checked' : ''}>
                                        <span class="day-label">${day.label}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            // For single miscrit
            const miscritDays = marker.daysOfWeek;
            container.innerHTML = `
                <p>Select which days <strong>${marker.miscritName}</strong> can be caught:</p>
                <div class="days-checkboxes single-miscrit-days">
                    ${days.map(day => `
                        <label class="day-checkbox">
                            <input type="checkbox" 
                                   value="${day.key}" 
                                   ${miscritDays.includes(day.key) ? 'checked' : ''}>
                            <span class="day-label">${day.label}</span>
                        </label>
                    `).join('')}
                </div>
            `;
        }
    }

    populateExistingImages(marker, container) {
        if (!marker.exactLocationImages) {
            marker.exactLocationImages = [];
        }
        
        container.innerHTML = '';
        
        marker.exactLocationImages.forEach((imageUrl, index) => {
            this.addImageToContainer(imageUrl, container, true);
        });
    }
    
    addImageToContainer(url, container, isExisting = false) {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
        imageItem.innerHTML = `
            <img src="${url}" alt="Location image" class="image-preview">
            <div class="image-url">${url}</div>
            <button class="btn-remove-image">&times;</button>
        `;
        
        container.appendChild(imageItem);
        
        // Add remove functionality
        imageItem.querySelector('.btn-remove-image').addEventListener('click', () => {
            imageItem.remove();
        });
    }

    saveMarkerInfoFromEditor(marker, exactImagesContainer) {
        // Get exact location images
        const imageItems = exactImagesContainer.querySelectorAll('.image-item');
        marker.exactLocationImages = Array.from(imageItems).map(item => {
            return item.querySelector('.image-url').textContent;
        });
        
        // Save to storage
        const allMarkers = this.getMiscritMarkers();
        this.saveMiscritMarkers(allMarkers);
    }

    updateMarkerElementFromData(marker, markerElement) {
        // Update the visual representation of the marker if needed
        // For now, just log the update
        const markerName = marker.isMultiple 
            ? marker.miscrits.map(m => m.miscritName).join(', ')
            : marker.miscritName;
    }

    removeMiscritMarker(marker, markerElement) {
        const markerName = marker.isMultiple 
            ? marker.miscrits.map(m => m.miscritName).join(', ')
            : marker.miscritName;
            
        if (confirm(`Remove ${markerName} marker?`)) {
            // Remove from localStorage
            const markers = this.getMiscritMarkers();
            if (markers[marker.location]) {
                markers[marker.location] = markers[marker.location].filter(m => 
                    m.id !== marker.id  // Use unique ID instead of timestamp
                );
                if (markers[marker.location].length === 0) {
                    delete markers[marker.location];
                }
            }
            localStorage.setItem('miscritMarkers', JSON.stringify(markers));

            // Remove visual element
            markerElement.remove();

        }
    }

    loadMiscritMarkers(location, imageContainer) {
        const markers = this.getMiscritMarkers();
        
        if (markers[location]) {
            // Get all filter values
            const dayFilter = document.getElementById('day-filter').value;
            const currentDay = this.getCurrentGMTDay();
            const ownershipFilterElement = document.getElementById('ownership-filter');
            const ownershipFilter = ownershipFilterElement ? ownershipFilterElement.value : '';
            const areaFilter = document.getElementById('area-filter').value;
            const rarityFilter = document.getElementById('rarity-filter').value;
            const elementFilter = document.getElementById('element-filter').value;
            const searchFilter = document.getElementById('search-filter').value.toLowerCase();
            
            
            markers[location].forEach((marker, index) => {
                
                // Check if marker should be visible based on all filters
                const dayVisible = this.shouldShowMarker(marker, dayFilter, currentDay);
                const ownershipVisible = this.shouldShowMarkerForOwnership(marker, ownershipFilter);
                const otherFiltersVisible = this.shouldShowMarkerForOtherFilters(marker, areaFilter, rarityFilter, elementFilter, searchFilter);
                
                
                // Only show marker if it passes all filters
                if (dayVisible && ownershipVisible && otherFiltersVisible) {
                    if (marker.isMultiple) {
                        this.createMultipleMarkerElement(marker, imageContainer);
                    } else {
                        this.createMarkerElement(marker, imageContainer);
                    }
                } else {
                }
            });
        } else {
        }
    }

    reloadAllMarkers() {
        // Find all image containers and reload their markers
        const imageContainers = document.querySelectorAll('.location-image-container');
        imageContainers.forEach(container => {
            // Clear existing markers
            const markers = container.querySelectorAll('.miscrit-marker');
            markers.forEach(marker => marker.remove());
            
            // Find the location name from the section header
            const section = container.closest('.location-section');
            if (section) {
                const titleElement = section.querySelector('.location-title');
                if (titleElement) {
                    const location = titleElement.textContent;
                    this.loadMiscritMarkers(location, container);
                }
            }
        });
    }

    shouldShowMarker(marker, dayFilter, currentDay) {
        // If no day filter is selected, show all markers
        if (!dayFilter) return true;

        // Determine which day to check
        const targetDay = dayFilter === 'today' ? currentDay : dayFilter;

        if (marker.isMultiple) {
            // For multiple miscrits, show marker if any miscrit is available on target day
            return marker.miscrits.some(miscrit => {
                // Get days from CDN data
                const days = this.getDaysOfWeekFromCDN(miscrit.miscritId, marker.location);
                return days.includes(targetDay);
            });
        } else {
            // For single miscrit, check its availability from CDN
            const days = this.getDaysOfWeekFromCDN(marker.miscritId, marker.location);
            return days.includes(targetDay);
        }
    }

    shouldShowMarkerForOwnership(marker, ownershipFilter) {
        // If no ownership filter or not logged in, show all markers
        if (!ownershipFilter || !this.playerData || !this.playerData.miscrits) {
            return true;
        }

        // For multiple miscrits, check if any of them match the ownership filter
        if (marker.isMultiple && marker.miscrits && Array.isArray(marker.miscrits)) {
            return marker.miscrits.some(miscrit => {
                if (!miscrit) {
                    return true; // Show markers with invalid data
                }
                
                // Use miscritId if available, otherwise fall back to miscritName
                let stats = null;
                if (miscrit.miscritId) {
                    stats = this.getMiscritCollectionStats(miscrit.miscritId);
                } else if (miscrit.miscritName) {
                    const miscritInfo = this.getMiscritInfoFromName(miscrit.miscritName);
                    if (miscritInfo) {
                        stats = this.getMiscritCollectionStats(miscritInfo.id);
                    }
                }
                
                if (stats) {
                    if (ownershipFilter === 'owned') {
                        return stats.total > 0;
                    } else if (ownershipFilter === 'not-owned') {
                        return stats.total === 0;
                    }
                }
                return true; // Show if we can't determine ownership
            });
        } else {
            // For single miscrit, check its ownership
            let stats = null;
            if (marker.miscritId) {
                stats = this.getMiscritCollectionStats(marker.miscritId);
            } else if (marker.name || marker.miscritName) {
                const miscritInfo = this.getMiscritInfoFromName(marker.name || marker.miscritName);
                if (miscritInfo) {
                    stats = this.getMiscritCollectionStats(miscritInfo.id);
                }
            }
            
            if (stats) {
                if (ownershipFilter === 'owned') {
                    return stats.total > 0;
                } else if (ownershipFilter === 'not-owned') {
                    return stats.total === 0;
                }
            }
            return true; // Show if we can't determine ownership
        }
    }

    shouldShowMarkerForOtherFilters(marker, areaFilter, rarityFilter, elementFilter, searchFilter) {
        // If no filters are applied, show all markers
        if (!areaFilter && !rarityFilter && !elementFilter && !searchFilter) {
            return true;
        }

        // For multiple miscrits, check if any of them match the filters
        if (marker.isMultiple && marker.miscrits && Array.isArray(marker.miscrits)) {
            return marker.miscrits.some(miscrit => {
                if (!miscrit) {
                    return true; // Show markers with invalid data
                }
                
                // Use miscritId if available, otherwise fall back to miscritName
                let miscritInfo = null;
                if (miscrit.miscritId) {
                    miscritInfo = this.getMiscritInfoFromId(miscrit.miscritId);
                } else if (miscrit.miscritName) {
                    miscritInfo = this.getMiscritInfoFromName(miscrit.miscritName);
                }
                
                if (miscritInfo) {
                    // Check area filter by looking at the full miscrit data, not just the info
                    if (areaFilter) {
                        // Find the full miscrit data from the main array
                        let fullMiscritData = null;
                        if (miscrit.miscritId) {
                            fullMiscritData = this.miscrits.find(m => m.id === miscrit.miscritId);
                        } else if (miscrit.miscritName) {
                            fullMiscritData = this.miscrits.find(m => m.firstName === miscrit.miscritName);
                        }
                        
                        if (fullMiscritData && fullMiscritData.currentLocationAreas) {
                            const hasArea = Object.keys(fullMiscritData.currentLocationAreas).includes(areaFilter);
                            if (!hasArea) {
                                return false;
                            }
                        } else {
                            return false; // If no area data, hide the marker when area filter is active
                        }
                    }
                    
                    // Check rarity filter
                    if (rarityFilter && miscritInfo.rarity !== rarityFilter) {
                        return false;
                    }
                    // Check element filter
                    if (elementFilter && miscritInfo.element !== elementFilter) {
                        return false;
                    }
                    // Check search filter
                    if (searchFilter && !miscritInfo.name.toLowerCase().includes(searchFilter)) {
                        return false;
                    }
                    return true;
                }
                return true; // Show if we can't determine info
            });
        } else {
            // For single miscrit, check its filters
            let miscritInfo = null;
            if (marker.miscritId) {
                miscritInfo = this.getMiscritInfoFromId(marker.miscritId);
            } else if (marker.name || marker.miscritName) {
                miscritInfo = this.getMiscritInfoFromName(marker.name || marker.miscritName);
            }
            
            if (miscritInfo) {
                // Check area filter by looking at the full miscrit data, not just the info
                if (areaFilter) {
                    // Find the full miscrit data from the main array
                    let fullMiscritData = null;
                    if (marker.miscritId) {
                        fullMiscritData = this.miscrits.find(m => m.id === marker.miscritId);
                    } else if (marker.name || marker.miscritName) {
                        fullMiscritData = this.miscrits.find(m => m.firstName === (marker.name || marker.miscritName));
                    }
                    
                    if (fullMiscritData && fullMiscritData.currentLocationAreas) {
                        const hasArea = Object.keys(fullMiscritData.currentLocationAreas).includes(areaFilter);
                        if (!hasArea) {
                            return false;
                        }
                    } else {
                        return false; // If no area data, hide the marker when area filter is active
                    }
                }
                
                // Check rarity filter
                if (rarityFilter && miscritInfo.rarity !== rarityFilter) {
                    return false;
                }
                // Check element filter
                if (elementFilter && miscritInfo.element !== elementFilter) {
                    return false;
                }
                // Check search filter
                if (searchFilter && !miscritInfo.name.toLowerCase().includes(searchFilter)) {
                    return false;
                }
                return true;
            }
            return true; // Show if we can't determine info
        }
    }

    getMiscritMarkers() {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'json';
        
        if (dataSource === 'json') {
            // Return from cached JSON data if available
            const markers = this.cachedJsonData?.markers || {};
            return markers;
        } else {
            // Return from local storage
            const stored = localStorage.getItem('miscritMarkers');
            const markers = stored ? JSON.parse(stored) : {};
            return markers;
        }
    }

    saveMiscritMarkers(markers) {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'json';
        
        if (dataSource === 'local') {
            localStorage.setItem('miscritMarkers', JSON.stringify(markers));
        } else {
            // When using JSON mode, show a warning that changes can't be saved
            console.warn('Cannot save markers in JSON mode. Switch to Local Storage mode to save changes.');
        }
    }

    saveMiscritAvailabilityData(availabilityData) {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'json';
        
        if (dataSource === 'local') {
            localStorage.setItem('miscritAvailability', JSON.stringify(availabilityData));
        } else {
            // When using JSON mode, show a warning that changes can't be saved
            console.warn('Cannot save availability data in JSON mode. Switch to Local Storage mode to save changes.');
        }
    }

    isEditingAllowed() {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'json';
        return dataSource === 'local';
    }

    exportData() {
        const markers = this.getMiscritMarkers();
        
        const exportData = {
            markers: markers,
            exportDate: new Date().toISOString(),
            version: "1.0"
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'miscrits-data.json';
        link.click();
        
        URL.revokeObjectURL(url);
    }

    showClearMarkersConfirmation() {
        // Create confirmation modal
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚠️ Clear All Markers</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>WARNING:</strong> This will permanently delete all markers from all locations.</p>
                    <p>This action cannot be undone. Are you sure you want to proceed?</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save clear-confirm-btn" style="background: var(--error);">Delete All Markers</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const confirmBtn = modal.querySelector('.clear-confirm-btn');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        confirmBtn.addEventListener('click', () => {
            this.clearAllMarkers();
            modal.remove();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    clearAllMarkers() {
        // Clear from localStorage
        localStorage.removeItem('miscritMarkers');
        
        // Remove all visual markers from all maps
        document.querySelectorAll('.miscrit-marker').forEach(marker => {
            marker.remove();
        });
        
    }

    showClearDatesConfirmation() {
        // Create confirmation modal
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚠️ Clear All Dates</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>WARNING:</strong> This will permanently delete all custom day-of-week availability data for all miscrits.</p>
                    <p>All miscrits will revert to being available on all days of the week.</p>
                    <p>This action cannot be undone. Are you sure you want to proceed?</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save clear-confirm-btn" style="background: var(--error);">Delete All Dates</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const confirmBtn = modal.querySelector('.clear-confirm-btn');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        confirmBtn.addEventListener('click', () => {
            this.clearAllDates();
            modal.remove();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    clearAllDates() {
        // Clear from localStorage
        localStorage.removeItem('miscritAvailability');
        
        // Refresh the page to update the display
        alert('All custom day-of-week data has been cleared. Reloading page...');
        location.reload();
        
    }

    showAdminModeWarning() {
        // Create modal for admin warning
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚠️ Admin Mode Warning</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>IMPORTANT WARNING:</strong></p>
                    <p>Using Admin Mode will <strong>NOT</strong> change the database this website pulls its information from.</p>
                    <p>This mode is designed for administrators to interactively create database content.</p>
                    <p><strong>Warning:</strong> Using this mode can break your own display of information as it will override the database with local changes.</p>
                    <p>Only proceed if you understand these limitations and are creating content for database purposes.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save admin-confirm">Enter Admin Mode</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const confirmBtn = modal.querySelector('.admin-confirm');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        confirmBtn.addEventListener('click', () => {
            this.enterAdminMode();
            modal.remove();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    enterAdminMode() {
        this.isAdminMode = true;
        
        // Save admin mode state to localStorage
        localStorage.setItem('isAdminMode', 'true');
        
        // Check data source and show warning if using JSON mode
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'json';
        if (dataSource === 'json') {
            alert('⚠️ Warning: You are in JSON data mode. Editing features will be disabled. Switch to Local Storage mode to make changes.');
        }
        
        // Add admin mode class to body for CSS styling
        document.body.classList.add('admin-mode');
        
        // Hide the "Enter Admin Mode" button
        const adminModeBtn = document.getElementById('admin-mode-btn');
        adminModeBtn.style.display = 'none';
        
        // Show the admin controls
        const adminControls = document.getElementById('admin-controls');
        adminControls.style.display = 'flex';
        
        // Show the admin help section
        const adminHelpSection = document.getElementById('admin-help-section');
        adminHelpSection.style.display = 'block';
        
    }

    exitAdminMode() {
        this.isAdminMode = false;
        
        // Remove admin mode state from localStorage
        localStorage.removeItem('isAdminMode');
        
        // Remove admin mode class from body
        document.body.classList.remove('admin-mode');
        
        // Show the "Enter Admin Mode" button
        const adminModeBtn = document.getElementById('admin-mode-btn');
        adminModeBtn.style.display = 'inline-block';
        
        // Hide the admin controls
        const adminControls = document.getElementById('admin-controls');
        adminControls.style.display = 'none';
        
        // Hide the admin help section
        const adminHelpSection = document.getElementById('admin-help-section');
        adminHelpSection.style.display = 'none';
        
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    }

    showError(message) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error-message').textContent = message;
        document.getElementById('error').style.display = 'block';
    }

    // Combined Add/Remove Miscrits functionality
    showManageMiscritsModal(marker, markerElement, imageContainer) {
        // Get location miscrits with correct filtering logic
        const location = marker.location;
        const locationMiscrits = this.miscrits
            .filter(miscrit => {
                // Check if miscrit appears in this location
                if (!miscrit.locations) return false;
                return Object.keys(miscrit.locations).includes(location);
            })
            .map(miscrit => ({
                id: miscrit.id,
                name: miscrit.names?.[0] || 'Unknown',
                element: miscrit.element,
                rarity: miscrit.rarity
            }))
            // Remove duplicates based on ID
            .filter((miscrit, index, self) => 
                index === self.findIndex(m => m.id === miscrit.id)
            )
            .sort((a, b) => a.name.localeCompare(b.name));


        // Track selected miscrits - start with current miscrits in marker
        let selectedMiscrits = [...marker.miscrits];

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'miscrit-selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Manage Miscrits on Pin</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="selected-miscrits-section">
                        <h4>Miscrits on this Pin:</h4>
                        <div class="selected-miscrits-list" id="current-selected-miscrits">
                            <!-- Will be populated by updateSelectedDisplay -->
                        </div>
                    </div>
                    <div class="miscrit-search">
                        <input type="text" placeholder="Search miscrits (leave empty to see all)..." class="miscrit-search-input" autofocus>
                    </div>
                    <div class="miscrit-list" id="manage-miscrit-search-results">
                        <!-- Will be populated by search functionality -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-save">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Get elements
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const saveBtn = modal.querySelector('.btn-save');
        const searchInput = modal.querySelector('.miscrit-search-input');
        const resultsContainer = modal.querySelector('#manage-miscrit-search-results');
        const selectedContainer = modal.querySelector('#current-selected-miscrits');

        const updateSelectedDisplay = () => {
            if (selectedMiscrits.length === 0) {
                selectedContainer.innerHTML = '<div class="no-selection">No Miscrits selected</div>';
                saveBtn.disabled = true;
            } else {
                selectedContainer.innerHTML = selectedMiscrits.map(miscrit => `
                    <div class="selected-miscrit" data-miscrit-id="${miscrit.miscritId}">
                        <img src="${miscrit.imageUrl}" alt="${miscrit.miscritName}" class="selected-miscrit-avatar">
                        <span class="selected-miscrit-name">${miscrit.miscritName}</span>
                        <button class="remove-selected" data-miscrit-id="${miscrit.miscritId}">&times;</button>
                    </div>
                `).join('');
                saveBtn.disabled = false;

                // Add remove listeners
                selectedContainer.querySelectorAll('.remove-selected').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const miscritId = parseInt(btn.dataset.miscritId);
                        selectedMiscrits = selectedMiscrits.filter(m => m.miscritId !== miscritId);
                        updateSelectedDisplay();
                        // Refresh search results to update selection state
                        if (searchInput.value.trim()) {
                            searchInput.dispatchEvent(new Event('input'));
                        }
                    });
                });
            }
        };

        // Close handlers
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Save changes
        saveBtn.addEventListener('click', () => {
            if (selectedMiscrits.length === 0) {
                alert('Cannot save with no miscrits. Use "Remove All" to delete the entire marker.');
                return;
            }

            // Update marker data
            if (selectedMiscrits.length === 1) {
                // Convert to single marker
                const miscrit = selectedMiscrits[0];
                marker.miscritId = miscrit.miscritId;
                marker.miscritName = miscrit.miscritName;
                marker.imageUrl = miscrit.imageUrl;
                delete marker.miscrits;
                delete marker.isMultiple;
            } else {
                // Keep as multiple marker
                marker.miscrits = selectedMiscrits;
                marker.isMultiple = true;
                // Clean up single marker properties if they exist
                delete marker.miscritId;
                delete marker.miscritName;
                delete marker.imageUrl;
            }

            // Update localStorage
            const markers = this.getMiscritMarkers();
            if (markers[marker.location]) {
                const markerIndex = markers[marker.location].findIndex(m => 
                    m.id === marker.id  // Use unique ID instead of timestamp
                );
                if (markerIndex !== -1) {
                    markers[marker.location][markerIndex] = marker;
                    localStorage.setItem('miscritMarkers', JSON.stringify(markers));
                }
            }

            // Update visual element
            markerElement.remove();
            if (marker.isMultiple) {
                this.createMultipleMarkerElement(marker, imageContainer);
            } else {
                this.createMarkerElement(marker, imageContainer);
            }

            document.body.removeChild(modal);
        });

        // Search functionality
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            let filteredMiscrits;
            if (searchTerm.length === 0) {
                // Show all miscrits sorted by rarity then name
                filteredMiscrits = locationMiscrits.sort((a, b) => {
                    const rarityOrder = ['Common', 'Rare', 'Epic', 'Exotic', 'Legendary'];
                    const aRarityIndex = rarityOrder.indexOf(a.rarity);
                    const bRarityIndex = rarityOrder.indexOf(b.rarity);
                    
                    if (aRarityIndex !== bRarityIndex) {
                        return aRarityIndex - bRarityIndex;
                    }
                    return a.name.localeCompare(b.name);
                });
            } else {
                // Filter based on search term
                filteredMiscrits = locationMiscrits.filter(miscrit => 
                    miscrit.name.toLowerCase().includes(searchTerm) ||
                    miscrit.element.toLowerCase().includes(searchTerm) ||
                    miscrit.rarity.toLowerCase().includes(searchTerm)
                );
            }

            if (filteredMiscrits.length === 0) {
                resultsContainer.innerHTML = '<div class="search-placeholder">No miscrits found</div>';
                return;
            }

            resultsContainer.innerHTML = filteredMiscrits.map(miscrit => {
                const isSelected = selectedMiscrits.some(m => m.miscritId === miscrit.id);
                const rarityClass = miscrit.rarity.toLowerCase();
                return `
                    <div class="manage-miscrit-option ${isSelected ? 'selected' : ''}" data-miscrit-id="${miscrit.id}" data-rarity="${rarityClass}">
                        <img src="https://cdn.worldofmiscrits.com/avatars/${miscrit.name.toLowerCase().replace(/\s+/g, '_')}_avatar.png" 
                             alt="${miscrit.name}" class="manage-miscrit-avatar">
                        <div class="manage-miscrit-info">
                            <span class="manage-miscrit-name">${miscrit.name}</span>
                        </div>
                        <button class="manage-miscrit-action ${isSelected ? 'remove' : 'add'}" data-miscrit-id="${miscrit.id}">
                            ${isSelected ? '✕' : '+'}
                        </button>
                    </div>
                `;
            }).join('');

            // Wrap results in grid container
            if (filteredMiscrits.length > 0) {
                resultsContainer.innerHTML = `<div class="manage-miscrits-grid">${resultsContainer.innerHTML}</div>`;
            }

            // Add click listeners to toggle selection
            const gridContainer = resultsContainer.querySelector('.manage-miscrits-grid');
            if (gridContainer) {
                gridContainer.querySelectorAll('.manage-miscrit-option').forEach(option => {
                    const actionBtn = option.querySelector('.manage-miscrit-action');
                    actionBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const miscritId = parseInt(option.dataset.miscritId);
                        const miscrit = this.miscrits.find(m => m.id === miscritId);
                        
                        // Toggle selection
                        if (selectedMiscrits.some(m => m.miscritId === miscritId)) {
                            selectedMiscrits = selectedMiscrits.filter(m => m.miscritId !== miscritId);
                        } else {
                            selectedMiscrits.push({
                                miscritId: miscrit.id,
                                miscritName: miscrit.names?.[0] || 'Unknown',
                                imageUrl: `https://cdn.worldofmiscrits.com/avatars/${(miscrit.names?.[0] || 'Unknown').toLowerCase().replace(/\s+/g, '_')}_avatar.png`,
                                miscritRarity: miscrit.rarity || 'Common'
                            });
                        }
                        
                        updateSelectedDisplay();
                        
                        // Update the search results to show new selection state
                        searchInput.dispatchEvent(new Event('input'));
                    });

                    // Also allow clicking the whole option
                    option.addEventListener('click', (e) => {
                        if (e.target.classList.contains('manage-miscrit-action')) return;
                        actionBtn.click();
                    });
                });
            }
        });

        // Initialize display with all miscrits
        searchInput.dispatchEvent(new Event('input'));

        // Initialize display
        updateSelectedDisplay();

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    showAddMiscritToMarkerModal(marker, markerElement, imageContainer) {
        // Redirect to the new combined modal
        this.showManageMiscritsModal(marker, markerElement, imageContainer);
    }

    showRemoveMiscritFromMarkerModal(marker, markerElement, imageContainer) {
        // Redirect to the new combined modal
        this.showManageMiscritsModal(marker, markerElement, imageContainer);
    }

    startMultipleMoveMode(marker, markerElement, imageContainer) {
        // Add move mode class to indicate we're in move mode
        document.body.classList.add('move-mode');
        markerElement.classList.add('moving');
        
        // Create instruction overlay
        const instruction = document.createElement('div');
        instruction.className = 'move-instruction';
        const miscritNames = marker.miscrits.map(m => m.miscritName).join(', ');
        instruction.textContent = `Moving ${miscritNames} - Click new position or press Escape to cancel`;
        document.body.appendChild(instruction);

        // Store current position for potential restoration
        const originalX = marker.x;
        const originalY = marker.y;

        // One-time click handler for new position
        const handleMapClick = (e) => {
            if (e.target.closest('.miscrit-marker')) return; // Ignore clicks on markers

            const rect = imageContainer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            // Update marker position
            marker.x = x;
            marker.y = y;
            markerElement.style.left = `${x}%`;
            markerElement.style.top = `${y}%`;

            // Update localStorage
            const markers = this.getMiscritMarkers();
            if (markers[marker.location]) {
                const markerIndex = markers[marker.location].findIndex(m => 
                    m.id === marker.id  // Use unique ID instead of timestamp
                );
                if (markerIndex !== -1) {
                    markers[marker.location][markerIndex] = marker;
                    localStorage.setItem('miscritMarkers', JSON.stringify(markers));
                }
            }

            cleanup();
        };

        // Escape key handler
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                cleanup();
            }
        };

        // Cleanup function
        const cleanup = () => {
            document.body.classList.remove('move-mode');
            markerElement.classList.remove('moving');
            instruction.remove();
            imageContainer.removeEventListener('click', handleMapClick);
            document.removeEventListener('keydown', handleEscape);
        };

        // Add event listeners
        imageContainer.addEventListener('click', handleMapClick);
        document.addEventListener('keydown', handleEscape);
    }

    initializePanZoom(viewport, mapContent, zoomInfo) {
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isPanning = false;
        let startX = 0;
        let startY = 0;
        let lastX = 0;
        let lastY = 0;

        const minScale = 0.5;
        const maxScale = 10;
        const scaleStep = 0.2;

        // Update transform
        const updateTransform = () => {
            mapContent.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            zoomInfo.textContent = `${Math.round(scale * 100)}%`;
        };

        // Reset view
        const resetView = () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
        };

        // Zoom functions
        const zoomIn = () => {
            const newScale = Math.min(scale + scaleStep, maxScale);
            if (newScale !== scale) {
                scale = newScale;
                updateTransform();
            }
        };

        const zoomOut = () => {
            const newScale = Math.max(scale - scaleStep, minScale);
            if (newScale !== scale) {
                scale = newScale;
                updateTransform();
            }
        };

        // Mouse wheel zoom
        const handleWheel = (e) => {
            e.preventDefault();
            const rect = viewport.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        };

        // Mouse pan start
        const handleMouseDown = (e) => {
            if (e.button === 0) { // Left mouse button
                isPanning = true;
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
                lastX = e.clientX;
                lastY = e.clientY;
                mapContent.style.transition = 'none';
                viewport.classList.add('panning');
            }
        };

        // Mouse pan move
        const handleMouseMove = (e) => {
            if (isPanning) {
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                updateTransform();
            }
        };

        // Mouse pan end
        const handleMouseUp = () => {
            if (isPanning) {
                isPanning = false;
                mapContent.style.transition = 'transform 0.1s ease-out';
                viewport.classList.remove('panning');
            }
        };

        // Touch support
        let lastTouchDistance = 0;
        let lastTouchCenter = { x: 0, y: 0 };

        const getTouchDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const getTouchCenter = (touches) => {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };
        };

        const handleTouchStart = (e) => {
            if (e.touches.length === 1) {
                // Single touch - pan
                const touch = e.touches[0];
                isPanning = true;
                startX = touch.clientX - translateX;
                startY = touch.clientY - translateY;
                mapContent.style.transition = 'none';
            } else if (e.touches.length === 2) {
                // Two touches - zoom
                isPanning = false;
                lastTouchDistance = getTouchDistance(e.touches);
                lastTouchCenter = getTouchCenter(e.touches);
            }
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && isPanning) {
                // Single touch pan
                const touch = e.touches[0];
                translateX = touch.clientX - startX;
                translateY = touch.clientY - startY;
                updateTransform();
            } else if (e.touches.length === 2) {
                // Two touch zoom
                const distance = getTouchDistance(e.touches);
                const center = getTouchCenter(e.touches);
                
                const scaleChange = distance / lastTouchDistance;
                const newScale = Math.min(Math.max(scale * scaleChange, minScale), maxScale);
                
                if (newScale !== scale) {
                    scale = newScale;
                    updateTransform();
                }
                
                lastTouchDistance = distance;
                lastTouchCenter = center;
            }
        };

        const handleTouchEnd = () => {
            isPanning = false;
            mapContent.style.transition = 'transform 0.1s ease-out';
        };

        // Button event listeners
        const zoomInBtn = viewport.querySelector('.zoom-in');
        const zoomOutBtn = viewport.querySelector('.zoom-out');
        const zoomResetBtn = viewport.querySelector('.zoom-reset');

        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);
        zoomResetBtn.addEventListener('click', resetView);

        // Mouse events
        viewport.addEventListener('wheel', handleWheel);
        viewport.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Touch events
        viewport.addEventListener('touchstart', handleTouchStart);
        viewport.addEventListener('touchmove', handleTouchMove);
        viewport.addEventListener('touchend', handleTouchEnd);

        // Prevent context menu on viewport
        viewport.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
        });

        // Initialize
        updateTransform();
    }

    initializeTimeDisplay() {
        this.updateTimeDisplay();
        // Update every second
        setInterval(() => {
            this.updateTimeDisplay();
        }, 1000);
    }

    updateTimeDisplay() {
        const now = new Date();
        
        // Current time in GMT+0
        const currentTime = now.toUTCString().slice(17, 25); // Extract HH:MM:SS
        document.getElementById('current-time').textContent = currentTime;
        
        // Calculate time until midnight GMT+0
        const midnight = new Date(now);
        midnight.setUTCDate(midnight.getUTCDate() + 1);
        midnight.setUTCHours(0, 0, 0, 0);
        
        const timeDiff = midnight.getTime() - now.getTime();
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        const countdownTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('countdown-time').textContent = countdownTime;
    }

    clearLocalStorage() {
        if (confirm('Are you sure you want to clear all local storage data? This will remove all custom markers and settings.')) {
            localStorage.removeItem('miscritMarkers');
            localStorage.removeItem('miscritSettings');
            localStorage.removeItem('miscritAvailability');
            localStorage.removeItem('dataSource');
            localStorage.removeItem('isAdminMode');
            alert('Local storage cleared. Reloading page...');
            location.reload();
        }
    }

    initializeDataSource() {
        const savedDataSource = localStorage.getItem('dataSource') || 'json';
        const dataSourceSelect = document.getElementById('data-source-select');
        dataSourceSelect.value = savedDataSource;
        this.currentDataSource = savedDataSource;
        
        // Set default day filter to "Today"
        this.initializeDayFilter();
        
        // Restore admin mode if it was previously active
        this.restoreAdminMode();
    }

    initializeDayFilter() {
        const dayFilter = document.getElementById('day-filter');
        dayFilter.value = 'today';
        
        // Update the "Today" option text to show current day
        this.updateTodayOption();
        
        // Update "Today" option text every minute to handle day changes
        setInterval(() => {
            this.updateTodayOption();
        }, 60000);
    }

    setupAdminHelpToggle() {
        const helpToggleBtn = document.getElementById('admin-help-toggle-btn');
        const helpContent = document.getElementById('admin-help-content');
        const helpSection = document.getElementById('admin-help-section');
        
        // Make the entire toggle area clickable
        const helpToggleArea = helpSection.querySelector('.admin-help-toggle');
        
        const toggleHelp = () => {
            const isVisible = helpContent.style.display !== 'none';
            
            if (isVisible) {
                helpContent.style.display = 'none';
                helpToggleBtn.textContent = 'Show Help';
                helpToggleBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            } else {
                helpContent.style.display = 'block';
                helpToggleBtn.textContent = 'Hide Help';
                helpToggleBtn.style.background = 'rgba(255, 255, 255, 0.3)';
            }
        };
        
        // Add click handlers
        helpToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHelp();
        });
        
        helpToggleArea.addEventListener('click', (e) => {
            if (e.target === helpToggleArea || e.target.tagName === 'H3') {
                toggleHelp();
            }
        });
    }

    updateTodayOption() {
        const dayFilter = document.getElementById('day-filter');
        const currentDay = this.getCurrentGMTDay();
        const dayNames = {
            'mon': 'Monday',
            'tue': 'Tuesday', 
            'wed': 'Wednesday',
            'thu': 'Thursday',
            'fri': 'Friday',
            'sat': 'Saturday',
            'sun': 'Sunday'
        };
        
        // Update the "today" option text
        const todayOption = dayFilter.querySelector('option[value="today"]');
        if (todayOption) {
            todayOption.textContent = `Today (${dayNames[currentDay]})`;
        }
    }

    restoreAdminMode() {
        const wasAdminMode = localStorage.getItem('isAdminMode') === 'true';
        if (wasAdminMode) {
            // Set admin mode without showing the warning dialog
            this.isAdminMode = true;
            
            // Add admin mode class to body for CSS styling
            document.body.classList.add('admin-mode');
            
            // Hide the "Enter Admin Mode" button
            const adminModeBtn = document.getElementById('admin-mode-btn');
            adminModeBtn.style.display = 'none';
            
            // Show the admin controls
            const adminControls = document.getElementById('admin-controls');
            adminControls.style.display = 'flex';
            
            // Show the admin help section
            const adminHelpSection = document.getElementById('admin-help-section');
            adminHelpSection.style.display = 'block';
            
        }
    }

    switchDataSource() {
        const dataSourceSelect = document.getElementById('data-source-select');
        const newSource = dataSourceSelect.value;
        
        localStorage.setItem('dataSource', newSource);
        this.currentDataSource = newSource;
        
        // Reload the page to apply the new data source
        location.reload();
    }

    async importFromJsonFile() {
        try {
            const response = await fetch('miscrits_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Show confirmation dialog
            const confirmMessage = `Import data from miscrits_data.json?\n\nThis will:\n- Replace all local markers\n- Replace all local miscrit availability data\n\nThis action cannot be undone.`;
            
            if (confirm(confirmMessage)) {
                // Import markers
                if (data.markers) {
                    localStorage.setItem('miscritMarkers', JSON.stringify(data.markers));
                }
                
                // Import miscrit availability data
                if (data.miscritAvailability) {
                    localStorage.setItem('miscritAvailability', JSON.stringify(data.miscritAvailability));
                }
                
                alert('Data imported successfully! Reloading page...');
                location.reload();
            }
        } catch (error) {
            alert(`Failed to import from miscrits_data.json: ${error.message}`);
        }
    }

    showFileInput() {
        const fileInput = document.getElementById('file-input');
        fileInput.click();
    }

    handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate the data structure
                if (!data.markers && !data.miscritAvailability) {
                    throw new Error('Invalid file format. Expected markers and/or miscritAvailability data.');
                }
                
                // Show confirmation dialog
                const confirmMessage = `Import data from ${file.name}?\n\nThis will:\n- Replace all local markers\n- Replace all local miscrit availability data\n\nThis action cannot be undone.`;
                
                if (confirm(confirmMessage)) {
                    // Import markers
                    if (data.markers) {
                        localStorage.setItem('miscritMarkers', JSON.stringify(data.markers));
                    }
                    
                    // Import miscrit availability data
                    if (data.miscritAvailability) {
                        localStorage.setItem('miscritAvailability', JSON.stringify(data.miscritAvailability));
                    }
                    
                    alert('Data imported successfully! Reloading page...');
                    location.reload();
                }
            } catch (error) {
                alert(`Failed to import file: ${error.message}`);
            }
        };
        
        reader.readAsText(file);
        
        // Reset the file input
        event.target.value = '';
    }

    /**
     * Calculate miscrit quality rating (F, F+, E, E+, etc.) based on stats
     * Ported from extract_miscrit_ratings.py
     */
    calculateMiscritRating(miscritData) {
        // Stat keys from the game (NEW FORMAT: shortened names)
        const statKeys = ["h", "s", "e", "d", "p", "pd"];
        
        // Rating labels from the game (18 - rating_sum = index)
        const ratings = ["S+", "S", "A+", "A", "B+", "B", "C+", "C", "D+", "D", "F+", "F", "F-"];
        
        // Calculate sum of all stat values
        let ratingSum = 0;
        for (const stat of statKeys) {
            ratingSum += miscritData[stat] || 1; // Default to 1 if stat missing
        }
        
        // Calculate quality grade
        if (ratingSum === 0) {
            return "Unknown";
        }
        
        const ratingIndex = 18 - ratingSum;
        if (ratingIndex >= 0 && ratingIndex < ratings.length) {
            return ratings[ratingIndex];
        } else {
            return "Unknown";
        }
    }

    /**
     * Get color for stat value based on rating calculation
     * Red for 1, White for 2, Green for 3+
     */
    getStatColor(statValue) {
        if (statValue === 1) {
            return '#e74c3c'; // Red
        } else if (statValue === 2) {
            return '#ffffff'; // White
        } else {
            return '#27ae60'; // Green
        }
    }

    /**
     * Calculate collection statistics for a specific miscrit
     */
    getMiscritCollectionStats(miscritId) {
        if (!this.playerData || !this.playerData.miscrits) {
            return null;
        }

        // Find all instances of this miscrit in player's collection
        const ownedMiscrits = this.playerData.miscrits.filter(miscrit => miscrit.m === miscritId);
        
        const stats = {
            total: ownedMiscrits.length,
            sPlus: 0,
            aPlusRS: 0,    // A+ RS (red spd + 1 other red)
            aRS: 0,        // A RS (red spd + 1 white)
            bPlusRS: 0     // B+ RS (red spd only)
        };

        if (ownedMiscrits.length === 0) {
            return stats;
        }

        ownedMiscrits.forEach(miscrit => {
            // Check each filter condition in priority order (highest first)
            // Each miscrit should only be counted in the first category it matches
            if (this.matchesFilter(miscrit, 's-plus')) {
                stats.sPlus++;
            } else if (this.matchesFilter(miscrit, 'red-spd-only')) {
                stats.aPlusRS++;  // A+ RS = red speed only (everything else green)
            } else if (this.matchesFilter(miscrit, 'red-spd-one-white')) {
                stats.aRS++;      // A RS = red speed + 1 white stat
            } else if (this.matchesFilter(miscrit, 'red-spd-one-red')) {
                stats.bPlusRS++;  // B+ = red speed + 1 other red stat
            }
            // If none of the above match, it will be counted in "Other"
        });

        return stats;
    }

    /**
     * Check if a miscrit matches the specified filter criteria
     */
    matchesFilter(miscrit, filterType) {
        const stats = {
            hp: miscrit.h || 1,
            spd: miscrit.s || 1,
            ea: miscrit.e || 1,
            ed: miscrit.d || 1,
            pa: miscrit.p || 1,
            pd: miscrit.pd || 1
        };

        switch (filterType) {
            case 'none':
                return true;
                
            case 's-plus':
                return this.calculateMiscritRating(miscrit) === 'S+';
                
            case 'red-spd-only':
                // Red SPD (1), everything else green (3+)
                return stats.spd === 1 && 
                       stats.hp >= 3 && stats.ea >= 3 && stats.ed >= 3 && 
                       stats.pa >= 3 && stats.pd >= 3;
                       
            case 'red-spd-one-white':
                // Red SPD (1), exactly one white (2), rest green (3+)
                if (stats.spd !== 1) return false;
                const whiteStats = Object.entries(stats).filter(([key, value]) => 
                    key !== 'spd' && value === 2).length;
                const greenStats = Object.entries(stats).filter(([key, value]) => 
                    key !== 'spd' && value >= 3).length;
                return whiteStats === 1 && greenStats === 4;
                
            case 'red-spd-one-red':
                // Red SPD (1), exactly one other red (1), rest green (3+)
                if (stats.spd !== 1) return false;
                const otherRedStats = Object.entries(stats).filter(([key, value]) => 
                    key !== 'spd' && value === 1).length;
                const otherGreenStats = Object.entries(stats).filter(([key, value]) => 
                    key !== 'spd' && value >= 3).length;
                return otherRedStats === 1 && otherGreenStats === 4;
                
            default:
                return true;
        }
    }

    /**
     * Calculate actual total stats using the game's formula
     * Based on base ratings (1-3), metadata, level, and bonuses
     */
    calculateTotalStats(miscrit, miscritInfo) {
        const level = miscrit.l || 1; // NEW: level is now 'l'
        const starMap = {"Weak": 1, "Moderate": 2, "Strong": 3, "Max": 4, "Elite": 5};
        
        // Stat mapping: player data now uses h/s/e/d/p/pd (NEW FORMAT)
        const statMapping = {
            'h': 'hp',    // player data 'h' maps to metadata 'hp'
            's': 'spd',   // player data 's' maps to metadata 'spd'
            'e': 'ea',    // player data 'e' maps to metadata 'ea'
            'd': 'ed',    // player data 'd' maps to metadata 'ed'
            'p': 'pa',    // player data 'p' maps to metadata 'pa'
            'pd': 'pd'    // player data 'pd' maps to metadata 'pd'
        };
        
        const totalStats = {};
        
        for (const [playerKey, metadataKey] of Object.entries(statMapping)) {
            // Get base stat rating (1-3) from player miscrit data
            const baseStatRating = miscrit[playerKey] || 1;
            
            // Get metadata stat level from miscrits.json
            const metadataStatLevel = miscritInfo[metadataKey] || "Weak";
            const metadataStatValue = starMap[metadataStatLevel] || 1;
            
            // Get bonus from training (bonus fields use 'b' suffix: hb, sb, eb, db, pb, pdb)
            const bonusKey = `${playerKey}b`;
            const bonus = miscrit[bonusKey] || 0;
            
            // Calculate total stat using the game's formula
            let value;
            if (playerKey === "h") {  // HP uses different formula
                // HP formula: ((12 + metadata_value * 2 + base_rating * 1.5) / 5) * level + 10 + bonus
                const globalValue = (12 + metadataStatValue * 2 + baseStatRating * 1.5) / 5;
                value = Math.floor(level * globalValue + 10);
            } else {
                // Other stats formula: ((3 + metadata_value * 2 + base_rating * 1.5) / 6) * level + 5 + bonus
                const globalValue = (3 + metadataStatValue * 2 + baseStatRating * 1.5) / 6;
                value = Math.floor(level * globalValue + 5);
            }
            
            // Add training bonus
            value += bonus;
            totalStats[playerKey] = value;
        }
        
        return totalStats;
    }

    /**
     * Apply filter to the miscrit list and regenerate the display
     */
    applyFilter(modal, allMiscrits, filterType) {
        // Filter the miscrits based on the selected criteria
        const filteredMiscrits = allMiscrits.filter(miscrit => 
            this.matchesFilter(miscrit, filterType)
        );

        // Regenerate the miscrit HTML
        let miscritsHtml = '';
        filteredMiscrits.forEach((miscrit, index) => {
            const isOnTeam = miscrit.teamplayer_id ? ' <span style="color: #ffd700;">🏆</span>' : '';
            const isFavorited = miscrit.fav ? ' <span style="color: #ff6b6b;">⭐</span>' : '';
            const rarityClass = this.getRarityColorClass(miscrit.rarity);
            const borderColor = `var(--rarity-${miscrit.rarity.toLowerCase()})`;
            
            miscritsHtml += `
                <div class="miscrit-card" style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid ${borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    
                    <!-- Level Badge -->
                    <div class="col-level" style="margin-right: 16px;">
                        <div style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            Lv.${miscrit.l || 1}
                        </div>
                    </div>
                    
                    <!-- Element Icon -->
                    <div class="col-element" style="margin-right: 12px; display: flex; align-items: center; justify-content: center; width: 24px;">
                        <img src="${miscrit.elementImageUrl}" alt="${miscrit.element}" style="width: 24px; height: 24px;" onerror="this.style.display='none';">
                    </div>
                    
                    <!-- Rating Badge -->
                    <div class="col-rating" style="margin-right: 12px;">
                        <div class="rating-badge rating-${miscrit.rating.toLowerCase().replace('+', 'plus').replace('-', 'minus')}" style="padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; min-width: 45px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            ${miscrit.rating}
                        </div>
                    </div>
                    
                    <!-- Rarity Badge -->
                    <div class="col-rarity" style="margin-right: 12px;">
                        <div class="rarity-badge rarity-${miscrit.rarity.toLowerCase()}" style="padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 12px; text-align: center; min-width: 70px; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
                            ${miscrit.rarity}
                        </div>
                    </div>
                    
                    <!-- Miscrit Image -->
                    <div class="col-image" style="width: 60px; height: 60px; margin-right: 16px; position: relative;">
                        <img src="${miscrit.imageUrl}" alt="${miscrit.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; background: var(--bg-primary);" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div style="width: 60px; height: 60px; background: var(--bg-primary); border-radius: 8px; display: none; align-items: center; justify-content: center; color: var(--text-muted); font-size: 10px; text-align: center;">No<br>Image</div>
                    </div>
                    
                    <!-- Name -->
                    <div class="col-name" style="min-width: 140px; margin-right: 16px;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-weight: bold; font-size: 16px; color: var(--text-primary);">${miscrit.displayName}</span>
                            ${isOnTeam}${isFavorited}
                        </div>
                    </div>
                    
                    <!-- Base Form -->
                    <div class="col-base-name" style="min-width: 140px; margin-right: 16px;">
                        <span style="font-weight: bold; font-size: 16px; color: var(--text-secondary);">${miscrit.baseName}</span>
                    </div>
                    
                    <!-- Stats Display -->
                    <div class="col-stats" style="min-width: 320px; background: var(--bg-primary); padding: 8px 12px; border-radius: 6px;">
                        <!-- Bonus Stats Row -->
                        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; font-size: 13px;">
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">HP</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.h || 1)};">${miscrit.hb || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">SPD</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.s || 1)};">${miscrit.sb || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">EA</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.e || 1)};">${miscrit.eb || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">PA</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.p || 1)};">${miscrit.pb || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">ED</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.d || 1)};">${miscrit.db || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">PD</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.pd || 1)};">${miscrit.pdb || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Update the modal content
        const miscritsList = modal.querySelector('.miscrits-list');
        if (miscritsList) {
            miscritsList.innerHTML = miscritsHtml;
        }

        // Update the header to show filtered count
        const modalHeader = modal.querySelector('.modal-header h3');
        if (modalHeader) {
            const totalCount = allMiscrits.length;
            const filteredCount = filteredMiscrits.length;
            if (filterType === 'none') {
                modalHeader.textContent = `My Miscrits Collection (${totalCount} total)`;
            } else {
                modalHeader.textContent = `My Miscrits Collection (${filteredCount} of ${totalCount} shown)`;
            }
        }

        // Reapply column visibility settings
        const columnCheckboxes = {
            'show-image': '.col-image',
            'show-name': '.col-name',
            'show-base-name': '.col-base-name',
            'show-level': '.col-level',
            'show-rarity': '.col-rarity',
            'show-element': '.col-element',
            'show-rating': '.col-rating',
            'show-stats': '.col-stats'
        };

        Object.keys(columnCheckboxes).forEach(checkboxId => {
            const checkbox = modal.querySelector(`#${checkboxId}`);
            const columnClass = columnCheckboxes[checkboxId];
            
            if (checkbox && !checkbox.checked) {
                const columns = modal.querySelectorAll(columnClass);
                columns.forEach(column => {
                    column.style.display = 'none';
                });
            }
        });
    }

    /**
     * Get miscrit info from miscrits.json using mId
     */
    getMiscritInfoFromId(miscritId) {
        const miscrit = this.miscrits.find(m => m.id === miscritId);
        if (miscrit) {
            // Use the names array if available, fallback to name property
            const primaryName = miscrit.names?.[0] || miscrit.name || `Unknown_${miscritId}`;
            const normalizedName = primaryName.toLowerCase().replace(/\s+/g, '_');
            
            return {
                name: primaryName,
                rarity: miscrit.rarity || 'Common',
                element: miscrit.element || 'Unknown',
                imageUrl: `https://cdn.worldofmiscrits.com/avatars/${normalizedName}_avatar.png`,
                elementImageUrl: miscrit.element ? `https://worldofmiscrits.com/${miscrit.element.toLowerCase()}.png` : ''
            };
        }
        return {
            name: `Unknown_${miscritId}`,
            rarity: 'Common',
            element: 'Unknown',
            imageUrl: '',
            elementImageUrl: ''
        };
    }

    /**
     * Get miscrit info from miscrits.json using name
     */
    getMiscritInfoFromName(miscritName) {
        // Handle undefined, null, or empty names
        if (!miscritName || typeof miscritName !== 'string') {
            return null;
        }
        
        const miscrit = this.miscrits.find(m => {
            // Check if the name matches any of the miscrit's names
            if (m.names && Array.isArray(m.names)) {
                return m.names.some(name => name && name.toLowerCase() === miscritName.toLowerCase());
            }
            // Fallback to checking the name property
            return (m.name || '').toLowerCase() === miscritName.toLowerCase();
        });
        
        if (miscrit) {
            return {
                id: miscrit.id,
                name: miscrit.names?.[0] || miscrit.name || `Unknown_${miscrit.id}`,
                rarity: miscrit.rarity || 'Common',
                element: miscrit.element || 'Unknown'
            };
        }
        return null;
    }

    /**
     * Get miscrit name from miscrits.json using mId (legacy method)
     */
    getMiscritNameFromId(miscritId) {
        const miscritInfo = this.getMiscritInfoFromId(miscritId);
        return miscritInfo.name;
    }

    /**
     * Get CSS class for stat count based on count value
     */
    getStatCountClass(count, overallStatus) {
        if (count > 0) {
            return 'stat-count-green';  // Green for any count > 0
        } else {
            return 'stat-count-red';    // Red for count = 0
        }
    }

    /**
     * Get rarity color class for styling
     */
    getRarityColorClass(rarity) {
        const rarityMap = {
            'Common': 'rarity-common',
            'Rare': 'rarity-rare', 
            'Epic': 'rarity-epic',
            'Exotic': 'rarity-exotic',
            'Legendary': 'rarity-legendary'
        };
        return rarityMap[rarity] || 'rarity-common';
    }

    async tryRestoreSession() {
        try {
            // Initialize API if not already done
            if (!this.miscritsApi) {
                this.miscritsApi = new MiscritsAPI();
            }
            
            // Try to restore session
            const restored = await this.miscritsApi.restoreSession();
            
            if (restored) {
                
                // Try to get player data (fetches fresh from server)
                try {
                    this.playerData = await this.miscritsApi.getPlayerData();
                    this.isLoggedIn = true;
                    this.updateLoginUI();
                    
                } catch (error) {
                    console.warn('[MiscritsApp] Failed to get player data with restored session:', error);
                    // Session might be invalid, clear it
                    this.miscritsApi.logout();
                    this.isLoggedIn = false;
                    this.updateLoginUI();
                }
            } else {
            }
        } catch (error) {
            console.warn('[MiscritsApp] Session restoration failed:', error);
        }
    }

    setupLoginEventListeners() {
        // Login button - we'll handle state changes in the click handler
        const loginBtn = document.getElementById('login-btn');
        loginBtn.addEventListener('click', () => {
            if (this.isLoggedIn) {
                this.handleLogout();
            } else {
                this.showLoginModal();
            }
        });

        // My Miscrits button
        const rawResponseBtn = document.getElementById('raw-response-btn');
        rawResponseBtn.addEventListener('click', () => this.showMyMiscrits());

        // My Collection button
        const collectionBtn = document.getElementById('collection-btn');
        collectionBtn.addEventListener('click', () => this.showMiscritCollection());

        // Login form submission
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));

        // Modal close handlers
        const loginModal = document.getElementById('login-modal');
        const closeBtn = loginModal.querySelector('.modal-close');
        const cancelBtn = loginModal.querySelector('.cancel-btn');

        closeBtn.addEventListener('click', () => this.hideLoginModal());
        cancelBtn.addEventListener('click', () => this.hideLoginModal());

        // Close modal when clicking outside
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                this.hideLoginModal();
            }
        });
    }

    showLoginModal() {
        const modal = document.getElementById('login-modal');
        modal.style.display = 'block';
        
        // Clear previous status
        const status = document.getElementById('login-status');
        status.style.display = 'none';
        status.className = '';
        
        // Focus on email field
        document.getElementById('login-email').focus();
    }

    hideLoginModal() {
        const modal = document.getElementById('login-modal');
        modal.style.display = 'none';
        
        // Clear form
        document.getElementById('login-form').reset();
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const status = document.getElementById('login-status');
        
        // Show loading state
        status.style.display = 'block';
        status.className = '';
        status.textContent = 'Logging in...';
        
        try {
            // Initialize API if not already done
            if (!this.miscritsApi) {
                this.miscritsApi = new MiscritsAPI();
            }
            
            // Authenticate
            await this.miscritsApi.authenticate(email, password);
            
            // Get player data
            this.playerData = await this.miscritsApi.getPlayerData();
            
            // Update UI
            this.isLoggedIn = true;
            this.updateLoginUI();
            
            // Show success
            status.className = 'success';
            status.textContent = `Login successful! Welcome, ${email}`;
            
            // Hide modal after a short delay
            setTimeout(() => {
                this.hideLoginModal();
            }, 1500);
            
        } catch (error) {
            console.error('Login failed:', error);
            status.className = 'error';
            status.textContent = `Login failed: ${error.message}`;
        }
    }

    updateLoginUI() {
        const loginBtn = document.getElementById('login-btn');
        const rawResponseBtn = document.getElementById('raw-response-btn');
        const collectionBtn = document.getElementById('collection-btn');
        const ownershipFilterGroup = document.getElementById('ownership-filter-group');
        
        if (this.isLoggedIn) {
            loginBtn.textContent = 'Logout';
            rawResponseBtn.style.display = 'inline-block';
            collectionBtn.style.display = 'inline-block';
            if (ownershipFilterGroup) {
                ownershipFilterGroup.style.display = 'block';
            }
            
            // Show user info if available
            if (this.playerData && this.playerData.username) {
                loginBtn.title = `Logged in as: ${this.playerData.username}`;
            }
        } else {
            loginBtn.textContent = 'Login';
            loginBtn.title = 'Click to login';
            rawResponseBtn.style.display = 'none';
            collectionBtn.style.display = 'none';
            if (ownershipFilterGroup) {
                ownershipFilterGroup.style.display = 'none';
            }
            
            // Reset ownership filter when logging out
            const ownershipFilter = document.getElementById('ownership-filter');
            if (ownershipFilter) {
                ownershipFilter.value = '';
            }
        }
        
        // Re-filter miscrits to account for ownership changes
        this.filterMiscrits();
    }

    handleLogout() {
        if (this.miscritsApi) {
            this.miscritsApi.logout(); // This will clear the stored session
        }
        
        this.isLoggedIn = false;
        this.miscritsApi = null;
        this.playerData = null;
        this.updateLoginUI();
        alert('Logged out successfully!');
    }

    showMyMiscrits() {
        if (!this.playerData || !this.playerData.miscrits) {
            alert('No miscrits data available. Please login first.');
            return;
        }

        const miscrits = this.playerData.miscrits;

        // Process and sort miscrits
        const processedMiscrits = miscrits.map(miscrit => {
            const miscritId = miscrit.m; // NEW: miscrit ID is now 'm'
            const miscritInfo = this.getMiscritInfoFromId(miscritId);
            
            // Get the CDN miscrit data to access evolution names
            const cdnMiscrit = this.miscrits.find(m => m.id === miscritId);
            const baseName = cdnMiscrit && cdnMiscrit.names && cdnMiscrit.names.length > 0 
                ? cdnMiscrit.names[0] // Always use the first name (base form)
                : miscritInfo.name; // Fallback to primary name
            
            // Calculate total stats using the game's formula
            const totalStats = this.calculateTotalStats(miscrit, miscritInfo);
            
            return {
                ...miscrit,
                name: miscritInfo.name,
                displayName: miscrit.n || miscritInfo.name, // NEW: nickname is now 'n'
                baseName: baseName, // Base evolution name (always first form)
                rarity: miscritInfo.rarity,
                element: miscritInfo.element,
                rating: this.calculateMiscritRating(miscrit),
                statTotal: (miscrit.h || 1) + (miscrit.s || 1) + (miscrit.e || 1) + 
                          (miscrit.d || 1) + (miscrit.p || 1) + (miscrit.pd || 1), // NEW: shortened stat names
                totalStats: totalStats, // Calculated total stats
                imageUrl: miscritInfo.imageUrl,
                elementImageUrl: miscritInfo.elementImageUrl
            };
        });

        // Sort by rarity first, then by rating
        const rarityOrder = ['Legendary', 'Exotic', 'Epic', 'Rare', 'Common'];
        const ratingOrder = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F+', 'F', 'F-', 'Unknown'];
        
        processedMiscrits.sort((a, b) => {
            // Sort by rarity first
            const rarityDiff = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
            if (rarityDiff !== 0) return rarityDiff;
            
            // Then by rating
            const ratingDiff = ratingOrder.indexOf(a.rating) - ratingOrder.indexOf(b.rating);
            if (ratingDiff !== 0) return ratingDiff;
            
            // Finally by level (descending)
            return (b.level || 1) - (a.level || 1);
        });

        // Generate rating summary
        const ratingCounts = {};
        processedMiscrits.forEach(miscrit => {
            ratingCounts[miscrit.rating] = (ratingCounts[miscrit.rating] || 0) + 1;
        });

        // Create the modal
        const miscritModal = document.createElement('div');
        miscritModal.className = 'modal';
        miscritModal.style.display = 'block';
        
        let summaryHtml = '<div class="rating-summary" style="margin-bottom: 24px; padding: 16px; background: linear-gradient(135deg, var(--bg-primary), var(--bg-secondary)); border-radius: 12px; border: 1px solid var(--border-color);"><h4 style="margin-bottom: 12px; color: var(--accent-primary);">📊 Rating Distribution</h4><div style="display: flex; flex-wrap: wrap; gap: 6px;">';
        
        for (const rating of ratingOrder) {
            if (ratingCounts[rating]) {
                const count = ratingCounts[rating];
                const percentage = (count / miscrits.length * 100).toFixed(1);
                summaryHtml += `<span class="rating-badge rating-${rating.toLowerCase().replace('+', 'plus').replace('-', 'minus')}">${rating}: ${count} (${percentage}%)</span>`;
            }
        }
        summaryHtml += '</div></div>';

        // Add column visibility controls
        let columnControlsHtml = `
            <div class="column-controls" style="margin-bottom: 16px; padding: 12px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
                <h4 style="margin-bottom: 8px; color: var(--accent-primary);">👁️ Column Visibility</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-image" checked style="margin-right: 6px;"> Image
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-name" checked style="margin-right: 6px;"> Name
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-base-name" checked style="margin-right: 6px;"> Base Form
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-level" checked style="margin-right: 6px;"> Level
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-rarity" checked style="margin-right: 6px;"> Rarity
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-element" checked style="margin-right: 6px;"> Element
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-rating" checked style="margin-right: 6px;"> Rating
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-stats" checked style="margin-right: 6px;"> Stats
                    </label>
                </div>
            </div>
            
            <div class="filter-controls" style="margin-bottom: 16px; padding: 12px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
                <h4 style="margin-bottom: 8px; color: var(--accent-primary);">🔍 Filters</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="filter" value="none" checked style="margin-right: 6px;"> Show All
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="filter" value="s-plus" style="margin-right: 6px;"> S+ Only
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="filter" value="red-spd-only" style="margin-right: 6px;"> Red SPD, Rest Green
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="filter" value="red-spd-one-white" style="margin-right: 6px;"> Red SPD + 1 White, Rest Green
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="radio" name="filter" value="red-spd-one-red" style="margin-right: 6px;"> Red SPD + 1 Other Red, Rest Green
                    </label>
                </div>
            </div>
        `;

        let miscritsHtml = '';
        processedMiscrits.forEach((miscrit, index) => {
            const isOnTeam = miscrit.teamplayer_id ? ' <span style="color: #ffd700;">🏆</span>' : '';
            const isFavorited = miscrit.fav ? ' <span style="color: #ff6b6b;">⭐</span>' : '';
            const rarityClass = this.getRarityColorClass(miscrit.rarity);
            const borderColor = `var(--rarity-${miscrit.rarity.toLowerCase()})`;
            
            miscritsHtml += `
                <div class="miscrit-card" style="display: flex; align-items: center; padding: 12px; margin-bottom: 8px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid ${borderColor}; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    
                    <!-- Level Badge -->
                    <div class="col-level" style="margin-right: 16px;">
                        <div style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            Lv.${miscrit.l || 1}
                        </div>
                    </div>
                    
                    <!-- Element Icon -->
                    <div class="col-element" style="margin-right: 12px; display: flex; align-items: center; justify-content: center; width: 24px;">
                        <img src="${miscrit.elementImageUrl}" alt="${miscrit.element}" style="width: 24px; height: 24px;" onerror="this.style.display='none';">
                    </div>
                    
                    <!-- Rating Badge -->
                    <div class="col-rating" style="margin-right: 12px;">
                        <div class="rating-badge rating-${miscrit.rating.toLowerCase().replace('+', 'plus').replace('-', 'minus')}" style="padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; min-width: 45px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            ${miscrit.rating}
                        </div>
                    </div>
                    
                    <!-- Rarity Badge -->
                    <div class="col-rarity" style="margin-right: 12px;">
                        <div class="rarity-badge rarity-${miscrit.rarity.toLowerCase()}" style="padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 12px; text-align: center; min-width: 70px; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
                            ${miscrit.rarity}
                        </div>
                    </div>
                    
                    <!-- Miscrit Image -->
                    <div class="col-image" style="width: 60px; height: 60px; margin-right: 16px; position: relative;">
                        <img src="${miscrit.imageUrl}" alt="${miscrit.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; background: var(--bg-primary);" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div style="width: 60px; height: 60px; background: var(--bg-primary); border-radius: 8px; display: none; align-items: center; justify-content: center; color: var(--text-muted); font-size: 10px; text-align: center;">No<br>Image</div>
                    </div>
                    
                    <!-- Name -->
                    <div class="col-name" style="min-width: 140px; margin-right: 16px;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-weight: bold; font-size: 16px; color: var(--text-primary);">${miscrit.displayName}</span>
                            ${isOnTeam}${isFavorited}
                        </div>
                    </div>
                    
                    <!-- Base Form -->
                    <div class="col-base-name" style="flex: 1; min-width: 140px; margin-right: 16px;">
                        <span style="font-weight: bold; font-size: 16px; color: var(--text-secondary);">${miscrit.baseName}</span>
                    </div>
                    
                    <!-- Stats Display -->
                    <div class="col-stats" style="min-width: 320px; background: var(--bg-primary); padding: 8px 12px; border-radius: 6px;">
                        <!-- Bonus Stats Row -->
                        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; font-size: 13px;">
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">HP</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.h || 1)};">${miscrit.hb || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">SPD</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.s || 1)};">${miscrit.sb || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">EA</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.e || 1)};">${miscrit.eb || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">PA</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.p || 1)};">${miscrit.pb || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">ED</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.d || 1)};">${miscrit.db || 0}</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: var(--text-muted); font-size: 10px;">PD</div>
                                <div style="font-weight: bold; color: ${this.getStatColor(miscrit.pd || 1)};">${miscrit.pdb || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        miscritModal.innerHTML = `
            <div class="modal-content" style="max-width: 98%; width: 1400px;">
                <div class="modal-header">
                    <h3>My Miscrits Collection (${miscrits.length} total)</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body" style="max-height: 85vh; overflow-y: auto;">
                    ${summaryHtml}
                    ${columnControlsHtml}
                    <div class="miscrits-list">${miscritsHtml}</div>
                    <div style="margin-top: 20px; text-align: center; display: flex; gap: 10px; justify-content: center;">
                        <button id="export-miscrits-btn" class="export-btn">Export Processed Data</button>
                        <button id="export-raw-btn" class="export-btn" style="background: var(--accent-secondary);">Download Raw API Response</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(miscritModal);
        
        // Setup event handlers
        const closeBtn = miscritModal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(miscritModal);
        });
        
        miscritModal.addEventListener('click', (e) => {
            if (e.target === miscritModal) {
                document.body.removeChild(miscritModal);
            }
        });
        
        // Export button
        const exportBtn = miscritModal.querySelector('#export-miscrits-btn');
        exportBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(processedMiscrits, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'my_miscrits_processed.json';
            link.click();
            URL.revokeObjectURL(url);
        });

        // Export raw API response button
        const exportRawBtn = miscritModal.querySelector('#export-raw-btn');
        exportRawBtn.addEventListener('click', async () => {
            try {
                // Fetch fresh raw data from the API
                const session = this.miscritsApi.session;
                const response = await this.miscritsApi.client.rpc(session, 'get_player', '{}');
                
                // Save the entire raw response
                const dataStr = JSON.stringify(response, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'player_data_raw_response.json';
                link.click();
                URL.revokeObjectURL(url);
                
            } catch (error) {
                console.error('Failed to fetch raw player data:', error);
                alert('Failed to download raw data. See console for details.');
            }
        });

        // Column visibility controls
        const columnCheckboxes = {
            'show-image': '.col-image',
            'show-name': '.col-name',
            'show-base-name': '.col-base-name',
            'show-level': '.col-level',
            'show-rarity': '.col-rarity',
            'show-element': '.col-element',
            'show-rating': '.col-rating',
            'show-stats': '.col-stats'
        };

        Object.keys(columnCheckboxes).forEach(checkboxId => {
            const checkbox = miscritModal.querySelector(`#${checkboxId}`);
            const columnClass = columnCheckboxes[checkboxId];
            
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    const columns = miscritModal.querySelectorAll(columnClass);
                    columns.forEach(column => {
                        column.style.display = checkbox.checked ? '' : 'none';
                    });
                });
            }
        });

        // Filter controls
        const filterRadios = miscritModal.querySelectorAll('input[name="filter"]');
        filterRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.applyFilter(miscritModal, processedMiscrits, radio.value);
                }
            });
        });
    }

    showMiscritCollection() {
        if (!this.playerData || !this.playerData.miscrits) {
            alert('No miscrits data available. Please login first.');
            return;
        }

        // Get all unique miscrits from CDN data
        const allMiscritsMap = new Map();
        
        // Build a map of all unique miscrits by ID
        this.miscrits.forEach(miscrit => {
            if (!allMiscritsMap.has(miscrit.id)) {
                allMiscritsMap.set(miscrit.id, {
                    id: miscrit.id,
                    name: miscrit.firstName || miscrit.names?.[0] || 'Unknown',
                    element: miscrit.element,
                    rarity: miscrit.rarity || 'Common',
                    imageUrl: miscrit.imageUrl,
                    elementImageUrl: miscrit.elementImageUrl
                });
            }
        });

        // Create a map of owned miscrits by ID and rating
        const ownedRatingsMap = new Map();
        this.playerData.miscrits.forEach(playerMiscrit => {
            const rating = this.calculateMiscritRating(playerMiscrit);
            const key = `${playerMiscrit.m}_${rating}`; // NEW: miscrit ID is now 'm'
            ownedRatingsMap.set(key, true);
        });

        // Convert to array and process
        const allRatings = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F+', 'F', 'F-'];
        const allMiscrits = Array.from(allMiscritsMap.values()).map(miscrit => {
            const ratingOwnership = {};
            
            allRatings.forEach(rating => {
                const key = `${miscrit.id}_${rating}`;
                ratingOwnership[rating] = ownedRatingsMap.has(key);
            });
            
            return {
                ...miscrit,
                ratingOwnership
            };
        });

        // Sort by rarity (Legendary to Common), then by name
        const rarityOrder = ['Legendary', 'Exotic', 'Epic', 'Rare', 'Common'];
        allMiscrits.sort((a, b) => {
            const rarityDiff = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
            if (rarityDiff !== 0) return rarityDiff;
            return a.name.localeCompare(b.name);
        });

        // Create the modal
        const collectionModal = document.createElement('div');
        collectionModal.className = 'modal';
        collectionModal.style.display = 'block';

        // Calculate statistics
        const totalMiscrits = allMiscrits.length;
        const ratingStats = {};
        allRatings.forEach(rating => {
            ratingStats[rating] = { owned: 0, total: totalMiscrits };
        });

        allMiscrits.forEach(miscrit => {
            Object.entries(miscrit.ratingOwnership).forEach(([rating, owned]) => {
                if (owned) ratingStats[rating].owned++;
            });
        });

        // Filters HTML
        let filtersHtml = `
            <div class="collection-filters" style="margin-bottom: 16px; padding: 16px; background: var(--bg-primary); border-radius: 12px; border: 1px solid var(--border-color);">
                <h4 style="margin-bottom: 12px; color: var(--accent-primary);">🔍 Filters</h4>
                
                <!-- Rarity Filter -->
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 13px;">Rarity:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" class="rarity-filter" value="Legendary" checked style="margin-right: 4px;">
                            <span class="rarity-badge rarity-legendary" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; color: white;">Legendary</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" class="rarity-filter" value="Exotic" checked style="margin-right: 4px;">
                            <span class="rarity-badge rarity-exotic" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; color: white;">Exotic</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" class="rarity-filter" value="Epic" checked style="margin-right: 4px;">
                            <span class="rarity-badge rarity-epic" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; color: white;">Epic</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" class="rarity-filter" value="Rare" checked style="margin-right: 4px;">
                            <span class="rarity-badge rarity-rare" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; color: white;">Rare</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" class="rarity-filter" value="Common" checked style="margin-right: 4px;">
                            <span class="rarity-badge rarity-common" style="padding: 4px 8px; border-radius: 6px; font-size: 11px; color: white;">Common</span>
                        </label>
                    </div>
                </div>
                
                <!-- Rating Filter -->
                <div style="margin-bottom: 12px;">
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 13px;">Ratings to Display:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${allRatings.map(rating => {
                            const ratingClass = `rating-${rating.toLowerCase().replace('+', 'plus').replace('-', 'minus')}`;
                            return `
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="checkbox" class="rating-filter" value="${rating}" checked style="margin-right: 4px;">
                                    <span class="rating-badge ${ratingClass}" style="padding: 4px 8px; border-radius: 6px; font-size: 11px;">${rating}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <!-- Ownership Filter -->
                <div style="margin-bottom: 0;">
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 13px;">Show:</div>
                    <div style="display: flex; gap: 12px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="ownership-filter" value="all" checked style="margin-right: 4px;">
                            <span>All</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="ownership-filter" value="owned" style="margin-right: 4px;">
                            <span>Only Owned (in selected ratings)</span>
                        </label>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="ownership-filter" value="not-owned" style="margin-right: 4px;">
                            <span>Only Not Owned (in selected ratings)</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        // Summary HTML
        let summaryHtml = '<div class="collection-summary" style="margin-bottom: 24px; padding: 16px; background: linear-gradient(135deg, var(--bg-primary), var(--bg-secondary)); border-radius: 12px; border: 1px solid var(--border-color);"><h4 style="margin-bottom: 12px; color: var(--accent-primary);">📊 Rating Collection Progress</h4><div style="display: flex; flex-wrap: wrap; gap: 6px;">';
        
        allRatings.forEach(rating => {
            const stats = ratingStats[rating];
            if (stats.owned > 0) {
                const percentage = (stats.owned / stats.total * 100).toFixed(1);
                const ratingClass = `rating-${rating.toLowerCase().replace('+', 'plus').replace('-', 'minus')}`;
                summaryHtml += `
                    <span class="rating-badge ${ratingClass}">${rating}: ${stats.owned}/${stats.total} (${percentage}%)</span>
                `;
            }
        });
        summaryHtml += '</div></div>';

        // Build miscrit cards
        let miscritsHtml = '<div class="miscrits-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px;">';
        
        allMiscrits.forEach(miscrit => {
            const rarityClass = `rarity-${miscrit.rarity.toLowerCase()}`;
            const borderColor = `var(--rarity-${miscrit.rarity.toLowerCase()})`;
            
            // Build rating indicators
            let ratingIndicators = '<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 8px;">';
            allRatings.forEach(rating => {
                const isOwned = miscrit.ratingOwnership[rating];
                const bgColor = isOwned ? '#22c55e' : '#ef4444';
                const ratingClass = `rating-${rating.toLowerCase().replace('+', 'plus').replace('-', 'minus')}`;
                
                ratingIndicators += `
                    <div class="rating-indicator rating-badge ${ratingClass}" data-rating="${rating}" style="flex: 0 0 calc(20% - 3px); padding: 4px 2px; background: ${bgColor}; border-radius: 4px; font-size: 9px; text-align: center; color: white; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                        ${rating}
                    </div>
                `;
            });
            ratingIndicators += '</div>';

            // Calculate owned ratings for this miscrit
            const ownedRatings = allRatings.filter(r => miscrit.ratingOwnership[r]).join(',');
            const notOwnedRatings = allRatings.filter(r => !miscrit.ratingOwnership[r]).join(',');

            miscritsHtml += `
                <div class="miscrit-collection-card" data-rarity="${miscrit.rarity}" data-owned-ratings="${ownedRatings}" data-not-owned-ratings="${notOwnedRatings}" style="background: var(--bg-secondary); border-radius: 12px; padding: 12px; border-left: 4px solid ${borderColor}; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s ease, box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 4px 16px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center;">
                            <img src="${miscrit.elementImageUrl}" alt="${miscrit.element}" style="width: 20px; height: 20px; margin-right: 8px;" onerror="this.style.display='none';">
                            <span style="font-weight: bold; font-size: 14px; color: var(--text-primary);">${miscrit.name}</span>
                        </div>
                        <div class="rarity-badge ${rarityClass}" style="padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; text-align: center; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
                            ${miscrit.rarity}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: center; margin-bottom: 8px;">
                        <img src="${miscrit.imageUrl}" alt="${miscrit.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; background: var(--bg-primary);" onerror="this.style.display='none';">
                    </div>
                    ${ratingIndicators}
                </div>
            `;
        });
        
        miscritsHtml += '</div>';

        collectionModal.innerHTML = `
            <div class="modal-content" style="max-width: 98%; width: 1400px;">
                <div class="modal-header">
                    <h3>My Miscrit Collection (${totalMiscrits} unique miscrits)</h3>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body" style="overflow-y: auto;">
                    ${summaryHtml}
                    ${filtersHtml}
                    <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-primary); border-radius: 8px; border: 1px solid var(--border-color);">
                        <h4 style="margin-bottom: 8px; color: var(--accent-primary);">Legend</h4>
                        <div style="display: flex; gap: 16px; font-size: 13px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 20px; height: 20px; background: #22c55e; border-radius: 4px;"></div>
                                <span>Owned</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 20px; height: 20px; background: #ef4444; border-radius: 4px;"></div>
                                <span>Not Owned</span>
                            </div>
                        </div>
                    </div>
                    ${miscritsHtml}
                </div>
            </div>
        `;

        document.body.appendChild(collectionModal);

        // Filter function
        const applyFilters = () => {
            // Get selected rarities
            const selectedRarities = Array.from(collectionModal.querySelectorAll('.rarity-filter:checked'))
                .map(cb => cb.value);
            
            // Get selected ratings
            const selectedRatings = Array.from(collectionModal.querySelectorAll('.rating-filter:checked'))
                .map(cb => cb.value);
            
            // Get ownership filter
            const ownershipFilter = collectionModal.querySelector('input[name="ownership-filter"]:checked').value;
            
            // Filter miscrit cards
            const cards = collectionModal.querySelectorAll('.miscrit-collection-card');
            cards.forEach(card => {
                const cardRarity = card.getAttribute('data-rarity');
                const ownedRatings = card.getAttribute('data-owned-ratings').split(',').filter(r => r);
                const notOwnedRatings = card.getAttribute('data-not-owned-ratings').split(',').filter(r => r);
                
                // Check rarity filter
                const passesRarityFilter = selectedRarities.includes(cardRarity);
                
                // Check ownership filter
                let passesOwnershipFilter = true;
                if (ownershipFilter === 'owned') {
                    // Show only if has at least one selected rating owned
                    passesOwnershipFilter = selectedRatings.some(rating => ownedRatings.includes(rating));
                } else if (ownershipFilter === 'not-owned') {
                    // Show only if has at least one selected rating not owned
                    passesOwnershipFilter = selectedRatings.some(rating => notOwnedRatings.includes(rating));
                }
                
                // Show/hide card
                if (passesRarityFilter && passesOwnershipFilter) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
                
                // Show/hide rating indicators based on selected ratings
                const ratingIndicators = card.querySelectorAll('.rating-indicator');
                ratingIndicators.forEach(indicator => {
                    const rating = indicator.getAttribute('data-rating');
                    if (selectedRatings.includes(rating)) {
                        indicator.style.display = '';
                    } else {
                        indicator.style.display = 'none';
                    }
                });
            });
        };

        // Setup event handlers
        const closeBtn = collectionModal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(collectionModal);
        });

        collectionModal.addEventListener('click', (e) => {
            if (e.target === collectionModal) {
                document.body.removeChild(collectionModal);
            }
        });
        
        // Add filter event listeners
        const rarityFilters = collectionModal.querySelectorAll('.rarity-filter');
        rarityFilters.forEach(filter => {
            filter.addEventListener('change', applyFilters);
        });
        
        const ratingFilters = collectionModal.querySelectorAll('.rating-filter');
        ratingFilters.forEach(filter => {
            filter.addEventListener('change', applyFilters);
        });
        
        const ownershipFilters = collectionModal.querySelectorAll('input[name="ownership-filter"]');
        ownershipFilters.forEach(filter => {
            filter.addEventListener('change', applyFilters);
        });
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MiscritsApp();
});
