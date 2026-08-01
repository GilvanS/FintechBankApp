async function testDashboard() {
    try {
        const loginRes = await fetch('http://localhost:3000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cpf: '11111111111',
                password: '1234'
            })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log("Logged in as admin", Boolean(token));

        const dashRes = await fetch('http://localhost:3000/admin/overdue-masses-dashboard', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const dashData = await dashRes.json();
        
        console.log("Dashboard Data:");
        console.dir(dashData, { depth: null });
    } catch (err) {
        console.error("Error:", err.message);
    }
}
testDashboard();
