const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static('outputdash'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Replace with your HTML file
  });

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});