const fs = require('fs');
const p = '/c/Users/user/ZCodeProject/preview-leave-premium.html';
fs.writeFileSync(p, fs.readFileSync(p, 'utf8') || '');
console.log('placeholder');
