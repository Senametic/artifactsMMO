const CHARACTER_NAME = "ethanol";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhbWluZ3dpdGhlaXRoYW5AZ21haWwuY29tIiwicGFzc3dvcmRfY2hhbmdlZCI6bnVsbH0.Ai8mlBeQDZZMifDTmMonGnMI8zgNJm6w8_QYKUed4iY";


const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
};

async function action(url, body) {
    try {
        const response = await fetch(url, {method: `POST`, headers: headers, body: body});
        const data = await response.json();
        if (!response.ok) {
            console.error("HTTP error:", response.status, response.statusText);
            console.log(await response.text());
            return;
        }
        console.log(data);
        const {cooldown} = data.data;
        await sleep(cooldown.total_seconds);
    } catch (error) {
        console.error(error);
    }
}

function sleep(seconds) {
    console.log(`⏳ Cooldown started: ${seconds} seconds`);
    return new Promise(resolve => { setTimeout(resolve, seconds * 1000); });
}

async function move(x,y) {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/move';
    const body = JSON.stringify({ x, y });
    //console.log(`Moved to [${x}, ${y}]`)
    await action(url, body);
}

async function check_IfTaskTaken() {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/task/complete';
    awaitaction(url, body)
}
async function check_IfTaskComplete() {

}
async function accept_NewTask() {
    const url = 'https://api.artifactsmmo.com/my/ethanol/action/task/new';
    awaitaction(url, body)


}
async function main() {
    while (true) {
        await move(0, 4);
    }
}
await main();