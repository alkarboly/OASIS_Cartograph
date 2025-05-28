const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the CSV data file
app.use('/data', express.static(path.join(__dirname, 'data')));

// Serve the main HTML file for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OASIS Star Cluster Visualizer running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`);
}); 