const databricksService = require('./services/databricksService');
(async () => {
    try {
        await databricksService.executeQuery("UPDATE fintech.transactions SET amount = -ABS(amount) WHERE type = 'SHOP_CREDIT' AND amount > 0");
        console.log('Updated SHOP_CREDIT positive amounts to negative!');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
})();
