const http = require('http');

const data = JSON.stringify({ clockInTime: new Date().toISOString() });
console.log(data);
