const fs = require('fs');
const p = 'C:/Users/user/ZCodeProject/preview-leave-premium.html';
const html = fs.readFileSync(p, 'utf8');
console.log('exists:', html.length > 0 ? 'yes' : 'no', 'length:', html.length);
