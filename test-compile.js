const http = require('http');

http.get('http://localhost:3000/en/admin/time-tracker', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.substring(0, 500)));
});
