# 🗺️ Miscrits Interactive Map & Guide

A comprehensive, feature-rich web application for exploring Miscrits locations with interactive maps, availability tracking, and advanced filtering. Perfect for both casual players and dedicated collectors!

## ✨ Key Features

### 🎯 Interactive Maps
- **Pan & Zoom**: Full pan and zoom functionality (50%-1000%) with smooth controls
- **Clickable Markers**: Interactive markers showing Miscrit locations on detailed map images
- **Multiple Marker Support**: Single markers for individual Miscrits, grouped markers for multiple catches
- **Visual Feedback**: Markers jump to top when clicked for better visibility
- **Right-Click Creation**: Admin mode allows creating new markers with right-click

### 📅 Day-of-Week Availability
- **Weekly Schedules**: Track which days each Miscrit can be caught
- **Visual Indicators**: Color-coded day indicators on each Miscrit tile
- **Current Day Highlighting**: Glowing outline shows the currently selected day
- **Smart Filtering**: Filter by specific days or "Today" (automatically detected via GMT+0)
- **Real-Time Updates**: Day indicators update automatically with filter changes

### 🔧 Admin Mode System
- **Protected Access**: Warning modal prevents accidental edits
- **Marker Management**: Create, edit, and delete markers with visual feedback
- **Data Export/Import**: Export all data including markers and availability schedules
- **Dual Data Sources**: Switch between local storage and JSON file data
- **Clear Functions**: Clear all markers or availability data with confirmation
- **Persistent State**: Admin mode persists through page refreshes

### 🕐 Real-Time Information
- **GMT+0 Clock**: Live clock display showing current GMT+0 time
- **Day Countdown**: Shows time remaining until end of current day
- **Auto-Updates**: Time display updates every second
- **Dynamic Filtering**: "Today" filter automatically adjusts to current GMT+0 day

### 🔍 Advanced Filtering System
- **Multi-Layer Filters**: Location, Area, Rarity, Element, Day, and Text search
- **Smart Area Detection**: Area filter updates based on selected location
- **Day-Based Filtering**: Show only Miscrits available on selected days
- **Real-Time Search**: Instant filtering as you type
- **Comprehensive Coverage**: Filters affect both tiles and map markers

### 📱 Modern Interface
- **Dark Theme**: Eye-friendly dark interface with accent colors
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Smooth Animations**: Hover effects, transitions, and glowing indicators
- **Intuitive Controls**: Clear visual hierarchy and user-friendly interactions
- **Loading States**: Progress indicators and error handling

## 🗂️ Data Management

### Enhanced Marker Information
- **Exact Location Images**: Multiple images per marker showing precise locations
- **Additional Information**: Custom notes and details for each marker
- **Rarity Color Coding**: Visual rarity indicators on markers
- **Flexible Structure**: Support for both single and multiple Miscrit markers

### Availability Tracking
- **Per-Miscrit Schedules**: Individual availability for each Miscrit
- **Area-Specific Data**: Different schedules for different areas
- **Default Behavior**: Assumes all days available if no data specified
- **Export/Import**: Full data persistence and sharing capabilities

## � Location Coverage

### Complete Map Collection
1. **Forest** - `assets/maps/forrest.jpg`
2. **Hidden Forest** - `assets/maps/hidden_forrest.jpg`
3. **Mansion Attic** - `assets/maps/mansion_attic.png`
4. **Mansion Floor 1** - `assets/maps/mansion_floor_1.jpg`
5. **Mansion Floor 2** - `assets/maps/mansion_floor_2.png`
6. **Mansion Outside** - `assets/maps/mansion_outside.jpg`
7. **Moon** - `assets/maps/moon.jpg`
8. **Mountain Cave** - `assets/maps/mountain_cave.png`
9. **Mountain** - `assets/maps/mountain.jpg`
10. **Shores** - `assets/maps/shores.jpg`

### Rarity System
- **Common** (Blue) - Most frequently found
- **Rare** (Purple) - Moderately difficult to find
- **Epic** (Pink) - Challenging to locate
- **Exotic** (Yellow) - Very rare encounters
- **Legendary** (Orange) - Extremely rare finds

## 🚀 Quick Start

### Local Development
```bash
# Clone the repository
git clone [repository-url]
cd miscrits_map

# Start the development server
python serve.py

# Open your browser (auto-opens to available port)
```

### GitHub Pages Deployment
1. Upload all files to your GitHub repository
2. Enable GitHub Pages in repository settings
3. Set source to main branch
4. Access at `https://yourusername.github.io/repositoryname`

## 🔧 Admin Mode Usage

### Entering Admin Mode
1. Click "Enter Admin Mode" button
2. Confirm the warning dialog
3. Admin controls become visible

### Managing Markers
- **Create**: Right-click on map images to create new markers
- **Edit**: Left-click existing markers to modify details
- **Delete**: Use marker context menus or admin controls
- **Export**: Save all data for backup or sharing

### Data Management
- **Switch Data Sources**: Toggle between local storage and JSON file
- **Clear Data**: Remove all markers or availability data
- **Import/Export**: Full data backup and restore capabilities

## 📁 Project Structure

```
miscrits_map/
├── index.html                    # Main application interface
├── script.js                     # Core application logic (3200+ lines)
├── styles.css                    # Complete styling system (1700+ lines)
├── miscrits_data.json           # Default Miscrit and marker data
├── serve.py                     # Development server
├── assets/
│   ├── maps/                    # Location map images
│   └── miscrits/
│       └── exactLocations/      # Precise location images
└── .internal_scripts/
    └── download_exact_locations.py  # Image management automation
```

## 🛠️ Technical Implementation

### Core Technologies
- **Pure JavaScript** - No frameworks, maximum compatibility
- **CSS Grid & Flexbox** - Modern responsive layouts
- **Local Storage API** - Client-side data persistence
- **Canvas 2D Context** - Map interaction and zooming
- **Modern ES6+** - Classes, arrow functions, async/await

### Advanced Features
- **State Management** - Comprehensive application state tracking
- **Event Delegation** - Efficient event handling for dynamic content
- **Debounced Search** - Optimized real-time filtering
- **Error Boundaries** - Graceful error handling and recovery
- **Memory Management** - Efficient DOM manipulation and cleanup

### Performance Optimizations
- **Lazy Loading** - Images load only when needed
- **Virtual Scrolling** - Efficient handling of large datasets
- **Caching Strategy** - Smart data caching and invalidation
- **Minimal Reflows** - Optimized DOM updates

## 🔄 Data Sources

### Primary Data
- **miscrits.json** - Complete Miscrit database with stats and locations
- **Local Storage** - User-created markers and availability data
- **Dynamic Switching** - Seamless transition between data sources

### Image Assets
- **Map Images** - High-quality location maps (800x600px standard)
- **Miscrit Images** - Individual Miscrit artwork
- **Exact Location Images** - Precise location screenshots

## 🌐 Browser Compatibility

- ✅ **Chrome 80+** - Full feature support
- ✅ **Firefox 75+** - Complete functionality
- ✅ **Safari 13+** - All features working
- ✅ **Edge 80+** - Full compatibility
- ⚠️ **IE 11** - Limited support (no admin features)

## 🎨 Customization Options

### Theme Modifications
```css
:root {
    --bg-primary: #1a1a1a;        /* Main background */
    --bg-secondary: #2d2d2d;      /* Card backgrounds */
    --accent-primary: #4a9eff;    /* Primary accent */
    --accent-secondary: #ff6b6b;  /* Secondary accent */
    --text-primary: #ffffff;      /* Main text */
    --text-secondary: #b0b0b0;    /* Secondary text */
}
```

### Feature Configuration
- **Default Zoom Levels** - Modify min/max zoom in script.js
- **Filter Options** - Customize available filters
- **Location Order** - Adjust display order of locations
- **Marker Styles** - Customize marker appearance

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch
3. Make changes with proper testing
4. Submit pull request with detailed description

### Code Style
- Use modern JavaScript (ES6+)
- Follow existing naming conventions
- Add comments for complex logic
- Test on multiple browsers

## 📊 Statistics & Metrics

- **Total Code Lines**: 6000+ (HTML/CSS/JS combined)
- **Supported Locations**: 10+ interactive maps
- **Filter Combinations**: 100+ possible filter states
- **Data Points**: 500+ Miscrits with full metadata
- **Admin Features**: 15+ management tools

## � Future Enhancements

- **Multi-language Support** - Internationalization
- **Advanced Analytics** - Catch rate statistics
- **User Accounts** - Personal progress tracking
- **Mobile App** - Native mobile application
- **API Integration** - Real-time game data sync

## 📄 License & Credits

This project is open source under MIT License. Miscrits game content and assets are owned by their respective creators.

### Acknowledgments
- Miscrits game developers for the amazing content
- Community contributors for data and feedback
- Open source libraries and resources used

---

**🎮 Happy Miscrit hunting and mapping! ✨**
