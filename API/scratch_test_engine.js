const { generateCardNumber } = require('./utils/cardEngine');

for(let i=0; i<10; i++) {
    console.log(generateCardNumber());
}
