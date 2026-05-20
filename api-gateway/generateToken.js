import jwt from 'jsonwebtoken';
import 'dotenv/config';

// Sign a token with your secret from the .env file
const token = jwt.sign(
    { username: 'k-flux', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '365d' }
);

console.log('\n=== YOUR VIP TOKEN ===\n');
console.log(token);
console.log('\n======================\n');
