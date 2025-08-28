// Miscrits Map - JavaScript Logic

class MiscritsApp {
    constructor() {
        this.miscrits = [];
        this.filteredMiscrits = [];
        this.isAdminMode = false;
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
            this.processMiscrits();
            this.renderMiscrits();
            this.initializeTimeDisplay();
            this.hideLoading();
        } catch (error) {
            this.showError(error.message);
        }
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
                console.log('miscrits_data.json not found, using local storage only');
                this.cachedJsonData = null;
            }
        } catch (error) {
            console.log('Failed to load miscrits_data.json:', error.message);
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
            this.reloadAllMarkers();
        });
        
        searchFilter.addEventListener('input', () => this.filterMiscrits());

        // Admin mode button
        const adminModeBtn = document.getElementById('admin-mode-btn');
        adminModeBtn.addEventListener('click', () => this.showAdminModeWarning());

        // Export data button (only visible in admin mode)
        const exportBtn = document.getElementById('export-data-btn');
        exportBtn.addEventListener('click', () => this.exportData());

        // Clear all markers button (only visible in admin mode)
        const clearBtn = document.getElementById('clear-markers-btn');
        clearBtn.addEventListener('click', () => this.showClearMarkersConfirmation());

        // Clear all dates button (only visible in admin mode)
        const clearDatesBtn = document.getElementById('clear-dates-btn');
        clearDatesBtn.addEventListener('click', () => this.showClearDatesConfirmation());

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

        // Initialize data source
        this.initializeDataSource();
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

    getLocationInfo(miscrit) {
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
            const areaNumbers = Object.keys(areas).sort((a, b) => parseInt(a) - parseInt(b));
            
            if (areaNumbers.length === 0) {
                // No specific areas, just the location name
                locationStrings.push(locationName === 'Hidden Forest' ? 'The Hidden Forest' : locationName);
            } else if (areaNumbers.length === 1) {
                // Single area
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
        
        return { text: locationStrings.join('\n\n'), isClickable: false };
    }

    filterMiscrits() {
        const locationFilter = document.getElementById('location-filter').value;
        const areaFilter = document.getElementById('area-filter').value;
        const rarityFilter = document.getElementById('rarity-filter').value;
        const elementFilter = document.getElementById('element-filter').value;
        const dayFilter = document.getElementById('day-filter').value;
        const searchFilter = document.getElementById('search-filter').value.toLowerCase();

        // Get current day in GMT+0 for "today" filter
        const currentDay = this.getCurrentGMTDay();

        this.filteredMiscrits = this.miscrits.filter(miscrit => {
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

            return matchesLocation && matchesArea && matchesRarity && matchesElement && matchesSearch && matchesDay;
        });

        this.renderMiscrits();
        this.updateStats();
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
        
        // If no custom availability data exists, assume available all days
        if (!miscritData) {
            return true;
        }

        // Check if miscrit is available on the target day in any location/area
        return Object.values(miscritData).some(days => {
            return days && days.includes(targetDay);
        });
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
        
        // Render each location section
        this.locationOrder.forEach(location => {
            if (groupedByLocation[location] && groupedByLocation[location].length > 0) {
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
            'Moon': 'assets/maps/moon.jpg'
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
        return miscrits.reduce((groups, miscrit) => {
            if (!miscrit.currentLocationAreas || Object.keys(miscrit.currentLocationAreas).length === 0) {
                // Handle miscrits without specific areas
                if (location === 'Hidden Forest') {
                    if (!groups['no-area']) groups['no-area'] = [];
                    groups['no-area'].push(miscrit);
                }
                return groups;
            }

            // Add miscrit to each area it appears in
            Object.keys(miscrit.currentLocationAreas).forEach(area => {
                if (!groups[area]) {
                    groups[area] = [];
                }
                groups[area].push(miscrit);
            });

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
                console.log('Location details for:', miscrit.firstName, miscrit.locations);
                // Future: Show detailed location modal
            });
        }

        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(elementDiv);
        card.appendChild(locationDiv);

        // Add availability information if custom data exists
        this.addAvailabilityInfoToCard(card, miscrit);

        // Add click event for future expansion (modal, details, etc.)
        card.addEventListener('click', () => {
            console.log('Clicked miscrit:', miscrit);
            // Future: Show detailed modal with all evolutions, stats, etc.
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
        
        console.log(`Updated availability for ${miscrit.firstName}`, availabilityData[miscrit.id]);
    }

    getMiscritAvailabilityData() {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'local';
        
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
            // Find the first area with custom availability, or use default
            const firstAreaKey = Object.keys(miscritData)[0];
            if (firstAreaKey && miscritData[firstAreaKey]) {
                availableDays = miscritData[firstAreaKey];
            }
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

        console.log(`Found ${locationMiscrits.length} miscrits for location: ${location}`, locationMiscrits);

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
            daysOfWeek: [], // Default to no days selected
            timestamp: Date.now()
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

        console.log(`Added ${miscrit.firstName} to ${location} at position ${x}%, ${y}%`);
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
                imageUrl: `https://cdn.worldofmiscrits.com/avatars/${miscrit.firstName.toLowerCase().replace(/\s+/g, '_')}_avatar.png`,
                daysOfWeek: [] // Default to no days selected
            })),
            exactLocationImages: customUrl ? [customUrl] : [], // Array of exact location images
            additionalInformation: '', // Additional information about this marker
            timestamp: Date.now(),
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

        console.log(`Added ${miscrits.length} miscrits to ${location} at position ${x}%, ${y}%`);
    }

    createMarkerElement(marker, imageContainer) {
        const markerEl = document.createElement('div');
        markerEl.className = 'miscrit-marker';
        markerEl.style.position = 'absolute';
        markerEl.style.left = `${marker.x}%`;
        markerEl.style.top = `${marker.y}%`;
        markerEl.style.transform = 'translate(-50%, -100%)'; // Always anchor to bottom
        
        // Create tooltip with day information
        const days = marker.daysOfWeek || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
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

        // Add left-click to bring to top
        markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bringMarkerToTop(markerEl, imageContainer);
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

    createMultipleMarkerElement(marker, imageContainer) {
        const markerEl = document.createElement('div');
        markerEl.className = 'miscrit-marker multiple-marker';
        markerEl.style.position = 'absolute';
        markerEl.style.left = `${marker.x}%`;
        markerEl.style.top = `${marker.y}%`;
        markerEl.style.transform = 'translate(-50%, -100%)'; // Always anchor to bottom
        
        // Create tooltip with day information for each miscrit
        const miscritInfo = marker.miscrits.map(m => {
            const days = m.daysOfWeek || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
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

        // Add left-click to bring to top
        markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.bringMarkerToTop(markerEl, imageContainer);
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
            <div class="context-menu-item" data-action="edit-days">
                <span class="context-icon">📅</span> Edit Days
            </div>
            <div class="context-menu-item" data-action="move">
                <span class="context-icon">🔄</span> Move
            </div>
            <div class="context-menu-item" data-action="edit-info">
                <span class="context-icon">ℹ️</span> Edit Info
            </div>
            <div class="context-menu-item" data-action="remove">
                <span class="context-icon">🗑️</span> Remove
            </div>
        `;

        document.body.appendChild(contextMenu);

        // Add event listeners
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            
            if (action === 'edit-days') {
                this.showEditDaysModal(marker, markerElement);
            } else if (action === 'move') {
                this.startMoveMode(marker, markerElement, imageContainer);
            } else if (action === 'edit-info') {
                this.showEditMarkerInfoModal(marker, markerElement);
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
                m.timestamp === marker.timestamp
            );
            if (markerIndex !== -1) {
                markers[marker.location][markerIndex] = marker;
                localStorage.setItem('miscritMarkers', JSON.stringify(markers));
            }
        }

        console.log(`Moved ${marker.miscritName} from ${oldX}%, ${oldY}% to ${newX}%, ${newY}%`);
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
            <div class="context-menu-item" data-action="edit-days">
                <span class="context-icon">📅</span> Edit Days
            </div>
            <div class="context-menu-item" data-action="move">
                <span class="context-icon">🔄</span> Move
            </div>
            <div class="context-menu-item" data-action="edit-info">
                <span class="context-icon">ℹ️</span> Edit Info
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
            } else if (action === 'edit-days') {
                this.showEditDaysModal(marker, markerElement);
            } else if (action === 'move') {
                this.startMultipleMoveMode(marker, markerElement, imageContainer);
            } else if (action === 'edit-info') {
                this.showEditMarkerInfoModal(marker, markerElement);
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
                m.timestamp === marker.timestamp
            );
            if (markerIndex !== -1) {
                markers[marker.location][markerIndex] = marker;
                localStorage.setItem('miscritMarkers', JSON.stringify(markers));
            }
        }

        const markerName = marker.isMultiple 
            ? marker.miscrits.map(m => m.miscritName).join(', ')
            : marker.miscritName;
        console.log(`Updated info for marker: ${markerName}`);
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
                m.timestamp === marker.timestamp
            );
            if (markerIndex !== -1) {
                markers[marker.location][markerIndex] = marker;
                localStorage.setItem('miscritMarkers', JSON.stringify(markers));
            }
        }

        const markerName = marker.isMultiple 
            ? marker.miscrits.map(m => m.miscritName).join(', ')
            : marker.miscritName;
        console.log(`Updated days for ${markerName}`);
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
                    m.timestamp !== marker.timestamp
                );
                if (markers[marker.location].length === 0) {
                    delete markers[marker.location];
                }
            }
            localStorage.setItem('miscritMarkers', JSON.stringify(markers));

            // Remove visual element
            markerElement.remove();

            console.log(`Removed ${marker.miscritName} marker from ${marker.location}`);
        }
    }

    loadMiscritMarkers(location, imageContainer) {
        const markers = this.getMiscritMarkers();
        if (markers[location]) {
            const dayFilter = document.getElementById('day-filter').value;
            const currentDay = this.getCurrentGMTDay();
            
            markers[location].forEach(marker => {
                // Check if marker should be visible based on day filter
                if (this.shouldShowMarker(marker, dayFilter, currentDay)) {
                    if (marker.isMultiple) {
                        this.createMultipleMarkerElement(marker, imageContainer);
                    } else {
                        this.createMarkerElement(marker, imageContainer);
                    }
                }
            });
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
                const days = miscrit.daysOfWeek || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
                return days.includes(targetDay);
            });
        } else {
            // For single miscrit, check its availability
            const days = marker.daysOfWeek || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
            return days.includes(targetDay);
        }
    }

    getMiscritMarkers() {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'local';
        
        if (dataSource === 'json') {
            // Return from cached JSON data if available
            return this.cachedJsonData?.markers || {};
        } else {
            // Return from local storage
            const stored = localStorage.getItem('miscritMarkers');
            return stored ? JSON.parse(stored) : {};
        }
    }

    saveMiscritMarkers(markers) {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'local';
        
        if (dataSource === 'local') {
            localStorage.setItem('miscritMarkers', JSON.stringify(markers));
        } else {
            // When using JSON mode, show a warning that changes can't be saved
            console.warn('Cannot save markers in JSON mode. Switch to Local Storage mode to save changes.');
        }
    }

    saveMiscritAvailabilityData(availabilityData) {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'local';
        
        if (dataSource === 'local') {
            localStorage.setItem('miscritAvailability', JSON.stringify(availabilityData));
        } else {
            // When using JSON mode, show a warning that changes can't be saved
            console.warn('Cannot save availability data in JSON mode. Switch to Local Storage mode to save changes.');
        }
    }

    isEditingAllowed() {
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'local';
        return dataSource === 'local';
    }

    exportData() {
        const markers = this.getMiscritMarkers();
        const availabilityData = this.getMiscritAvailabilityData();
        
        const exportData = {
            markers: markers,
            miscritAvailability: availabilityData,
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
        console.log('Exported miscrits data:', exportData);
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
        
        console.log('All markers have been cleared');
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
        
        console.log('All miscrit availability data has been cleared');
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
        const dataSource = this.currentDataSource || localStorage.getItem('dataSource') || 'local';
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
        
        console.log('Admin mode activated');
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
        
        console.log('Admin mode deactivated');
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

        console.log(`Found ${locationMiscrits.length} miscrits for location: ${location}`, locationMiscrits);

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
                    m.timestamp === marker.timestamp
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
            console.log('Updated marker miscrits');
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
                    m.timestamp === marker.timestamp
                );
                if (markerIndex !== -1) {
                    markers[marker.location][markerIndex] = marker;
                    localStorage.setItem('miscritMarkers', JSON.stringify(markers));
                }
            }

            cleanup();
            console.log(`Moved multiple marker from ${originalX}%, ${originalY}% to ${x}%, ${y}%`);
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
        const savedDataSource = localStorage.getItem('dataSource') || 'local';
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
            
            console.log('Admin mode restored from previous session');
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
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MiscritsApp();
});
