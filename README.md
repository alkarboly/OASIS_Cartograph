# OASIS Star Cluster Visualizer

A 3D interactive visualization of the OASIS star cluster from Elite Dangerous, built with Three.js and deployed on Render.com.

![OASIS Star Cluster](https://img.shields.io/badge/Elite%20Dangerous-OASIS%20Cluster-orange)
![Three.js](https://img.shields.io/badge/Three.js-r128-blue)
![Node.js](https://img.shields.io/badge/Node.js-14%2B-green)

## Features

- **3D Interactive Visualization**: Navigate through the OASIS star cluster in real-time 3D space
- **Color-Coded Systems**: Visual distinction between claimed/unclaimed systems and port completion status
- **Interactive Filters**: Toggle visibility of different system types
- **System Information**: Detailed information panels for each star system
- **Hover Effects**: Dynamic hover states with system name display
- **Responsive Design**: Works on desktop and mobile devices
- **Elite Dangerous Integration**: Real data from the OASIS colonization project

## Color Scheme

- 🟢 **Green**: Claimed systems with completed ports
- 🟠 **Orange**: Claimed systems with incomplete ports  
- 🔴 **Red**: Unclaimed systems

## Installation

### Prerequisites

- Node.js 14.0.0 or higher
- npm (comes with Node.js)

### Local Development

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd OASIS_Cartograph
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Project Structure

```
OASIS_Cartograph/
├── package.json              # Node.js dependencies and scripts
├── server.js                 # Express server configuration
├── README.md                 # This file
├── data/                     # CSV data files
│   └── OASIS Catalog - OASIS_Catalog.csv
└── public/                   # Static web assets
    ├── index.html            # Main HTML file
    ├── styles.css            # CSS styling
    └── js/                   # JavaScript modules
        ├── main.js           # Main application controller
        ├── csvParser.js      # CSV data parsing
        ├── starSystem.js     # Star system 3D objects
        ├── sceneManager.js   # Three.js scene management
        └── uiController.js   # UI interaction handling
```

## Usage

### Navigation Controls

- **Mouse**: Click and drag to rotate the view
- **Scroll**: Zoom in and out
- **Right-click + drag**: Pan the view

### Keyboard Shortcuts

- **1**: Toggle claimed systems visibility
- **2**: Toggle unclaimed systems visibility  
- **3**: Toggle port complete systems visibility
- **4**: Toggle port incomplete systems visibility
- **Escape**: Close system information panel

### Interaction

- **Hover**: Hover over a star to see its name and highlight effect
- **Click**: Click on a star to view detailed system information
- **Filters**: Use the control panel to filter visible systems
- **Statistics**: View real-time counts of different system types

## Data Format

The application reads CSV data with the following columns:

- `System Name`: Name of the star system
- `Cmdr Name`: Commander who claimed the system
- `Discord Name`: Discord username of the commander
- `Is Claimed?`: Whether the system is claimed (Yes/No)
- `Primary Port Complete?`: Whether the primary port is complete (Yes/No)
- `Coordinates`: System coordinates in "X / Y / Z" format
- `Orbital Slots`: Number of orbital construction slots
- `Planetary Slots`: Number of planetary construction slots
- `Asteroid Base Slots`: Number of asteroid base slots
- `Narrative`: Description or notes about the system
- `Inara Link`: Link to the system on Inara.cz

## Deployment

### Deploy to Render.com

1. **Create a Render account** at [render.com](https://render.com)

2. **Connect your repository**
   - Fork this repository to your GitHub account
   - Connect your GitHub account to Render
   - Create a new "Web Service" from your forked repository

3. **Configure the deployment**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
   - **Node Version**: `14` or higher

4. **Deploy**
   - Render will automatically build and deploy your application
   - Your app will be available at `https://your-app-name.onrender.com`

### Environment Variables

No environment variables are required for basic deployment. The application uses:

- `PORT`: Automatically set by Render (defaults to 3000 locally)

### Custom Domain (Optional)

To use a custom domain:

1. Go to your Render dashboard
2. Select your web service
3. Go to "Settings" → "Custom Domains"
4. Add your domain and configure DNS

## Development

### Adding New Features

1. **CSV Data**: Update the CSV file in the `data/` directory
2. **Styling**: Modify `public/styles.css` for visual changes
3. **3D Objects**: Edit `public/js/starSystem.js` for star visualization
4. **Scene Management**: Modify `public/js/sceneManager.js` for 3D scene changes
5. **UI Controls**: Update `public/js/uiController.js` for interface changes

### Performance Optimization

- The application is optimized for up to 1000 star systems
- Large datasets may require additional optimization
- Consider implementing level-of-detail (LOD) for very large clusters

## Troubleshooting

### Common Issues

1. **CSV Loading Errors**
   - Check that the CSV file is properly formatted
   - Ensure coordinates are in "X / Y / Z" format
   - Verify boolean fields use "Yes"/"No" values

2. **3D Rendering Issues**
   - Ensure WebGL is supported in your browser
   - Try disabling browser extensions that might interfere
   - Check browser console for JavaScript errors

3. **Performance Issues**
   - Reduce the number of background stars in `sceneManager.js`
   - Disable shadows for better performance on low-end devices
   - Consider reducing the coordinate scale for smaller clusters

### Browser Compatibility

- **Chrome**: Fully supported
- **Firefox**: Fully supported  
- **Safari**: Supported (may have minor visual differences)
- **Edge**: Fully supported
- **Mobile**: Supported with touch controls

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

- **Elite Dangerous**: Frontier Developments
- **Three.js**: Three.js contributors
- **OASIS Project**: Elite Dangerous community colonization effort
- **Data**: OASIS commanders and contributors

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review browser console for error messages
3. Create an issue in the repository
4. Contact the OASIS community on Discord

---

**Fly safe, Commanders! o7** 