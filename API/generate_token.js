require('dotenv').config();
const jwt = require('jsonwebtoken');

function generateToken(cpf) {
    return jwt.sign({ cpf }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

console.log("Token for 7777777777:", generateToken('7777777777'));
