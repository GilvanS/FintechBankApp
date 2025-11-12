// Basic Express Server Placeholder

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Basic Route for testing
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', message: 'Fintech Bank API is running.' });
});


// TODO: Implement all the routes defined in swagger.yaml
// e.g., /auth/signup, /auth/login, /user/me/{cpf}, etc.


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
