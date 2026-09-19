const fs = require('fs');
let code = fs.readFileSync('services/invoiceEngine.js', 'utf8');

if (!code.includes('computeNextInvoiceDueDate')) {
    code = code.replace(/const \{ getDb, esc \} = require\('\.\.\/repositories\/context'\);/, 
        "const { getDb, esc } = require('../repositories/context');\nconst { computeNextInvoiceDueDate } = require('../utils/billing');"
    );
    
    code = code.replace(/const nextDueDate = new Date\(dueDate\);\s*nextDueDate\.setMonth\(nextDueDate\.getMonth\(\) \+ 1\);\s*nextDueDate\.setDate\(dueDay\);/g, 
        "let nextDueDate = new Date(dueDate);\n          nextDueDate = computeNextInvoiceDueDate(dueDay, nextDueDate);"
    );
    
    fs.writeFileSync('services/invoiceEngine.js', code, 'utf8');
}
