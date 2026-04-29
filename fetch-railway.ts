import http from 'http';
import https from 'https';

https.get('https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://instaboostpro-production-f35c.up.railway.app&relation=delegate_permission/common.handle_all_urls', (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('BODY:', data));
}).on('error', err => console.error(err));
