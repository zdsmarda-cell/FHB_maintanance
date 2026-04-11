const fetch = require('node-fetch');
async function test() {
    const res = await fetch('http://localhost:3000/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "Doplnění přívodního kabelu" })
    });
    const text = await res.text();
    console.log(text);
}
test();
